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
                                    rsx! { button { class: "hi-zoom-controls__btn", "\u{21BA}" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                            div { style: "margin-left:auto;display:flex;align-items:center;gap:6px;",
                                span { style: "font-size:0.75rem;color:var(--hi-color-text-muted,#9ca3af);", "Keyboard:" }
                                span { style: "font-size:0.75rem;font-family:monospace;background:var(--hi-surface-secondary,#f3f4f6);padding:2px 8px;border-radius:4px;border:1px solid var(--hi-border,#e5e7eb);", "Ctrl + Scroll" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Zoom Slider with Tick Marks" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            div { style: "display:flex;flex-direction:column;width:100%;gap:10px;",
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
                                div { style: "display:flex;justify-content:space-between;padding:0 4px;",
                                    span { style: "font-size:0.6875rem;color:var(--hi-color-text-muted,#9ca3af);font-weight:500;", "25%" }
                                    span { style: "font-size:0.6875rem;color:var(--hi-color-text-muted,#9ca3af);font-weight:500;", "50%" }
                                    span { style: "font-size:0.6875rem;color:var(--hi-color-text-muted,#9ca3af);font-weight:500;", "100%" }
                                    span { style: "font-size:0.6875rem;color:var(--hi-color-text-muted,#9ca3af);font-weight:500;", "200%" }
                                    span { style: "font-size:0.6875rem;color:var(--hi-color-text-muted,#9ca3af);font-weight:500;", "400%" }
                                }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Floating Zoom Controls" }
                    div { class: "demo-block__body",
                        div { style: "position:relative;height:260px;background:#fafbfc;border-radius:12px;border:1px solid var(--hi-border,#e5e7eb);overflow:hidden;",
                            div { style: "position:absolute;inset:0;background-image:radial-gradient(circle,var(--hi-border,#e5e7eb) 1px,transparent 1px);background-size:20px 20px;opacity:0.6;" }
                            div { style: "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:120px;height:80px;background:linear-gradient(135deg,#F5A9A9 0%,#f0c4c4 100%);border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(245,169,169,0.25);",
                                span { style: "color:white;font-size:24px;font-weight:700;text-shadow:0 1px 3px rgba(0,0,0,0.15);", "\u{1F5BC}" }
                            }
                            div { style: "position:absolute;top:28px;left:28px;width:56px;height:40px;background:white;border-radius:6px;border:1px solid var(--hi-border,#e5e7eb);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--hi-color-text-secondary,#6b7280);box-shadow:0 2px 8px rgba(0,0,0,0.06);", "Card A" }
                            div { style: "position:absolute;top:32px;right:32px;width:64px;height:44px;background:white;border-radius:6px;border:1px solid var(--hi-border,#e5e7eb);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--hi-color-text-secondary,#6b7280);box-shadow:0 2px 8px rgba(0,0,0,0.06);", "Card B" }
                            div { style: "position:absolute;bottom:48px;left:40px;width:72px;height:36px;background:rgba(245,169,169,0.08);border:1px dashed rgba(245,169,169,0.35);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--hi-color-primary,#F5A9A9);font-weight:600;", "Selection" }
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
                                        rsx! { button { class: "hi-zoom-controls__btn", "\u{21BA}" } },
                                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                    )}
                                }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Zoom to Selection" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            div { class: "hi-zoom-controls",
                                {glow_wrap(
                                    rsx! { button { class: "hi-zoom-controls__btn", "+" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                div { class: "hi-zoom-controls__slider",
                                    input { r#type: "range", min: "25", max: "400", value: "150", class: "hi-zoom-controls__range" }
                                }
                                {glow_wrap(
                                    rsx! { button { class: "hi-zoom-controls__btn", "-" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                span { class: "hi-zoom-controls__level", "150%" }
                                {glow_wrap(
                                    rsx! { button { class: "hi-zoom-controls__btn", "Fit" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Secondary, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-zoom-controls__btn", style: "width:auto;padding:0 10px;font-size:13px;", "\u{25B9} Sel" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                                )}
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
