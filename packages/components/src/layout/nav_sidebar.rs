// hi-components/src/layout/nav_sidebar.rs
// NavSidebar — mirror of the canonical Vue `HkNavSidebar` (the ready-made
// navigation band: one row per app route).
//
// NO STYLESHEET OF ITS OWN. The Vue component ships no sheet and renders no
// `hk-` class of its own: it is pure composition — `HSidebar` supplies the
// panel chrome, `HNavItem` (the sibling mirror in `nav_item.rs`) supplies the
// rows, and the only classes this component writes are the HOST-scoped
// `s-nav-item-*` hooks its consuming app dresses. `styles()` therefore returns
// an empty table (the `basic::kbd` convention — an empty table, not an error):
// layout comes from the host's utility classes, and the row geometry from the
// vendored `HkNavItem.scss` that `NavItemComponent::styles()` carries.
//
// DOM contract (Vue's render output):
//
//   nav[.host-class]                    (the band inside the panel's slot)
//     <NavItem row>                     (per item; key = item.key)
//        span.hk-nav-item-icon          ← ALWAYS rendered: Vue's `icon` slot is
//          div.hk-icon > svg            a function, so it is truthy even when
//                                       the icon key is unknown (empty span)
//        span.hk-nav-item-label
//          span.s-nav-item-content      (host-scoped classes, `s-` prefix)
//            span.s-nav-item-label      {item.label}
//            span.s-nav-item-badge?     aria-label="{badge} pending"
//                                       {item.badge}
//
// Row state comes from the props the Vue template computes per item:
// `active = currentRoute === item.route` (exact string equality),
// `disabled = item.disabled`, and a click that emits the item's route.
//
// Deltas vs Vue (documented, not accidental):
//   * THE PANEL SHELL IS NOT RENDERED HERE. Vue wraps the band in
//     `<HSidebar width="224px">`; the Rust `Sidebar` in `navigation/sidebar.rs`
//     is still the LEGACY component (a different sheet and class family), so
//     HkSidebar's mirror is not available to compose yet. The mirror therefore
//     renders the band Vue nests inside that panel and leaves the panel to the
//     host, exposing the width it must use as
//     [`nav_sidebar_panel_width`] (`NAV_SIDEBAR_PANEL_WIDTH`, Vue's literal).
//   * `collapsed` IS DEAD UPSTREAM. HkNavSidebar declares it and never threads
//     it into `HSidebar` (the render passes `width` only), so the panel stays
//     full width and the rows keep their labels whatever the flag says. The
//     mirror keeps the prop for public-surface parity and reproduces the same
//     render — it does NOT invent a collapsed layout the Vue form cannot show.
//   * `navItems[].icon` is a NAME STRING keyed into Vue's `iconMap` (lucide
//     components). The mirror resolves the same twenty keys onto the crate's
//     minimal `MdiIcon` vocabulary ([`nav_sidebar_icon`]); an unknown key is
//     `None`, and Vue's own map miss behaves the same way (no glyph, empty icon
//     cell). The table below is the exact port — see the approximations marked
//     in [`nav_sidebar_icon`].
//   * THE BADGE LABEL IS NOT I18N IN VUE: it hard-codes `` `${item.badge}
//     pending` ``. The mirror routes it through the bundle
//     (`components.hk.navSidebar.badgePending`, `"{badge} pending"`) so a host
//     can translate it; an untranslated locale renders byte-identical text.
//     Vue's `item.badge &&` truthiness also skips an EMPTY badge string, which
//     the mirror reproduces instead of rendering an empty pill.
//   * `key={item.key}` is reproduced by stamping the row root's identity
//     (`VElement::key`), which is what Vue's keyed list does.

use hikari_icons::MdiIcon;

use super::nav_item::{NavItem, NavItemProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct NavSidebarComponent;

/// The panel width Vue hands to `HSidebar` (`<HSidebar width="224px">`).
pub const NAV_SIDEBAR_PANEL_WIDTH: &str = "224px";

/// The row icon size Vue passes (`h(IconComp, { size: 16 })`).
pub const NAV_SIDEBAR_ICON_PX: u32 = 16;

/// One nav entry (Vue: `interface NavItem` — `{ key, icon, label, route,
/// disabled?, badge? }`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct NavSidebarItem {
    /// Stable row identity (Vue: `key`, the list key).
    pub key: String,
    /// The icon NAME from Vue's `iconMap` (see [`nav_sidebar_icon`]).
    pub icon: String,
    pub label: String,
    /// The route the row navigates to; compared verbatim with
    /// [`NavSidebarProps::current_route`].
    pub route: String,
    pub disabled: bool,
    pub badge: Option<String>,
}

/// The panel width the host must give its own panel (Vue's literal `224px`).
pub fn nav_sidebar_panel_width() -> &'static str {
    NAV_SIDEBAR_PANEL_WIDTH
}

/// Vue's `const active = props.currentRoute === item.route` — exact string
/// equality, no prefix / trailing-slash normalisation.
pub fn nav_sidebar_is_active(current_route: &str, route: &str) -> bool {
    current_route == route
}

/// The badge's accessible name. Vue hard-codes `` `${badge} pending` ``; the
/// mirror asks the bundle first and falls back to the same English text.
pub fn nav_sidebar_badge_label(badge: &str) -> String {
    let template = hikari_i18n::t("components.hk.navSidebar.badgePending", "{badge} pending");
    template.replace("{badge}", badge)
}

/// The port of Vue's `iconMap` onto the crate's `MdiIcon` vocabulary.
///
/// Nine keys have an exact MDI counterpart (`zap`, `mic`, `settings`,
/// `panels`, `bell`, `box`, `chart`, `bar`, `manifest`); the rest are the
/// nearest semantic glyph the minimal set carries, because the enum is a
/// deliberately small subset. The approximations are the `plug` (Cable →
/// SwapHorizontal), `bot` (Bot → Chat), `cpu` (Cpu → CubeOutline), `folder`
/// (FolderOpen → BookOpen), `radio` (Send → ArrowRight), `monitor` (Monitor →
/// ViewColumn), `link` (Webhook → SourceBranch), `key` (Key → Tag), `shield`
/// (Shield → CheckboxMarkedCircle) and `share` (Share2 →
/// ArrowExpandHorizontal) rows.
pub fn nav_sidebar_icon(key: &str) -> Option<MdiIcon> {
    let icon = match key {
        "chart" => MdiIcon::ViewDashboard,
        "plug" => MdiIcon::SwapHorizontal,
        "bot" => MdiIcon::Chat,
        "cpu" => MdiIcon::CubeOutline,
        "zap" => MdiIcon::LightningBolt,
        "folder" => MdiIcon::BookOpen,
        "radio" => MdiIcon::ArrowRight,
        "monitor" => MdiIcon::ViewColumn,
        "box" => MdiIcon::Package,
        "link" => MdiIcon::SourceBranch,
        "key" => MdiIcon::Tag,
        "shield" => MdiIcon::CheckboxMarkedCircle,
        "bar" => MdiIcon::Graph,
        "gauge" => MdiIcon::Pulse,
        "mic" => MdiIcon::Microphone,
        "settings" => MdiIcon::Cog,
        "panels" => MdiIcon::Layers,
        "bell" => MdiIcon::Bell,
        "share" => MdiIcon::ArrowExpandHorizontal,
        "manifest" => MdiIcon::TextBox,
        _ => return None,
    };
    Some(icon)
}

/// The icon slot's content: the mapped glyph, or nothing at all for an unknown
/// key. The SLOT stays present either way (Vue's `icon: () => …` is a truthy
/// function), so the row keeps its empty `span.hk-nav-item-icon` cell and the
/// labels stay aligned.
fn nav_sidebar_icon_slot(key: &str) -> Element {
    match nav_sidebar_icon(key) {
        Some(icon) => rsx! {
            Icon { icon, size: NAV_SIDEBAR_ICON_PX }
        },
        None => empty_vnode(),
    }
}

/// The default slot Vue builds for one row: `span.s-nav-item-content` holding
/// the label and the optional badge pill.
fn nav_sidebar_row_content(item: &NavSidebarItem) -> Element {
    let mut content = VElement::new("span")
        .class("s-nav-item-content")
        .child(rsx! {
            span { class: "s-nav-item-label", {VNode::Text(VText::new(item.label.as_str()))} }
        });
    // Vue: `{item.badge && <span …>}` — an empty string renders nothing.
    if let Some(badge) = &item.badge
        && !badge.is_empty()
    {
        content = content.child(rsx! {
            span {
                class: "s-nav-item-badge",
                "aria-label": nav_sidebar_badge_label(badge),
                "{badge}"
            }
        });
    }
    VNode::Element(Box::new(content))
}

/// Stamp Vue's `key={item.key}` onto the row's root element (tairitsu keeps row
/// identity on `VElement::key`, not on the component call).
fn with_row_key(node: Element, key: &str) -> Element {
    match node {
        VNode::Element(mut element) => {
            element.key = Some(key.to_string());
            VNode::Element(element)
        }
        other => other,
    }
}

#[define_props]
pub struct NavSidebarProps {
    /// Vue: `navItems` (required upstream; an empty list renders an empty
    /// band).
    #[default]
    pub items: Vec<NavSidebarItem>,

    /// Vue: `currentRoute` (required upstream) — the row whose `route` equals
    /// it is the active one.
    #[default]
    pub current_route: String,

    /// Vue: `collapsed` — see the header delta: declared upstream and never
    /// threaded into the panel, so it changes nothing in the render.
    #[default]
    pub collapsed: bool,

    /// The `navigate` emit (Vue: `emits: ["navigate"]`, payload `route`).
    pub on_navigate: Option<EventHandler<String>>,

    /// Host class for the band (Vue: attribute fallthrough on `<nav>`).
    #[default]
    pub class: String,
}

#[component]
pub fn NavSidebar(props: NavSidebarProps) -> Element {
    // Vue's `<nav>` carries no class of its own; a host class is the only one.
    let mut nav = VElement::new("nav").class(props.class.clone());
    for item in &props.items {
        let onclick: Option<EventHandler<MouseEvent>> =
            props
                .on_navigate
                .as_ref()
                .map(|handler: &EventHandler<String>| {
                    let handler = handler.clone();
                    let route = item.route.clone();
                    // Vue: `onClick={() => emit("navigate", item.route)}`.
                    EventHandler::new(move |_event: MouseEvent| handler.call(route.clone()))
                });
        let row = NavItem(NavItemProps {
            active: nav_sidebar_is_active(&props.current_route, &item.route),
            disabled: item.disabled,
            icon_slot: Some(nav_sidebar_icon_slot(&item.icon)),
            children: nav_sidebar_row_content(item),
            onclick,
            ..Default::default()
        });
        nav = nav.child(with_row_key(row, &item.key));
    }
    VNode::Element(Box::new(nav))
}

impl StyledComponent for NavSidebarComponent {
    fn styles() -> &'static str {
        // Vue ships NO sheet for this component and it renders no `hk-` class
        // of its own: the panel chrome is HkSidebar's, the row geometry is
        // NavItem's vendored sheet, and the only classes written here are the
        // host-scoped `s-nav-item-*` hooks. Layout comes from the host's
        // utility classes — an empty table, not an error (basic::kbd rule).
        ""
    }

    fn name() -> &'static str {
        "nav-sidebar"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(key: &str, icon: &str, label: &str, route: &str) -> NavSidebarItem {
        NavSidebarItem {
            key: key.to_string(),
            icon: icon.to_string(),
            label: label.to_string(),
            route: route.to_string(),
            ..Default::default()
        }
    }

    #[test]
    fn nav_sidebar_defaults_match_the_vue_props() {
        let props = NavSidebarProps::default();
        assert!(props.items.is_empty());
        assert_eq!(props.current_route, "");
        // Vue: `collapsed: { type: Boolean, default: false }`.
        assert!(!props.collapsed);
        assert!(props.on_navigate.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn nav_sidebar_width_and_icon_size_match_the_vue_literals() {
        // Vue: `<HSidebar width="224px">` + `h(IconComp, { size: 16 })`.
        assert_eq!(NAV_SIDEBAR_PANEL_WIDTH, "224px");
        assert_eq!(nav_sidebar_panel_width(), "224px");
        assert_eq!(NAV_SIDEBAR_ICON_PX, 16);
    }

    #[test]
    fn nav_sidebar_active_row_is_an_exact_route_match() {
        assert!(nav_sidebar_is_active("/dashboard", "/dashboard"));
        assert!(!nav_sidebar_is_active("/dashboard", "/dashboard/settings"));
        // No prefix or trailing-slash normalisation, exactly like Vue's `===`.
        assert!(!nav_sidebar_is_active("/dashboard/", "/dashboard"));
        assert!(!nav_sidebar_is_active("/", "/dashboard"));
        // Two empty routes still match (Vue compares two empty strings).
        assert!(nav_sidebar_is_active("", ""));
    }

    #[test]
    fn nav_sidebar_badge_label_keeps_the_vue_text() {
        assert_eq!(nav_sidebar_badge_label("3"), "3 pending");
        assert_eq!(nav_sidebar_badge_label("beta"), "beta pending");
    }

    #[test]
    fn nav_sidebar_icon_map_covers_all_twenty_vue_keys() {
        // Vue's `iconMap` keys, in its own order.
        let keys = [
            "chart", "plug", "bot", "cpu", "zap", "folder", "radio", "monitor", "box", "link",
            "key", "shield", "bar", "gauge", "mic", "settings", "panels", "bell", "share",
            "manifest",
        ];
        let mut mapped: Vec<MdiIcon> = Vec::new();
        for key in keys {
            let icon = nav_sidebar_icon(key);
            assert!(icon.is_some(), "iconMap key {key:?} must map to a glyph");
            mapped.push(icon.expect("checked above"));
        }
        // Every key keeps its own glyph: a duplicate would collapse two
        // different menu entries into one icon column.
        for (index, icon) in mapped.iter().enumerate() {
            assert!(
                !mapped[index + 1..].contains(icon),
                "duplicate glyph for the key at {index}"
            );
        }
        // The exact pairs where the MDI vocabulary has the same meaning.
        assert_eq!(nav_sidebar_icon("mic"), Some(MdiIcon::Microphone));
        assert_eq!(nav_sidebar_icon("settings"), Some(MdiIcon::Cog));
        assert_eq!(nav_sidebar_icon("panels"), Some(MdiIcon::Layers));
        assert_eq!(nav_sidebar_icon("bell"), Some(MdiIcon::Bell));
        // An unknown key is a miss, exactly like Vue's `iconMap[item.icon]`.
        assert_eq!(nav_sidebar_icon("nope"), None);
        assert_eq!(nav_sidebar_icon(""), None);
    }

    #[test]
    fn nav_sidebar_renders_the_vue_band() {
        let html = NavSidebar(NavSidebarProps {
            items: vec![
                {
                    let mut row = item("chart", "chart", "Overview", "/dashboard");
                    row.badge = Some("3".to_string());
                    row
                },
                {
                    let mut row = item("plug", "plug", "Connections", "/connections");
                    row.disabled = true;
                    row
                },
                item("mystery", "unknown-key", "Mystery", "/mystery"),
            ],
            current_route: "/dashboard".to_string(),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "<nav",
            r#"class="hk-nav-item hk-nav-item-button hk-nav-item-active""#,
            r#"class="hk-nav-item hk-nav-item-button hk-nav-item-disabled""#,
            r#"data-active="""#,
            r#"data-disabled="""#,
            // The default slot rides `span.hk-nav-item-label`.
            r#"class="hk-nav-item-label""#,
            // The host-scoped row content Vue's consumer dresses.
            r#"class="s-nav-item-content""#,
            r#"class="s-nav-item-label""#,
            r#"class="s-nav-item-badge""#,
            r#"aria-label="3 pending""#,
            // The icon-cell vocabulary of the sibling row mirror.
            r#"class="hk-nav-item-icon""#,
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Three rows, three icon cells: the unknown key keeps an EMPTY cell
        // (Vue's icon slot is a truthy function even when it renders null).
        assert_eq!(html.matches("hk-nav-item-icon").count(), 3, "{html}");
        // The band itself carries no class when the host passes none — Vue's
        // `<nav>` has none of its own.
        assert!(!html.contains(r#"<nav class"#), "{html}");
        // The disabled row is a native disabled button.
        assert!(html.contains(r#"disabled="disabled""#), "{html}");
    }

    #[test]
    fn nav_sidebar_host_class_rides_the_band_only() {
        let html = NavSidebar(NavSidebarProps {
            items: vec![item("chart", "chart", "Overview", "/")],
            current_route: "/".to_string(),
            class: "app-nav".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"<nav class="app-nav""#), "{html}");
        // The host class does not leak into the rows.
        assert!(!html.contains("hk-nav-item-button app-nav"), "{html}");
    }

    #[test]
    fn nav_sidebar_skips_an_empty_badge_like_vues_truthiness() {
        let mut row = item("chart", "chart", "Overview", "/");
        row.badge = Some(String::new());
        let html = NavSidebar(NavSidebarProps {
            items: vec![row],
            current_route: "/".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("s-nav-item-badge"), "{html}");
    }

    #[test]
    fn nav_sidebar_styles_are_empty_and_host_supplied() {
        // Vue ships no sheet for this component: the panel is HkSidebar's and
        // the rows are HkNavItem's vendored one. An empty table, not an error.
        assert_eq!(NavSidebarComponent::styles(), "");
        assert_eq!(NavSidebarComponent::name(), "nav-sidebar");
    }
}
