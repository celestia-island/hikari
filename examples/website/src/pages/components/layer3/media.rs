use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-media", "Media", "Video and audio player components with custom controls and playback state display.", rsx! [
        {render_demo_block("Video Player", rsx!{
            div { class: "hi-media-player",
                    div { class: "hi-media-player__poster",
                        div { class: "hi-media-player__play-btn",
                            span { class: "hi-media-player__play-icon", "▶" }
                        }
                        span { class: "hi-media-player__time-overlay", "3:42" }
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
        })}
        {render_demo_block("Audio Player", rsx!{
            div { class: "hi-audio-player",
                div { class: "hi-audio-player__info",
                    div { class: "hi-audio-player__art",
                        span { class: "hi-audio-player__art-icon", "🎵" }
                    }
                    div {
                        div { class: "hi-audio-player__title", "Ambient Sounds" }
                        div { class: "hi-audio-player__subtitle", "Nature Collection" }
                    }
                }
                 div { class: "hi-audio-player__body",
                    div { class: "hi-media-player__progress",
                        div { class: "hi-media-player__progress__bar", style: "width: 65%;" }
                    }
                    div { class: "hi-audio-player__time-row",
                        span { "2:15" }
                        span { "3:28" }
                    }
                    div { class: "hi-audio-player__controls",
                        {glow_wrap(
                            rsx! { button { class: "hi-media-player__btn", "⏮" } },
                            GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                        )}
                        {glow_wrap(
                            rsx! { button { class: "hi-media-player__btn hi-media-player__btn--lg", "▶" } },
                            GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                        )}
                        {glow_wrap(
                            rsx! { button { class: "hi-media-player__btn", "⏭" } },
                            GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                        )}
                    }
                }
            }
        })}
        {render_demo_block("Mini Player", rsx!{
            div { class: "hi-mini-player",
                div { class: "hi-mini-player__art", "🎶" }
                div { class: "hi-mini-player__body",
                    div { class: "hi-mini-player__title", "Chill Vibes" }
                    div { class: "hi-media-player__progress",
                        div { class: "hi-media-player__progress__bar", style: "width:48%;" }
                    }
                }
                span { class: "hi-mini-player__time", "1:34 / 3:00" }
                {glow_wrap(
                    rsx! { button { class: "hi-media-player__btn hi-mini-player__play-btn", "▶" } },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                )}
            }
        })}
        {render_demo_block("API", rsx!{
            div {
                {render_api_table(&[
                ("src", "string", "-", "Media source URL"),
                ("poster", "string", "-", "Video poster image"),
                ("autoplay", "bool", "false", "Auto-play on mount"),
                ("controls", "bool", "true", "Show playback controls"),
                ("loop", "bool", "false", "Loop playback"),
                ("volume", "number", "1.0", "Initial volume (0.0 - 1.0)"),
            ])}
            }
        })}
    ])
}
