use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

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
                            div { class: "hi-alert hi-alert--info", "ℹ  This is an informational alert for general notices." }
                            div { class: "hi-alert hi-alert--success", "✓  Operation completed successfully." }
                            div { class: "hi-alert hi-alert--danger", "✗  An error occurred. Please try again later." }
                            div { class: "hi-alert hi-alert--warning", "⚠  Warning: Your session will expire in 5 minutes." }
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
