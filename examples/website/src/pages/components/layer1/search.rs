use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use crate::components::icon_utils::icon_el;
use hikari_icons::MdiIcon;
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn make_search(placeholder: &str, extra_class: &str, icon: bool, clearable: bool, value: &str) -> VNode {
    let mut classes = "hi-search".to_string();
    if !extra_class.is_empty() {
        classes.push_str(" ");
        classes.push_str(extra_class);
    }
    let icon_node = if icon {
        Some(rsx! { span { class: "hi-search__icon", {icon_el(MdiIcon::Magnify, 16)} } })
    } else {
        None
    };
    let clear_node = if clearable {
        Some(rsx! { button { attr: "type", "button", class: "hi-search__clear", attr: "aria-label", "Clear", {icon_el(MdiIcon::Close, 14)} } })
    } else {
        None
    };
    let mut children: Vec<VNode> = Vec::new();
    if let Some(n) = icon_node { children.push(n); }
    children.push(rsx! { input { class: "hi-input", placeholder: placeholder, r#type: "search", value: value } });
    if let Some(n) = clear_node { children.push(n); }
    glow_wrap(
        VNode::Element(tairitsu_vdom::VElement::new("div").class(classes.as_str()).children(children)),
        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
    )
}

pub fn render() -> VNode {
    render_demo_page(
        "page-component-search",
        "Search",
        "Search input with icon, clear button, and size variants for instant filtering.",
        rsx! {
            {render_demo_block("Basic Search",
                render_demo_row(make_search("Search...", "", false, false, ""))
            )}
            {render_demo_block("With Icon",
                render_demo_row(make_search("Search components...", "", true, false, ""))
            )}
            {render_demo_block("Search Sizes",
                rsx! {
                    div { class: "hi-search-stack",
                        {make_search("Quick search", "hi-search--sm", true, false, "")}
                        {make_search("Search components...", "", true, false, "")}
                        {make_search("Search the documentation...", "hi-search--lg", true, false, "")}
                    }
                }
            )}
            {render_demo_block("Disabled Search",
                render_demo_row(
                    rsx! {
                        div { class: "hi-search hi-search--disabled",
                            div { class: "hi-search__icon", {icon_el(MdiIcon::Magnify, 16)} }
                            input { class: "hi-input hi-search__input", placeholder: "Search...", disabled: "true" }
                        }
                    }
                )
            )}
            {render_demo_block("Clearable Search",
                render_demo_row(make_search("Type to search...", "", true, true, ""))
            )}
            {render_demo_block("API",
                render_api_table(&[
                    ("placeholder", "string", "Search...", "Input placeholder text"),
                    ("value", "string", "", "Current search query"),
                    ("icon", "bool", "false", "Show search icon"),
                    ("clearable", "bool", "false", "Show clear button"),
                    ("size", "small | default | large", "default", "Input size preset"),
                ])
            )}
        }
    )
}
