use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-zoom-controls", "Zoom Controls", "Zoom in, zoom out, and reset controls for canvas viewers, maps, and image previews.", rsx! [
        {render_demo_block("Basic Zoom Controls", rsx!{
            div { style: "display:flex;align-items:center;gap:14px;",
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
                        rsx! { button { class: "hi-zoom-controls__btn", "↺" } },
                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                    )}
                }
                div { style: "margin-left:auto;display:flex;align-items:center;gap:6px;",
                    span { style: "font-size:0.75rem;color:var(--hi-color-text-tertiary);", "Keyboard:" }
                    span { style: "font-size:0.75rem;font-family:monospace;background:var(--hi-color-fill-secondary);padding:2px 8px;border-radius:4px;border:1px solid var(--hi-color-border);", "Ctrl + Scroll" }
                }
            }
        })}
        {render_demo_block("Zoom Slider with Tick Marks", rsx!{
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
                    span { style: "font-size:0.6875rem;color:var(--hi-color-text-tertiary);font-weight:500;", "25%" }
                    span { style: "font-size:0.6875rem;color:var(--hi-color-text-tertiary);font-weight:500;", "50%" }
                    span { style: "font-size:0.6875rem;color:var(--hi-color-text-tertiary);font-weight:500;", "100%" }
                    span { style: "font-size:0.6875rem;color:var(--hi-color-text-tertiary);font-weight:500;", "200%" }
                    span { style: "font-size:0.6875rem;color:var(--hi-color-text-tertiary);font-weight:500;", "400%" }
                }
            }
        })}
        {render_demo_block("Floating Zoom Controls", rsx!{
            div { class: "hi-zoom-canvas",
                div { class: "hi-zoom-canvas__grid" }
                div { class: "hi-zoom-canvas__preview",
                    span { "🖼" }
                }
                div { class: "hi-zoom-canvas__card", "Card A" }
                div { class: "hi-zoom-canvas__card hi-zoom-canvas__card--right", "Card B" }
                div { class: "hi-zoom-canvas__selection", "Selection" }
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
                            rsx! { button { class: "hi-zoom-controls__btn", "↺" } },
                            GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                        )}
                    }
                }
            }
        })}
        {render_demo_block("Zoom to Selection", rsx!{
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
                    rsx! { button { class: "hi-zoom-controls__btn hi-zoom-controls__btn--text", "▹ Sel" } },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                )}
            }
        })}
        {render_demo_block("API", rsx!{
            div {
                {render_api_table(&[
                ("zoom", "number", "100", "Current zoom percentage"),
                ("min", "number", "25", "Minimum zoom level"),
                ("max", "number", "400", "Maximum zoom level"),
                ("step", "number", "25", "Zoom increment per step"),
                ("showSlider", "bool", "false", "Show range slider"),
                ("variant", "default | floating", "default", "Control layout style"),
            ])}
            }
        })}
    ])
}
