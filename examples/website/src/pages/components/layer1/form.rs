use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn glow_input(placeholder: &str, type_: &str, extra_class: &str, color: GlowColor) -> VNode {
    glow_wrap(
        rsx! { input { class: format!("hi-input {}", extra_class), placeholder: placeholder, r#type: type_ } },
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
                            rsx! { button { class: "hi-button hi-button-primary", "Submit" } },
                            GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                        )}
                    }
                }
            )}
            {render_demo_block("Input States",
                rsx! {
                    form { class: "hi-form",
                        div { style: "display:flex;flex-direction:column;gap:16px;",
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
                                    rsx! { input { class: "hi-input hi-input-error", placeholder: "Error state", r#type: "text", value: "invalid-user" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Danger, ..Default::default() },
                                )}
                                span { class: "hi-form-error", "Username must be 3-20 characters" }
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Disabled" }
                                {glow_input("Disabled field", "text", "disabled=\"true\"", GlowColor::Ghost)}
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
                            rsx! { button { class: "hi-button hi-button-primary hi-button-sm", "Search" } },
                            GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                        )}
                    }
                }
            )}
            {render_demo_block("Form Validation",
                rsx! {
                    form { class: "hi-form",
                        div { style: "display:flex;flex-direction:column;gap:16px;max-width:480px;",
                            div { class: "hi-form-item",
                                label { class: "hi-form-item__label",
                                    span { "Username" }
                                    span { style: "color:#ef4444;margin-left:2px;", "*" }
                                }
                                input { class: "hi-input", value: "alice_chen", style: "width:100%;box-sizing:border-box;" }
                                p { style: "margin:4px 0 0;font-size:12px;color:#22c55e;display:flex;align-items:center;gap:4px;", "\u{2713} Username is available" }
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-form-item__label",
                                    span { "Email" }
                                    span { style: "color:#ef4444;margin-left:2px;", "*" }
                                }
                                input { class: "hi-input", value: "invalid-email", style: "width:100%;box-sizing:border-box;border-color:#ef4444;background:#fef2f2;" }
                                p { style: "margin:4px 0 0;font-size:12px;color:#ef4444;", "Please enter a valid email address (e.g. user@example.com)" }
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-form-item__label", "Password" }
                                input { class: "hi-input", r#type: "password", value: "12345", style: "width:100%;box-sizing:border-box;border-color:#ef4444;background:#fef2f2;", autocomplete: "new-password" }
                                p { style: "margin:4px 0 0;font-size:12px;color:#ef4444;", "Password must be at least 8 characters" }
                            }
                            div { style: "display:flex;gap:12px;margin-top:8px;",
                                button { class: "hi-button hi-button-primary", "Submit" }
                                button { class: "hi-button hi-button-secondary", "Reset" }
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
        },
    )
}
