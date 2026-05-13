use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn glow_input(placeholder: &str, type_: &str, extra_class: &str, color: GlowColor) -> VNode {
    glow_wrap(
        rsx! { input { class: format!("hi-input {}", extra_class), placeholder: placeholder, r#type: type_ } },
        GlowConfig { intensity: GlowIntensity::Soft, color, ..Default::default() },
    )
}

fn glow_input_disabled(placeholder: &str, type_: &str, color: GlowColor) -> VNode {
    glow_wrap(
        rsx! { input { class: "hi-input", placeholder: placeholder, r#type: type_, attr: "disabled", "true" } },
        GlowConfig { intensity: GlowIntensity::Soft, color, ..Default::default() },
    )
}

pub fn render() -> VNode {
    render_demo_page(
        "page-component-form",
        "Form",
        "Form container for collecting and validating user input. Supports labels, various input types, and submission.",
        rsx! {
            {render_demo_block("Basic Form",
                rsx! {
                    form { class: "hi-form",
                        div { class: "hi-form-item",
                            label { class: "hi-label", "Name" }
                            {glow_input("Enter name", "text", "", GlowColor::Ghost)}
                        }
                        div { class: "hi-form-item",
                            label { class: "hi-label", "Email" }
                            {glow_input("Enter email", "email", "", GlowColor::Ghost)}
                        }
                        div { class: "hi-form-item",
                            label { class: "hi-label", "Message" }
                            {glow_wrap(
                                rsx! { textarea { class: "hi-textarea", placeholder: "Enter message" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                        }
                        {glow_wrap(
                            rsx! { button { class: "hi-button hi-button-primary", attr: "type", "button", "Submit" } },
                            GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                        )}
                    }
                }
            )}
            {render_demo_block("Input States",
                rsx! {
                    form { class: "hi-form",
                        div { class: "hi-form--stacked",
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Default" }
                                {glow_input("Default input", "text", "", GlowColor::Ghost)}
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Password" }
                                {glow_input("Enter password", "password", "", GlowColor::Ghost)}
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Email" }
                                {glow_input("email@example.com", "email", "", GlowColor::Ghost)}
                            }
                            div { class: "hi-form-item hi-form-item--error",
                                label { class: "hi-label", "Username" }
                                {glow_wrap(
                                    rsx! { input { class: "hi-input hi-input--error", placeholder: "Error state", r#type: "text", value: "invalid-user" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Danger, ..Default::default() },
                                )}
                                span { class: "hi-form-error", "Username must be 3-20 characters" }
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Disabled" }
                                {glow_input_disabled("Disabled field", "text", GlowColor::Ghost)}
                            }
                        }
                    }
                }
            )}
            {render_demo_block("Inline Form",
                rsx! {
                    form { class: "hi-form hi-form--inline",
                        {glow_input("Search...", "search", "", GlowColor::Ghost)}
                        {glow_wrap(
                            rsx! { button { class: "hi-button hi-button-primary hi-button-sm", attr: "type", "button", "Search" } },
                            GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                        )}
                    }
                }
            )}
            {render_demo_block("Form Validation",
                rsx! {
                    form { class: "hi-form",
                        div { class: "hi-form--stacked",
                            div { class: "hi-form-item",
                                label { class: "hi-form-item__label",
                                    span { "Username" }
                                    span { class: "hi-form-item__required", "*" }
                                }
                                input { class: "hi-input hi-input--block hi-input--error", value: "alice_chen" }
                                p { class: "hi-form-item__success", "\u{2713} Username is available" }
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-form-item__label",
                                    span { "Email" }
                                    span { class: "hi-form-item__required", "*" }
                                }
                                input { class: "hi-input hi-input--block hi-input--error", value: "invalid-email" }
                                p { class: "hi-form-item__error", "Please enter a valid email address (e.g. user@example.com)" }
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-form-item__label", "Password" }
                                input { class: "hi-input hi-input--block hi-input--error", r#type: "password", value: "12345", autocomplete: "new-password" }
                                p { class: "hi-form-item__error", "Password must be at least 8 characters" }
                            }
                            div { class: "hi-form-actions",
                                button { class: "hi-button hi-button-primary", attr: "type", "button", "Submit" }
                                button { class: "hi-button hi-button-secondary", attr: "type", "button", "Reset" }
                            }
                        }
                    }
                }
            )}
            {render_demo_block("API",
                render_api_table(&[
                    ("label", "string", "-", "Field label text"),
                    ("required", "bool", "false", "Mark field as required"),
                    ("disabled", "bool", "false", "Disable the field"),
                    ("layout", "vertical | horizontal", "vertical", "Label-input alignment"),
                ])
            )}
        }
    )
}
