// hi-components/src/layout/locale_picker_popup.rs
// LocalePickerPopup — mirror of the canonical Vue `HkLocalePickerPopup`: the
// locale list as one flat menu tree, laid on top of the family's menu grammar.
//
// THE SHEET OWNERSHIP (verified, not assumed — `styled()` returns `""` for
// that reason): Vue ships NO sheet for this component. `HkLocalePickerPopup`
// imports `HkMenu` and renders nothing but that; the popup's canvas is
// `HkSelectPanel`'s (`.hk-select-popout-host` / `.hk-select-popout`, painted by
// `HkSelect.scss`, mirrored + compiled by `basic/select.rs`) and its rows are
// `HkMenu`'s (`.hk-menu-level` / `.hk-menu-row` / `.hk-menu-check` /
// `.hk-menu-flag` / `.hk-menu-label`). `HkMenu.scss` is NOT part of the
// vendored mirror set this wave (`manifest.tsv` lists `_menu-item.scss` only),
// so those row classes reach the Rust form as DOM hooks: the same deal
// `basic/kbd.rs` documents for a Vue sheet-less component. The trigger's sheet
// (`HkLocalePicker.scss`) belongs to `layout/locale_picker.rs` — the popup owns
// no class of its own at all.
//
// DOM contract (mirrors Vue, which renders one `HkSelectPanel` for the level):
//
//   ── desktop popout (the only branch this wave mirrors) ──
//   div.hk-select-popout-host
//       data-side={bottom|right|left} data-align={start|end}
//       (style: inline geometry — fixed from the anchor rect, else absolute
//        against the positioned ancestor; no Teleport, no popup-manager band)
//     div.hk-select-popout [aria-label={title}]        (keydown: Escape closes)
//       div.hk-menu-level role="menu"
//         button.hk-menu-row type="button"
//             [data-checked]                            (presence-only marker)
//           span.hk-menu-check [data-on] aria-hidden="true"
//             ── the ✓ glyph, checked rows only ──
//           span.hk-menu-flag                           (item.flag)
//           span.hk-menu-label {label}
//
// Vue prop mapping: `open` → [`LocalePickerPopupProps::open`] (CONTROLLED — see
// below), `locales` → [`LocalePickerPopupProps::locales`]
// ([`LocalePopupEntry`]), `currentLocale` → `current_locale`, `placement` →
// [`LocalePopupPlacement`] (Vue's `"left-start" | "right-start" |
// "bottom-end"`, defaulting to `right-start`), `t` → the `title` prop (Vue takes
// a translate function). Emits: `update:open` → `on_open_change`, `select` →
// `on_select`.
//
// Controlled state: Vue's only local state is HkMenu's (desktop path, open
// levels, sheet stack) and the popup itself owns none. tairitsu 0.5.22 has no
// per-instance component state (`use_signal` allocates a fresh signal per
// render, `use_state` shares ONE slot per component type), so `open` is a prop
// and every close request leaves through `on_open_change` — the host owns the
// flag exactly as it owns `currentLocale`. Nothing is stored here.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * NO `<Teleport>`, no overlay-root, no popup-manager z-band and no
//     auto-flip: the popout renders in place with inline geometry, so the
//     host's stacking context decides the paint order and the requested
//     placement is used VERBATIM (Vue flips a surface that would leave the
//     viewport — that needs a measured box, which this wave has no ref /
//     measurement pairing for).
//   * NO MOBILE SHEET: Vue's HkMenu opens full-width sheets with back-gesture
//     navigation on phones. The mirror renders the same popout at every width
//     (the task's inline-positioning contract); a host that wants the sheet
//     grammar mounts this surface inside one.
//   * NO CASCADE AND NO HISTORY GUARD: locale items are leaves, so the level
//     path, the per-level panels and the `lingering` leave window have nothing
//     to drive. The single `hk-menu-level` is Vue's level 0 verbatim.
//   * NO OUTSIDE-CLICK CLOSE, no overlay-scrollbar attach and no enter/leave
//     transition (`hk-select-popout-*` are Vue's `<Transition>` names): all of
//     them are document-level / measurement / animation-bus contracts. Escape
//     (on the panel), a row press, or the mobile scrim in a host-owned sheet
//     are the close paths.
//   * `hk-menu-row`'s `data-active` is NOT emitted: Vue marks only a branch row
//     whose children are open, and a flat locale level has no branches.
//   * The layout is flat and HOST-ORDERED (Vue draws `locales` in the order it
//     is given); sorting belongs to the caller — `layout/locale_picker.rs`
//     resolves it purely (`locale_sorted_locales`).
//   * The ✓ glyph is lucide `check` at 12 units, byte-for-byte the markup
//     `lucide-vue-next` renders for `<Check size={12} />`, through
//     `dangerous_inner_html` on a `display:contents` host (an `rsx!` `svg {}`
//     child lands in the HTML namespace in this host stack).

use hikari_i18n::t;

use crate::feedback::popover::{PopoverAnchorRect, PopoverPlacement, popover_position_style};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct LocalePickerPopupComponent;

/// One locale of the popup's list (Vue: the `{ code, label, flag? }` shape
/// `HkLocalePicker` maps its `LocaleOption`s into).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct LocalePopupEntry {
    /// Stable identity — the value emitted on `select`.
    pub code: String,

    /// The row text (the language's own or the host's name).
    pub label: String,

    /// Optional leading glyph (flag emoji or any short symbol).
    pub flag: Option<String>,
}

/// Vue's placement union for this popup: a `left-start` / `right-start` cascade
/// or, as `HkLocalePicker` passes, `bottom-end`. Anything else resolves to
/// `right-start` — Vue filters the prop through exactly that allow-list.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum LocalePopupPlacement {
    BottomEnd,
    #[default]
    RightStart,
    LeftStart,
}

impl LocalePopupPlacement {
    /// The Vue union token.
    pub fn token(self) -> &'static str {
        match self {
            LocalePopupPlacement::BottomEnd => "bottom-end",
            LocalePopupPlacement::RightStart => "right-start",
            LocalePopupPlacement::LeftStart => "left-start",
        }
    }

    /// Vue's allow-list filter: the three known tokens pass, everything else
    /// (including `""` and `bottom-start`) becomes `right-start`.
    pub fn from_token(token: &str) -> Self {
        match token {
            "bottom-end" => LocalePopupPlacement::BottomEnd,
            "left-start" => LocalePopupPlacement::LeftStart,
            _ => LocalePopupPlacement::RightStart,
        }
    }

    /// The twelve-placement grammar this popup shares with `feedback::popover`.
    pub fn as_popover_placement(self) -> PopoverPlacement {
        match self {
            LocalePopupPlacement::BottomEnd => PopoverPlacement::BottomEnd,
            LocalePopupPlacement::RightStart => PopoverPlacement::RightStart,
            LocalePopupPlacement::LeftStart => PopoverPlacement::LeftStart,
        }
    }

    /// The popout host's `data-side` token (Vue: HkSelectPanel's resolved side).
    pub fn side_token(self) -> &'static str {
        match self {
            LocalePopupPlacement::BottomEnd => "bottom",
            LocalePopupPlacement::RightStart => "right",
            LocalePopupPlacement::LeftStart => "left",
        }
    }

    /// The popout host's `data-align` token (Vue: the resolved alignment).
    pub fn align_token(self) -> &'static str {
        match self {
            LocalePopupPlacement::BottomEnd => "end",
            LocalePopupPlacement::RightStart | LocalePopupPlacement::LeftStart => "start",
        }
    }
}

/// One rendered row (Vue: an `HkMenuItem` built from a locale).
#[derive(Clone, PartialEq, Debug)]
pub struct LocalePopupItem {
    /// The item key (the locale code).
    pub key: String,
    pub label: String,
    pub flag: Option<String>,
    /// `checked: loc.code === props.currentLocale` — one row per locale, so at
    /// most one is checked.
    pub checked: bool,
}

/// Vue's `items` computed: one menu item per locale, in host order, with the
/// current locale carrying the check.
pub fn locale_popup_items(
    locales: &[LocalePopupEntry],
    current_locale: &str,
) -> Vec<LocalePopupItem> {
    locales
        .iter()
        .map(|locale| LocalePopupItem {
            key: locale.code.clone(),
            label: locale.label.clone(),
            flag: locale.flag.clone(),
            checked: locale.code == current_locale,
        })
        .collect()
}

/// The inline geometry of the `position: fixed` popout host.
///
/// With an anchor rect the twelve-placement helper pins the surface to it
/// (Vue: HkSelectPanel's `positionPanel`, minus the measured flip/clamp pass).
/// WITHOUT one — a host that did not measure its trigger — the surface pins to
/// its nearest POSITIONED ancestor instead (absolute, one `offset` away from
/// the anchor edge); `layout/locale_picker.rs` carries `position: relative` on
/// the picker root for exactly that case. Both arms need no measurement of the
/// panel itself: the align arm translates by a percentage, so no panel width is
/// read, and the vertical arms write an edge instead of a height.
pub fn locale_popup_style(
    placement: LocalePopupPlacement,
    anchor: Option<PopoverAnchorRect>,
    offset: f64,
) -> String {
    match anchor {
        Some(anchor) => popover_position_style(placement.as_popover_placement(), anchor, offset),
        None => match placement {
            LocalePopupPlacement::BottomEnd => {
                format!("position:absolute;top:calc(100% + {offset}px);right:0")
            }
            LocalePopupPlacement::RightStart => {
                format!("position:absolute;left:calc(100% + {offset}px);top:0")
            }
            LocalePopupPlacement::LeftStart => {
                format!("position:absolute;right:calc(100% + {offset}px);top:0")
            }
        },
    }
}

/// The popup's surface name: Vue's fallback chain is
/// `props.t("locale.title") || "Language"` (its default `t` echoes the key, so
/// a host that passes no translator gets the English literal).
pub fn locale_popup_title(title: Option<&String>) -> String {
    match title {
        Some(title) => title.clone(),
        None => t("components.hk.localePickerPopup.title", "Language"),
    }
}

/// Vue's presence-only marker attribute: `data-*` carries `"true"` while the
/// flag is on and is ABSENT otherwise (a serialized `="false"` reads as a value
/// to a `[data-checked]` selector).
fn marker_attr(flag: bool) -> Option<&'static str> {
    if flag { Some("true") } else { None }
}

/// One lucide glyph, serialized exactly as `lucide-vue-next` renders it: the
/// 24-unit viewBox, the stroke attribute set, the
/// `lucide lucide-{name}-icon lucide-{name}` class pair and the automatic
/// `aria-hidden="true"` the library adds when no a11y prop is passed.
fn lucide_icon_svg(name: &str, size: u32, body: &str) -> String {
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{size}\" height=\"{size}\" \
         viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" \
         stroke-linecap=\"round\" stroke-linejoin=\"round\" \
         class=\"lucide lucide-{name}-icon lucide-{name}\" aria-hidden=\"true\">{body}</svg>"
    )
}

/// lucide `check`'s path (`<Check size={12} />`).
const LUCIDE_CHECK_BODY: &str = r#"<path d="M20 6 9 17l-5-5"></path>"#;

/// A glyph mounted through `dangerous_inner_html` on its own
/// `style="display:contents"` host (the crate-wide SVG rule: an rsx `svg {}`
/// child would be an HTML element, and the host must not add a box).
fn glyph_host(markup: String) -> Element {
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: markup,
        }
    }
}

#[define_props]
pub struct LocalePickerPopupProps {
    /// Controlled visibility (Vue: HkMenu's `open` prop; the popup itself
    /// renders nothing while closed).
    pub open: bool,

    /// The locale list, in the host's order.
    pub locales: Vec<LocalePopupEntry>,

    /// The locale that carries the check.
    pub current_locale: String,

    /// Vue's `placement` allow-list (default `right-start`, like Vue).
    pub placement: LocalePopupPlacement,

    /// The trigger rect to anchor against (`feedback::popover::
    /// anchor_rect_from_element_id` measures one by id). Without it the surface
    /// pins to the nearest positioned ancestor — see [`locale_popup_style`].
    pub anchor: Option<PopoverAnchorRect>,

    /// Gap between the trigger and the popout, in px (Vue: HkMenu's `offset`
    /// default 6).
    #[default(6.0)]
    pub offset: f64,

    /// The panel's accessible name (Vue: the `title` HkMenu publishes as the
    /// popout's `aria-label`). `None` resolves through the i18n bundle.
    pub title: Option<String>,

    /// Fires with the desired open state (Vue: `update:open`).
    pub on_open_change: Option<EventHandler<bool>>,

    /// Fires with the chosen locale code (Vue: `select`).
    pub on_select: Option<EventHandler<String>>,
}

#[component]
pub fn LocalePickerPopup(props: LocalePickerPopupProps) -> Element {
    if !props.open {
        return empty_vnode();
    }

    let items = locale_popup_items(&props.locales, &props.current_locale);
    let placement = props.placement;
    let side = placement.side_token();
    let align = placement.align_token();
    let host_style = locale_popup_style(placement, props.anchor, props.offset);
    // Vue: HkSelectPanel writes `aria-label={props.title || undefined}`.
    let aria_label =
        Some(locale_popup_title(props.title.as_ref())).filter(|title| !title.is_empty());

    let on_open_change = props.on_open_change.clone();
    let on_select = props.on_select.clone();
    let request_close = {
        let change = on_open_change.clone();
        move || {
            if let Some(handler) = change.as_ref() {
                handler.call(false);
            }
        }
    };
    let key_close = request_close.clone();
    let popup_keydown = move |event: KeyboardEvent| {
        // Vue's Escape path: the panel asks its owner to close. Consume the key
        // only when it actually closed something, so a host dialog's own Escape
        // still works (the same rule the select/header picker mirrors follow).
        if event.key.as_str() == "Escape" {
            event.prevent_default();
            event.stop_propagation();
            key_close();
        }
    };

    let mut rows: Vec<VNode> = Vec::with_capacity(items.len());
    for item in &items {
        let key = item.key.clone();
        let label = item.label.clone();
        let flag = item.flag.clone();
        let checked = item.checked;
        let click_close = request_close.clone();
        let click_select = on_select.clone();
        let click_key = key.clone();
        rows.push(rsx! {
            button {
                "type": "button",
                class: "hk-menu-row",
                "data-checked": marker_attr(checked),
                onclick: move |event: MouseEvent| {
                    event.stop_propagation();
                    if let Some(handler) = click_select.as_ref() {
                        handler.call(click_key.clone());
                    }
                    // Vue's leaf pick closes the menu it lives in.
                    click_close();
                },
                // Vue reserves the leading check column whenever any item
                // carries `checked` — every locale item does, so it is always
                // rendered (HkMenu's `checkReserved`).
                span {
                    class: "hk-menu-check",
                    "data-on": marker_attr(checked),
                    "aria-hidden": "true",
                    if checked {
                        {glyph_host(lucide_icon_svg("check", 12, LUCIDE_CHECK_BODY))}
                    }
                }
                if let Some(flag) = flag {
                    span { class: "hk-menu-flag", {flag} }
                }
                span { class: "hk-menu-label", {label} }
            }
        });
    }

    let rows = VNode::Fragment(rows);
    rsx! {
        div {
            class: "hk-select-popout-host",
            "data-side": side,
            "data-align": align,
            style: host_style,
            div {
                class: "hk-select-popout",
                "aria-label": aria_label,
                onkeydown: popup_keydown,
                div {
                    class: "hk-menu-level",
                    "role": "menu",
                    {rows}
                }
            }
        }
    }
}

impl StyledComponent for LocalePickerPopupComponent {
    fn styles() -> &'static str {
        // NO sheet of its own. Vue's `HkLocalePickerPopup` imports `HkMenu`
        // only; the surface is HkSelectPanel's (`.hk-select-popout*`, painted by
        // the mirrored `HkSelect.scss` that `basic/select.rs` compiles) and the
        // rows are HkMenu's (`.hk-menu-*`, whose sheet is not in this wave's
        // vendored set — they are hooks here, exactly like `basic/kbd.rs`).
        // Registering this name is still correct: it pins the component's
        // identity in the registry bundle with no CSS of its own.
        ""
    }

    fn name() -> &'static str {
        "locale-picker-popup"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn locales() -> Vec<LocalePopupEntry> {
        vec![
            LocalePopupEntry {
                code: "en".to_string(),
                label: "English".to_string(),
                flag: Some("🇬🇧".to_string()),
            },
            LocalePopupEntry {
                code: "zh-Hans".to_string(),
                label: "简体中文".to_string(),
                flag: None,
            },
        ]
    }

    fn anchor() -> PopoverAnchorRect {
        PopoverAnchorRect {
            x: 100.0,
            y: 50.0,
            width: 40.0,
            height: 20.0,
        }
    }

    #[test]
    fn locale_popup_placement_tokens_match_the_vue_allow_list() {
        assert_eq!(LocalePopupPlacement::BottomEnd.token(), "bottom-end");
        assert_eq!(LocalePopupPlacement::RightStart.token(), "right-start");
        assert_eq!(LocalePopupPlacement::LeftStart.token(), "left-start");
        // Vue's filter passes the three known tokens through…
        assert_eq!(
            LocalePopupPlacement::from_token("bottom-end"),
            LocalePopupPlacement::BottomEnd
        );
        assert_eq!(
            LocalePopupPlacement::from_token("left-start"),
            LocalePopupPlacement::LeftStart
        );
        // …and resolves everything else to the default.
        assert_eq!(
            LocalePopupPlacement::from_token("bottom-start"),
            LocalePopupPlacement::RightStart
        );
        assert_eq!(
            LocalePopupPlacement::from_token(""),
            LocalePopupPlacement::RightStart
        );
        // The resolved side/align pairs feed the transition's transform-origin.
        assert_eq!(LocalePopupPlacement::BottomEnd.side_token(), "bottom");
        assert_eq!(LocalePopupPlacement::BottomEnd.align_token(), "end");
        assert_eq!(LocalePopupPlacement::RightStart.side_token(), "right");
        assert_eq!(LocalePopupPlacement::RightStart.align_token(), "start");
        assert_eq!(LocalePopupPlacement::LeftStart.align_token(), "start");
    }

    #[test]
    fn locale_popup_maps_locales_to_menu_items() {
        let items = locale_popup_items(&locales(), "zh-Hans");
        assert_eq!(items.len(), 2);
        // Host order, key/label/flag preserved.
        assert_eq!(items[0].key, "en");
        assert_eq!(items[0].label, "English");
        assert_eq!(items[0].flag.as_deref(), Some("🇬🇧"));
        assert!(!items[0].checked);
        assert_eq!(items[1].key, "zh-Hans");
        assert!(items[1].checked);
        // An unknown current locale leaves every row unchecked (no panic, no
        // phantom selection) — Vue's `code === currentLocale` does the same.
        let items = locale_popup_items(&locales(), "fr");
        assert!(items.iter().all(|item| !item.checked));
        assert!(locale_popup_items(&[], "en").is_empty());
    }

    #[test]
    fn locale_popup_geometry_anchors_to_the_trigger_rect() {
        assert_eq!(
            locale_popup_style(LocalePopupPlacement::BottomEnd, Some(anchor()), 6.0),
            "left:140px;top:76px;transform:translate(-100%, 0)"
        );
        assert_eq!(
            locale_popup_style(LocalePopupPlacement::RightStart, Some(anchor()), 6.0),
            "left:146px;top:50px;transform:translate(0, 0)"
        );
        assert_eq!(
            locale_popup_style(LocalePopupPlacement::LeftStart, Some(anchor()), 6.0),
            "left:94px;top:50px;transform:translate(-100%, 0)"
        );
    }

    #[test]
    fn locale_popup_without_an_anchor_pins_to_the_positioned_ancestor() {
        // The picker root carries `position: relative`, so the unmeasured arm
        // is an absolute edge pin (never a fixed corner of the viewport).
        assert_eq!(
            locale_popup_style(LocalePopupPlacement::BottomEnd, None, 6.0),
            "position:absolute;top:calc(100% + 6px);right:0"
        );
        assert_eq!(
            locale_popup_style(LocalePopupPlacement::RightStart, None, 6.0),
            "position:absolute;left:calc(100% + 6px);top:0"
        );
        assert_eq!(
            locale_popup_style(LocalePopupPlacement::LeftStart, None, 6.0),
            "position:absolute;right:calc(100% + 6px);top:0"
        );
    }

    #[test]
    fn locale_popup_title_falls_back_to_the_english_bundle() {
        assert_eq!(
            locale_popup_title(None),
            t("components.hk.localePickerPopup.title", "Language")
        );
        assert_eq!(locale_popup_title(Some(&"Idioma".to_string())), "Idioma");
        // Vue's `props.title || undefined`: an empty title still names the
        // surface through the bundle rather than emitting `aria-label=""`.
        let title = locale_popup_title(Some(&String::new()));
        assert!(title.is_empty());
    }

    #[test]
    fn locale_picker_popup_defaults_match_the_vue_props() {
        let props = LocalePickerPopupProps::default();
        assert!(!props.open);
        assert!(props.locales.is_empty());
        assert_eq!(props.current_locale, "");
        // Vue's placement default is `right-start`.
        assert_eq!(props.placement, LocalePopupPlacement::RightStart);
        assert!(props.anchor.is_none());
        assert_eq!(props.offset, 6.0);
        assert!(props.title.is_none());
        assert!(props.on_open_change.is_none());
        assert!(props.on_select.is_none());
    }

    #[test]
    fn locale_popup_renders_the_vue_menu_contract() {
        let html = LocalePickerPopup(LocalePickerPopupProps {
            open: true,
            locales: locales(),
            current_locale: "en".to_string(),
            placement: LocalePopupPlacement::BottomEnd,
            anchor: Some(anchor()),
            title: Some("Language".to_string()),
            ..Default::default()
        })
        .render_to_html();

        // The HkSelectPanel surface: fixed host with the inline coords and the
        // resolved side/align, the scrolling popout, and its accessible name.
        assert!(html.contains(r#"class="hk-select-popout-host""#), "{html}");
        assert!(html.contains(r#"data-side="bottom""#), "{html}");
        assert!(html.contains(r#"data-align="end""#), "{html}");
        assert!(
            html.contains(r#"style="left:140px;top:76px;transform:translate(-100%, 0)""#),
            "{html}"
        );
        assert!(html.contains(r#"class="hk-select-popout""#), "{html}");
        assert!(html.contains(r#"aria-label="Language""#), "{html}");
        // The menu grammar: one level, one row per locale.
        assert!(html.contains(r#"class="hk-menu-level""#), "{html}");
        assert!(html.contains(r#"role="menu""#), "{html}");
        assert_eq!(html.matches(r#"class="hk-menu-row""#).count(), 2, "{html}");
        // The check column is reserved on EVERY row; only the current locale
        // carries `data-on` and the ✓ glyph.
        assert_eq!(
            html.matches(r#"class="hk-menu-check""#).count(),
            2,
            "{html}"
        );
        assert_eq!(html.matches(r#"data-on="true""#).count(), 1, "{html}");
        assert!(html.contains(r#"data-checked="true""#), "{html}");
        assert!(!html.contains(r#"data-checked="false""#), "{html}");
        // The svg carries `lucide lucide-check-icon lucide-check`, so the bare
        // needle matches twice; count the element wrapper instead.
        assert_eq!(html.matches("lucide-check-icon").count(), 1, "{html}");
        // Flags lead the label; a flagless locale renders none.
        assert!(html.contains(r#"class="hk-menu-flag""#), "{html}");
        assert!(html.contains("🇬🇧"), "{html}");
        assert!(html.contains(r#"class="hk-menu-label">English<"#), "{html}");
    }

    #[test]
    fn locale_popup_closed_renders_nothing() {
        let html = LocalePickerPopup(LocalePickerPopupProps {
            locales: locales(),
            current_locale: "en".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.is_empty(), "a closed popup mounts no surface: {html}");
    }

    #[test]
    fn locale_picker_popup_ships_no_sheet_of_its_own() {
        // Verified ownership: Vue ships no `HkLocalePickerPopup.scss`; the
        // surface comes from the mirrored HkSelect sheet and the rows from
        // HkMenu (hook-only this wave).
        assert_eq!(LocalePickerPopupComponent::styles(), "");
        assert_eq!(LocalePickerPopupComponent::name(), "locale-picker-popup");
        // The only sheet in the locale pair is the trigger's, and it belongs to
        // the picker — nothing this component could legitimately compile.
        let trigger_sheet = std::fs::read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/src/styles/vue-mirror/components/HkLocalePicker.scss"
        ))
        .expect("the vendored trigger sheet exists");
        assert!(trigger_sheet.contains(".hk-locale-picker-trigger"));
        assert!(
            !trigger_sheet.contains("hk-menu-"),
            "the trigger sheet never paints the menu rows"
        );
    }
}
