use hikari_icons::generated::mdi_selected::get;
use hikari_icons::MdiIcon;
use tairitsu_macros::rsx;
use tairitsu_vdom::{VElement, VNode};
use crate::components::demo_page::{render_demo_page, render_demo_block, render_demo_row, render_api_table};

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
        "page-component-feedback",
        "Feedback",
        "Alerts, progress bars, and spinners for communicating system status to users.",
        rsx! {
            {render_demo_block("Alert Variants", rsx! {
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
            })}
            {render_demo_block("Alert with Title", rsx! {
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
            })}
            {render_demo_block("Progress Bars", rsx! {
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
            })}
            {render_demo_block("Spinners",
                rsx! {
                    {render_demo_row(rsx! {
                        div { class: "hi-spin" }
                        div { class: "hi-spin hi-spin--lg" }
                        div { style: "display:flex;align-items:center;gap:8px;",
                            div { class: "hi-spin" }
                            span { style: "font-size:14px;color:var(--hi-color-text-secondary);", "Loading data..." }
                        }
                    })}
                }
            )}
            {render_demo_block("Closable Alerts", rsx! {
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
                        span { style: "flex:1;", "\u{2713}  Changes saved successfully." }
                        span { style: "cursor:pointer;font-size:16px;opacity:0.6;padding:0 4px;", "\u{00d7}" }
                    }
                }
            })}
            {render_demo_block("Indeterminate & Spinner Sizes", rsx! {
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
            })}
            {render_demo_block("API",
                render_api_table(&[
                    ("Alert.variant", "info | success | danger | warning", "-", "Alert style variant"),
                    ("Alert.title", "string", "-", "Optional alert heading"),
                    ("Progress.percent", "number", "-", "Completion percentage (0-100)"),
                    ("Progress.variant", "default | success | danger", "-", "Progress bar color"),
                    ("Spinner.size", "default | large", "-", "Spinner diameter"),
                ])
            )}
        }
    )
}
