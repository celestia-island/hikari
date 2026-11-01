// hi-components/src/basic/file_field.rs
// FileField — mirror of the canonical Vue `HkFileField`: the VISIBLE
// file-input field every "pick a file" surface draws (label + box + trigger +
// clear + native input + message line).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkFileField.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-file-*` class names are literal and
// identical in both forms. The DOM contract below mirrors the Vue render
// output one-to-one:
//
//   div.hk-file-field
//     label.hk-file-field-label [for=id]              (label && non-empty)
//       {label} span.hk-file-field-required (*)       (required)
//     div.hk-file-box [data-disabled] [data-error] [data-filled]
//       button.hk-file-trigger [id] type="button" [disabled]
//              [aria-haspopup=dialog]                  (remote mode only)
//         svg.hk-file-trigger-icon                      (file-plus glyph)
//         span.hk-file-trigger-text [data-filled]      (summary | placeholder)
//       button.hk-file-clear type="button" aria-label   (filled && !disabled)
//         svg                                           (✕ glyph)
//       input.hk-file-native type="file" [multiple] [accept] [name]
//             [disabled] tabindex=-1 aria-hidden="true" (local mode only)
//     p.hk-file-field-error                            (error wins)
//     p.hk-file-field-hint                             (else hint)
//
// Vue prop mapping: `modelValue` → [`FileFieldProps::model_value`],
// `update:modelValue` → [`FileFieldProps::on_files`], `mode` → [`FileFieldMode`],
// `accept` / `multiple` / `disabled` / `required` / `name` / `id` /
// `label` / `placeholder` / `hint` / `error` pass through under the same
// names. The two icons are the Vue inline `<svg>` markup verbatim, mounted
// through `dangerous_inner_html` on a dedicated `display:contents` host (see
// the crate-wide SVG rule below).
//
// Behaviour deltas vs Vue (each one deliberate, none silent):
//   * the selection is CONTROLLED (`model_value` + `on_files`). Vue keeps no
//     selection state either — it only emits — so this is a pure rename of
//     `update:modelValue`.
//   * VUE'S TWO PICKER PATHS COLLAPSE INTO ONE `on_pick` REQUEST. In `local`
//     mode Vue calls `nativeInputRef.click()`; in `remote` mode it flips its
//     internal `dialogOpen` ref and mounts `HkFileBrowserDialog` itself.
//     tairitsu 0.5.22 exposes no element ref + `click()` pairing and no
//     per-instance state, so the trigger only EMITS: the host opens its own
//     picker / mounts the [`crate::basic::file_browser_dialog`] dialog and
//     writes the answer back through `model_value`. The `#trigger` is still a real
//     `<button>` with the id the caption points at, so the DOM contract (and
//     a host that clicks the native input itself) is unchanged.
//   * THE BOX IS THE DROP ZONE. Vue's field has no drop path at all; here the
//     box accepts a file drop and reports the dropped NAMES through
//     `on_files` (`DataTransfer` carries names only — `tairitsu_vdom` has no
//     `File` object). This is the only way a host can hand the mirror
//     files without owning a picker. No drag-over visual state is published:
//     the mirrored sheet defines no drag marker and the component owns no
//     state to flip, so the drop lands without a hover treatment.
//   * the native `<input type="file">` stays (local mode) for hosts that do
//     drive it, but a `change` event reaches Rust as the browser's fake path
//     string only, so [`picked_files_from_change_value`] recovers the leaf
//     names from it (`C:\fakepath\a.csv` → `a.csv`) and drops the size/path
//     it cannot see. Vue reads `input.files` instead; `EventData` here has no
//     DOM file list.
//   * Vue's `useId()` has no tairitsu analogue: the caption's `for` is
//     emitted only when the caller passes `id` (the same rule the Input
//     mirror documents).
//   * the placeholder defaults resolve through `hikari_i18n::t` with the Vue
//     fallback strings, so both forms read the same copy.
//   * no client-side `accept` filtering of the picked names: Vue passes the
//     attribute to the native input and filters nothing, and the drop path
//     has no `File` type to test against.
//
// The SVG glyphs are trusted static markup mounted through
// `dangerous_inner_html` (the path `hikari_icons::Icon`, `basic::button` and
// `feedback::progress_ring` already use): tairitsu creates elements with a
// plain `createElement(localName)` (no SVG namespace), so an `svg {}` rsx
// child would land in the HTML namespace and never paint. `inner_html` also
// suppresses an element's children, so each glyph rides its own
// `display:contents` host and the visible boxes stay siblings of it.

use hikari_i18n::t;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct FileFieldComponent;

/// Which picker the trigger requests (Vue: `mode`, default `local`). The
/// mirror never opens either one itself — see the header delta.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum FileFieldMode {
    #[default]
    Local,
    Remote,
}

impl FileFieldMode {
    /// `aria-haspopup` exactly as Vue emits it: only the remote mode names a
    /// dialog, the local mode omits the attribute (`undefined`).
    pub fn aria_haspopup(self) -> Option<&'static str> {
        match self {
            FileFieldMode::Local => None,
            FileFieldMode::Remote => Some("dialog"),
        }
    }

    pub fn is_remote(self) -> bool {
        matches!(self, FileFieldMode::Remote)
    }
}

/// One picked file (Vue: `PickedFile` from `filePicker.ts`). Vue's fourth
/// field (`file?: File`) has no tairitsu analogue — this host has no DOM
/// `File` object, and the drop path carries names only.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct PickedFile {
    pub name: String,
    /// Remote absolute path (Vue: `path`).
    pub path: Option<String>,
    /// Byte size when known (Vue: `size`).
    pub size: Option<u64>,
}

/// The field's message line (Vue: `error` wins over `hint`, both truthy
/// strings only).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct FieldMessage {
    pub text: String,
    /// `true` = the error line, `false` = the hint line.
    pub is_error: bool,
}

/// Vue: `props.error ? <error/> : props.hint ? <hint/> : null` — an empty
/// string is falsy for both, so it renders no line at all. Shared with
/// [`crate::basic::file_picker_field`], which draws the same priority on its
/// own sheet classes.
pub fn field_message(error: Option<&str>, hint: Option<&str>) -> Option<FieldMessage> {
    if let Some(error) = error.filter(|text| !text.is_empty()) {
        return Some(FieldMessage {
            text: error.to_string(),
            is_error: true,
        });
    }
    hint.filter(|text| !text.is_empty())
        .map(|hint| FieldMessage {
            text: hint.to_string(),
            is_error: false,
        })
}

/// Vue's `summary` computed: one name as-is, several as `"first +N"`.
pub fn selection_summary(files: &[PickedFile]) -> String {
    match files.len() {
        0 => String::new(),
        1 => files[0].name.clone(),
        count => format!("{} +{}", files[0].name, count - 1),
    }
}

/// Vue's `placeholderText` computed. The caller's `placeholder` wins only
/// when it is a TRUE string (Vue tests `if (props.placeholder)`, not
/// `??` — an empty string falls through to the localized default).
pub fn file_field_placeholder(
    mode: FileFieldMode,
    multiple: bool,
    placeholder: Option<&str>,
) -> String {
    if let Some(text) = placeholder.filter(|text| !text.is_empty()) {
        return text.to_string();
    }
    match (mode.is_remote(), multiple) {
        (true, true) => t(
            "hikari::filePicker.fieldChooseRemoteMany",
            "Choose remote files…",
        ),
        (true, false) => t(
            "hikari::filePicker.fieldChooseRemoteOne",
            "Choose a remote file…",
        ),
        (false, true) => t("hikari::filePicker.fieldChooseMany", "Choose files…"),
        (false, false) => t("hikari::filePicker.fieldChooseOne", "Choose a file…"),
    }
}

/// Recover the leaf names from a native `<input type="file">` change value.
/// The browser hands over a fake path (`C:\fakepath\a.csv` / `a.csv`), and a
/// `multiple` input joins selections with `,` — this is the only file channel
/// a `ChangeEvent` carries (see the header delta). `multiple: false` keeps
/// the first entry only, exactly Vue's `files.slice(0, 1)`.
pub fn picked_files_from_change_value(value: &str, multiple: bool) -> Vec<PickedFile> {
    let mut files: Vec<PickedFile> = Vec::new();
    for candidate in value.split(',') {
        let candidate = candidate.trim();
        if candidate.is_empty() {
            continue;
        }
        let name = candidate
            .rsplit(['/', '\\'])
            .next()
            .unwrap_or_default()
            .trim()
            .to_string();
        if name.is_empty() {
            continue;
        }
        files.push(PickedFile {
            name,
            path: None,
            size: None,
        });
        if !multiple {
            break;
        }
    }
    files
}

/// Cap a drop / change selection like Vue's `multiple ? files : files[0]`.
pub fn cap_selection(mut files: Vec<PickedFile>, multiple: bool) -> Vec<PickedFile> {
    if !multiple {
        files.truncate(1);
    }
    files
}

/// The file-plus trigger glyph, byte-identical to the Vue inline `<svg>`
/// (its `hk-file-trigger-icon` class rides the markup, not the host div).
const FILE_PLUS_SVG: &str = r#"<svg class="hk-file-trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>"#;

/// The clear (✕) glyph, byte-identical to the Vue inline `<svg>`.
const CLEAR_SVG: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="14" height="14" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>"#;

#[define_props]
pub struct FileFieldProps {
    /// The current selection (Vue: `modelValue`, default `[]`).
    pub model_value: Vec<PickedFile>,

    /// Which picker the trigger requests (see the header delta).
    #[default]
    pub mode: FileFieldMode,

    /// Multi-selection toggle (also the native input's `multiple`).
    #[default]
    pub multiple: bool,

    /// Native accept string (`.csv,.json`); omitted when unset.
    pub accept: Option<String>,

    /// Caption above the box (Vue: `label`).
    pub label: Option<String>,

    /// Trigger copy while empty; falls back to the localized default.
    pub placeholder: Option<String>,

    /// Secondary message line, shown only without an error.
    pub hint: Option<String>,

    /// Error ink + message line; wins over `hint`.
    pub error: Option<String>,

    #[default]
    pub disabled: bool,

    /// Appends the `*` marker to the caption.
    #[default]
    pub required: bool,

    /// `name` for the internal native input (local mode).
    pub name: Option<String>,

    /// Trigger id and the caption's `for` target (Vue generates one).
    pub id: Option<String>,

    /// Fires with the new selection — a pick, a drop, a native change, or an
    /// empty vec for the clear button (Vue: `update:modelValue`).
    pub on_files: Option<EventHandler<Vec<PickedFile>>>,

    /// Fires on a trigger press: the host opens its picker / mounts the
    /// browser dialog (see the header delta; Vue opens one internally).
    pub on_pick: Option<EventHandler<()>>,
}

#[component]
pub fn FileField(props: FileFieldProps) -> Element {
    let has_files = !props.model_value.is_empty();
    let summary = selection_summary(&props.model_value);
    let trigger_text = if has_files {
        summary
    } else {
        file_field_placeholder(props.mode, props.multiple, props.placeholder.as_deref())
    };
    // Vue truthiness: an empty caption / error is absent.
    let label_text = props.label.clone().filter(|label| !label.is_empty());
    let message = field_message(props.error.as_deref(), props.hint.as_deref());
    let has_error = props
        .error
        .as_deref()
        .is_some_and(|error| !error.is_empty());
    let disabled = props.disabled;
    let multiple = props.multiple;
    let mode = props.mode;
    let field_id = props.id.clone();
    // The caption's `for` is a CHILD of the root (evaluated after the
    // trigger's `id` attribute has consumed `field_id`), so it carries its
    // own clone.
    let label_for = field_id.clone();
    let accept = props.accept.clone();
    let name = props.name.clone();

    // Trigger: a press only REQUESTS a picker (Vue clicks its own ref).
    let on_pick = props.on_pick.clone();
    let trigger_click = move |_: MouseEvent| {
        if disabled {
            return;
        }
        if let Some(handler) = on_pick.as_ref() {
            handler.call(());
        }
    };

    // Clear: Vue emits an empty selection.
    let clear_handler = props.on_files.clone();
    let clear_click = move |_: MouseEvent| {
        if let Some(handler) = clear_handler.as_ref() {
            handler.call(Vec::new());
        }
    };

    // Native change: the fake path string is the only channel (delta).
    let change_handler = props.on_files.clone();
    let on_change = move |event: ChangeEvent| {
        if disabled {
            return;
        }
        let files = picked_files_from_change_value(&event.value, multiple);
        if files.is_empty() {
            return;
        }
        if let Some(handler) = change_handler.as_ref() {
            handler.call(files);
        }
    };

    // Drop zone: `DataTransfer` carries file NAMES only (delta).
    let drop_handler = props.on_files.clone();
    let on_drop = move |event: DragEvent| {
        event.prevent_default();
        if disabled {
            return;
        }
        let Some(transfer) = event.data_transfer.as_ref() else {
            return;
        };
        let dropped: Vec<PickedFile> = transfer
            .files
            .iter()
            .map(|name| PickedFile {
                name: name.clone(),
                path: None,
                size: None,
            })
            .collect();
        let picked = cap_selection(dropped, multiple);
        if picked.is_empty() {
            return;
        }
        if let Some(handler) = drop_handler.as_ref() {
            handler.call(picked);
        }
    };
    // A drop only lands on a box that cancelled the dragover default.
    let on_drag_over = move |event: DragEvent| {
        event.prevent_default();
    };

    rsx! {
        div {
            class: "hk-file-field",
            if let Some(label) = label_text {
                label {
                    class: "hk-file-field-label",
                    "for": label_for,
                    "{label}"
                    if props.required {
                        span { class: "hk-file-field-required",
                            "*"
                        }
                    }
                }
            }
            div {
                class: "hk-file-box",
                "data-disabled": disabled,
                "data-error": has_error,
                "data-filled": has_files,
                ondragover: on_drag_over,
                ondrop: on_drop,
                button {
                    class: "hk-file-trigger",
                    "type": "button",
                    id: field_id,
                    disabled: disabled,
                    "aria-haspopup": mode.aria_haspopup(),
                    onclick: trigger_click,
                    // SVG on its own `display:contents` host (see the header).
                    div {
                        style: "display:contents",
                        dangerous_inner_html: FILE_PLUS_SVG,
                    }
                    span {
                        class: "hk-file-trigger-text",
                        "data-filled": has_files,
                        "{trigger_text}"
                    }
                }
                if has_files && !disabled {
                    button {
                        class: "hk-file-clear",
                        "type": "button",
                        "aria-label": t("hikari::filePicker.fieldClear", "Clear selection"),
                        onclick: clear_click,
                        div {
                            style: "display:contents",
                            dangerous_inner_html: CLEAR_SVG,
                        }
                    }
                }
                if !mode.is_remote() {
                    input {
                        class: "hk-file-native",
                        "type": "file",
                        multiple: multiple,
                        accept: accept,
                        name: name,
                        disabled: disabled,
                        tabindex: -1,
                        "aria-hidden": "true",
                        onchange: on_change,
                    }
                }
            }
            if let Some(message) = message {
                if message.is_error {
                    p { class: "hk-file-field-error",
                        "{message.text}"
                    }
                } else {
                    p { class: "hk-file-field-hint",
                        "{message.text}"
                    }
                }
            }
        }
    }
}

impl StyledComponent for FileFieldComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-file-*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkFileField.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "file-field"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn picked(name: &str) -> PickedFile {
        PickedFile {
            name: name.to_string(),
            ..Default::default()
        }
    }

    #[test]
    fn file_field_defaults_match_the_vue_props() {
        let props = FileFieldProps::default();
        assert!(props.model_value.is_empty());
        assert_eq!(props.mode, FileFieldMode::Local);
        assert!(!props.multiple);
        assert_eq!(props.accept, None);
        assert_eq!(props.label, None);
        assert_eq!(props.placeholder, None);
        assert_eq!(props.hint, None);
        assert_eq!(props.error, None);
        assert!(!props.disabled);
        assert!(!props.required);
        assert_eq!(props.name, None);
        assert_eq!(props.id, None);
        assert!(props.on_files.is_none());
        assert!(props.on_pick.is_none());
        // Vue's `mode` default is `local`, so no dialog affordance.
        assert_eq!(FileFieldMode::Local.aria_haspopup(), None);
        assert_eq!(FileFieldMode::Remote.aria_haspopup(), Some("dialog"));
    }

    #[test]
    fn file_field_selection_summary_matches_the_vue_computed() {
        assert_eq!(selection_summary(&[]), "");
        assert_eq!(selection_summary(&[picked("a.csv")]), "a.csv");
        assert_eq!(
            selection_summary(&[picked("a.csv"), picked("b.csv"), picked("c.csv")]),
            "a.csv +2"
        );
    }

    #[test]
    fn file_field_placeholder_falls_back_by_mode_and_multiple() {
        // A true override wins.
        assert_eq!(
            file_field_placeholder(FileFieldMode::Local, false, Some("Pick")),
            "Pick"
        );
        // Vue tests truthiness, so an empty override falls through.
        assert_eq!(
            file_field_placeholder(FileFieldMode::Local, false, Some("")),
            "Choose a file…"
        );
        assert_eq!(
            file_field_placeholder(FileFieldMode::Local, true, None),
            "Choose files…"
        );
        assert_eq!(
            file_field_placeholder(FileFieldMode::Remote, false, None),
            "Choose a remote file…"
        );
        assert_eq!(
            file_field_placeholder(FileFieldMode::Remote, true, None),
            "Choose remote files…"
        );
    }

    #[test]
    fn file_field_message_line_prefers_the_error() {
        assert_eq!(field_message(None, None), None);
        // Vue truthiness: empty strings never render a line.
        assert_eq!(field_message(Some(""), Some("")), None);
        assert_eq!(
            field_message(None, Some("hint")),
            Some(FieldMessage {
                text: "hint".to_string(),
                is_error: false,
            })
        );
        // The error wins over the hint.
        assert_eq!(
            field_message(Some("bad"), Some("hint")),
            Some(FieldMessage {
                text: "bad".to_string(),
                is_error: true,
            })
        );
    }

    #[test]
    fn file_field_change_value_yields_leaf_names() {
        assert!(picked_files_from_change_value("", false).is_empty());
        // The browser's fake path, both separators.
        assert_eq!(
            picked_files_from_change_value("C:\\fakepath\\a.csv", false)[0].name,
            "a.csv"
        );
        assert_eq!(
            picked_files_from_change_value("/tmp/reports/b.json", false)[0].name,
            "b.json"
        );
        // `multiple` inputs join the fake paths with commas; a single pick
        // keeps only the first entry (Vue's `files.slice(0, 1)`).
        let many = picked_files_from_change_value("/tmp/a.csv, /tmp/b.csv", true);
        assert_eq!(many.len(), 2);
        assert_eq!(many[1].name, "b.csv");
        let one = picked_files_from_change_value("/tmp/a.csv, /tmp/b.csv", false);
        assert_eq!(one.len(), 1);
        assert_eq!(one[0].name, "a.csv");
        // Nothing to recover from blank segments.
        assert!(picked_files_from_change_value(" , ,", true).is_empty());
    }

    #[test]
    fn file_field_cap_matches_the_vue_multiple_slice() {
        let files = vec![picked("a"), picked("b")];
        assert_eq!(cap_selection(files.clone(), true).len(), 2);
        assert_eq!(cap_selection(files, false).len(), 1);
        assert!(cap_selection(Vec::new(), false).is_empty());
    }

    #[test]
    fn file_field_renders_the_vue_shell() {
        let html = FileField(FileFieldProps {
            model_value: vec![picked("a.csv"), picked("b.csv")],
            label: Some("Upload".to_string()),
            required: true,
            id: Some("field-1".to_string()),
            hint: Some("hint".to_string()),
            accept: Some(".csv".to_string()),
            multiple: true,
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-file-field",
            "hk-file-field-label",
            "hk-file-field-required",
            "hk-file-box",
            "hk-file-trigger",
            "hk-file-trigger-icon",
            "hk-file-trigger-text",
            "hk-file-clear",
            "hk-file-native",
            "hk-file-field-hint",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The summary + the presence markers the sheet styles by.
        assert!(html.contains("a.csv +1"), "{html}");
        assert!(html.contains("data-filled"), "{html}");
        assert!(html.contains(r#"for="field-1""#), "{html}");
        assert!(html.contains(r#"id="field-1""#), "{html}");
        assert!(html.contains(r#"accept=".csv""#), "{html}");
        // The native input is inert for assistive tech (Vue's tabindex /
        // aria-hidden pair) and invisible to the tab order.
        assert!(html.contains(r#"tabindex="-1""#), "{html}");
        assert!(html.contains(r#"aria-hidden="true""#), "{html}");
        // Local mode: no dialog affordance.
        assert!(!html.contains("aria-haspopup"), "{html}");
    }

    #[test]
    fn file_field_empty_and_disabled_states_render_the_vue_markers() {
        let html = FileField(FileFieldProps {
            placeholder: Some("Choose it".to_string()),
            error: Some("nope".to_string()),
            disabled: true,
            ..Default::default()
        })
        .render_to_html();
        // Placeholder instead of a summary; the error line wins.
        assert!(html.contains("Choose it"), "{html}");
        assert!(html.contains("hk-file-field-error"), "{html}");
        assert!(!html.contains("hk-file-field-hint"), "{html}");
        // The disabled box marker + no clear button (Vue hides it).
        assert!(html.contains("data-disabled"), "{html}");
        assert!(!html.contains("hk-file-clear"), "{html}");
    }

    #[test]
    fn file_field_remote_mode_drops_the_native_input() {
        let html = FileField(FileFieldProps {
            mode: FileFieldMode::Remote,
            ..Default::default()
        })
        .render_to_html();
        // Vue mounts the native input in local mode only.
        assert!(!html.contains("hk-file-native"), "{html}");
        assert!(html.contains(r#"aria-haspopup="dialog""#), "{html}");
        // The remote placeholder default (English fallback: no locale table).
        assert!(html.contains("Choose a remote file"), "{html}");
    }

    #[test]
    fn file_field_styles_come_from_the_canonical_vue_sheet() {
        let css = FileFieldComponent::styles();
        assert!(
            css.contains(".hk-file-field")
                && css.contains(".hk-file-box")
                && css.contains(".hk-file-trigger")
                && css.contains(".hk-file-clear")
                && css.contains(".hk-file-native"),
            "file field css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored file field sheet"
        );
    }
}
