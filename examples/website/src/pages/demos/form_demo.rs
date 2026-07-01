use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

use crate::components::{demo_page::{render_api_table, render_demo_block, render_demo_page}, glow::{GlowColor, GlowConfig, GlowIntensity, glow_wrap}};

fn glow_input(placeholder: &str, type_: &str, id: &str, required: bool) -> VNode {
    glow_wrap(
        rsx! { input { class: "hi-input", placeholder: placeholder, r#type: type_, id: id, attr_if: "required", required, "true" } },
        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
    )
}

fn btn_primary(text: &str) -> VNode {
    glow_wrap(
        rsx! { button { class: "hi-button hi-button-primary hi-button-lg hi-button--block", attr: "type", "submit", text } },
        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
    )
}

fn btn_secondary(text: &str) -> VNode {
    glow_wrap(
        rsx! { button { class: "hi-button hi-button-secondary hi-button-lg", attr: "type", "button", text } },
        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Secondary, ..Default::default() },
    )
}

pub fn render_form_demo() -> VNode {
    render_demo_page(
        "page-demos-form",
        "Form Demo",
        "Demonstrates how to build a complete login form using Layer 1 components.",
        rsx! {
            {render_demo_block("Login Form",
                rsx! {
                    div { class: "demo-form-login",
                        div { class: "card demo-card",
                            div { class: "demo-form-header",
                                h2 { class: "demo-form-header__title", "Login" }
                                p { class: "demo-form-header__subtitle", "Welcome back, please sign in to your account" }
                            }
                            div { class: "demo-form-body",
                                {glow_input("you@example.com", "email", "demo-email", true)}
                                {glow_input("Enter your password", "password", "demo-password", true)}
                                div { class: "demo-form-row--between",
                                    label { class: "demo-form-remember",
                                        input { r#type: "checkbox", class: "hi-switch__input" }
                                        "Remember me"
                                    }
                                    a { class: "demo-form-link", "Forgot password?" }
                                }
                                div { class: "demo-form-actions",
                                    {btn_primary("Sign In")}
                                    {btn_secondary("Cancel")}
                                }
                            }
                            div { class: "demo-form-footer",
                                p { "Don't have an account?" }
                                a { class: "demo-form-link", "Sign up" }
                            }
                        }
                    }
                }
            )}
            {render_demo_block("API",
                render_api_table(&[
                    ("layout", "vertical | horizontal | inline", "vertical", "Form layout mode"),
                    ("validation", "object | string", "-", "Validation rules per field"),
                    ("requiredMark", "bool", "true", "Show required asterisk"),
                    ("rememberMe", "bool", "false", "Show remember me checkbox"),
                    ("forgotLink", "string", "-", "Forgot password link URL"),
                    ("signupLink", "string", "-", "Sign up link URL"),
                ])
            )}
        }
    )
}
