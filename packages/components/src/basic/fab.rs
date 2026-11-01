// hi-components/src/basic/fab.rs
// Fab — mirror of the canonical Vue `HkFab`: a floating action button with an
// optional speed dial (staggered mini buttons).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkFab.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash`.
//
//   div.hk-fab [data-positioning][data-corner][data-size][data-variant]
//              [data-expand][data-expanded="true"]
//              (style: --hk-fab-offset-x / --hk-fab-offset-y)
//     div.hk-fab-actions [aria-hidden]
//       button.hk-fab-mini [tabindex][aria-hidden][disabled][title][aria-label]
//         span.hk-fab-mini-icon?   (the action glyph)
//         span.hk-fab-mini-label?  (the action label)
//     button.hk-fab-button [aria-label][aria-expanded?][disabled]
//       span.hk-fab-icon  (glyph, or the inline chevron fallback)
//
// Behaviour deltas vs Vue (documented):
//   * the speed dial's open flag is CONTROLLED (`open` + `on_open_change`):
//     tairitsu 0.5.22 has no per-instance component state, and Vue's
//     document-level Escape / outside-pointerdown dismissal needs a
//     document listener — the HOST owns that dismissal and flips `open`;
//   * no `HkFloatingLayer` (`layer: "top"`): that layer is not mirrored yet,
//     so the floating variant renders in-tree with the host's positioning
//     (the `data-positioning`/`data-corner` markers stay available);
//   * the icon is a typed `MdiIcon` (Vue resolves a name string through the
//     icon registry; the Rust icon primitive has no name registry).

use hikari_icons::Icon;
use hikari_icons::MdiIcon;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct FabComponent;

/// Anchoring mode (Vue: `positioning`, default `absolute`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum FabPositioning {
    #[default]
    Absolute,
    Fixed,
}

impl FabPositioning {
    pub fn data_value(self) -> &'static str {
        match self {
            FabPositioning::Absolute => "absolute",
            FabPositioning::Fixed => "fixed",
        }
    }
}

/// Which viewport corner the fab anchors to (Vue default bottom-right).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum FabCorner {
    #[default]
    BottomRight,
    BottomLeft,
    TopRight,
    TopLeft,
}

impl FabCorner {
    pub fn data_value(self) -> &'static str {
        match self {
            FabCorner::BottomRight => "bottom-right",
            FabCorner::BottomLeft => "bottom-left",
            FabCorner::TopRight => "top-right",
            FabCorner::TopLeft => "top-left",
        }
    }
}

/// The three size steps (Vue default md).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum FabSize {
    Sm,
    #[default]
    Md,
    Lg,
}

impl FabSize {
    pub fn data_value(self) -> &'static str {
        match self {
            FabSize::Sm => "sm",
            FabSize::Md => "md",
            FabSize::Lg => "lg",
        }
    }
}

/// The two inks (Vue default glass).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum FabVariant {
    Primary,
    #[default]
    Glass,
}

impl FabVariant {
    pub fn data_value(self) -> &'static str {
        match self {
            FabVariant::Primary => "primary",
            FabVariant::Glass => "glass",
        }
    }
}

/// Which way the dial expands (Vue default up).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum FabExpandDirection {
    #[default]
    Up,
    Down,
    Left,
    Right,
}

impl FabExpandDirection {
    pub fn data_value(self) -> &'static str {
        match self {
            FabExpandDirection::Up => "up",
            FabExpandDirection::Down => "down",
            FabExpandDirection::Left => "left",
            FabExpandDirection::Right => "right",
        }
    }
}

/// One speed-dial entry (Vue: `HFabAction`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct FabAction {
    pub key: String,
    pub label: Option<String>,
    pub icon: Option<MdiIcon>,
}

/// The inline chevron-down fallback glyph (Vue keeps this local too).
const CHEVRON_DOWN_SVG: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>"#;

#[define_props]
pub struct FabProps {
    /// The main glyph (Vue: a registry name string; the Rust primitive is
    /// typed). `None` renders the chevron fallback.
    pub icon: Option<MdiIcon>,

    /// Accessible label for the main button (Vue: `ariaLabel`).
    #[default]
    pub aria_label: String,

    #[default]
    pub positioning: FabPositioning,

    #[default]
    pub corner: FabCorner,

    /// `--hk-fab-offset-x` override (Vue: `offsetX`).
    pub offset_x: Option<String>,

    /// `--hk-fab-offset-y` override (Vue: `offsetY`).
    pub offset_y: Option<String>,

    #[default]
    pub size: FabSize,

    #[default]
    pub variant: FabVariant,

    #[default]
    pub disabled: bool,

    /// Speed-dial entries; empty = a plain round icon button.
    pub actions: Option<Vec<FabAction>>,

    #[default]
    pub expand_direction: FabExpandDirection,

    /// The dial's open flag (Vue owns this internally; the mirror is
    /// controlled — see the header delta).
    #[default]
    pub open: bool,

    /// Fired on a main-button press (before any toggle request).
    pub onclick: Option<EventHandler<MouseEvent>>,

    /// Fired with the requested open state (main press with actions, or an
    /// action press closing the dial).
    pub on_open_change: Option<EventHandler<bool>>,

    /// Fired for an activated speed-dial entry (with the entry key).
    pub on_action: Option<EventHandler<String>>,
}

#[component]
pub fn Fab(props: FabProps) -> Element {
    let has_actions = props
        .actions
        .as_ref()
        .map(|actions| !actions.is_empty())
        .unwrap_or(false);
    let open = props.open && has_actions;

    let actions_markup = if has_actions {
        let mut action_nodes: Vec<VNode> = Vec::new();
        for action in props.actions.as_deref().unwrap_or_default() {
            let key_for_action = action.key.clone();
            let on_action = props.on_action.clone();
            let on_open_change = props.on_open_change.clone();
            let disabled = props.disabled;
            let mut button = VElement::new("button")
                .attr("type", "button")
                .class("hk-fab-mini")
                .attr("tabindex", if open { "0" } else { "-1" })
                .attr("aria-hidden", if open { "false" } else { "true" })
                .attr("disabled", if disabled { "disabled" } else { "" })
                .attr(
                    "aria-label",
                    action.label.clone().unwrap_or_else(|| action.key.clone()),
                );
            if let Some(label) = &action.label {
                button = button.attr("title", label.clone());
            }
            button = button.on_click(move |_: MouseEvent| {
                if let Some(handler) = on_action.as_ref() {
                    handler.call(key_for_action.clone());
                }
                if let Some(handler) = on_open_change.as_ref() {
                    handler.call(false);
                }
            });
            if let Some(icon) = action.icon {
                button = button.child(rsx! {
                    span { class: "hk-fab-mini-icon", Icon { icon, size: 18 } }
                });
            }
            if let Some(label) = &action.label {
                button = button.child(rsx! {
                    span { class: "hk-fab-mini-label", "{label}" }
                });
            }
            action_nodes.push(VNode::Element(Box::new(button)));
        }
        rsx! {
            div {
                class: "hk-fab-actions",
                "aria-hidden": if open { "false" } else { "true" },
                {VNode::Fragment(action_nodes)}
            }
        }
    } else {
        empty_vnode()
    };

    let glyph = match props.icon {
        Some(icon) => rsx! {
            span { class: "hk-fab-icon", Icon { icon, size: 22 } }
        },
        None => rsx! {
            span {
                class: "hk-fab-icon",
                // The chevron is SVG: rsx `svg {}` lands in the HTML
                // namespace in this host stack, so it rides innerHTML on a
                // dedicated host (inner_html suppresses children).
                div {
                    style: "display:contents",
                    dangerous_inner_html: CHEVRON_DOWN_SVG,
                }
            }
        },
    };

    let mut root = VElement::new("div")
        .class("hk-fab")
        .attr("data-positioning", props.positioning.data_value())
        .attr("data-corner", props.corner.data_value())
        .attr("data-size", props.size.data_value())
        .attr("data-variant", props.variant.data_value())
        .attr("data-expand", props.expand_direction.data_value());
    if open {
        root = root.attr("data-expanded", "true");
    }
    let mut style = String::new();
    if let Some(offset) = &props.offset_x {
        style.push_str(&format!("--hk-fab-offset-x:{offset};"));
    }
    if let Some(offset) = &props.offset_y {
        style.push_str(&format!("--hk-fab-offset-y:{offset};"));
    }
    if !style.is_empty() {
        root = root.style(style);
    }

    // Main button: click emits, then requests the toggle when the dial exists.
    let main_click = {
        let onclick = props.onclick.clone();
        let on_open_change = props.on_open_change.clone();
        let next_open = !open;
        move |e: MouseEvent| {
            if let Some(handler) = onclick.as_ref() {
                handler.call(e.clone());
            }
            if has_actions && let Some(handler) = on_open_change.as_ref() {
                handler.call(next_open);
            }
        }
    };
    let mut main = VElement::new("button")
        .attr("type", "button")
        .class("hk-fab-button")
        .attr("aria-label", props.aria_label.clone());
    if has_actions {
        main = main.attr("aria-expanded", if open { "false" } else { "true" });
    }
    if props.disabled {
        main = main.attr("disabled", "disabled");
    }
    main = main.on_click(main_click).child(glyph);

    VNode::Element(Box::new(
        root.child(actions_markup)
            .child(VNode::Element(Box::new(main))),
    ))
}

impl StyledComponent for FabComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkFab.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "fab"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fab_data_tokens_match_vue() {
        assert_eq!(FabPositioning::Absolute.data_value(), "absolute");
        assert_eq!(FabCorner::BottomLeft.data_value(), "bottom-left");
        assert_eq!(FabSize::Lg.data_value(), "lg");
        assert_eq!(FabVariant::Glass.data_value(), "glass");
        assert_eq!(FabExpandDirection::Left.data_value(), "left");
    }

    #[test]
    fn fab_defaults_match_the_vue_props() {
        let props = FabProps::default();
        assert_eq!(props.positioning, FabPositioning::Absolute);
        assert_eq!(props.corner, FabCorner::BottomRight);
        assert_eq!(props.size, FabSize::Md);
        assert_eq!(props.variant, FabVariant::Glass);
        assert_eq!(props.expand_direction, FabExpandDirection::Up);
        assert!(!props.disabled);
        assert!(!props.open);
        assert!(props.actions.is_none());
        assert!(props.icon.is_none());
    }

    #[test]
    fn fab_renders_the_vue_shell() {
        let html = Fab(FabProps::default()).render_to_html();
        for needle in ["hk-fab", "hk-fab-button", "hk-fab-icon"] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(html.contains("data-size=\"md\""), "{html}");
        assert!(html.contains("data-variant=\"glass\""), "{html}");
    }

    #[test]
    fn fab_speed_dial_renders_minis_and_aria() {
        let html = Fab(FabProps {
            actions: Some(vec![FabAction {
                key: "a".to_string(),
                label: Some("Alpha".to_string()),
                ..Default::default()
            }]),
            open: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-fab-actions"), "{html}");
        assert!(html.contains("hk-fab-mini"), "{html}");
        assert!(html.contains("data-expanded=\"true\""), "{html}");
        assert!(html.contains("aria-expanded=\"false\""), "{html}");
    }

    #[test]
    fn fab_styles_come_from_the_canonical_vue_sheet() {
        let css = FabComponent::styles();
        assert!(
            css.contains(".hk-fab"),
            "fab css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored fab sheet"
        );
    }
}
