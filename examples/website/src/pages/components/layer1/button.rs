use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    let btn_primary = glow_wrap(
        rsx! { button { class: "hi-button hi-button-primary", "Primary" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            ..Default::default()
        },
    );
    let btn_secondary = glow_wrap(
        rsx! { button { class: "hi-button hi-button-secondary", "Secondary" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Secondary,
            ..Default::default()
        },
    );
    let btn_danger = glow_wrap(
        rsx! { button { class: "hi-button hi-button-danger", "Danger" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Danger,
            ..Default::default()
        },
    );
    let btn_ghost = glow_wrap(
        rsx! { button { class: "hi-button hi-button-ghost", "Ghost" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );
    let btn_small = glow_wrap(
        rsx! { button { class: "hi-button hi-button-primary hi-button-sm", "Small" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            ..Default::default()
        },
    );
    let btn_large = glow_wrap(
        rsx! { button { class: "hi-button hi-button-primary hi-button-lg", "Large" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            ..Default::default()
        },
    );
    let btn_disabled = glow_wrap(
        rsx! { button { class: "hi-button hi-button-primary", disabled: "true", "Disabled" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            ..Default::default()
        },
    );

    rsx! {
        div { id: "page-component-button", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Button" }
                p { class: "page-header__subtitle",
                    "Primary action trigger with variants: primary, secondary, danger, ghost. Supports multiple sizes and states."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Button Variants" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            {btn_primary}
                            {btn_secondary}
                            {btn_danger}
                            {btn_ghost}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Button Sizes" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            {btn_small}
                            {glow_wrap(
                                rsx! { button { class: "hi-button hi-button-primary", "Default" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                            )}
                            {btn_large}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Button States" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            {glow_wrap(
                                rsx! { button { class: "hi-button hi-button-primary", "Normal" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                            )}
                            {glow_wrap(
                                rsx! { button { class: "hi-button hi-button-primary", disabled: "true", "\u{23F7} Loading..." } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                            )}
                            {glow_wrap(
                                rsx! { button { class: "hi-button hi-button-primary", "\u{2605} Icon Button" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                            )}
                            {btn_disabled}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Button Group" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            {glow_wrap(
                                rsx! { button { class: "hi-button hi-button-secondary", "Cancel" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Secondary, ..Default::default() },
                            )}
                            {glow_wrap(
                                rsx! { button { class: "hi-button hi-button-primary", "Confirm" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                            )}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Block Buttons" }
                    div { class: "demo-block__body",
                        div { style: "display:flex;flex-direction:column;gap:12px;",
                            button { class: "hi-button hi-button-primary", style: "width:100%;", "Full Width Primary" }
                            button { class: "hi-button hi-button-danger", style: "width:100%;", "Delete Account" }
                            div { style: "display:flex;gap:12px;",
                                button { class: "hi-button hi-button-secondary", style: "flex:1;", "Cancel" }
                                button { class: "hi-button hi-button-primary", style: "flex:1;", "Confirm" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                            tbody {
                                tr { td { code { "variant" } } td { code { "primary | secondary | danger | ghost" } } td { code { "primary" } } td { "Visual style variant" } }
                                tr { td { code { "size" } } td { code { "small | default | large" } } td { code { "default" } } td { "Button size preset" } }
                                tr { td { code { "disabled" } } td { code { "bool" } } td { code { "false" } } td { "Disable the button" } }
                                tr { td { code { "glow" } } td { code { "dim | soft | bright" } } td { code { "-" } } td { "Glow hover intensity" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
