//! Components overview page — cards for each component across all layers.

use tairitsu_vdom::{VElement, VNode, VText};

use crate::components::demo_page::render_demo_page;

struct ComponentEntry {
    icon: &'static str,
    title: &'static str,
    description: &'static str,
    href: &'static str,
}

fn component_card(entry: &ComponentEntry, layer: &str) -> VNode {
    let icon_class = format!("component-card__icon hi-icon mdi {}", entry.icon);
    VNode::Element(
        VElement::new("a")
            .class("component-card")
            .attr("href", entry.href)
            .child(VNode::Element(
                VElement::new("span")
                    .class(icon_class)
                    .child(VNode::Text(VText::new(""))),
            ))
            .child(VNode::Element(
                VElement::new("span")
                    .class("component-card__tag")
                    .child(VNode::Text(VText::new(layer))),
            ))
            .child(VNode::Element(
                VElement::new("h3")
                    .class("component-card__name")
                    .child(VNode::Text(VText::new(entry.title))),
            ))
            .child(VNode::Element(
                VElement::new("p")
                    .class("component-card__desc")
                    .child(VNode::Text(VText::new(entry.description))),
            )),
    )
}

fn layer_section(title: &str, components: &[ComponentEntry], layer: &str) -> VNode {
    let mut cards: Vec<VNode> = Vec::new();
    for entry in components {
        cards.push(component_card(entry, layer));
    }

    VNode::Element(
        VElement::new("div")
            .class("page-section")
            .child(VNode::Element(
                VElement::new("h2")
                    .class("page-section__title")
                    .child(VNode::Text(VText::new(title))),
            ))
            .child(VNode::Element(
                VElement::new("div").class("component-grid").children(cards),
            )),
    )
}

pub fn render() -> VNode {
    let layer1: &[ComponentEntry] = &[
        ComponentEntry {
            icon: "mdi-gesture-tap",
            title: "Button",
            description: "Primary action trigger with variants: primary, secondary, danger, ghost.",
            href: "/components/layer1/button",
        },
        ComponentEntry {
            icon: "mdi-textbox",
            title: "Input",
            description: "Text entry field with validation states and placeholder support.",
            href: "/components/layer1/input",
        },
        ComponentEntry {
            icon: "mdi-toggle-switch",
            title: "Switch",
            description: "Boolean toggle control.",
            href: "/components/layer1/switch",
        },
        ComponentEntry {
            icon: "mdi-account-circle",
            title: "Avatar",
            description: "User or entity representation with image and initials fallback.",
            href: "/components/layer1/avatar",
        },
        ComponentEntry {
            icon: "mdi-tag",
            title: "Tag",
            description: "Compact label for categorisation or status display.",
            href: "/components/layer1/tag",
        },
        ComponentEntry {
            icon: "mdi-image-outline",
            title: "Image",
            description: "Responsive image with lazy loading and fallback.",
            href: "/components/layer1/image",
        },
        ComponentEntry {
            icon: "mdi-inbox-outline",
            title: "Empty",
            description: "Empty state placeholder with configurable icon and message.",
            href: "/components/layer1/empty",
        },
        ComponentEntry {
            icon: "mdi-comment-text-outline",
            title: "Comment",
            description: "User comment display with author, time, and content.",
            href: "/components/layer1/comment",
        },
        ComponentEntry {
            icon: "mdi-numeric",
            title: "Number Input",
            description: "Numeric field with increment / decrement controls.",
            href: "/components/layer1/number-input",
        },
        ComponentEntry {
            icon: "mdi-magnify",
            title: "Search",
            description: "Search input with instant filtering support.",
            href: "/components/layer1/search",
        },
    ];

    let layer2: &[ComponentEntry] = &[
        ComponentEntry {
            icon: "mdi-navigation-variant",
            title: "Navigation",
            description: "Tabs, breadcrumbs, steps, and menu components.",
            href: "/components/layer2/navigation",
        },
        ComponentEntry {
            icon: "mdi-table",
            title: "Data",
            description: "Tables, lists, and data grids with sorting / filtering.",
            href: "/components/layer2/data",
        },
        ComponentEntry {
            icon: "mdi-form-textbox",
            title: "Form",
            description: "Form builder with validation, layout, and submission handling.",
            href: "/components/layer2/form",
        },
        ComponentEntry {
            icon: "mdi-message-alert",
            title: "Feedback",
            description: "Toast notifications, alerts, progress bars, and spinners.",
            href: "/components/layer2/feedback",
        },
        ComponentEntry {
            icon: "mdi-sitemap",
            title: "Cascader",
            description: "Hierarchical multi-level select picker.",
            href: "/components/layer2/cascader",
        },
        ComponentEntry {
            icon: "mdi-swap-horizontal",
            title: "Transfer",
            description: "Dual-panel transfer widget for moving items between lists.",
            href: "/components/layer2/transfer",
        },
        ComponentEntry {
            icon: "mdi-arrow-collapse-vertical",
            title: "Collapsible",
            description: "Accordion / collapse panels with animation.",
            href: "/components/layer2/collapsible",
        },
        ComponentEntry {
            icon: "mdi-timeline-clock-outline",
            title: "Timeline",
            description: "Chronological event display.",
            href: "/components/layer2/timeline",
        },
        ComponentEntry {
            icon: "mdi-file-tree",
            title: "Tree",
            description: "Hierarchical tree view with expand / collapse.",
            href: "/components/layer2/tree",
        },
        ComponentEntry {
            icon: "mdi-page-last",
            title: "Pagination",
            description: "Page navigation control.",
            href: "/components/layer2/pagination",
        },
    ];

    let layer3: &[ComponentEntry] = &[
        ComponentEntry {
            icon: "mdi-play-circle",
            title: "Media Player",
            description: "Video and audio player with custom controls.",
            href: "/components/layer3/media",
        },
        ComponentEntry {
            icon: "mdi-pencil",
            title: "Editor",
            description: "Rich text and markdown editor with formatting toolbar.",
            href: "/components/layer3/editor",
        },
        ComponentEntry {
            icon: "mdi-chart-bar",
            title: "Visualization",
            description: "Charts, graphs, and data visualisation primitives.",
            href: "/components/layer3/visualization",
        },
        ComponentEntry {
            icon: "mdi-magnify-plus-outline",
            title: "Zoom Controls",
            description: "Zoom in, zoom out, and reset controls for canvas or viewer.",
            href: "/components/layer3/zoom-controls",
        },
    ];

    render_demo_page(
        "page-components",
        "Components",
        "Hikari components, organised in three layers of abstraction.",
        VNode::Fragment(vec![
            layer_section("Layer 1 \u{2014} Base Components", layer1, "Layer 1"),
            layer_section("Layer 2 \u{2014} Composed Components", layer2, "Layer 2"),
            layer_section("Layer 3 \u{2014} Complex Components", layer3, "Layer 3"),
        ]),
    )
}
