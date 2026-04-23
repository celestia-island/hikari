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
        div { id: "page-component-feedback", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Feedback" }
                p { class: "page-header__subtitle",
                    "Alerts, progress bars, and spinners for communicating system status to users."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Alert Variants" }
                    div { class: "demo-block__body",
                        div { style: "display:flex;flex-direction:column;gap:12px;",
                            div { class: "hi-alert hi-alert--info",
                                span { style: "display:flex;align-items:center;gap:8px;",
                                    {icon_el(MdiIcon::Information, 16)}
                                    "This is an informational alert for general notices." }
                                }
                            div { class: "hi-alert hi-alert--success",
                                span { style: "display:flex;align-items:center;gap:8px;",
                                    {icon_el(MdiIcon::Check, 16)}
                                    "Operation completed successfully." }
                                }
                            div { class: "hi-alert hi-alert--danger",
                                span { style: "display:flex;align-items:center;gap:8px;",
                                    {icon_el(MdiIcon::Close, 16)}
                                    "An error occurred. Please try again later." }
                                }
                            div { class: "hi-alert hi-alert--warning",
                                span { style: "display:flex;align-items:center;gap:8px;",
                                    {icon_el(MdiIcon::AlertTriangle, 16)}
                                    "Warning: Your session will expire in 5 minutes." }
                                }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Alert with Title" }
                    div { class: "demo-block__body",
                        div { style: "display:flex;flex-direction:column;gap:12px;",
                            div { class: "hi-alert hi-alert--success",
                                div { style: "font-weight:600;margin-bottom:4px;", "Update Available" }
                                div { "A new version (v2.4.0) is ready to install." }
                            }
                            div { class: "hi-alert hi-alert--danger",
                                div { style: "font-weight:600;margin-bottom:4px;", "Connection Lost" }
                                div { "Unable to reach the server. Check your network settings." }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Progress Bars" }
                    div { class: "demo-block__body",
                        div { style: "display:flex;flex-direction:column;gap:16px;",
                            div {
                                div { style: "margin-bottom:4px;font-size:13px;color:var(--hi-color-text-secondary);", "Uploading... 60%" }
                                div { class: "hi-progress",
                                    div { class: "hi-progress__bar", style: "width: 60%;" }
                                }
                            }
                            div {
                                div { style: "margin-bottom:4px;font-size:13px;color:var(--hi-color-text-secondary);", "Processing... 85%" }
                                div { class: "hi-progress hi-progress--success",
                                    div { class: "hi-progress__bar", style: "width: 85%;" }
                                }
                            }
                            div {
                                div { style: "margin-bottom:4px;font-size:13px;color:var(--hi-color-text-secondary);", "Error at 30%" }
                                div { class: "hi-progress hi-progress--danger",
                                    div { class: "hi-progress__bar", style: "width: 30%;" }
                                }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Spinners" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            div { class: "hi-spin" }
                            div { class: "hi-spin hi-spin--lg" }
                            div { style: "display:flex;align-items:center;gap:8px;",
                                div { class: "hi-spin" }
                                span { style: "font-size:14px;color:var(--hi-color-text-secondary);", "Loading data..." }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Closable Alerts" }
                    div { class: "demo-block__body",
                        div { style: "display:flex;flex-direction:column;gap:12px;",
                            div { class: "hi-alert hi-alert--info",
                                span { style: "display:flex;align-items:center;gap:8px;flex:1;",
                                    {icon_el(MdiIcon::Information, 16)}
                                    "This alert can be dismissed." }
                                span { style: "cursor:pointer;font-size:16px;opacity:0.6;padding:0 4px;", "\u{00D7}" }
                            }
                            div { class: "hi-alert hi-alert--success",
                                span { style: "display:flex;align-items:center;gap:8px;flex:1;",
                                    {icon_el(MdiIcon::Check, 16)}
                                    "Changes saved successfully." }
                                span { style: "cursor:pointer;font-size:16px;opacity:0.6;padding:0 4px;", "\u{00D7}" }
                            }
                            div { class: "hi-alert hi-alert--success",
                                span { style: "flex:1;", "✓  Changes saved successfully." }
                                span { style: "cursor:pointer;font-size:16px;opacity:0.6;padding:0 4px;", "×" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Indeterminate & Spinner Sizes" }
                    div { class: "demo-block__body",
                        div { style: "display:flex;flex-direction:column;gap:20px;",
                            div {
                                div { style: "margin-bottom:6px;font-size:13px;color:var(--hi-color-text-secondary);", "Loading resources..." }
                                div { class: "hi-progress",
                                    div { class: "hi-progress__bar", style: "width:40%;animation:hi-progress-indeterminate 1.8s ease-in-out infinite;" }
                                }
                            }
                            div { style: "display:flex;align-items:center;gap:24px;",
                                div { style: "display:flex;align-items:center;gap:10px;",
                                    div { class: "hi-spin hi-spin--sm" }
                                    span { style: "font-size:13px;color:var(--hi-color-text-secondary);", "Small" }
                                }
                                div { style: "display:flex;align-items:center;gap:10px;",
                                    div { class: "hi-spin" }
                                    span { style: "font-size:13px;color:var(--hi-color-text-secondary);", "Default" }
                                }
                                div { style: "display:flex;align-items:center;gap:10px;",
                                    div { class: "hi-spin hi-spin--lg" }
                                    span { style: "font-size:13px;color:var(--hi-color-text-secondary);", "Large" }
                                }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Component" } th { "Property" } th { "Type" } th { "Description" } } }
                            tbody {
                                tr { td { code { "Alert" } } td { code { "variant" } } td { code { "info | success | danger | warning" } } td { "Alert style variant" } }
                                tr { td { code { "Alert" } } td { code { "title" } } td { code { "string" } } td { "Optional alert heading" } }
                                tr { td { code { "Progress" } } td { code { "percent" } } td { code { "number" } } td { "Completion percentage (0-100)" } }
                                tr { td { code { "Progress" } } td { code { "variant" } } td { code { "default | success | danger" } } td { "Progress bar color" } }
                                tr { td { code { "Spinner" } } td { code { "size" } } td { code { "default | large" } } td { "Spinner diameter" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
