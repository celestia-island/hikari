// hi-components/src/basic/search_input.rs
// SearchInput — mirror of the canonical Vue `HkSearchInput` (the bare search
// field: leading magnifier, native `type=search` element, trailing clear
// affordance while the field holds text).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkSearchInput.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.hk-search-input*` class names are literal and identical in both forms.
// The DOM contract below mirrors the Vue render output:
//
//   div.hk-search-input.hk-search-input-{size}   [.hk-search-input-disabled]
//     span.hk-search-input-icon
//       <searchIcon>                            (raw SVG, see the deltas)
//     input.hk-search-input-field
//          type="search" [value] [placeholder] [disabled]
//     button.hk-search-input-clear                (value non-empty && enabled)
//          type="button" tabindex="-1" [aria-label]
//       <clearIcon>                             (raw SVG, see the deltas)
//
// Vue prop mapping: `modelValue` → [`SearchInputProps::model_value`], `size` →
// [`SearchInputSize`] (`hk-search-input-{sm,md,lg}`), `placeholder` →
// [`SearchInputProps::placeholder`], `disabled` → the element attribute plus the
// wrapper's `hk-search-input-disabled` marker, `clearAriaLabel` →
// [`SearchInputProps::clear_aria_label`]. The three emits are
// `update:modelValue` → [`SearchInputProps::oninput`], `search` →
// [`SearchInputProps::onsearch`], `clear` → [`SearchInputProps::onclear`].
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * DEBOUNCE IS NOT SCHEDULED. Vue runs `debounce` through a `setTimeout`
//     and emits `search` on every `modelValue` watcher tick. tairitsu 0.5.22
//     has no render-scoped timer + watcher pairing that survives a re-render
//     (the same limit the tooltip/select mirrors document), so `debounce` is
//     ACCEPTED AND INERT and `search` fires on Enter only — the host owns the
//     debounce window, exactly where a controlled component's async edges
//     already live.
//   * `Enter` reports the CONTROLLED value ([`SearchInputProps::model_value`]).
//     Vue reads `(e.target as HTMLInputElement).value`; the wasm event payload
//     carries no target value, so the mirror cannot re-read the element. Same
//     convention the crate's other field mirrors use for `InputEvent`.
//   * `oninput` forwards `InputEvent.data` — the host stack's "field's new
//     text" payload, the convention `basic/input.rs` and `entry/search.rs`
//     already document — rather than Vue's `target.value` read.
//   * NO `clearValue` FOCUS RESTORE: Vue calls `inputRef.value?.focus()` after
//     emitting; element refs are never populated in this host stack, so the
//     mirror cannot move focus. The host owns focus.
//   * the two glyphs are the Vue source's own hand-drawn SVG nodes (NOT lucide
//     icons), emitted verbatim through `dangerous_inner_html` on a dedicated
//     `display:contents` host: `rsx!`'s `svg {}` would land in the HTML
//     namespace in this host stack, so an SVG child can only ride innerHTML.
//     The markup is HTML-serialized (self-closing `<circle/>` → `<circle></circle>`),
//     which parses to the identical SVG tree.

use hikari_i18n::t;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SearchInputComponent;

/// The three size steps (Vue: `"sm" | "md" | "lg"`, default `"md"`); they
/// ride the wrapper as `hk-search-input-{size}`.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SearchInputSize {
    Sm,
    #[default]
    Md,
    Lg,
}

impl SearchInputSize {
    /// The `hk-search-input-{size}` class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            SearchInputSize::Sm => "hk-search-input-sm",
            SearchInputSize::Md => "hk-search-input-md",
            SearchInputSize::Lg => "hk-search-input-lg",
        }
    }
}

/// Vue's `searchIcon` vnode, HTML-serialized.
const SEARCH_INPUT_SEARCH_ICON_SVG: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>"#;

/// Vue's `clearIcon` vnode, HTML-serialized.
const SEARCH_INPUT_CLEAR_ICON_SVG: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>"#;

#[define_props]
pub struct SearchInputProps {
    /// Vue: `modelValue`, default `""` (controlled).
    #[default]
    pub model_value: String,

    /// Native placeholder; `None` falls back to the i18n default exactly like
    /// Vue's `placeholder ?? t("hikari::searchInput.placeholder", "Search…")`.
    pub placeholder: Option<String>,

    #[default]
    pub disabled: bool,

    /// Size step (`hk-search-input-{size}`).
    #[default]
    pub size: SearchInputSize,

    /// Vue's `debounce` (ms). ACCEPTED AND INERT — the host owns debouncing
    /// (see the file-header deltas).
    #[default(0.0)]
    pub debounce: f64,

    /// Vue's `clearAriaLabel`; the empty default falls back to the i18n string,
    /// exactly Vue's `clearAriaLabel || t(...)`.
    #[default]
    pub clear_aria_label: String,

    /// Vue: `update:modelValue` — the field's new text.
    pub oninput: Option<EventHandler<String>>,

    /// Vue: the `search` emit (the mirror fires it on Enter only).
    pub onsearch: Option<EventHandler<String>>,

    /// Vue: the `clear` emit (after the clearing `update:modelValue`).
    pub onclear: Option<EventHandler<()>>,
}

/// Vue's `v-if="props.modelValue && !props.disabled"` on the clear button:
/// JavaScript truthiness on the value, so an empty string hides it.
pub fn search_input_shows_clear(model_value: &str, disabled: bool) -> bool {
    !model_value.is_empty() && !disabled
}

/// Vue: `placeholder ?? t("hikari::searchInput.placeholder", "Search…")`.
pub fn search_input_placeholder(placeholder: Option<&str>) -> String {
    match placeholder {
        Some(placeholder) => placeholder.to_string(),
        None => t("hikari::searchInput.placeholder", "Search…"),
    }
}

/// Vue: `clearAriaLabel || t("hikari::searchInput.clear", "Clear search")` —
/// an empty caller string falls back (falsy in JavaScript).
pub fn search_input_clear_label(clear_aria_label: &str) -> String {
    if clear_aria_label.is_empty() {
        t("hikari::searchInput.clear", "Clear search")
    } else {
        clear_aria_label.to_string()
    }
}

/// The wrapper class list in Vue's order: `hk-search-input`, the size step,
/// then the disabled marker.
pub fn search_input_classes(size: SearchInputSize, disabled: bool) -> String {
    let mut classes = format!("hk-search-input {}", size.class_name());
    if disabled {
        classes.push_str(" hk-search-input-disabled");
    }
    classes
}

/// Vue's presence-only boolean attribute (`disabled` when on, absent when off).
/// A serialized `disabled="false"` is still a TRUE HTML boolean, so the mirror
/// never emits one (the W2a mirrors pass the raw `bool`; this file does not).
fn boolean_attr(flag: bool) -> Option<&'static str> {
    if flag { Some("true") } else { None }
}

#[component]
pub fn SearchInput(props: SearchInputProps) -> Element {
    let classes = search_input_classes(props.size, props.disabled);
    let shows_clear = search_input_shows_clear(&props.model_value, props.disabled);
    let placeholder = search_input_placeholder(props.placeholder.as_deref());
    let clear_label = search_input_clear_label(&props.clear_aria_label);
    let value = props.model_value.clone();
    // Vue's Enter path reads the element's value; the mirror reuses the
    // controlled one (see the header deltas).
    let search_value = props.model_value.clone();
    let disabled = props.disabled;

    // One closure per binding site: `rsx!` consumes exactly one closure per
    // attribute, and `EventHandler` is not `Copy`.
    let oninput_for_field = props.oninput.clone();
    let oninput_for_clear = props.oninput.clone();
    let onsearch = props.onsearch.clone();
    let onclear = props.onclear.clone();

    rsx! {
        div { class: classes,
            span { class: "hk-search-input-icon",
                div {
                    style: "display:contents",
                    dangerous_inner_html: SEARCH_INPUT_SEARCH_ICON_SVG,
                }
            }
            input {
                "type": "search",
                class: "hk-search-input-field",
                value: value,
                placeholder: placeholder,
                disabled: boolean_attr(disabled),
                oninput: move |event: InputEvent| {
                    if let Some(handler) = oninput_for_field.as_ref() {
                        handler.call(event.data.clone());
                    }
                },
                onkeydown: move |event: KeyboardEvent| {
                    // Vue: Enter flushes the pending debounce and emits
                    // `search` with the field's value.
                    if event.key == "Enter"
                        && let Some(handler) = onsearch.as_ref()
                    {
                        handler.call(search_value.clone());
                    }
                },
            }
            if shows_clear {
                button {
                    "type": "button",
                    class: "hk-search-input-clear",
                    tabindex: -1,
                    "aria-label": clear_label,
                    onclick: move |_event: MouseEvent| {
                        // Vue's `clearValue`: `update:modelValue ""`, then
                        // `clear`, then refocus (the refocus is a documented
                        // delta — no element handles here).
                        if let Some(handler) = oninput_for_clear.as_ref() {
                            handler.call(String::new());
                        }
                        if let Some(handler) = onclear.as_ref() {
                            handler.call(());
                        }
                    },
                    div {
                        style: "display:contents",
                        dangerous_inner_html: SEARCH_INPUT_CLEAR_ICON_SVG,
                    }
                }
            }
        }
    }
}

impl StyledComponent for SearchInputComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-search-input*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkSearchInput.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "search-input"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_input_size_classes_match_the_vue_modifiers() {
        assert_eq!(SearchInputSize::Sm.class_name(), "hk-search-input-sm");
        assert_eq!(SearchInputSize::Md.class_name(), "hk-search-input-md");
        assert_eq!(SearchInputSize::Lg.class_name(), "hk-search-input-lg");
    }

    #[test]
    fn search_input_classes_match_the_vue_order() {
        assert_eq!(
            search_input_classes(SearchInputSize::Md, false),
            "hk-search-input hk-search-input-md"
        );
        assert_eq!(
            search_input_classes(SearchInputSize::Lg, true),
            "hk-search-input hk-search-input-lg hk-search-input-disabled"
        );
        // Vue's default step.
        assert_eq!(
            search_input_classes(SearchInputSize::default(), false),
            "hk-search-input hk-search-input-md"
        );
    }

    #[test]
    fn search_input_defaults_match_the_vue_props() {
        let props = SearchInputProps::default();
        assert_eq!(props.model_value, "");
        assert_eq!(props.placeholder, None);
        assert!(!props.disabled);
        assert_eq!(props.size, SearchInputSize::Md);
        // Vue: `debounce: 0` — accepted, and inert in this mirror.
        assert_eq!(props.debounce, 0.0);
        // Vue: `clearAriaLabel: ""` → the i18n fallback is used at render.
        assert_eq!(props.clear_aria_label, "");
        assert!(props.oninput.is_none());
        assert!(props.onsearch.is_none());
        assert!(props.onclear.is_none());
    }

    #[test]
    fn search_input_truthiness_rules_match_vue() {
        // The clear button exists only for a non-empty value on an enabled
        // field (Vue: `modelValue && !disabled`).
        assert!(!search_input_shows_clear("", false));
        assert!(search_input_shows_clear("q", false));
        assert!(!search_input_shows_clear("q", true));
        assert!(!search_input_shows_clear("", true));
    }

    #[test]
    fn search_input_fallbacks_match_the_vue_nullish_and_or_chains() {
        // `placeholder ?? t(...)`: `undefined` falls back, `""` does NOT.
        assert_eq!(search_input_placeholder(None), "Search…");
        assert_eq!(search_input_placeholder(Some("")), "");
        assert_eq!(search_input_placeholder(Some("Find")), "Find");
        // `clearAriaLabel || t(...)`: `""` falls back.
        assert_eq!(search_input_clear_label(""), "Clear search");
        assert_eq!(search_input_clear_label("Wipe"), "Wipe");
    }

    #[test]
    fn search_input_icons_keep_the_vue_markup() {
        for (svg, shape) in [
            (
                SEARCH_INPUT_SEARCH_ICON_SVG,
                r#"<circle cx="11" cy="11" r="8">"#,
            ),
            (
                SEARCH_INPUT_CLEAR_ICON_SVG,
                r#"<line x1="18" y1="6" x2="6" y2="18">"#,
            ),
        ] {
            assert!(svg.starts_with("<svg "), "{svg}");
            assert!(svg.ends_with("</svg>"), "{svg}");
            assert!(svg.contains(r#"viewBox="0 0 24 24""#), "{svg}");
            assert!(svg.contains(shape), "{svg}");
        }
        // The Vue source spells these two glyphs by hand (no lucide class).
        assert!(!SEARCH_INPUT_SEARCH_ICON_SVG.contains("lucide"));
        assert!(!SEARCH_INPUT_CLEAR_ICON_SVG.contains("lucide"));
    }

    #[test]
    fn search_input_renders_the_vue_dom_contract() {
        // Default field: the wrapper, the icon host and the search element.
        let html = SearchInput(SearchInputProps::default()).render_to_html();
        assert!(
            html.contains(r#"class="hk-search-input hk-search-input-md""#),
            "{html}"
        );
        assert!(html.contains(r#"class="hk-search-input-icon""#), "{html}");
        assert!(html.contains(r#"style="display:contents""#), "{html}");
        assert!(html.contains("<svg viewBox=\"0 0 24 24\""), "{html}");
        assert!(html.contains(r#"type="search""#), "{html}");
        assert!(html.contains(r#"class="hk-search-input-field""#), "{html}");
        assert!(html.contains("Search…"), "{html}");
        // No clear button for an empty field, and no falsy boolean attribute.
        assert!(!html.contains("hk-search-input-clear"), "{html}");
        assert!(!html.contains(r#"disabled="false""#), "{html}");

        // A filled field shows the clear affordance, named for AT.
        let html = SearchInput(SearchInputProps {
            model_value: "needle".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"value="needle""#), "{html}");
        assert!(html.contains(r#"class="hk-search-input-clear""#), "{html}");
        assert!(html.contains(r#"aria-label="Clear search""#), "{html}");
        assert!(html.contains(r#"tabindex="-1""#), "{html}");

        // A disabled field carries the wrapper marker and the element attribute,
        // and never the clear button.
        let html = SearchInput(SearchInputProps {
            model_value: "needle".to_string(),
            disabled: true,
            size: SearchInputSize::Lg,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-search-input-lg"), "{html}");
        assert!(html.contains("hk-search-input-disabled"), "{html}");
        assert!(html.contains(r#"disabled="true""#), "{html}");
        assert!(!html.contains("hk-search-input-clear"), "{html}");
    }

    #[test]
    fn search_input_styles_come_from_the_canonical_vue_sheet() {
        let css = SearchInputComponent::styles();
        for class in [
            ".hk-search-input",
            ".hk-search-input-icon",
            ".hk-search-input-field",
            ".hk-search-input-clear",
            ".hk-search-input-disabled",
            ".hk-search-input-sm",
            ".hk-search-input-md",
            ".hk-search-input-lg",
        ] {
            assert!(
                css.contains(class),
                "search-input css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored search input sheet"
        );
    }
}
