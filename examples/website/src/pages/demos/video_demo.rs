use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-demos-video", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Video & Audio Demo" }
                p { class: "page-header__subtitle",
                    "Demonstrates the full functionality of Layer 3 video player and audio waveform components."
                }
            }

            div { class: "page-section",
                h2 { "VideoPlayer" }
                p { class: "page-section__desc",
                    "Full-featured video player with playback controls, volume adjustment, and fullscreen support."
                }
                div { class: "card",
                    div { class: "card__header",
                        h3 { class: "card__title", "Sample Video" }
                    }
                    div { class: "card__body",
                        video {
                            class: "hi-video-player",
                            controls: "true",
                            preload: "metadata",
                            width: "100%",
                            r#type: "video/mp4",
                            source { src: "https://www.w3schools.com/html/mov_bbb.mp4", r#type: "video/mp4" }
                            "Your browser does not support the video element."
                        }
                    }
                }
            }

            div { class: "page-section",
                h2 { "AudioWaveform" }
                p { class: "page-section__desc",
                    "Audio player with real-time waveform visualization (WASM platform)."
                }
                div { class: "card",
                    div { class: "card__header",
                        h3 { class: "card__title", "Sample Audio" }
                    }
                    div { class: "card__body",
                        div { class: "hi-audio-waveform",
                            canvas { id: "waveform-canvas", class: "hi-audio-waveform__canvas", width: "800", height: "150" }
                            audio {
                                id: "waveform-audio",
                                class: "hi-audio-waveform__audio",
                                controls: "true",
                                preload: "metadata",
                                source { src: "https://www.w3schools.com/html/horse.mp3", r#type: "audio/mpeg" }
                                "Your browser does not support the audio element."
                            }
                        }
                    }
                }
            }
        }
    }
}
