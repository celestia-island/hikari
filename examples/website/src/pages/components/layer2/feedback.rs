use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use hikari_components::style_builder::{CssProperty, StyleStringBuilder};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-feedback-composed", "Feedback (Composed)", "Toast notifications, progress indicators, and skeleton loading for composed feedback patterns.", rsx! [
        {render_demo_block("Toast Notifications", rsx! {
            div { class: "hi-toast-stack",
                div { class: "hi-toast hi-toast--info",
                    div { class: "hi-toast__icon", "ℹ" }
                    div { class: "hi-toast__content",
                        div { class: "hi-toast__title", "System Update" }
                        div { class: "hi-toast__message", "A new version is available for download." }
                    }
                    button { class: "hi-toast__close", attr: "type", "button", "×" }
                }
                div { class: "hi-toast hi-toast--success",
                    div { class: "hi-toast__icon", "✓" }
                    div { class: "hi-toast__content",
                        div { class: "hi-toast__title", "Saved" }
                        div { class: "hi-toast__message", "Your changes have been saved successfully." }
                    }
                    button { class: "hi-toast__close", attr: "type", "button", "×" }
                }
                div { class: "hi-toast hi-toast--danger",
                    div { class: "hi-toast__icon", "✗" }
                    div { class: "hi-toast__content",
                        div { class: "hi-toast__title", "Error" }
                        div { class: "hi-toast__message", "Failed to connect to the server." }
                    }
                    button { class: "hi-toast__close", attr: "type", "button", "×" }
                }
                div { class: "hi-toast hi-toast--warning",
                    div { class: "hi-toast__icon", "⚠" }
                    div { class: "hi-toast__content",
                        div { class: "hi-toast__title", "Warning" }
                        div { class: "hi-toast__message", "You are about to delete this item permanently." }
                    }
                    button { class: "hi-toast__close", attr: "type", "button", "×" }
                }
            }
        })}
        {render_demo_block("Progress Indicators", rsx! {
            div { class: "hi-progress-stack",
                div {
                    div { class: "hi-progress-label",
                        span { class: "hi-progress-label__text", "Build Progress" }
                        span { class: "hi-progress-label__meta", "3 of 5 steps" }
                    }
                    div { class: "hi-progress",
                        div { class: "hi-progress__bar", style: StyleStringBuilder::new().add_percent(CssProperty::Width, 60).build_clean() }
                    }
                }
                div {
                    div { class: "hi-progress-label",
                        span { class: "hi-progress-label__text", "Upload Complete" }
                        span { class: "hi-progress-label__meta hi-progress-label__meta--success", "100%" }
                    }
                    div { class: "hi-progress hi-progress--success",
                        div { class: "hi-progress__bar", style: StyleStringBuilder::new().add_percent(CssProperty::Width, 100).build_clean() }
                    }
                }
                div {
                    div { class: "hi-progress-label",
                        span { class: "hi-progress-label__text", "Storage Used" }
                        span { class: "hi-progress-label__meta", "7.2 / 10 GB" }
                    }
                    div { class: "hi-progress hi-progress--warning",
                        div { class: "hi-progress__bar", style: StyleStringBuilder::new().add_percent(CssProperty::Width, 72).build_clean() }
                    }
                }
            }
        })}
        {render_demo_block("Skeleton Loading", rsx! {
            div { class: "hi-skeleton-cards",
                div { class: "hi-skeleton-card",
                    div { class: "hi-skeleton-card__header",
                        div { class: "hi-skeleton hi-skeleton--circle hi-skeleton--avatar-sm" }
                        div { class: "hi-skeleton-card__header-text",
                            div { class: "hi-skeleton hi-skeleton--text-md" }
                            div { class: "hi-skeleton hi-skeleton--text-xs" }
                        }
                    }
                    div { class: "hi-skeleton hi-skeleton--line" }
                    div { class: "hi-skeleton hi-skeleton--line" }
                    div { class: "hi-skeleton hi-skeleton--line hi-skeleton--line-short" }
                }
                div { class: "hi-skeleton-card hi-skeleton-card--media",
                    div { class: "hi-skeleton hi-skeleton--banner" }
                    div { class: "hi-skeleton hi-skeleton--text-lg" }
                    div { class: "hi-skeleton hi-skeleton--line" }
                    div { class: "hi-skeleton hi-skeleton--line-short" }
                }
            }
        })}
        {render_demo_block("API", rsx! {
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
        })}
    ])
}
