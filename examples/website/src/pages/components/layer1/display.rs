use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
use crate::components::icon_utils::icon_el;
use hikari_icons::MdiIcon;
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page(
        "page-component-display",
        "Display",
        "Badges, dividers, status indicators, and text styling primitives for visual presentation.",
        rsx! {
            {render_demo_block("Badges",
                rsx! {
                    {render_demo_row(
                        rsx! {
                            span { class: "hi-badge", "New" }
                            span { class: "hi-badge hi-badge--primary", "Beta" }
                            span { class: "hi-badge hi-badge--success", "Active" }
                            span { class: "hi-badge hi-badge--danger", "Offline" }
                            span { class: "hi-badge hi-badge--warning", "Pending" }
                        }
                    )}
                    {render_demo_row(
                        rsx! {
                            span { class: "hi-badge hi-badge--dot", "" }
                            span { class: "hi-badge hi-badge--dot hi-badge--success", "" }
                            span { class: "hi-badge hi-badge--dot hi-badge--danger", "" }
                        }
                    )}
                }
            )}
            {render_demo_block("Badge on Element",
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
            )}
            {render_demo_block("Dividers",
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
            )}
            {render_demo_block("Status Indicators",
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
            )}
            {render_demo_block("Text Styles",
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
            )}
            {render_demo_block("API",
                render_api_table(&[
                    ("Badge", "variant", "default | primary | success | danger | warning", "Badge color variant"),
                    ("Badge", "dot", "bool", "Show as a small dot indicator"),
                    ("Divider", "with-text", "string", "Center text on the divider"),
                    ("Status", "state", "online | offline | busy | away", "Status indicator color"),
                    ("Text", "variant", "heading | subheading | body | caption | muted | code", "Text style preset"),
                ])
            )}
        }
    )
}
