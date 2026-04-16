use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-component-media", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Media" }
                p { class: "page-header__subtitle",
                    "Video and audio player components with custom controls and playback state display."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Video Player" }
                    div { class: "demo-block__body",
                        div { class: "hi-media-player",
                            div { class: "hi-media-player__poster",
                                span { style: "font-size:48px;", "▶" }
                                span { style: "position:absolute;bottom:12px;left:12px;color:white;font-size:13px;background:rgba(0,0,0,0.6);padding:2px 8px;border-radius:4px;", "3:42" }
                            }
                            div { class: "hi-media-player__controls",
                                {glow_wrap(
                                    rsx! { button { class: "hi-media-player__btn", "▶" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                                )}
                                div { class: "hi-media-player__progress",
                                    div { class: "hi-media-player__progress__bar", style: "width: 35%;" }
                                }
                                span { class: "hi-media-player__time", "1:18 / 3:42" }
                                {glow_wrap(
                                    rsx! { button { class: "hi-media-player__btn", "🔊" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-media-player__btn", "⛶" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Audio Player" }
                    div { class: "demo-block__body",
                        div { class: "hi-audio-player",
                            div { class: "hi-audio-player__info",
                                div { class: "hi-audio-player__art", "♫" }
                                div {
                                    div { style: "font-weight:600;", "Ambient Sounds" }
                                    div { style: "font-size:13px;color:var(--hi-color-text-secondary);", "Nature Collection" }
                                }
                            }
                            div { style: "flex:1;display:flex;flex-direction:column;gap:8px;",
                                div { class: "hi-media-player__progress",
                                    div { class: "hi-media-player__progress__bar", style: "width: 65%;" }
                                }
                                div { style: "display:flex;justify-content:space-between;font-size:12px;color:var(--hi-color-text-secondary);",
                                    span { "2:15" }
                                    span { "3:28" }
                                }
                                div { style: "display:flex;justify-content:center;gap:16px;",
                                    {glow_wrap(
                                        rsx! { button { class: "hi-media-player__btn", "⏮" } },
                                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                    )}
                                    {glow_wrap(
                                        rsx! { button { class: "hi-media-player__btn", style: "font-size:24px;", "▶" } },
                                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                                    )}
                                    {glow_wrap(
                                        rsx! { button { class: "hi-media-player__btn", "⏭" } },
                                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                    )}
                                }
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
                                tr { td { code { "src" } } td { code { "string" } } td { code { "-" } } td { "Media source URL" } }
                                tr { td { code { "poster" } } td { code { "string" } } td { code { "-" } } td { "Video poster image" } }
                                tr { td { code { "autoplay" } } td { code { "bool" } } td { code { "false" } } td { "Auto-play on mount" } }
                                tr { td { code { "controls" } } td { code { "bool" } } td { code { "true" } } td { "Show playback controls" } }
                                tr { td { code { "loop" } } td { code { "bool" } } td { code { "false" } } td { "Loop playback" } }
                                tr { td { code { "volume" } } td { code { "number" } } td { code { "1.0" } } td { "Initial volume (0.0 - 1.0)" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
