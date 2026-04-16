use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn make_search(
    placeholder: &str,
    extra_class: &str,
    icon: bool,
    clearable: bool,
    value: &str,
) -> VNode {
    let mut classes = "hi-search".to_string();
    if !extra_class.is_empty() {
        classes.push_str(" ");
        classes.push_str(extra_class);
    }
    let icon_node = if icon {
        Some(rsx! { span { class: "hi-search__icon", "\u{1F50D}" } })
    } else {
        None
    };
    let clear_node = if clearable {
        Some(rsx! { button { class: "hi-search__clear", "\u{00D7}" } })
    } else {
        None
    };
    let mut children: Vec<VNode> = Vec::new();
    if let Some(n) = icon_node {
        children.push(n);
    }
    children.push(rsx! { input { class: "hi-search__input", placeholder: placeholder, r#type: "search", value: value } });
    if let Some(n) = clear_node {
        children.push(n);
    }
    glow_wrap(
        VNode::Element(
            tairitsu_vdom::VElement::new("div")
                .class(classes.as_str())
                .children(children),
        ),
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    )
}

pub fn render() -> VNode {
    let search_basic = make_search("Search...", "", false, false, "");
    let search_icon = make_search("Search components...", "", true, false, "");
    let search_small = make_search("Quick search", "hi-search--sm", true, false, "");
    let search_large = make_search(
        "Search the documentation...",
        "hi-search--lg",
        true,
        false,
        "",
    );
    let search_clearable = make_search("Type to search...", "", true, true, "");

    rsx! {
        div { id: "page-component-search", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Search" }
                p { class: "page-header__subtitle",
                    "Search input with icon, clear button, and size variants for instant filtering."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic Search" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            {search_basic}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "With Icon" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            {search_icon}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Search Sizes" }
                    div { class: "demo-block__body",
                        div { style: "display:flex;flex-direction:column;gap:12px;",
                            {search_small}
                            {make_search("Search components...", "", true, false, "")}
                            {search_large}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Clearable Search" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            {search_clearable}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                            tbody {
                                tr { td { code { "placeholder" } } td { code { "string" } } td { code { "Search..." } } td { "Input placeholder text" } }
                                tr { td { code { "value" } } td { code { "string" } } td { code { "" } } td { "Current search query" } }
                                tr { td { code { "icon" } } td { code { "bool" } } td { code { "false" } } td { "Show search icon" } }
                                tr { td { code { "clearable" } } td { code { "bool" } } td { code { "false" } } td { "Show clear button" } }
                                tr { td { code { "size" } } td { code { "small | default | large" } } td { code { "default" } } td { "Input size preset" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
