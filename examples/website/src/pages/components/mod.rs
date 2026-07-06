//! Component documentation pages.

use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn page_header(title: &str, subtitle: &str) -> VNode {
    use tairitsu_vdom::{VElement, VText};
    VNode::Element(
        VElement::new("div")
            .class("page-header")
            .child(VNode::Element(
                VElement::new("h1")
                    .class("page-header__title")
                    .child(VNode::Text(VText::new(title))),
            ))
            .child(VNode::Element(
                VElement::new("p")
                    .class("page-header__subtitle")
                    .child(VNode::Text(VText::new(subtitle))),
            )),
    )
}

fn component_ref_card(name: &str, description: &str, layer: &str) -> VNode {
    use tairitsu_vdom::{VElement, VText};
    VNode::Element(
        VElement::new("div")
            .class("component-card")
            .child(VNode::Element(
                VElement::new("span")
                    .class("component-card__tag")
                    .child(VNode::Text(VText::new(layer))),
            ))
            .child(VNode::Element(
                VElement::new("h3")
                    .class("component-card__name")
                    .child(VNode::Text(VText::new(name))),
            ))
            .child(VNode::Element(
                VElement::new("p")
                    .class("component-card__desc")
                    .child(VNode::Text(VText::new(description))),
            )),
    )
}

/// Render the components overview page.
fn render_overview() -> VNode {
    use tairitsu_vdom::{VElement, VNode};

    let layer1_components: &[(&str, &str)] = &[
        (
            "Button",
            "Primary action trigger with variants: primary, secondary, danger, ghost.",
        ),
        (
            "Input",
            "Text entry field with validation states and placeholder support.",
        ),
        ("Switch", "Boolean toggle control."),
        (
            "Avatar",
            "User or entity representation with image and initials fallback.",
        ),
        ("Tag", "Compact label for categorisation or status display."),
        ("Image", "Responsive image with lazy loading and fallback."),
        (
            "Empty",
            "Empty state placeholder with configurable icon and message.",
        ),
        (
            "Comment",
            "User comment display with author, time, and content.",
        ),
        (
            "Number Input",
            "Numeric field with increment / decrement controls.",
        ),
        ("Search", "Search input with instant filtering support."),
    ];

    let layer2_components: &[(&str, &str)] = &[
        (
            "Navigation",
            "Tabs, breadcrumbs, steps, and menu components.",
        ),
        (
            "Data",
            "Tables, lists, and data grids with sorting / filtering.",
        ),
        (
            "Form",
            "Form builder with validation, layout, and submission handling.",
        ),
        (
            "Feedback",
            "Toast notifications, alerts, progress bars, and spinners.",
        ),
        ("Cascader", "Hierarchical multi-level select picker."),
        (
            "Transfer",
            "Dual-panel transfer widget for moving items between lists.",
        ),
        ("Collapsible", "Accordion / collapse panels with animation."),
        ("Timeline", "Chronological event display."),
        ("Tree", "Hierarchical tree view with expand / collapse."),
        ("Pagination", "Page navigation control."),
    ];

    let mut cards: Vec<VNode> = Vec::new();
    for (name, desc) in layer1_components {
        cards.push(component_ref_card(name, desc, "Layer 1"));
    }
    for (name, desc) in layer2_components {
        cards.push(component_ref_card(name, desc, "Layer 2"));
    }

    VNode::Element(
        VElement::new("div")
            .attr("id", "page-components-overview")
            .class("hikari-page")
            .child(page_header(
                "Components",
                "Hikari components, organised in three layers of abstraction.",
            ))
            .child(VNode::Element(
                VElement::new("div")
                    .class("page-section")
                    .child(VNode::Element(
                        VElement::new("div").class("component-grid").children(cards),
                    )),
            )),
    )
}

fn render_layer1() -> VNode {
    rsx! {
        div { id: "page-components-layer1", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Layer 1 — Base Components" }
                p { class: "page-header__subtitle",
                    "Atomic UI primitives: buttons, inputs, tags, avatars, and more."
                }
            }
            div { class: "page-section",
                h2 { "Button" }
                p {
                    "The Button component supports primary, secondary, danger, and ghost variants in three sizes."
                }
                div { class: "demo-row",
                    button { class: "hi-btn hi-btn--primary", "Primary" }
                    button { class: "hi-btn hi-btn--secondary", "Secondary" }
                    button { class: "hi-btn hi-btn--primary hi-btn--sm", "Small" }
                    button { class: "hi-btn hi-btn--primary hi-btn--lg", "Large" }
                }
                h2 { "Input" }
                p { "Text input fields with placeholder, disabled, and error states." }
                div { class: "demo-row",
                    input {
                        class: "hi-input",
                        placeholder: "Default input",
                        r#type: "text",
                    }
                    input {
                        class: "hi-input hi-input--error",
                        placeholder: "Error state",
                        r#type: "text",
                    }
                    input {
                        class: "hi-input",
                        placeholder: "Disabled",
                        r#type: "text",
                        disabled: "true",
                    }
                }
                h2 { "Switch" }
                p { "Boolean toggle control." }
                div { class: "demo-row",
                    label { class: "hi-switch",
                        input { r#type: "checkbox", class: "hi-switch__input" }
                        span { class: "hi-switch__rail" }
                    }
                }
                h2 { "Tag" }
                p { "Compact label for status or categorisation." }
                div { class: "demo-row",
                    span { class: "hi-tag hi-tag--primary", "Primary" }
                    span { class: "hi-tag hi-tag--success", "Success" }
                    span { class: "hi-tag hi-tag--danger", "Danger" }
                    span { class: "hi-tag hi-tag--warning", "Warning" }
                }
            }
        }
    }
}

fn render_layer2() -> VNode {
    rsx! {
        div { id: "page-components-layer2", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Layer 2 — Composed Components" }
                p { class: "page-header__subtitle",
                    "Pattern-level components built from Layer 1 primitives."
                }
            }
            div { class: "page-section",
                h2 { "Feedback" }
                p { "Toast notifications, alerts, and progress indicators." }
                div { class: "demo-row",
                    div { class: "hi-alert hi-alert--info", "ℹ  This is an informational alert." }
                    div { class: "hi-alert hi-alert--success", "✓  Operation completed successfully." }
                    div { class: "hi-alert hi-alert--danger",
                        "✗  An error occurred. Please try again."
                    }
                }
                h2 { "Navigation" }
                p { "Tabs, breadcrumbs, and menu components." }
                div { class: "demo-row",
                    nav { class: "hi-tabs",
                        button { class: "hi-tab hi-tab--active", "Tab 1" }
                        button { class: "hi-tab", "Tab 2" }
                        button { class: "hi-tab", "Tab 3" }
                    }
                }
            }
        }
    }
}

fn render_layer3() -> VNode {
    rsx! {
        div { id: "page-components-layer3", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Layer 3 — Complex Components" }
                p { class: "page-header__subtitle",
                    "Advanced widgets: rich editor, media player, visualisation, and interactive guides."
                }
            }
            div { class: "page-section",
                p {
                    "Layer 3 components are high-complexity, domain-specific widgets that integrate multiple Layer 1 and Layer 2 components."
                }
                div { class: "card-grid",
                    div { class: "card",
                        h3 { class: "card__title", "Rich Editor" }
                        p { class: "card__body",
                            "Full-featured rich text editing with formatting, code blocks, and media embedding."
                        }
                    }
                    div { class: "card",
                        h3 { class: "card__title", "Visualisation" }
                        p { class: "card__body", "Charts, graphs, and data visualisation primitives." }
                    }
                    div { class: "card",
                        h3 { class: "card__title", "Media Player" }
                        p { class: "card__body", "Video and audio player with custom controls." }
                    }
                    div { class: "card",
                        h3 { class: "card__title", "User Guide" }
                        p { class: "card__body",
                            "Interactive onboarding and feature discovery overlay."
                        }
                    }
                }
            }
        }
    }
}

/// Returns all component pages as a Vec for inclusion in the full page tree.
pub fn render_all() -> Vec<VNode> {
    vec![
        render_overview(),
        render_layer1(),
        render_layer2(),
        render_layer3(),
    ]
}
