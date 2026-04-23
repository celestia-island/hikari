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
    rsx! {
        div { id: "page-component-empty", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Empty" }
                p { class: "page-header__subtitle",
                    "Placeholder states for when no data is available, including search-not-found and empty table views."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic Empty State" }
                    div { class: "demo-block__body",
                        div { class: "hi-empty",
                            div { class: "hi-empty__icon", "∅" }
                            div { class: "hi-empty__description", "No data available" }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Empty with Action" }
                    div { class: "demo-block__body",
                        div { class: "hi-empty",
                            div { class: "hi-empty__icon", "📋" }
                            div { class: "hi-empty__description", "You have no projects yet" }
                            button { class: "hi-button hi-button-primary", "Create Project" }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Search Not Found" }
                    div { class: "demo-block__body",
                         div { class: "hi-empty",
                             div { class: "hi-empty__icon",
                                 {icon_el(MdiIcon::Magnify, 48)}
                             }
                             div { class: "hi-empty__description", "No results found for \"quantum computing\"" }
                             div { class: "hi-empty__hint", "Try adjusting your search terms or filters" }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Empty Table" }
                    div { class: "demo-block__body",
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
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Skeleton Loading" }
                    div { class: "demo-block__body",
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
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                            tbody {
                                tr { td { code { "icon" } } td { code { "string" } } td { code { "∅" } } td { "Icon or emoji displayed" } }
                                tr { td { code { "description" } } td { code { "string" } } td { code { "No data" } } td { "Primary description text" } }
                                tr { td { code { "hint" } } td { code { "string" } } td { code { "-" } } td { "Secondary helper text" } }
                                tr { td { code { "action" } } td { code { "VNode" } } td { code { "-" } } td { "Optional action button" } }
                                tr { td { code { "image" } } td { code { "string" } } td { code { "-" } } td { "Custom illustration URL" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
