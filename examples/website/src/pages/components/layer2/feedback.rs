use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-feedback-composed", "Feedback (Composed)", "Toast notifications, progress indicators, and skeleton loading for composed feedback patterns.", VNode::Fragment(vec![
        render_demo_block("Toast Notifications", rsx! {
            div { style: "display:flex;flex-direction:column;gap:12px;",
                div { class: "hi-toast hi-toast--info",
                    div { class: "hi-toast__icon", "ℹ" }
                    div { class: "hi-toast__content",
                        div { class: "hi-toast__title", "System Update" }
                        div { class: "hi-toast__message", "A new version is available for download." }
                    }
                    button { class: "hi-toast__close", "×" }
                }
                div { class: "hi-toast hi-toast--success",
                    div { class: "hi-toast__icon", "✓" }
                    div { class: "hi-toast__content",
                        div { class: "hi-toast__title", "Saved" }
                        div { class: "hi-toast__message", "Your changes have been saved successfully." }
                    }
                    button { class: "hi-toast__close", "×" }
                }
                div { class: "hi-toast hi-toast--danger",
                    div { class: "hi-toast__icon", "✗" }
                    div { class: "hi-toast__content",
                        div { class: "hi-toast__title", "Error" }
                        div { class: "hi-toast__message", "Failed to connect to the server." }
                    }
                    button { class: "hi-toast__close", "×" }
                }
                div { class: "hi-toast hi-toast--warning",
                    div { class: "hi-toast__icon", "⚠" }
                    div { class: "hi-toast__content",
                        div { class: "hi-toast__title", "Warning" }
                        div { class: "hi-toast__message", "You are about to delete this item permanently." }
                    }
                    button { class: "hi-toast__close", "×" }
                }
            }
        }),
        render_demo_block("Progress Indicators", rsx! {
            div { style: "display:flex;flex-direction:column;gap:16px;",
                div {
                    div { style: "display:flex;justify-content:space-between;margin-bottom:4px;",
                        span { style: "font-size:13px;font-weight:600;", "Build Progress" }
                        span { style: "font-size:13px;color:var(--hi-color-text-secondary);", "3 of 5 steps" }
                    }
                    div { class: "hi-progress",
                        div { class: "hi-progress__bar", style: "width: 60%;" }
                    }
                }
                div {
                    div { style: "display:flex;justify-content:space-between;margin-bottom:4px;",
                        span { style: "font-size:13px;font-weight:600;", "Upload Complete" }
                        span { style: "font-size:13px;color:var(--hi-color-text-success);", "100%" }
                    }
                    div { class: "hi-progress hi-progress--success",
                        div { class: "hi-progress__bar", style: "width: 100%;" }
                    }
                }
                div {
                    div { style: "display:flex;justify-content:space-between;margin-bottom:4px;",
                        span { style: "font-size:13px;font-weight:600;", "Storage Used" }
                        span { style: "font-size:13px;color:var(--hi-color-text-secondary);", "7.2 / 10 GB" }
                    }
                    div { class: "hi-progress hi-progress--warning",
                        div { class: "hi-progress__bar", style: "width: 72%;" }
                    }
                }
            }
        }),
        render_demo_block("Skeleton Loading", rsx! {
            div { style: "display:flex;flex-direction:column;gap:20px;",
                div { class: "hi-skeleton-card",
                    div { style: "display:flex;align-items:center;gap:12px;margin-bottom:16px;",
                        div { class: "hi-skeleton hi-skeleton--circle", style: "width:40px;height:40px;" }
                        div { style: "flex:1;display:flex;flex-direction:column;gap:8px;",
                            div { class: "hi-skeleton", style: "width:50%;height:14px;" }
                            div { class: "hi-skeleton", style: "width:30%;height:10px;" }
                        }
                    }
                    div { class: "hi-skeleton", style: "width:100%;height:12px;" }
                    div { class: "hi-skeleton", style: "width:100%;height:12px;" }
                    div { class: "hi-skeleton", style: "width:60%;height:12px;" }
                }
                div { class: "hi-skeleton-card",
                    div { class: "hi-skeleton", style: "width:100%;height:140px;margin-bottom:12px;" }
                    div { class: "hi-skeleton", style: "width:80%;height:16px;" }
                    div { class: "hi-skeleton", style: "width:100%;height:12px;margin-top:8px;" }
                    div { class: "hi-skeleton", style: "width:40%;height:12px;margin-top:8px;" }
                }
            }
        }),
        render_demo_block("API", rsx! {
            div {
                {render_api_table(&[
                    ("Toast", "variant", "info | success | danger | warning", "Toast style variant"),
                    ("Toast", "duration", "number", "Auto-dismiss time in ms"),
                    ("Toast", "closable", "bool", "Show close button"),
                    ("Progress", "label", "string", "Progress label text"),
                    ("Progress", "showInfo", "bool", "Show percentage text"),
                    ("Skeleton", "loading", "bool", "Whether to show skeleton"),
                    ("Skeleton", "rows", "number", "Number of skeleton rows"),
                ])}
            }
        }),
    ]))
}
