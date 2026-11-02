// hi-components/src/navigation/expansion_panel.rs
// ExpansionPanel — mirror of the canonical Vue `HkExpansionPanel`: the
// collapsible section shell (header row + chevron + body).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkExpansionPanel.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash`.
//
//   div.hk-expansion-panel [data-open] [data-disabled]
//     button.hk-expansion-panel-header [aria-expanded] [aria-disabled?] [disabled]
//       div.hk-expansion-panel-header-text
//         {title slot | span.hk-expansion-panel-title}
//         {subtitle slot | span.hk-expansion-panel-subtitle}
//       div.hk-expansion-panel-action?         (stopPropagation wrapper)
//         {action slot}
//       span.hk-expansion-panel-chevron        (aria-hidden, inner HTML chevron)
//     {children}                                (body; open only — Vue's
//                                              v-show keeps it mounted, the
//                                              mirror mounts it conditionally,
//                                              see the delta below)
//
// Deltas vs Vue (documented, not accidental):
//   * the panel is CONTROLLED-only (`open` + `on_open_change`): tairitsu has
//     no per-instance component state (ledger L48), so Vue's uncontrolled
//     `defaultOpen` seed is the host's job (pass the seed as `open`).
//   * the body mounts only while open (Vue's `v-show` keeps it in the DOM,
//     hidden); mounting-unmounting preserves the layout contract via the
//     sheet's `[data-open]` rules and keeps heavy bodies out of the tree.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ExpansionPanelComponent;

const CHEVRON_DOWN_SVG: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>"#;

#[define_props]
pub struct ExpansionPanelProps {
    /// Controlled open state (Vue: `modelValue`; the uncontrolled seed is the
    /// host's job — see the header delta).
    #[default]
    pub open: bool,

    /// Header title (plain string; callers resolve i18n themselves, like Vue).
    #[default]
    pub title: String,

    /// Optional secondary header line.
    pub subtitle: Option<String>,

    /// Disable the toggle (body stays in its current state).
    #[default]
    pub disabled: bool,

    /// Fired with the NEXT open state on a header press (Vue emits
    /// `update:modelValue` then `toggle`; the mirror folds both into one).
    pub on_open_change: Option<EventHandler<bool>>,

    /// Title slot (wins over the `title` string, like Vue's slot precedence).
    pub title_slot: Option<Element>,

    /// Subtitle slot (wins over the `subtitle` string).
    pub subtitle_slot: Option<Element>,

    /// Trailing action row; its clicks never toggle the panel.
    pub action: Option<Element>,

    pub children: Element,
}

#[component]
pub fn ExpansionPanel(props: ExpansionPanelProps) -> Element {
    let toggle = {
        let disabled = props.disabled;
        let open = props.open;
        let on_open_change = props.on_open_change.clone();
        move |_event: MouseEvent| {
            if disabled {
                return;
            }
            if let Some(handler) = on_open_change.as_ref() {
                handler.call(!open);
            }
        }
    };

    let title_node = match &props.title_slot {
        Some(slot) => slot.clone(),
        None if !props.title.is_empty() => rsx! {
            span { class: "hk-expansion-panel-title", {props.title.clone()} }
        },
        _ => empty_vnode(),
    };
    let subtitle_node = match &props.subtitle_slot {
        Some(slot) => slot.clone(),
        None => match &props.subtitle {
            Some(subtitle) if !subtitle.is_empty() => rsx! {
                span { class: "hk-expansion-panel-subtitle", {subtitle.clone()} }
            },
            _ => empty_vnode(),
        },
    };

    let action_node = match &props.action {
        Some(action) => rsx! {
            div {
                class: "hk-expansion-panel-action",
                // The action row never toggles the panel (Vue stopPropagation).
                onclick: move |event: MouseEvent| event.stop_propagation(),
                {action.clone()}
            }
        },
        None => empty_vnode(),
    };

    let mut root = VElement::new("div").class("hk-expansion-panel");
    if props.open {
        root = root.attr("data-open", "");
    }
    if props.disabled {
        root = root.attr("data-disabled", "");
    }

    let mut header = VElement::new("button")
        .attr("type", "button")
        .class("hk-expansion-panel-header")
        .attr("aria-expanded", if props.open { "true" } else { "false" })
        .on_click(toggle);
    if props.disabled {
        header = header.attr("aria-disabled", "true").attr("disabled", "");
    }
    header = header
        .child(rsx! {
            div { class: "hk-expansion-panel-header-text",
                {title_node}
                {subtitle_node}
            }
        })
        .child(action_node)
        .child(rsx! {
            span {
                class: "hk-expansion-panel-chevron",
                "aria-hidden": "true",
                // The chevron is SVG markup: rsx `svg {}` lands in the HTML
                // namespace in this host stack, so it rides innerHTML on a
                // dedicated host (inner_html suppresses children).
                div {
                    style: "display:contents",
                    dangerous_inner_html: CHEVRON_DOWN_SVG,
                }
            }
        });

    root = root.child(VNode::Element(Box::new(header)));
    if props.open {
        root = root.child(props.children.clone());
    }
    VNode::Element(Box::new(root))
}

impl StyledComponent for ExpansionPanelComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkExpansionPanel.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "expansion-panel"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expansion_panel_defaults_match_the_vue_props() {
        let props = ExpansionPanelProps::default();
        assert!(!props.open);
        assert_eq!(props.title, "");
        assert!(props.subtitle.is_none());
        assert!(!props.disabled);
        assert!(props.on_open_change.is_none());
    }

    #[test]
    fn expansion_panel_closed_renders_the_header_shell() {
        let html = ExpansionPanel(ExpansionPanelProps {
            title: "Group".to_string(),
            children: rsx! { div { class: "body", "content" } },
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-expansion-panel-title"), "{html}");
        assert!(html.contains(r#"aria-expanded="false""#), "{html}");
        assert!(!html.contains("data-open"), "{html}");
        assert!(
            !html.contains("class=\"body\""),
            "closed mounts no body: {html}"
        );
    }

    #[test]
    fn expansion_panel_open_mounts_the_body() {
        let html = ExpansionPanel(ExpansionPanelProps {
            open: true,
            title: "G".to_string(),
            children: rsx! { div { class: "body", "content" } },
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"data-open="""#), "{html}");
        assert!(html.contains(r#"aria-expanded="true""#), "{html}");
        assert!(html.contains("class=\"body\""), "{html}");
    }

    #[test]
    fn expansion_panel_disabled_marks_the_header() {
        let html = ExpansionPanel(ExpansionPanelProps {
            disabled: true,
            children: empty_vnode(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"aria-disabled="true""#), "{html}");
        assert!(html.contains("disabled"), "{html}");
        assert!(html.contains("data-disabled"), "{html}");
    }

    #[test]
    fn expansion_panel_header_toggle_fires_the_next_state() {
        let fired = std::rc::Rc::new(std::cell::Cell::new(false));
        let sink = std::rc::Rc::clone(&fired);
        let node = ExpansionPanel(ExpansionPanelProps {
            open: false,
            on_open_change: Some(EventHandler::new(move |next: bool| {
                sink.set(next);
            })),
            children: empty_vnode(),
            ..Default::default()
        });
        fn click_header(node: &Element) -> bool {
            match node {
                VNode::Element(el) => {
                    if el.class.to_string().contains("hk-expansion-panel-header")
                        && let Some(handler) = el.event_handlers.get("click")
                    {
                        handler.borrow_mut()(
                            Box::new(MouseEvent::default()) as Box<dyn tairitsu_vdom::EventData>
                        );
                        return true;
                    }
                    el.children.iter().any(click_header)
                }
                VNode::Fragment(children) => children.iter().any(click_header),
                _ => false,
            }
        }
        assert!(click_header(&node));
        assert!(fired.get(), "the toggle must request open");
    }

    #[test]
    fn expansion_panel_styles_come_from_the_canonical_vue_sheet() {
        let css = ExpansionPanelComponent::styles();
        assert!(css.contains(".hk-expansion-panel"), "{css}");
        assert!(!css.contains("CSS generation failed"), "scss failed");
    }
}
