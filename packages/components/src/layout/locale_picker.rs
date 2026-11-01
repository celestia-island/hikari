// hi-components/src/layout/locale_picker.rs
// LocalePicker — mirror of the canonical Vue `HkLocalePicker`: the compact
// language trigger in a footer/utility row plus the locale list it opens.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkLocalePicker.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-locale-picker-*` class names are literal
// and identical in both forms. It carries ONLY the trigger: Vue's dropdown is
// `HkLocalePickerPopup` → `HkMenu` and inherits the menu grammar there (the
// hand-rolled dropdown sheet was removed with the 2026-10-31 sweep). That is
// also why `layout/locale_picker_popup.rs` declares `styles() == ""` — this
// sheet is the whole pair's only CSS. DOM contract:
//
//   div                                  (style: position:relative — the anchor
//                                         box the popup's unmeasured arm pins
//                                         against; Vue's trigger ref)
//     button.hk-locale-picker-trigger type="button"
//         aria-haspopup="menu" aria-expanded={true|false}
//         [aria-label] [title]
//       {CODE}                           (currentLocale.toUpperCase())
//       span[style="display:contents"] > <10×10 caret svg>   (Vue: inline svg)
//     ── while open (nested `LocalePickerPopup`) ──
//     div.hk-select-popout-host > div.hk-select-popout > div.hk-menu-level
//         > button.hk-menu-row …         (see locale_picker_popup.rs)
//
// Vue prop mapping: `locales` → [`LocalePickerProps::locales`]
// ([`LocaleOption`]), `currentLocale` → `current_locale` (Vue default `"en"`),
// `select` → `on_select`, and Vue's local `open` ref → the CONTROLLED
// [`LocalePickerProps::open`] + `on_open_change` pair. tairitsu 0.5.22 has no
// per-instance component state (`use_signal` allocates a fresh signal per
// render, `use_state` shares ONE slot per component type), so the host owns the
// open flag exactly as it owns `currentLocale`; the mirror stores nothing.
//
// Pure surface (tested without a DOM): [`locale_trigger_code`] (the visible
// code), [`locale_current_label`] (the resolved current language),
// [`locale_sorted_locales`] + [`locale_popup_entries`] (the list and its order)
// and [`locale_trigger_aria`] (the control's accessible name).
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * NO `<Teleport>` / popup-manager z-band and no sheet: the popup renders in
//     place (see `locale_picker_popup.rs`) and the picker root keeps Vue's own
//     `position:relative` so the unmeasured arm has a containing block.
//   * The trigger carries an accessible NAME. Vue leaves the button bare (the
//     letters "EN" are the whole label), so the mirror adds `aria-label` (the
//     i18n "Language", or the host's `aria_label`) and `title` (the resolved
//     current language name, falling back to the code) — the same a11y delta
//     `basic/color_picker.rs` documents for its bare swatch button.
//   * `sort` is an explicit, default-off extension: Vue draws `locales` in the
//     order it is given (`LocaleSort::Source`, the default). A host with a
//     bilingual, unsorted list passes `LocaleSort::Label` and gets a stable,
//     case-insensitive label order — resolved purely by
//     [`locale_sorted_locales`], never in the DOM.
//   * `LocaleOption` has no `flag` field (Vue's `LocaleOption` is
//     `{ code, label }`), so the popup entries this picker builds carry
//     `flag: None`; `locale_picker_popup::LocalePopupEntry` keeps the flag for
//     hosts that drive the popup directly.
//   * NO `open` watcher side effects: Vue closes through the popup's
//     `update:open` emit, which the mirror forwards verbatim.

use hikari_i18n::t;

use crate::prelude::*;
use crate::styled::StyledComponent;

use super::locale_picker_popup::{
    LocalePickerPopup, LocalePickerPopupProps, LocalePopupEntry, LocalePopupPlacement,
};

pub struct LocalePickerComponent;

/// One selectable locale (Vue: `LocaleOption`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct LocaleOption {
    /// The locale code (`"en"`, `"zh-Hans"`, …) — the value emitted on select.
    pub code: String,

    /// The row text (the language's own or the host's name).
    pub label: String,
}

/// How the picker orders the list it feeds the popup.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum LocaleSort {
    /// The host's order — Vue's behaviour, and the default.
    #[default]
    Source,

    /// Case-insensitive ascending label order; equal labels keep the source
    /// order (a stable sort, so a host's tiebreak survives).
    Label,
}

/// Vue's `props.currentLocale.toUpperCase()`: the trigger's visible code.
pub fn locale_trigger_code(current_locale: &str) -> String {
    current_locale.to_uppercase()
}

/// The resolved name of the current language: the matching locale's label, or
/// the uppercased code when the list does not carry it (a host that set a code
/// the catalog does not know still gets a readable tooltip).
pub fn locale_current_label(locales: &[LocaleOption], current_locale: &str) -> String {
    match locales.iter().find(|locale| locale.code == current_locale) {
        Some(locale) => locale.label.clone(),
        None => locale_trigger_code(current_locale),
    }
}

/// The list the popup draws, ordered by [`LocaleSort`].
pub fn locale_sorted_locales(locales: &[LocaleOption], sort: LocaleSort) -> Vec<LocaleOption> {
    let mut ordered = locales.to_vec();
    if sort == LocaleSort::Label {
        // `sort_by` is stable: equal labels keep the host's order.
        ordered.sort_by_key(|option| option.label.to_lowercase());
    }
    ordered
}

/// Vue's mapping step (`props.locales.map(loc => ({ code, label }))`) folded
/// into the popup's entry shape, on top of the resolved order.
pub fn locale_popup_entries(locales: &[LocaleOption], sort: LocaleSort) -> Vec<LocalePopupEntry> {
    locale_sorted_locales(locales, sort)
        .into_iter()
        .map(|locale| LocalePopupEntry {
            code: locale.code,
            label: locale.label,
            // Vue's `LocaleOption` carries no flag; the popup keeps the field.
            flag: None,
        })
        .collect()
}

/// The trigger's accessible name: the host's override or the i18n "Language".
pub fn locale_trigger_aria(aria_label: Option<&String>) -> String {
    match aria_label {
        Some(label) => label.clone(),
        None => t("components.hk.localePicker.label", "Language"),
    }
}

/// Vue's inline caret: a raw 10-unit svg (not a lucide node), drawn with
/// `currentColor` so the sheet's `.hk-locale-picker-trigger svg { opacity: 0.5 }`
/// rule inherits through it.
const LOCALE_CARET_SVG: &str = r#"<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.2"></path></svg>"#;

/// A glyph mounted through `dangerous_inner_html` on its own
/// `style="display:contents"` host (the crate-wide SVG rule: an rsx `svg {}`
/// child would be an HTML element, and the host must not add a box).
fn glyph_host(markup: &'static str) -> Element {
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: markup,
        }
    }
}

#[define_props]
pub struct LocalePickerProps {
    /// The selectable locales (Vue default: an empty list).
    pub locales: Vec<LocaleOption>,

    /// The active locale (Vue default `"en"`).
    #[default("en".to_string())]
    pub current_locale: String,

    /// Controlled popup visibility (Vue: the local `open` ref).
    pub open: bool,

    /// The trigger's accessible name (Vue has none — see the header deltas).
    /// `None` resolves through the i18n bundle.
    pub aria_label: Option<String>,

    /// The list order (default [`LocaleSort::Source`] = Vue's own order).
    pub sort: LocaleSort,

    /// Fires with the desired open state (Vue: the local ref's writer).
    pub on_open_change: Option<EventHandler<bool>>,

    /// Fires with the chosen locale code (Vue: `select`).
    pub on_select: Option<EventHandler<String>>,
}

#[component]
pub fn LocalePicker(props: LocalePickerProps) -> Element {
    let code = locale_trigger_code(&props.current_locale);
    let current_label = locale_current_label(&props.locales, &props.current_locale);
    let aria_label = locale_trigger_aria(props.aria_label.as_ref());
    let entries = locale_popup_entries(&props.locales, props.sort);
    let aria_expanded = if props.open { "true" } else { "false" };

    let open = props.open;
    let trigger_change = props.on_open_change.clone();
    let trigger_click = move |event: MouseEvent| {
        event.stop_propagation();
        if let Some(handler) = trigger_change.as_ref() {
            handler.call(!open);
        }
    };

    rsx! {
        div {
            // Vue: `<div style={{ position: "relative" }} ref={trigger}>` — the
            // anchor box the popup's unmeasured arm pins against.
            style: "position:relative",
            button {
                "type": "button",
                class: "hk-locale-picker-trigger",
                "aria-haspopup": "menu",
                "aria-expanded": aria_expanded,
                "aria-label": aria_label,
                title: current_label,
                onclick: trigger_click,
                "{code}"
                {glyph_host(LOCALE_CARET_SVG)}
            }
            // Vue renders `HkLocalePickerPopup` as the trigger's sibling with
            // `placement="bottom-end"`; it renders nothing while closed.
            LocalePickerPopup {
                open: props.open,
                locales: entries,
                current_locale: props.current_locale.clone(),
                placement: LocalePopupPlacement::BottomEnd,
                // No measurement here: the popup's absolute arm pins to the
                // `position:relative` box above.
                anchor: None,
                offset: 6.0,
                title: None,
                on_open_change: props.on_open_change.clone(),
                on_select: props.on_select.clone(),
            }
        }
    }
}

impl StyledComponent for LocalePickerComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-locale-picker-trigger` name literal so this CSS matches Vue).
        // It styles the trigger only — the popup has no sheet of its own.
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkLocalePicker.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "locale-picker"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn locales() -> Vec<LocaleOption> {
        vec![
            LocaleOption {
                code: "zh-Hans".to_string(),
                label: "简体中文".to_string(),
            },
            LocaleOption {
                code: "en".to_string(),
                label: "English".to_string(),
            },
            LocaleOption {
                code: "de".to_string(),
                label: "Deutsch".to_string(),
            },
        ]
    }

    #[test]
    fn locale_trigger_code_uppercases_like_vue() {
        assert_eq!(locale_trigger_code("en"), "EN");
        assert_eq!(locale_trigger_code("zh-Hans"), "ZH-HANS");
        // Vue's `toUpperCase()` on an empty string stays empty (no placeholder
        // is invented here — the host decides what an unset locale reads).
        assert_eq!(locale_trigger_code(""), "");
    }

    #[test]
    fn locale_current_label_resolves_or_falls_back_to_the_code() {
        assert_eq!(locale_current_label(&locales(), "en"), "English");
        assert_eq!(locale_current_label(&locales(), "zh-Hans"), "简体中文");
        // An unknown code falls back to the uppercased code, not to "en".
        assert_eq!(locale_current_label(&locales(), "fr"), "FR");
        assert_eq!(locale_current_label(&[], "en"), "EN");
    }

    #[test]
    fn locale_list_order_follows_the_requested_sort() {
        // Source order is Vue's behaviour and the default.
        let source = locale_sorted_locales(&locales(), LocaleSort::Source);
        assert_eq!(
            source.iter().map(|l| l.code.as_str()).collect::<Vec<_>>(),
            vec!["zh-Hans", "en", "de"]
        );
        // Label order is case-insensitive; nothing is dropped or duplicated.
        let by_label = locale_sorted_locales(&locales(), LocaleSort::Label);
        assert_eq!(
            by_label
                .iter()
                .map(|l| l.label.as_str())
                .collect::<Vec<_>>(),
            vec!["Deutsch", "English", "简体中文"]
        );
        // Equal labels keep the host's order (stable sort).
        let twins = vec![
            LocaleOption {
                code: "a".to_string(),
                label: "Same".to_string(),
            },
            LocaleOption {
                code: "b".to_string(),
                label: "same".to_string(),
            },
        ];
        let ordered = locale_sorted_locales(&twins, LocaleSort::Label);
        assert_eq!(
            ordered.iter().map(|l| l.code.as_str()).collect::<Vec<_>>(),
            vec!["a", "b"]
        );
    }

    #[test]
    fn locale_popup_entries_carry_the_resolved_order_and_no_flags() {
        let entries = locale_popup_entries(&locales(), LocaleSort::Label);
        assert_eq!(
            entries.iter().map(|e| e.label.as_str()).collect::<Vec<_>>(),
            vec!["Deutsch", "English", "简体中文"]
        );
        // Vue's `LocaleOption` has no flag, so the picker never invents one.
        assert!(entries.iter().all(|entry| entry.flag.is_none()));
        assert_eq!(entries[0].code, "de");
    }

    #[test]
    fn locale_trigger_aria_defaults_to_the_english_bundle() {
        assert_eq!(
            locale_trigger_aria(None),
            t("components.hk.localePicker.label", "Language")
        );
        assert_eq!(locale_trigger_aria(Some(&"Sprache".to_string())), "Sprache");
    }

    #[test]
    fn locale_picker_defaults_match_the_vue_props() {
        let props = LocalePickerProps::default();
        assert!(props.locales.is_empty());
        // Vue's `currentLocale` prop default.
        assert_eq!(props.current_locale, "en");
        // Vue's local `open` ref starts closed.
        assert!(!props.open);
        assert!(props.aria_label.is_none());
        assert_eq!(props.sort, LocaleSort::Source);
        assert!(props.on_open_change.is_none());
        assert!(props.on_select.is_none());
    }

    #[test]
    fn locale_picker_renders_the_vue_trigger_contract() {
        let html = LocalePicker(LocalePickerProps {
            locales: locales(),
            current_locale: "zh-Hans".to_string(),
            ..Default::default()
        })
        .render_to_html();

        // Vue's positioned anchor box, then the compact trigger.
        assert!(html.contains(r#"style="position:relative""#), "{html}");
        assert!(
            html.contains(r#"class="hk-locale-picker-trigger""#),
            "{html}"
        );
        assert!(html.contains(r#"aria-haspopup="menu""#), "{html}");
        assert!(html.contains(r#"aria-expanded="false""#), "{html}");
        // The a11y delta: a control name plus the resolved language name.
        assert!(html.contains(r#"aria-label="Language""#), "{html}");
        assert!(html.contains(r#"title="简体中文""#), "{html}");
        // The visible code is the uppercased locale, and the caret is Vue's own
        // 10-unit svg behind a display:contents host.
        assert!(html.contains(">ZH-HANS<"), "{html}");
        assert!(html.contains(r#"style="display:contents""#), "{html}");
        assert!(
            html.contains(
                r#"<path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.2">"#
            ),
            "{html}"
        );
        // Closed: the popup mounts nothing at all.
        assert!(!html.contains("hk-select-popout"), "{html}");
        assert!(!html.contains("hk-menu-row"), "{html}");
    }

    #[test]
    fn locale_picker_open_renders_the_popup_against_the_picker_root() {
        let html = LocalePicker(LocalePickerProps {
            locales: locales(),
            current_locale: "en".to_string(),
            open: true,
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains(r#"aria-expanded="true""#), "{html}");
        // The nested popup: Vue's `bottom-end` placement, pinned to the picker
        // root because no anchor rect was measured.
        assert!(html.contains(r#"class="hk-select-popout-host""#), "{html}");
        assert!(html.contains(r#"data-side="bottom""#), "{html}");
        assert!(html.contains(r#"data-align="end""#), "{html}");
        assert!(
            html.contains(r#"style="position:absolute;top:calc(100% + 6px);right:0""#),
            "{html}"
        );
        assert!(html.contains(r#"aria-label="Language""#), "{html}");
        // Every locale is a row, current one checked.
        assert_eq!(html.matches(r#"class="hk-menu-row""#).count(), 3, "{html}");
        assert!(html.contains(r#"data-checked="true""#), "{html}");
    }

    #[test]
    fn locale_picker_styles_come_from_the_canonical_vue_sheet() {
        let css = LocalePickerComponent::styles();
        assert!(
            css.contains(".hk-locale-picker-trigger"),
            "locale picker css must carry the vue trigger class"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored locale picker sheet"
        );
        // The dropdown sheet is gone from Vue; the trigger is the sheet's whole
        // content and the popup owns no CSS at all.
        assert!(
            !css.contains(".hk-locale-picker-popup") && !css.contains(".hk-locale-picker-dropdown"),
            "the retired hand-rolled dropdown sheet must not come back"
        );
        assert_eq!(LocalePickerComponent::name(), "locale-picker");
    }
}
