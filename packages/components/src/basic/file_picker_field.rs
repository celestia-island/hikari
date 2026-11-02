// hi-components/src/basic/file_picker_field.rs
// FilePickerField — mirror of the canonical Vue `HkFilePickerField`: the
// PATH-valued sibling of [`crate::basic::file_field`]. Where the file field
// hands back file ENTRIES, this one holds a path STRING the operator can also
// type by hand — a folder badge, an editable input, and a browse button pinned
// right.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkFilePickerField.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-file-picker-*` class names are literal
// and identical in both forms. The DOM contract mirrors the Vue render output:
//
//   div.hk-file-picker-field
//     label.hk-file-picker-label [for=id]              (label && non-empty)
//       {label}
//     div.hk-file-picker-box [data-disabled] [data-error] [data-mono]
//       span.hk-file-picker-badge aria-hidden="true"
//         svg                                           (folder-open glyph)
//       input.hk-file-picker-input [id] type="text" value
//             [placeholder] spellcheck="false" [disabled]
//       button.hk-btn.hk-btn-ghost.hk-btn-sm.hk-file-picker-browse
//             [disabled]                                (HkButton mirror)
//     p.hk-file-picker-hint [data-error]                (error wins over hint)
//
// Vue prop mapping: `modelValue` → [`FilePickerFieldProps::model_value`],
// `update:modelValue` → [`FilePickerFieldProps::oninput`], `directory` →
// [`FilePickerFieldProps::directory`] (Vue default `true`), `mono` →
// [`FilePickerFieldProps::mono`] (Vue default `true`), the field chrome
// (`label` / `placeholder` / `hint` / `error` / `disabled` / `id`) passes
// through under the same names. The folder glyph is the Vue inline `<svg>`
// markup verbatim, mounted through `dangerous_inner_html` on a dedicated
// `display:contents` host (the crate-wide SVG rule — see `basic::file_field`).
//
// The field's message line and its "error wins, empty string is absent"
// priority are the SHARED helpers in [`crate::basic::file_field`]
// (`field_message`), so the two fields cannot drift apart on that rule.
//
// Behaviour deltas vs Vue (each one deliberate, none silent):
//   * VUE'S THREE PICKER BACKENDS (`hook` / `remote` / `native`, plus `auto`)
//     COLLAPSE INTO ONE `on_browse` REQUEST, and the `backend` prop is
//     therefore NOT mirrored. All three need something this host cannot do:
//     `hook` awaits a host `Promise<string|null>`, `remote` mounts
//     `HkFileBrowserDialog` over an ASYNC `RemoteFsAdapter` (that dialog is
//     mirrored with host-fetched entries — see
//     [`crate::basic::file_browser_dialog`]), and `native` calls
//     `showDirectoryPicker` / `showOpenFilePicker`, which do not exist in
//     this WASI host. What is left is exactly the same DOM: a press that asks
//     the HOST to open whichever picker it has. `directory` survives because
//     it still picks the placeholder copy (and the host uses it as the
//     dialog's `pick_directory`), and a backend with no request channel
//     wired leaves the Browse button disabled — Vue's `canBrowse` gate.
//   * the resolved path is controlled (`model_value` + `oninput`): Vue's
//     `update:modelValue` emit, nothing more. Vue's async `pick()` never
//     writes the field itself, so no state is lost.
//   * Vue's `useId()` has no tairitsu analogue: the caption's `for` is emitted
//     only when the caller passes `id` (the Input mirror's rule).
//   * the Browse button renders the crate's mirrored `HkButton`
//     (`basic::button`, `.hk-btn*` classes) instead of Vue's `HButton` import
//     — the same sheet, the same ghost/sm step, the same host class.
//   * no `hk-file-picker-input` focus/ref plumbing: Vue's `ref` exists only to
//     open the FS Access picker, which is not mirrored; focus now follows the
//     normal tab order.

use hikari_i18n::t;

use crate::basic::button::{Button, ButtonSize, ButtonVariant};
use crate::basic::file_field::field_message;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct FilePickerFieldComponent;

/// Vue's `placeholderText` computed: an explicit `placeholder` wins under
/// `??` (so an EMPTY string is kept — unlike the file field, which tests
/// truthiness), otherwise the copy follows `directory`.
pub fn picker_placeholder(directory: bool, placeholder: Option<&str>) -> String {
    if let Some(text) = placeholder {
        return text.to_string();
    }
    if directory {
        t("hikari::filePicker.fieldPickDirectory", "Choose a folder…")
    } else {
        t("hikari::filePicker.fieldPickFile", "Choose a file…")
    }
}

/// Vue's browse-button gate: `disabled || !canBrowse`. With the backends
/// collapsed (see the header) "can browse" means "the host wired a request".
pub fn browse_disabled(disabled: bool, has_browse: bool) -> bool {
    disabled || !has_browse
}

/// The folder-open badge glyph, byte-identical to the Vue inline `<svg>`
/// (Vue's `width`/`height` of 18 included).
const FOLDER_OPEN_SVG: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/></svg>"#;

#[define_props]
pub struct FilePickerFieldProps {
    /// The current path (Vue: `modelValue`, default `""`).
    #[default]
    pub model_value: String,

    /// Directory target (Vue default `true`): picks the placeholder copy and
    /// is the host's `pick_directory` hint for its own dialog.
    #[default(true)]
    pub directory: bool,

    /// Caption above the box (Vue: `label`).
    pub label: Option<String>,

    /// Input placeholder; falls back to the localized default.
    pub placeholder: Option<String>,

    /// Secondary message line, shown only without an error.
    pub hint: Option<String>,

    /// Error ink + message line; wins over `hint`.
    pub error: Option<String>,

    #[default]
    pub disabled: bool,

    /// Render the path in the mono face (Vue: `mono`, default `true`).
    #[default(true)]
    pub mono: bool,

    /// Input id and the caption's `for` target (Vue generates one).
    pub id: Option<String>,

    /// Fires with the new path text as the operator types (Vue:
    /// `update:modelValue`; the `InputEvent.data` convention the crate's
    /// other field mirrors use).
    pub oninput: Option<EventHandler<String>>,

    /// Fires on a Browse press: the host opens its picker / mounts the
    /// browser dialog (see the header delta).
    pub on_browse: Option<EventHandler<()>>,
}

#[component]
pub fn FilePickerField(props: FilePickerFieldProps) -> Element {
    let label_text = props.label.clone().filter(|label| !label.is_empty());
    let message = field_message(props.error.as_deref(), props.hint.as_deref());
    let has_error = props
        .error
        .as_deref()
        .is_some_and(|error| !error.is_empty());
    let disabled = props.disabled;
    let field_id = props.id.clone();
    // The caption's `for` is a CHILD of the root (evaluated after the input's
    // `id` attribute has consumed `field_id`), so it carries its own clone.
    let label_for = field_id.clone();
    let placeholder = picker_placeholder(props.directory, props.placeholder.as_deref());
    let value = props.model_value.clone();
    let browse_label = t("hikari::filePicker.browse", "Browse…");

    // Vue: the button is disabled when the field is, or when the resolved
    // backend has nothing to open with (header delta: one request channel).
    let has_browse = props.on_browse.is_some();
    let browse_armed = !browse_disabled(disabled, has_browse);

    let oninput = props.oninput.clone();
    let on_input = move |event: InputEvent| {
        if let Some(handler) = oninput.as_ref() {
            handler.call(event.data.clone());
        }
    };

    let on_browse = props.on_browse.clone();
    let on_browse_click = move |_: MouseEvent| {
        if disabled {
            return;
        }
        if let Some(handler) = on_browse.as_ref() {
            handler.call(());
        }
    };

    rsx! {
        div {
            class: "hk-file-picker-field",
            if let Some(label) = label_text {
                label {
                    class: "hk-file-picker-label",
                    "for": label_for,
                    "{label}"
                }
            }
            div {
                class: "hk-file-picker-box",
                "data-disabled": disabled,
                "data-error": has_error,
                "data-mono": props.mono,
                span {
                    class: "hk-file-picker-badge",
                    "aria-hidden": "true",
                    // SVG on its own `display:contents` host (see the header).
                    div {
                        style: "display:contents",
                        dangerous_inner_html: FOLDER_OPEN_SVG,
                    }
                }
                input {
                    class: "hk-file-picker-input",
                    "type": "text",
                    id: field_id,
                    value: value,
                    placeholder: placeholder,
                    "spellcheck": "false",
                    disabled: disabled,
                    oninput: on_input,
                }
                Button {
                    variant: ButtonVariant::Ghost,
                    size: ButtonSize::Sm,
                    disabled: !browse_armed,
                    class: "hk-file-picker-browse".to_string(),
                    onclick: Some(EventHandler::new(on_browse_click)),
                    children: VNode::Text(VText::new(&browse_label)),
                }
            }
            if let Some(message) = message {
                p {
                    class: "hk-file-picker-hint",
                    "data-error": message.is_error,
                    "{message.text}"
                }
            }
        }
    }
}

impl StyledComponent for FilePickerFieldComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-file-picker-*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkFilePickerField.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "file-picker-field"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_picker_field_defaults_match_the_vue_props() {
        let props = FilePickerFieldProps::default();
        assert_eq!(props.model_value, "");
        // Vue's `directory` default is TRUE — a picker field picks a folder
        // unless told otherwise.
        assert!(props.directory);
        assert_eq!(props.label, None);
        assert_eq!(props.placeholder, None);
        assert_eq!(props.hint, None);
        assert_eq!(props.error, None);
        assert!(!props.disabled);
        // Vue's `mono` default is TRUE — paths are code.
        assert!(props.mono);
        assert_eq!(props.id, None);
        assert!(props.oninput.is_none());
        assert!(props.on_browse.is_none());
    }

    #[test]
    fn file_picker_field_placeholder_follows_directory_and_nullish_coalescing() {
        assert_eq!(picker_placeholder(true, None), "Choose a folder…");
        assert_eq!(picker_placeholder(false, None), "Choose a file…");
        assert_eq!(picker_placeholder(true, Some("/srv/data")), "/srv/data");
        // Vue uses `??`, so an explicit empty placeholder is KEPT (the file
        // field's truthiness rule does not apply here).
        assert_eq!(picker_placeholder(true, Some("")), "");
    }

    #[test]
    fn file_picker_field_browse_button_gate_matches_vue() {
        // Armed only when enabled AND a request channel exists.
        assert!(!browse_disabled(false, true));
        assert!(browse_disabled(true, true));
        assert!(browse_disabled(false, false));
        assert!(browse_disabled(true, false));
    }

    #[test]
    fn file_picker_field_message_priority_is_shared_with_the_file_field() {
        // Same rule, same helper: error wins, empty strings are absent.
        assert_eq!(field_message(None, None), None);
        assert_eq!(field_message(Some(""), Some("")), None);
        assert_eq!(
            field_message(None, Some("hint")).map(|line| (line.text, line.is_error)),
            Some(("hint".to_string(), false))
        );
        assert_eq!(
            field_message(Some("bad"), Some("hint")).map(|line| (line.text, line.is_error)),
            Some(("bad".to_string(), true))
        );
    }

    #[test]
    fn file_picker_field_renders_the_vue_shell() {
        let html = FilePickerField(FilePickerFieldProps {
            model_value: "/srv/data".to_string(),
            label: Some("Directory".to_string()),
            id: Some("picker-1".to_string()),
            hint: Some("hint".to_string()),
            on_browse: Some(EventHandler::new(|_: ()| {})),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-file-picker-field",
            "hk-file-picker-label",
            "hk-file-picker-box",
            "hk-file-picker-badge",
            "hk-file-picker-input",
            "hk-file-picker-browse",
            "hk-file-picker-hint",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The mono default publishes the sheet's `[data-mono]` marker.
        assert!(html.contains("data-mono"), "{html}");
        assert!(html.contains(r#"for="picker-1""#), "{html}");
        assert!(html.contains(r#"value="/srv/data""#), "{html}");
        // The button is the mirrored HkButton at ghost/sm.
        assert!(html.contains("hk-btn-ghost"), "{html}");
        assert!(html.contains("hk-btn-sm"), "{html}");
        // Armed (a request channel is wired) → no disabled attribute.
        assert!(!html.contains("disabled"), "{html}");
        // Directory default copy.
        assert!(html.contains("Choose a folder"), "{html}");
        // No error line: the hint loses its `data-error` marker.
        assert!(!html.contains("data-error"), "{html}");
    }

    #[test]
    fn file_picker_field_error_and_disabled_states() {
        let html = FilePickerField(FilePickerFieldProps {
            error: Some("bad path".to_string()),
            hint: Some("unused".to_string()),
            disabled: true,
            mono: false,
            ..Default::default()
        })
        .render_to_html();
        // Error wins and carries the sheet's `[data-error]` marker.
        assert!(html.contains("bad path"), "{html}");
        assert!(!html.contains("unused"), "{html}");
        assert!(html.contains("data-error"), "{html}");
        // `mono: false` retires the marker; the box stays disabled.
        assert!(!html.contains("data-mono"), "{html}");
        assert!(html.contains("data-disabled"), "{html}");
        // No request channel → the browse button is disabled.
        assert!(
            html.contains(r#"disabled="disabled""#) || html.contains(" disabled"),
            "{html}"
        );
    }

    #[test]
    fn file_picker_field_styles_come_from_the_canonical_vue_sheet() {
        let css = FilePickerFieldComponent::styles();
        assert!(
            css.contains(".hk-file-picker-field")
                && css.contains(".hk-file-picker-box")
                && css.contains(".hk-file-picker-badge")
                && css.contains(".hk-file-picker-input")
                && css.contains(".hk-file-picker-browse"),
            "file picker css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored file picker sheet"
        );
    }
}
