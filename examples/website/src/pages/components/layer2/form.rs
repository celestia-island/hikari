use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-form-composed", "Form (Composed)", "Form builder with validation, layout options, and submission handling.", rsx! [
        {render_demo_block("Login Form", rsx! {
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
                div { {glow_wrap(
                    rsx! { button { class: "hi-button hi-button-primary", "Sign In" } },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                )} }
            }
        })}
        {render_demo_block("Registration Form with Validation", rsx! {
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
                div { {glow_wrap(
                    rsx! { button { class: "hi-button hi-button-primary", "Submit" } },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                )} }
            }
        })}
        {render_demo_block("Inline Form", rsx! {
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
        })}
        {render_demo_block("API", rsx! {
            div {
                {render_api_table(&[
                    ("layout", "vertical | horizontal | inline", "vertical", "Form layout mode"),
                    ("validation", "object", "-", "Validation rules per field"),
                    ("disabled", "bool", "false", "Disable entire form"),
                    ("requiredMark", "bool", "true", "Show required asterisk"),
                ])}
            }
        })}
    ])
}
