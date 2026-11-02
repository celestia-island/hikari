// hi-components/src/navigation/menu_panel.rs
// MenuPanel — mirror of the canonical Vue `HkMenuPanel`: the detachable menu
// container with a single, shared layout constraint.
//
// The admin nav drawer nests three paddings (drawer body → sidebar panel →
// nav row), so consumer-built footer menus used to need per-app CSS hacks to
// line their left edge up with the nav items above. This panel owns the
// constraint instead: it pads with the same inset as the nav rows
// (`--hk-menu-panel-inset`, default 12px) and its items carry the nav row's
// own padding, so `HkMenuActionItem` / `HkMenuIdentityItem` children always
// land on the nav text edge — in a drawer footer, a popup, or any other host.
// Fully pluggable: no drawer/popover dependency, no state.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkMenuPanel.scss`, vendored under
// `src/styles/vue-mirror/` and listed in the mirror manifest), compiled with
// `no_hash` so the `.hk-menu-list` class name is literal and identical in
// both forms. The sheet also publishes `--hk-menu-section-gap` so a captioned
// run moved into the panel matches its 4px row rhythm. DOM contract (mirrors
// the Vue render output):
//
//   div.hk-menu-list [role=menu] [aria-label]
//     {children}                            (the default slot's rows)
//
// Vue prop mapping: `label` → [`MenuPanelProps::label`] (default undefined —
// no `aria-label` attribute at all), the default slot →
// [`MenuPanelProps::children`]. Vue emits nothing and keeps no state; the
// mirror is a pure shell the same way.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct MenuPanelComponent;

/// The panel's own class (Vue: `class="hk-menu-list"`, the one constant of
/// the shell).
pub fn menu_panel_classes() -> &'static str {
    "hk-menu-list"
}

/// The listbox role the shell announces (Vue: `role="menu"`).
pub fn menu_panel_role() -> &'static str {
    "menu"
}

/// Vue's `aria-label={props.label}`: `None` (Vue `undefined`) omits the
/// attribute entirely; `Some(..)` names the menu for assistive tech.
pub fn menu_panel_aria_label(label: Option<&str>) -> Option<&str> {
    label
}

#[define_props]
pub struct MenuPanelProps {
    /// Accessible label for the menu list (Vue: `label`, default undefined).
    pub label: Option<String>,

    /// The menu rows (Vue: the default slot — `HkMenuActionItem`,
    /// `HkMenuIdentityItem`, `HkMenuSection`…, in host order).
    pub children: Element,
}

#[component]
pub fn MenuPanel(props: MenuPanelProps) -> Element {
    rsx! {
        div {
            class: menu_panel_classes(),
            "role": menu_panel_role(),
            "aria-label": menu_panel_aria_label(props.label.as_deref()),
            {props.children.clone()}
        }
    }
}

impl StyledComponent for MenuPanelComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-menu-list` name literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkMenuPanel.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "menu-panel"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn menu_panel_defaults_match_the_vue_props() {
        let props = MenuPanelProps::default();
        // Vue: `label` defaults to undefined — no accessible name.
        assert_eq!(props.label, None);
        // The default slot is the crate's empty vnode (an empty fragment),
        // not a panic.
        assert!(matches!(
            props.children,
            VNode::Fragment(ref nodes) if nodes.is_empty()
        ));
    }

    #[test]
    fn menu_panel_shell_grammar_matches_vue() {
        assert_eq!(menu_panel_classes(), "hk-menu-list");
        assert_eq!(menu_panel_role(), "menu");
        // Vue's `aria-label={undefined}` omits the attribute; a label names
        // the list.
        assert_eq!(menu_panel_aria_label(None), None);
        assert_eq!(
            menu_panel_aria_label(Some("Account menu")),
            Some("Account menu")
        );
        // An explicitly empty label STAYS (Vue `""` is not nullish).
        assert_eq!(menu_panel_aria_label(Some("")), Some(""));
    }

    #[test]
    fn menu_panel_renders_the_vue_contract() {
        let html = MenuPanel(MenuPanelProps {
            label: Some("Account menu".to_string()),
            children: rsx! {
                div { class: "hk-menu-identity-item", "row" }
            },
        })
        .render_to_html();

        assert!(html.contains(r#"class="hk-menu-list""#), "{html}");
        assert!(html.contains(r#"role="menu""#), "{html}");
        assert!(html.contains(r#"aria-label="Account menu""#), "{html}");
        // The default slot rides inside, host order.
        assert!(html.contains(">row<"), "{html}");
    }

    #[test]
    fn menu_panel_without_a_label_omits_the_attribute() {
        let html = MenuPanel(MenuPanelProps {
            children: empty_vnode(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"class="hk-menu-list""#), "{html}");
        assert!(html.contains(r#"role="menu""#), "{html}");
        assert!(!html.contains("aria-label"), "{html}");
    }

    #[test]
    fn menu_panel_styles_come_from_the_canonical_vue_sheet() {
        let css = MenuPanelComponent::styles();
        assert!(
            css.contains(".hk-menu-list"),
            "menu-panel css must carry the vue class"
        );
        // The sheet's layout contract: the panel re-publishes the section
        // rhythm so a captioned run matches this list's 4px rows.
        assert!(css.contains("--hk-menu-panel-inset"), "{css}");
        assert!(css.contains("--hk-menu-section-gap"), "{css}");
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored menu-panel sheet"
        );
        assert_eq!(MenuPanelComponent::name(), "menu-panel");
    }
}
