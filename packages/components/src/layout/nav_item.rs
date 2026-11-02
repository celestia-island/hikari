// hi-components/src/layout/nav_item.rs
// NavItem — mirror of the canonical Vue `HkNavItem` (one nav row: a plain
// action button, an anchor, or an accordion group of child rows).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkNavItem.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.hk-nav-item*` class names are literal and identical in both forms. The
// sheet `@use`s the unified menu-row grammar (`components/_menu-item.scss`,
// also vendored) and `styles/_polyfill.scss`, so that ONE compiled table
// carries the row metrics (`--hk-menu-item-*`) plus both interaction states.
//
// DOM contract — Vue's render output, branch for branch:
//
//   ── sub items present (the accordion group) ──────────────────────────
//   div[.host-class]                       (Vue: a bare wrapper div)
//     button.hk-nav-item.hk-nav-item-button
//            [.hk-nav-item-active] [.hk-nav-item-disabled]
//            [data-active] [data-disabled] type="button" [disabled]
//            [.host-class]
//       span.hk-nav-item-icon?             (the icon slot)
//       span.hk-nav-item-label?            (the default slot)
//       span[style="display:contents"] > svg.hk-nav-item-arrow[…]
//     div.hk-nav-item-children?            (only while expanded)
//       a.hk-nav-item.hk-nav-item-link[.hk-nav-item-active][data-active]
//              href="#<child.id>"
//         span.hk-nav-item-icon?           (child.icon)
//         span.hk-nav-item-label           (child.label)
//         span.hk-nav-item-badge?          (child.badge)
//   ── `to` ─────────────────────────────────────────────────────────────
//   a.hk-nav-item.hk-nav-item-link[.hk-nav-item-active][.hk-nav-item-disabled]
//        href={safeHref(to)} aria-disabled="true|false"
//        [aria-current="page"] [data-active] [data-disabled] [.host-class]
//   ── `href` ───────────────────────────────────────────────────────────
//   a.hk-nav-item.hk-nav-item-link[…]     (the same, minus `aria-current`)
//   ── otherwise ────────────────────────────────────────────────────────
//   button.hk-nav-item.hk-nav-item-button
//        [.hk-nav-item-active] [.hk-nav-item-disabled]
//        [data-active] [data-disabled] type="button" [disabled] [.host-class]
//
// The class order is Vue's `buildClass`: `hk-nav-item`, the branch's own
// `hk-nav-item-{button|link}`, `hk-nav-item-active`, `hk-nav-item-disabled`,
// then a host class (Vue lands a fallthrough `class` on the branch's root
// element — the wrapper `div` for the accordion branch, the row itself
// otherwise). The two data attributes are PRESENCE attributes
// (`data-active={props.active ? "" : undefined}`), so a false flag is genuinely
// absent instead of an empty attribute a `[data-active]` selector would still
// match — which is why the rows are built through `VElement` rather than
// `rsx!` (the badge.rs rule).
//
// Child-row indentation is the sheet's `.hk-nav-item-children {
// padding-inline-start: var(--space-16, 1rem) }` — ONE 16px step per nesting
// level, exposed as [`nav_item_indent_step_px`] for hosts that render their
// own nested runs; the leading icon cell is the menu grammar's
// `--hk-menu-item-icon-box` (16px, [`NAV_ITEM_ICON_BOX_PX`]).
//
// Deltas vs Vue (documented, not accidental):
//   * `expanded` is a CONTROLLED prop plus an `on_toggle` callback. Vue keeps
//     the accordion flag in a local `ref(false)` that its group button flips;
//     tairitsu 0.5.22 component-body hooks are render-scoped, so the mirror
//     hands the state to the host instead of owning it (this crate runs no
//     `use_signal` / `use_state` in mirrored components).
//   * Vue's `children` ARRAY prop (the child rows) is `sub_items` here — the
//     `children` name keeps its slot meaning (Vue's default slot). Vue tests
//     the array's PRESENCE, so an empty `[]` still renders the accordion
//     shell; the mirror tests emptiness, because a Rust `Vec` cannot tell
//     "absent" from "empty".
//   * Icons resolve through `MdiIcon` + `hikari_icons::Icon` (Vue passes a
//     component through `slots.icon` / `icon`). `None` here means "no icon
//     span at all", while `Some(empty_vnode())` keeps Vue's empty
//     `span.hk-nav-item-icon` — the distinction HkNavSidebar's unknown-icon
//     key relies on, since Vue's slot function is truthy even when it returns
//     null.
//   * The arrow is lucide `ChevronRight`'s markup (`size={16}`) mounted
//     through `dangerous_inner_html` on a `style="display:contents"` host: an
//     rsx `svg {}` child would be an HTML-namespace element that never paints,
//     and `dangerous_inner_html` suppresses an element's own children, hence
//     the dedicated host. The class string is lucide v1.0.0's merged order —
//     `lucide`, the passed class, then the `-icon` alias and the icon name —
//     so the sheet's `.hk-nav-item-arrow` selector matches the svg itself,
//     exactly as it does in Vue.
//   * `to` / `href` run through the ported `utils/safeHref.ts` allowlist
//     ([`is_safe_href`] / [`safe_href`]): http, https, mailto, tel, `/`, `#`,
//     `./` and `../` pass verbatim; a dangerous scheme (`javascript:`,
//     `vbscript:`, `data:`) or an empty value becomes the inert `"#"`.
//   * A disabled row still renders. The anchors keep Vue's shape
//     (`aria-disabled` + the sheet's `[data-disabled]` gate, with the click
//     handler calling `prevent_default()` and NOT emitting); the buttons carry
//     the native attribute, so the handler can never fire.

use hikari_icons::{Icon, MdiIcon};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct NavItemComponent;

/// One nesting step of child rows: the sheet's
/// `.hk-nav-item-children { padding-inline-start: var(--space-16, 1rem) }`.
pub const NAV_ITEM_INDENT_STEP_PX: u32 = 16;

/// The leading icon cell: `--hk-menu-item-icon-box` (16px) from the vendored
/// menu-item grammar. Vue passes child icons bare and lets the sheet normalize
/// them; the mirror's `.hk-icon` wrapper is a real box, so it takes the cell
/// size directly.
pub const NAV_ITEM_ICON_BOX_PX: u32 = 16;

/// lucide `ChevronRight` at `size={16}`, collapsed — byte-identical to the
/// markup Vue's `<ChevronRight size={16} class="hk-nav-item-arrow" />`
/// renders (see the header delta about the `display:contents` host).
const NAV_ITEM_ARROW_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide hk-nav-item-arrow lucide-chevron-right-icon lucide-chevron-right" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>"#;

/// The same glyph with the sheet's expanded modifier (rotate 90deg).
const NAV_ITEM_ARROW_EXPANDED_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide hk-nav-item-arrow hk-nav-item-arrow-expanded lucide-chevron-right-icon lucide-chevron-right" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>"#;

/// The paint-inert host every SVG glyph hangs on (`dangerous_inner_html`
/// suppresses an element's own children, so the markup cannot sit beside a
/// sibling — the crate-wide SVG rule).
fn glyph_host(markup: &'static str) -> Element {
    VNode::Element(Box::new(
        VElement::new("span")
            .style("display:contents")
            .dangerous_inner_html(markup),
    ))
}

/// Vue `utils/safeHref.ts` `isSafeHref`: the scheme allowlist for `href`
/// props. The dangerous-scheme check runs first, exactly like Vue's, so
/// `JaVaScRiPt:` can never slip through the case-insensitive allowlist.
pub fn is_safe_href(href: &str) -> bool {
    let trimmed = href.trim();
    if trimmed.is_empty() {
        return false;
    }
    let lower = trimmed.to_ascii_lowercase();
    if lower.starts_with("javascript:")
        || lower.starts_with("vbscript:")
        || lower.starts_with("data:")
    {
        return false;
    }
    lower.starts_with("http:")
        || lower.starts_with("https:")
        || lower.starts_with("mailto:")
        || lower.starts_with("tel:")
        || trimmed.starts_with('/')
        || trimmed.starts_with('#')
        || trimmed.starts_with("./")
        || trimmed.starts_with("../")
}

/// Vue `safeHref`: an allowed href passes verbatim, anything else (including
/// an absent / empty one) becomes the inert `"#"`.
pub fn safe_href(href: Option<&str>) -> String {
    match href {
        Some(value) if !value.is_empty() && is_safe_href(value) => value.to_string(),
        _ => "#".to_string(),
    }
}

/// Vue's four render branches, in its own resolution order.
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum NavItemKind {
    /// A plain `<button>` action row.
    Button,
    /// The `to` branch: `<a>` with `aria-current="page"` while active.
    To,
    /// The `href` branch: `<a>` without `aria-current`.
    Href,
    /// The child-row branch: a `div` wrapper around an accordion button.
    Group,
}

impl NavItemKind {
    /// The branch's own class — Vue adds `hk-nav-item-button` to BOTH button
    /// branches (the group's trigger is a button too) and `hk-nav-item-link`
    /// to both anchors.
    pub fn class_name(self) -> &'static str {
        match self {
            NavItemKind::Button | NavItemKind::Group => "hk-nav-item-button",
            NavItemKind::To | NavItemKind::Href => "hk-nav-item-link",
        }
    }

    /// True for the two anchor branches.
    pub fn is_anchor(self) -> bool {
        matches!(self, NavItemKind::To | NavItemKind::Href)
    }
}

/// Vue's branch resolution, in its own order: the child-row array wins over
/// `to`, `to` wins over `href`, and a row with neither is a plain button.
pub fn nav_item_kind(has_sub_items: bool, to: Option<&str>, href: Option<&str>) -> NavItemKind {
    if has_sub_items {
        NavItemKind::Group
    } else if to.is_some() {
        NavItemKind::To
    } else if href.is_some() {
        NavItemKind::Href
    } else {
        NavItemKind::Button
    }
}

/// The complete class list in Vue's `buildClass` order (`hk-nav-item`, the
/// branch class, `-active`, `-disabled`). A host class is appended by
/// [`nav_item_with_host_class`] — Vue lands it on the branch's root element only.
pub fn nav_item_classes(active: bool, disabled: bool, kind: NavItemKind) -> String {
    let mut classes = format!("hk-nav-item {}", kind.class_name());
    if active {
        classes.push_str(" hk-nav-item-active");
    }
    if disabled {
        classes.push_str(" hk-nav-item-disabled");
    }
    classes
}

/// Append a fallthrough host class (Vue's `{...attrs}` `class` merge).
pub fn nav_item_with_host_class(classes: String, host_class: &str) -> String {
    if host_class.is_empty() {
        classes
    } else {
        format!("{classes} {host_class}")
    }
}

/// The child-row indent at `level` (0 = the row itself): one 16px step per
/// nesting level.
pub fn nav_item_indent_step_px(level: u32) -> u32 {
    level.saturating_mul(NAV_ITEM_INDENT_STEP_PX)
}

/// The arrow's class list (Vue:
/// `["hk-nav-item-arrow", expanded ? "hk-nav-item-arrow-expanded" : ""]`).
pub fn nav_item_arrow_classes(expanded: bool) -> &'static str {
    if expanded {
        "hk-nav-item-arrow hk-nav-item-arrow-expanded"
    } else {
        "hk-nav-item-arrow"
    }
}

/// The arrow markup for the state; its svg class is
/// [`nav_item_arrow_classes`] merged into lucide's own order.
pub fn nav_item_arrow_svg(expanded: bool) -> &'static str {
    if expanded {
        NAV_ITEM_ARROW_EXPANDED_SVG
    } else {
        NAV_ITEM_ARROW_SVG
    }
}

/// One child row (Vue: `interface NavItemChild`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct NavItemChild {
    /// The row's identity; also the fragment its anchor points at.
    pub id: String,
    pub label: String,
    pub icon: Option<MdiIcon>,
    /// The current child row (`hk-nav-item-active` + `data-active`).
    pub active: bool,
    pub badge: Option<String>,
}

/// `div.hk-nav-item-children` with one anchor per child row, exactly Vue's
/// `childItems()`. Child anchors carry `href="#<id>"` verbatim (Vue does NOT
/// run `safeHref` here — a same-document fragment cannot carry a scheme) and
/// never a click handler.
fn nav_item_children_block(children: &[NavItemChild]) -> Element {
    let mut block = VElement::new("div").class("hk-nav-item-children");
    for child in children {
        let mut row = VElement::new("a")
            .attr("href", format!("#{}", child.id))
            .class(nav_item_classes(child.active, false, NavItemKind::Href))
            .key(&child.id);
        if child.active {
            row = row.attr("data-active", "");
        }
        if let Some(icon) = child.icon {
            row = row.child(rsx! {
                span { class: "hk-nav-item-icon",
                    Icon { icon, size: NAV_ITEM_ICON_BOX_PX }
                }
            });
        }
        row = row.child(rsx! {
            span { class: "hk-nav-item-label", {VNode::Text(VText::new(child.label.as_str()))} }
        });
        if let Some(badge) = &child.badge {
            row = row.child(rsx! {
                span { class: "hk-nav-item-badge", "{badge}" }
            });
        }
        block = block.child(VNode::Element(Box::new(row)));
    }
    VNode::Element(Box::new(block))
}

/// Vue's `content()`: the icon slot, then the default slot, each wrapped in
/// its own span only when the slot carries something. An `icon_slot` of
/// `Some(empty_vnode())` still renders `span.hk-nav-item-icon`, which is how
/// Vue's presence test behaves.
fn nav_item_content(icon_slot: Option<&Element>, children: &Element) -> VNode {
    let mut nodes: Vec<VNode> = Vec::new();
    if let Some(icon) = icon_slot {
        nodes.push(rsx! {
            span { class: "hk-nav-item-icon",
                {icon.clone()}
            }
        });
    }
    if !slot_is_empty(children) {
        nodes.push(rsx! {
            span { class: "hk-nav-item-label",
                {children.clone()}
            }
        });
    }
    VNode::Fragment(nodes)
}

/// True when a slot carries nothing to render (the icon_button.rs rule).
fn slot_is_empty(node: &VNode) -> bool {
    match node {
        VNode::Fragment(nodes) => nodes.iter().all(slot_is_empty),
        VNode::Text(text) => text.text.is_empty(),
        VNode::Element(_) | VNode::DynamicText(_) => false,
    }
}

#[define_props]
pub struct NavItemProps {
    /// Vue: `active` (the row is the current route).
    #[default]
    pub active: bool,

    /// Vue: `disabled`.
    #[default]
    pub disabled: bool,

    /// Vue: `to` — the route target; renders an anchor that also carries
    /// `aria-current="page"` while active.
    pub to: Option<String>,

    /// Vue: `href` — a link target without `aria-current`.
    pub href: Option<String>,

    /// Vue: the `children` ARRAY prop — the child rows of the accordion
    /// branch (see the header delta on the rename).
    #[default]
    pub sub_items: Vec<NavItemChild>,

    /// The accordion flag (Vue: the local `expanded` ref); controlled here.
    #[default]
    pub expanded: bool,

    /// The icon slot (Vue: `slots.icon`).
    pub icon_slot: Option<Element>,

    /// The default slot (Vue: `slots.default`, the row label).
    pub children: Element,

    /// The `click` emit (Vue: `emits: { click }`).
    pub onclick: Option<EventHandler<MouseEvent>>,

    /// The accordion toggle; it fires with the NEW value (Vue's group button
    /// flips its own ref instead of emitting).
    pub on_toggle: Option<EventHandler<bool>>,

    /// Fallthrough host class (Vue: the `class` attr merge on the branch root).
    #[default]
    pub class: String,
}

#[component]
pub fn NavItem(props: NavItemProps) -> Element {
    let kind = nav_item_kind(
        !props.sub_items.is_empty(),
        props.to.as_deref(),
        props.href.as_deref(),
    );
    let classes = nav_item_classes(props.active, props.disabled, kind);
    let content = nav_item_content(props.icon_slot.as_ref(), &props.children);

    let active = props.active;
    let disabled = props.disabled;
    let expanded = props.expanded;

    match kind {
        NavItemKind::Group => {
            let on_toggle = props.on_toggle.clone();
            // The host class rides the wrapper div below, NOT the button:
            // Vue's fallthrough lands on this branch's single root element.
            let mut button = VElement::new("button")
                .attr("type", "button")
                .class(classes)
                .on_click(move |_event: MouseEvent| {
                    if let Some(handler) = on_toggle.as_ref() {
                        handler.call(!expanded);
                    }
                })
                .child(content)
                .child(glyph_host(nav_item_arrow_svg(expanded)));
            if active {
                button = button.attr("data-active", "");
            }
            if disabled {
                button = button
                    .attr("data-disabled", "")
                    .attr("disabled", "disabled");
            }
            // Vue lands a fallthrough class on the branch's single root — the
            // wrapper div here, not the button.
            let mut root = VElement::new("div")
                .class(props.class.clone())
                .child(VNode::Element(Box::new(button)));
            if expanded {
                root = root.child(nav_item_children_block(&props.sub_items));
            }
            VNode::Element(Box::new(root))
        }
        NavItemKind::To | NavItemKind::Href => {
            let onclick = props.onclick.clone();
            let target = if kind == NavItemKind::To {
                safe_href(props.to.as_deref())
            } else {
                safe_href(props.href.as_deref())
            };
            let mut anchor = VElement::new("a")
                .attr("href", target)
                .class(nav_item_with_host_class(classes, &props.class))
                .attr("aria-disabled", if disabled { "true" } else { "false" })
                .on_click(move |event: MouseEvent| {
                    // Vue's `onClick`: a disabled anchor swallows the click.
                    if disabled {
                        event.prevent_default();
                        return;
                    }
                    if let Some(handler) = onclick.as_ref() {
                        handler.call(event);
                    }
                })
                .child(content);
            // `aria-current` rides the `to` branch only.
            if kind == NavItemKind::To && active {
                anchor = anchor.attr("aria-current", "page");
            }
            if active {
                anchor = anchor.attr("data-active", "");
            }
            if disabled {
                anchor = anchor.attr("data-disabled", "");
            }
            VNode::Element(Box::new(anchor))
        }
        NavItemKind::Button => {
            let onclick = props.onclick.clone();
            let mut button = VElement::new("button")
                .attr("type", "button")
                .class(nav_item_with_host_class(classes, &props.class))
                .on_click(move |event: MouseEvent| {
                    if let Some(handler) = onclick.as_ref() {
                        handler.call(event);
                    }
                })
                .child(content);
            if active {
                button = button.attr("data-active", "");
            }
            if disabled {
                button = button
                    .attr("data-disabled", "")
                    .attr("disabled", "disabled");
            }
            VNode::Element(Box::new(button))
        }
    }
}

impl StyledComponent for NavItemComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-nav-item*` names literal so this CSS matches the Vue build).
        // The sheet `@use`s the vendored `_menu-item.scss` grammar and
        // `_polyfill.scss`, so this one table also carries `--hk-menu-item-*`.
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkNavItem.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "nav-item"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn label(text: &str) -> Element {
        rsx! {
            span { "{text}" }
        }
    }

    #[test]
    fn nav_item_defaults_match_the_vue_props() {
        let props = NavItemProps::default();
        assert!(!props.active);
        assert!(!props.disabled);
        assert!(props.to.is_none());
        assert!(props.href.is_none());
        assert!(props.sub_items.is_empty());
        // Vue's local `expanded` ref starts false.
        assert!(!props.expanded);
        assert!(props.icon_slot.is_none());
        assert!(slot_is_empty(&props.children));
        assert!(props.onclick.is_none());
        assert!(props.on_toggle.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn nav_item_kind_resolution_follows_vues_branch_order() {
        // The child-row array wins over both link props.
        assert_eq!(
            nav_item_kind(true, Some("/a"), Some("https://example.com")),
            NavItemKind::Group
        );
        // `to` wins over `href` (it is the branch that carries aria-current).
        assert_eq!(
            nav_item_kind(false, Some("/a"), Some("https://example.com")),
            NavItemKind::To
        );
        assert_eq!(
            nav_item_kind(false, None, Some("https://example.com")),
            NavItemKind::Href
        );
        assert_eq!(nav_item_kind(false, None, None), NavItemKind::Button);
        // The anchor predicate matches the two link branches.
        assert!(NavItemKind::To.is_anchor() && NavItemKind::Href.is_anchor());
        assert!(!NavItemKind::Button.is_anchor() && !NavItemKind::Group.is_anchor());
    }

    #[test]
    fn nav_item_class_lists_follow_vues_build_class_order() {
        assert_eq!(
            nav_item_classes(false, false, NavItemKind::To),
            "hk-nav-item hk-nav-item-link"
        );
        assert_eq!(
            nav_item_classes(true, true, NavItemKind::Href),
            "hk-nav-item hk-nav-item-link hk-nav-item-active hk-nav-item-disabled"
        );
        // Both button branches carry `hk-nav-item-button` — the accordion's
        // trigger is a button too.
        assert_eq!(
            nav_item_classes(false, false, NavItemKind::Button),
            "hk-nav-item hk-nav-item-button"
        );
        assert_eq!(
            nav_item_classes(false, false, NavItemKind::Group),
            "hk-nav-item hk-nav-item-button"
        );
        // A host class lands after every built class (Vue's attr merge).
        assert_eq!(
            nav_item_with_host_class(nav_item_classes(true, false, NavItemKind::To), "host-row"),
            "hk-nav-item hk-nav-item-link hk-nav-item-active host-row"
        );
        assert_eq!(
            nav_item_with_host_class(nav_item_classes(false, false, NavItemKind::Button), ""),
            "hk-nav-item hk-nav-item-button"
        );
    }

    #[test]
    fn nav_item_indent_is_one_sixteen_pixel_step_per_level() {
        // The sheet's `.hk-nav-item-children` inset is `--space-16` = 1rem.
        assert_eq!(NAV_ITEM_INDENT_STEP_PX, 16);
        assert_eq!(nav_item_indent_step_px(0), 0);
        assert_eq!(nav_item_indent_step_px(1), 16);
        assert_eq!(nav_item_indent_step_px(3), 48);
        // The icon column is the menu grammar's 16px cell.
        assert_eq!(NAV_ITEM_ICON_BOX_PX, 16);
    }

    #[test]
    fn nav_item_href_allowlist_matches_the_ported_safe_href() {
        // Allowed schemes / shapes pass verbatim.
        for allowed in [
            "https://example.com/x",
            "http://example.com",
            "mailto:dev@example.com",
            "tel:+10000000000",
            "/dashboard",
            "#section",
            "./relative",
            "../up",
        ] {
            assert!(is_safe_href(allowed), "{allowed} should be allowed");
            assert_eq!(safe_href(Some(allowed)), allowed);
        }
        // Dangerous schemes are neutralized, whatever their casing.
        for dangerous in [
            "javascript:alert(1)",
            "JaVaScRiPt:alert(1)",
            "  javascript:alert(1)",
            "vbscript:msgbox(1)",
            "data:text/html,<script>alert(1)</script>",
        ] {
            assert!(!is_safe_href(dangerous), "{dangerous} must be rejected");
            assert_eq!(safe_href(Some(dangerous)), "#");
        }
        // Vue's `if (!href) return "#"`.
        assert!(!is_safe_href(""));
        assert_eq!(safe_href(None), "#");
        assert_eq!(safe_href(Some("")), "#");
        // A scheme that is merely similar is not in the allowlist.
        assert!(!is_safe_href("httpx://example.com"));
    }

    #[test]
    fn nav_item_arrow_classes_and_markup_stay_in_step() {
        assert_eq!(nav_item_arrow_classes(false), "hk-nav-item-arrow");
        assert_eq!(
            nav_item_arrow_classes(true),
            "hk-nav-item-arrow hk-nav-item-arrow-expanded"
        );
        for (expanded, svg) in [
            (false, nav_item_arrow_svg(false)),
            (true, nav_item_arrow_svg(true)),
        ] {
            // The sheet selects the svg itself, so the class must ride it.
            assert!(
                svg.contains(nav_item_arrow_classes(expanded)),
                "the svg must carry the row arrow classes: {svg}"
            );
            assert!(svg.contains(r#"viewBox="0 0 24 24""#), "{svg}");
            assert!(svg.contains(r#"<path d="m9 18 6-6-6-6"/>"#), "{svg}");
            assert!(svg.contains(r#"aria-hidden="true""#), "{svg}");
            // lucide v1.0.0 merge order: lucide, the passed class, aliases.
            assert!(
                svg.contains(r#"class="lucide hk-nav-item-arrow"#),
                "the passed class rides right after `lucide`: {svg}"
            );
        }
        assert!(!nav_item_arrow_svg(false).contains("hk-nav-item-arrow-expanded"));
        assert!(nav_item_arrow_svg(true).contains("hk-nav-item-arrow-expanded"));
    }

    #[test]
    fn nav_item_renders_the_vue_link_row() {
        let html = NavItem(NavItemProps {
            active: true,
            to: Some("/dashboard".to_string()),
            icon_slot: Some(rsx! {
                span { "icon" }
            }),
            children: label("Dashboard"),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "<a",
            r#"class="hk-nav-item hk-nav-item-link hk-nav-item-active""#,
            r#"href="/dashboard""#,
            // Vue always renders the boolean form on the anchors.
            r#"aria-disabled="false""#,
            r#"aria-current="page""#,
            r#"data-active="""#,
            r#"class="hk-nav-item-icon""#,
            r#"class="hk-nav-item-label""#,
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The disabled marker is presence-only — an active row has no
        // `data-disabled` at all.
        assert!(!html.contains("data-disabled"), "{html}");
        // Icon precedes the label, exactly like Vue's `content()`.
        let icon = html.find("hk-nav-item-icon").expect("icon span");
        let text = html.find("hk-nav-item-label").expect("label span");
        assert!(icon < text, "the icon span comes first: {html}");
    }

    #[test]
    fn nav_item_renders_the_vue_accordion_group() {
        let collapsed = NavItem(NavItemProps {
            sub_items: vec![NavItemChild {
                id: "child-a".to_string(),
                label: "Child A".to_string(),
                active: true,
                badge: Some("3".to_string()),
                ..Default::default()
            }],
            children: label("Group"),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "<div",
            r#"type="button""#,
            r#"class="hk-nav-item hk-nav-item-button""#,
            "hk-nav-item-arrow",
            "display:contents",
        ] {
            assert!(collapsed.contains(needle), "missing {needle}: {collapsed}");
        }
        // The child block only exists while expanded.
        assert!(!collapsed.contains("hk-nav-item-children"), "{collapsed}");
        assert!(!collapsed.contains("href=\"#child-a\""), "{collapsed}");

        let expanded = NavItem(NavItemProps {
            expanded: true,
            sub_items: vec![NavItemChild {
                id: "child-a".to_string(),
                label: "Child A".to_string(),
                active: true,
                badge: Some("3".to_string()),
                ..Default::default()
            }],
            children: label("Group"),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-nav-item-children""#,
            r##"href="#child-a""##,
            r#"class="hk-nav-item hk-nav-item-link hk-nav-item-active""#,
            r#"data-active="""#,
            r#"class="hk-nav-item-label""#,
            r#"class="hk-nav-item-badge""#,
            "hk-nav-item-arrow-expanded",
        ] {
            assert!(expanded.contains(needle), "missing {needle}: {expanded}");
        }
        // Child rows carry no `data-disabled` and no click contract.
        assert!(!expanded.contains("data-disabled"), "{expanded}");
    }

    #[test]
    fn nav_item_renders_the_plain_button_row_with_the_disabled_gate() {
        let html = NavItem(NavItemProps {
            disabled: true,
            children: label("Do it"),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "<button",
            r#"type="button""#,
            r#"class="hk-nav-item hk-nav-item-button hk-nav-item-disabled""#,
            r#"data-disabled="""#,
            r#"disabled="disabled""#,
            r#"class="hk-nav-item-label""#,
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // No aria-current / href on a plain button row.
        assert!(!html.contains("aria-current"), "{html}");
        assert!(!html.contains("href"), "{html}");
    }

    #[test]
    fn nav_item_neutralizes_a_dangerous_href() {
        let html = NavItem(NavItemProps {
            href: Some("javascript:alert(1)".to_string()),
            children: label("Bad"),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r##"href="#"##), "{html}");
        assert!(!html.contains("javascript"), "{html}");
        // The `href` branch carries no `aria-current`.
        assert!(!html.contains("aria-current"), "{html}");
    }

    #[test]
    fn nav_item_styles_come_from_the_canonical_vue_sheet() {
        let css = NavItemComponent::styles();
        for class in [
            ".hk-nav-item",
            ".hk-nav-item-icon",
            ".hk-nav-item-label",
            ".hk-nav-item-badge",
            ".hk-nav-item-arrow",
            ".hk-nav-item-arrow-expanded",
            ".hk-nav-item-children",
        ] {
            assert!(
                css.contains(class),
                "nav-item css must carry the vue class {class:?}"
            );
        }
        // The vendored menu-item grammar lands in the same table.
        for token in ["--hk-menu-item-min-h", "--hk-menu-item-pad-x"] {
            assert!(css.contains(token), "missing menu-item token {token}");
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored nav item sheet"
        );
    }
}
