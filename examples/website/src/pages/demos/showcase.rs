use tairitsu_vdom::{VElement, VNode, VText};

use crate::components::page_layout::{render_demo_section, render_page_container};

pub fn render_showcase() -> VNode {
    let cards = vec![
        ("/demos/form", "Form Demo", "Login form with validation, input types, checkboxes, and a submit flow using Layer 1 components."),
        ("/demos/dashboard", "Dashboard Demo", "Data dashboard with stats cards, data table, and navigation patterns using Layer 2 components."),
        ("/demos/video", "Video & Audio Demo", "Video player and audio waveform visualization using Layer 3 media components."),
        ("/animations", "Animation Demo", "Glow, neon, tech, and transition animation presets with interactive start/stop controls."),
    ];

    let mut card_nodes: Vec<VNode> = Vec::new();
    for (href, title, desc) in cards {
        card_nodes.push(VNode::Element(
            VElement::new("a")
                .attr("href", href)
                .class("card card--link")
                .child(VNode::Element(
                    VElement::new("h3")
                        .class("card__title")
                        .child(VNode::Text(VText::new(title))),
                ))
                .child(VNode::Element(
                    VElement::new("p")
                        .class("card__body")
                        .child(VNode::Text(VText::new(desc))),
                ))
                .child(VNode::Element(
                    VElement::new("span")
                        .class("card__action card__action--link")
                        .child(VNode::Text(VText::new("View Demo ->"))),
                )),
        ));
    }

    let cards_container =
        VNode::Element(VElement::new("div").class("card-grid").children(card_nodes));

    let content = render_demo_section("Full-composition Demos", cards_container);

    render_page_container(
        "page-demos-overview",
        Some("Demos"),
        Some("Complete application examples showcasing Hikari components in realistic scenarios."),
        content,
    )
}
