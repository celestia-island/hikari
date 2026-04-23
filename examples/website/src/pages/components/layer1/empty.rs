use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
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
        "page-component-empty",
        "Empty",
        "Placeholder states for when no data is available, including search-not-found and empty table views.",
        rsx! {
            {render_demo_block("Basic Empty State",
                rsx! {
                    div { class: "hi-empty",
                        div { class: "hi-empty__icon", "\u{2205}" }
                        div { class: "hi-empty__description", "No data available" }
                    }
                }
            )}
            {render_demo_block("Empty with Action",
                rsx! {
                    div { class: "hi-empty",
                        div { class: "hi-empty__icon", "\u{1f4cb}" }
                        div { class: "hi-empty__description", "You have no projects yet" }
                        button { class: "hi-button hi-button-primary", "Create Project" }
                    }
                }
            )}
            {render_demo_block("Search Not Found",
                rsx! {
                    div { class: "hi-empty",
                        div { class: "hi-empty__icon",
                            {icon_el(MdiIcon::Magnify, 48)}
                        }
                        div { class: "hi-empty__description", "No results found for \"quantum computing\"" }
                        div { class: "hi-empty__hint", "Try adjusting your search terms or filters" }
                    }
                }
            )}
            {render_demo_block("Empty Table",
                rsx! {
                    table { class: "hi-table",
                        thead { tr { th { "Name" } th { "Status" } th { "Updated" } } }
                        tbody {
                            tr {
                                td { colspan: "3",
                                    div { class: "hi-empty",
                                        div { class: "hi-empty__icon",
                                            {icon_el(MdiIcon::FileEdit, 48)}
                                        }
                                        div { class: "hi-empty__description", "No records to display" }
                                    }
                                }
                            }
                        }
                    }
                }
            )}
            {render_demo_block("Skeleton Loading",
                rsx! {
                    div { style: "display:flex;flex-direction:column;gap:16px;",
                        div { style: "display:flex;align-items:center;gap:12px;",
                            div { class: "hi-skeleton hi-skeleton--circle", style: "width:48px;height:48px;" }
                            div { style: "display:flex;flex-direction:column;gap:8px;flex:1;",
                                div { class: "hi-skeleton", style: "width:40%;height:16px;" }
                                div { class: "hi-skeleton", style: "width:60%;height:12px;" }
                            }
                        }
                        div { class: "hi-skeleton", style: "width:100%;height:120px;" }
                        div { style: "display:flex;gap:8px;",
                            div { class: "hi-skeleton", style: "width:80px;height:32px;" }
                            div { class: "hi-skeleton", style: "width:80px;height:32px;" }
                        }
                    }
                }
            )}
            {render_demo_block("API",
                render_api_table(&[
                    ("icon", "string", "\u{2205}", "Icon or emoji displayed"),
                    ("description", "string", "No data", "Primary description text"),
                    ("hint", "string", "-", "Secondary helper text"),
                    ("action", "VNode", "-", "Optional action button"),
                    ("image", "string", "-", "Custom illustration URL"),
                ])
            )}
        },
    )
}
