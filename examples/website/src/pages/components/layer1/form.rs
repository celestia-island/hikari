use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    let input_default = glow_wrap(
        rsx! { input { class: "hi-input", placeholder: "Default input", r#type: "text" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );
    let input_error = glow_wrap(
        rsx! { input { class: "hi-input hi-input-error", placeholder: "Error state", r#type: "text" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Danger,
            ..Default::default()
        },
    );
    let input_disabled = glow_wrap(
        rsx! { input { class: "hi-input", placeholder: "Disabled", r#type: "text", disabled: "true" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );
    let input_password = glow_wrap(
        rsx! { input { class: "hi-input", placeholder: "Password", r#type: "password" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );
    let input_email = glow_wrap(
        rsx! { input { class: "hi-input", placeholder: "email@example.com", r#type: "email" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
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
        div { id: "page-component-form", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Form" }
                p { class: "page-header__subtitle",
                    "Form container for collecting and validating user input. Supports labels, various input types, and submission."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic Form" }
                    div { class: "demo-block__body",
                        form { class: "hi-form",
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Name" },
                                {glow_wrap(
                                    rsx! { input { class: "hi-input", placeholder: "Enter name", r#type: "text" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Email" },
                                {glow_wrap(
                                    rsx! { input { class: "hi-input", placeholder: "Enter email", r#type: "email" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Message" },
                                {glow_wrap(
                                    rsx! { textarea { class: "hi-textarea", placeholder: "Enter message" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                            {btn_submit}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Input States" }
                    div { class: "demo-block__body",
                        div { style: "display:flex;flex-direction:column;gap:16px;",
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Default" }
                                {glow_wrap(
                                    rsx! { input { class: "hi-input", placeholder: "Default input", r#type: "text" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Password" }
                                {glow_wrap(
                                    rsx! { input { class: "hi-input", placeholder: "Enter password", r#type: "password" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                            div { class: "hi-form-item",
                                label { class: "hi-label", "Email" }
                                {glow_wrap(
                                    rsx! { input { class: "hi-input", placeholder: "email@example.com", r#type: "email" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
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
                                {glow_wrap(
                                    rsx! { input { class: "hi-input", placeholder: "Disabled field", r#type: "text", disabled: "true" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
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
                                rsx! { button { class: "hi-button hi-button-primary hi-button-sm", "\u{1F50D} Search" } },
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
                                tr { td { code { "label" } } td { code { "string" } } td { code { "-" } } td { "Field label text" } }
                                tr { td { code { "required" } } td { code { "bool" } } td { code { "false" } } td { "Mark field as required" } }
                                tr { td { code { "disabled" } } td { code { "bool" } } td { code { "false" } } td { "Disable the field" } }
                                tr { td { code { "layout" } } td { code { "vertical | horizontal" } } td { code { "vertical" } } td { "Label-input alignment" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
