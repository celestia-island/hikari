use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use hikari_icons::generated::mdi_selected::get;
use hikari_icons::MdiIcon;
use tairitsu_macros::rsx;
use tairitsu_vdom::{VElement, VNode};

fn icon_el(icon: MdiIcon, size: u32) -> VNode {
    let icon_name = icon.to_string();
    let svg_str = get(&icon_name)
        .map(|data| {
            format!(
                r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{}" width="{}" height="{}"><path fill="currentColor" d="{}"/></svg>"#,
                data.view_box.as_deref().unwrap_or("0 0 24 24"),
                size,
                size,
                data.path.as_deref().unwrap_or("")
            )
        })
        .unwrap_or_else(|| String::from(
            r#"<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>"#
        ));
    VNode::Element(
        VElement::new("span")
            .class("hikari-icon")
            .inner_html(svg_str),
    )
}

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
        Some(rsx! { button { class: "hi-search__clear", "\u{00D7}" } })
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
                    div { style: "display:flex;flex-direction:column;gap:12px;",
                        {make_search("Quick search", "hi-search--sm", true, false, "")}
                        {make_search("Search components...", "", true, false, "")}
                        {make_search("Search the documentation...", "hi-search--lg", true, false, "")}
                    }
                }
            )}
            {render_demo_block("Clearable Search",
                render_demo_row(make_search("Type to search...", "", true, true, ""))
            )}
            {render_demo_block("Disabled Search",
                render_demo_row(
                    rsx! {
                        div { class: "hi-search",
                            div { class: "hi-search__icon", {icon_el(MdiIcon::Magnify, 16)} }
                            input { class: "hi-input hi-search__input", placeholder: "Search...", disabled: "true", style: "cursor:not-allowed;opacity:0.6;" }
                        }
                    }
                )
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
