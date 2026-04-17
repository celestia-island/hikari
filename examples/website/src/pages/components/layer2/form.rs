use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    let btn_signin = glow_wrap(
        rsx! { button { class: "hi-button hi-button-primary", "Sign In" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            ..Default::default()
        },
    );
    let btn_submit = glow_wrap(
        rsx! { button { class: "hi-button hi-button-primary", "Submit" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            ..Default::default()
        },
    );

    rsx! {
        div { id: "page-component-form-composed", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Form (Composed)" }
                p { class: "page-header__subtitle",
                    "Form builder with validation, layout options, and submission handling."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Login Form" }
                    div { class: "demo-block__body",
                        form { class: "hi-form",
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Username" },
                                {glow_wrap(
                                    rsx! { input { class: "hi-input", placeholder: "Enter username", r#type: "text" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Password" },
                                {glow_wrap(
                                    rsx! { input { class: "hi-input", placeholder: "Enter password", r#type: "password", autocomplete: "current-password" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-switch",
                                    input { r#type: "checkbox", class: "hi-switch__input" }
                                    span { class: "hi-switch__rail" }
                                }
                                span { "Remember me" }
                            }
                            {btn_signin}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Registration Form with Validation" }
                    div { class: "demo-block__body",
                        form { class: "hi-form",
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Email" },
                                {glow_wrap(
                                    rsx! { input { class: "hi-input", placeholder: "you@example.com", r#type: "email" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                span { class: "hi-form-item__help", "We will never share your email." }
                            }
                            div { class: "hi-form-item hi-form-item--error",
                                label { class: "hi-label", "Password" },
                                {glow_wrap(
                                    rsx! { input { class: "hi-input hi-input-error", placeholder: "Min 8 characters", r#type: "password", autocomplete: "new-password" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Danger, ..Default::default() },
                                )}
                                span { class: "hi-form-item__error", "Password must be at least 8 characters" }
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Confirm Password" },
                                {glow_wrap(
                                    rsx! { input { class: "hi-input", placeholder: "Repeat password", r#type: "password", autocomplete: "new-password" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Bio" },
                                {glow_wrap(
                                    rsx! { textarea { class: "hi-textarea", placeholder: "Tell us about yourself..." } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                            {btn_submit}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Inline Form" }
                    div { class: "demo-block__body",
                        form { class: "hi-form hi-form--inline",
                            {glow_wrap(
                                rsx! { input { class: "hi-input", placeholder: "Search...", r#type: "search" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                            {glow_wrap(
                                rsx! { select { class: "hi-select",
                                    option { value: "all", "All" }
                                    option { value: "active", "Active" }
                                    option { value: "archived", "Archived" }
                                } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                            {glow_wrap(
                                rsx! { button { class: "hi-button hi-button-primary", "Search" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                            )}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                            tbody {
                                tr { td { code { "layout" } } td { code { "vertical | horizontal | inline" } } td { code { "vertical" } } td { "Form layout mode" } }
                                tr { td { code { "validation" } } td { code { "object" } } td { code { "-" } } td { "Validation rules per field" } }
                                tr { td { code { "disabled" } } td { code { "bool" } } td { code { "false" } } td { "Disable entire form" } }
                                tr { td { code { "requiredMark" } } td { code { "bool" } } td { code { "true" } } td { "Show required asterisk" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
