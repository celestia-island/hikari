//! Demo pages showcasing Hikari component compositions.

pub mod video_demo;

use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn render_overview() -> VNode {
    rsx! {
        div { id: "page-demos-overview", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Demos" }
                p { class: "page-header__subtitle",
                    "Full-composition demos showing Hikari components in realistic scenarios."
                }
            }
            div { class: "page-section",
                div { class: "card-grid",
                    a { href: "/demos/form", class: "card card--link",
                        h3 { class: "card__title", "Form Demo" }
                        p { class: "card__body",
                            "Registration form with validation, input types, switches, and a submit flow."
                        }
                    }
                    a { href: "/demos/dashboard", class: "card card--link",
                        h3 { class: "card__title", "Dashboard Demo" }
                        p { class: "card__body",
                            "Data dashboard with stats cards, a simple data table, and navigation tabs."
                        }
                    }
                    a { href: "/demos/video", class: "card card--link",
                        h3 { class: "card__title", "Video & Audio Demo" }
                        p { class: "card__body",
                            "Video player and audio waveform visualization components."
                        }
                    }
                }
            }
        }
    }
}

fn render_form_demo() -> VNode {
    rsx! {
        div { id: "page-demos-form", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Form Demo" }
                p { class: "page-header__subtitle",
                    "Registration form built with Hikari Layer 1 and Layer 2 components."
                }
            }
            div { class: "page-section",
                form { class: "hi-form demo-form",
                    div { class: "hi-form-row",
                        label { class: "hi-label", r#for: "demo-name", "Full Name" }
                        input {
                            id: "demo-name",
                            class: "hi-input",
                            r#type: "text",
                            placeholder: "Enter your full name",
                            required: "true",
                        }
                    }
                    div { class: "hi-form-row",
                        label { class: "hi-label", r#for: "demo-email", "Email" }
                        input {
                            id: "demo-email",
                            class: "hi-input",
                            r#type: "email",
                            placeholder: "you@example.com",
                            required: "true",
                        }
                    }
                    div { class: "hi-form-row",
                        label { class: "hi-label", r#for: "demo-role", "Role" }
                        select { id: "demo-role", class: "hi-select",
                            option { value: "dev", "Developer" }
                            option { value: "design", "Designer" }
                            option { value: "pm", "Product Manager" }
                            option { value: "other", "Other" }
                        }
                    }
                    div { class: "hi-form-row hi-form-row--inline",
                        label { class: "hi-switch",
                            input {
                                r#type: "checkbox",
                                class: "hi-switch__input",
                                id: "demo-notifications",
                            }
                            span { class: "hi-switch__rail" }
                        }
                        label {
                            class: "hi-label hi-label--inline",
                            r#for: "demo-notifications",
                            "Receive email notifications"
                        }
                    }
                    div { class: "hi-form-row",
                        button {
                            r#type: "submit",
                            class: "hi-btn hi-btn--primary hi-btn--lg",
                            "Create Account"
                        }
                        button {
                            r#type: "button",
                            class: "hi-btn hi-btn--secondary hi-btn--lg",
                            "Cancel"
                        }
                    }
                }
            }
        }
    }
}

fn render_dashboard_demo() -> VNode {
    rsx! {
        div { id: "page-demos-dashboard", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Dashboard Demo" }
                p { class: "page-header__subtitle",
                    "Analytics dashboard showing stats cards and a data table."
                }
            }
            div { class: "page-section",
                div { class: "stats-grid",
                    div { class: "stat-card",
                        span { class: "stat-card__value", "1,284" }
                        span { class: "stat-card__label", "Total Users" }
                        span { class: "stat-card__delta hi-tag hi-tag--success", "+12%" }
                    }
                    div { class: "stat-card",
                        span { class: "stat-card__value", "48,602" }
                        span { class: "stat-card__label", "Page Views" }
                        span { class: "stat-card__delta hi-tag hi-tag--success", "+8%" }
                    }
                    div { class: "stat-card",
                        span { class: "stat-card__value", "3.4s" }
                        span { class: "stat-card__label", "Avg. Load Time" }
                        span { class: "stat-card__delta hi-tag hi-tag--danger", "+0.3s" }
                    }
                    div { class: "stat-card",
                        span { class: "stat-card__value", "99.8%" }
                        span { class: "stat-card__label", "Uptime" }
                        span { class: "stat-card__delta hi-tag hi-tag--success", "Stable" }
                    }
                }
                h2 { "Recent Activity" }
                table { class: "hi-table hi-table--striped",
                    thead {
                        tr {
                            th { "User" }
                            th { "Action" }
                            th { "Component" }
                            th { "Date" }
                            th { "Status" }
                        }
                    }
                    tbody {
                        tr {
                            td { "Alice" }
                            td { "Viewed" }
                            td { "Button" }
                            td { "2025-01-10" }
                            td {
                                span { class: "hi-tag hi-tag--success", "OK" }
                            }
                        }
                        tr {
                            td { "Bob" }
                            td { "Downloaded" }
                            td { "Icon Set" }
                            td { "2025-01-10" }
                            td {
                                span { class: "hi-tag hi-tag--success", "OK" }
                            }
                        }
                        tr {
                            td { "Carol" }
                            td { "Reported" }
                            td { "Transfer" }
                            td { "2025-01-09" }
                            td {
                                span { class: "hi-tag hi-tag--warning", "Pending" }
                            }
                        }
                        tr {
                            td { "Dave" }
                            td { "Submitted" }
                            td { "Form Demo" }
                            td { "2025-01-09" }
                            td {
                                span { class: "hi-tag hi-tag--success", "OK" }
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Returns all demo pages as a Vec for inclusion in the full page tree.
pub fn render_all() -> Vec<VNode> {
    vec![
        render_overview(),
        render_form_demo(),
        render_dashboard_demo(),
        video_demo::render(),
    ]
}
