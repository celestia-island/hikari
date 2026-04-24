use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
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

pub fn render() -> VNode {
    render_demo_page(
        "page-component-display",
        "Display",
        "Badges, dividers, status indicators, and text styling primitives for visual presentation.",
        VNode::Fragment(vec![
            render_demo_block("Badges",
                VNode::Fragment(vec![
                    render_demo_row(
                        rsx! {
                            span { class: "hi-badge", "New" }
                            span { class: "hi-badge hi-badge--primary", "Beta" }
                            span { class: "hi-badge hi-badge--success", "Active" }
                            span { class: "hi-badge hi-badge--danger", "Offline" }
                            span { class: "hi-badge hi-badge--warning", "Pending" }
                        }
                    ),
                    render_demo_row(
                        rsx! {
                            span { class: "hi-badge hi-badge--dot", "" }
                            span { class: "hi-badge hi-badge--dot hi-badge--success", "" }
                            span { class: "hi-badge hi-badge--dot hi-badge--danger", "" }
                        }
                    ),
                ])
            ),
            render_demo_block("Badge on Element",
                render_demo_row(
                    rsx! {
                        div { style: "position:relative;display:inline-block;",
                            span { class: "hi-badge hi-badge--danger", "3" }
                            span { style: "font-size:20px;",
                                {icon_el(MdiIcon::Bell, 20)}
                            }
                        }
                        div { style: "position:relative;display:inline-block;",
                            span { class: "hi-badge hi-badge--dot hi-badge--success", "" }
                            span { style: "font-size:20px;",
                                {icon_el(MdiIcon::Mail, 20)}
                            }
                        }
                    }
                )
            ),
            render_demo_block("Dividers",
                rsx! {
                    div { style: "display:flex;flex-direction:column;gap:16px;",
                        div {
                            p { "Content above the divider" }
                            hr { class: "hi-divider" }
                            p { "Content below the divider" }
                        }
                        div {
                            p { "Section with text divider" }
                            hr { class: "hi-divider" }
                            div { class: "hi-divider hi-divider--with-text", "OR" }
                        }
                    }
                }
            ),
            render_demo_block("Status Indicators",
                rsx! {
                    div { style: "display:flex;flex-direction:column;gap:12px;",
                        div { style: "display:flex;align-items:center;gap:8px;",
                            span { class: "hi-status hi-status--online", "" }
                            span { "Online" }
                        }
                        div { style: "display:flex;align-items:center;gap:8px;",
                            span { class: "hi-status hi-status--offline", "" }
                            span { "Offline" }
                        }
                        div { style: "display:flex;align-items:center;gap:8px;",
                            span { class: "hi-status hi-status--busy", "" }
                            span { "Busy" }
                        }
                        div { style: "display:flex;align-items:center;gap:8px;",
                            span { class: "hi-status hi-status--away", "" }
                            span { "Away" }
                        }
                    }
                }
            ),
            render_demo_block("Text Styles",
                rsx! {
                    div { style: "display:flex;flex-direction:column;gap:12px;",
                        p { class: "hi-text hi-text--heading", "Heading Text" }
                        p { class: "hi-text hi-text--subheading", "Subheading Text" }
                        p { class: "hi-text hi-text--body", "Regular body text for paragraph content." }
                        p { class: "hi-text hi-text--caption", "Caption or helper text with smaller font size." }
                        p { class: "hi-text hi-text--muted", "Muted or disabled text styling." }
                        p { class: "hi-text hi-text--code", "monospace_code_style()" }
                    }
                }
            ),
            render_demo_block("API",
                render_api_table(&[
                    ("Badge", "variant", "default | primary | success | danger | warning", "Badge color variant"),
                    ("Badge", "dot", "bool", "Show as a small dot indicator"),
                    ("Divider", "with-text", "string", "Center text on the divider"),
                    ("Status", "state", "online | offline | busy | away", "Status indicator color"),
                    ("Text", "variant", "heading | subheading | body | caption | muted | code", "Text style preset"),
                ])
            ),
        ]),
    )
}
