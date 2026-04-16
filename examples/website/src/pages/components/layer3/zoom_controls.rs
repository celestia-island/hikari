use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-component-zoom-controls", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Zoom Controls" }
                p { class: "page-header__subtitle",
                    "Zoom in, zoom out, and reset controls for canvas viewers, maps, and image previews."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic Zoom Controls" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            div { class: "hi-zoom-controls",
                                {glow_wrap(
                                    rsx! { button { class: "hi-zoom-controls__btn", "+" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                span { class: "hi-zoom-controls__level", "100%" }
                                {glow_wrap(
                                    rsx! { button { class: "hi-zoom-controls__btn", "-" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-zoom-controls__btn", "⟲" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Zoom Slider" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            div { class: "hi-zoom-controls",
                                {glow_wrap(
                                    rsx! { button { class: "hi-zoom-controls__btn", "+" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                div { class: "hi-zoom-controls__slider",
                                    input { r#type: "range", min: "25", max: "400", value: "100", class: "hi-zoom-controls__range" }
                                }
                                {glow_wrap(
                                    rsx! { button { class: "hi-zoom-controls__btn", "-" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                span { class: "hi-zoom-controls__level", "100%" }
                                {glow_wrap(
                                    rsx! { button { class: "hi-zoom-controls__btn", "Fit" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Secondary, ..Default::default() },
                                )}
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Floating Zoom Controls" }
                    div { class: "demo-block__body",
                        div { style: "position:relative;height:200px;background:var(--hi-color-surface);border-radius:8px;border:1px solid var(--hi-color-border);overflow:hidden;",
                            div { style: "position:absolute;bottom:12px;right:12px;",
                                div { class: "hi-zoom-controls hi-zoom-controls--floating",
                                    {glow_wrap(
                                        rsx! { button { class: "hi-zoom-controls__btn", "+" } },
                                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                    )}
                                    {glow_wrap(
                                        rsx! { button { class: "hi-zoom-controls__btn", "-" } },
                                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                    )}
                                    {glow_wrap(
                                        rsx! { button { class: "hi-zoom-controls__btn", "⟲" } },
                                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                    )}
                                }
                            }
                            div { style: "display:flex;align-items:center;justify-content:center;height:100%;color:var(--hi-color-text-secondary);",
                                "Canvas / Image Preview Area"
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
                                tr { td { code { "zoom" } } td { code { "number" } } td { code { "100" } } td { "Current zoom percentage" } }
                                tr { td { code { "min" } } td { code { "number" } } td { code { "25" } } td { "Minimum zoom level" } }
                                tr { td { code { "max" } } td { code { "number" } } td { code { "400" } } td { "Maximum zoom level" } }
                                tr { td { code { "step" } } td { code { "number" } } td { code { "25" } } td { "Zoom increment per step" } }
                                tr { td { code { "showSlider" } } td { code { "bool" } } td { code { "false" } } td { "Show range slider" } }
                                tr { td { code { "variant" } } td { code { "default | floating" } } td { code { "default" } } td { "Control layout style" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
