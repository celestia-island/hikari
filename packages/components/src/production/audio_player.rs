// packages/components/src/production/audio_player.rs
// Audio player component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{AudioPlayerClass, ClassesBuilder, UtilityClass};

use crate::styled::StyledComponent;

/// AudioPlayer component type wrapper (for StyledComponent)
pub struct AudioPlayerComponent;

/// Audio player size variants
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum AudioPlayerSize {
    #[default]
    Medium,
    Small,
    Large,
}

/// Audio player component with Arknights + FUI styling
///
/// A audio player with cover art, title/artist info, and native controls.
#[derive(Clone, PartialEq, Props)]
pub struct AudioPlayerProps {
    /// Audio source URL
    pub src: String,

    /// Audio title
    #[props(default)]
    pub title: Option<String>,

    /// Audio artist/author
    #[props(default)]
    pub artist: Option<String>,

    /// Cover image URL
    #[props(default)]
    pub cover: Option<String>,

    /// Autoplay audio
    #[props(default)]
    pub autoplay: bool,

    /// Show controls (uses native browser controls)
    #[props(default = true)]
    pub controls: bool,

    /// Loop audio
    #[props(default)]
    pub loop_: bool,

    /// Muted by default
    #[props(default)]
    pub muted: bool,

    /// Player size
    #[props(default)]
    pub size: AudioPlayerSize,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Additional CSS styles
    #[props(default)]
    pub style: String,
}

#[component]
pub fn AudioPlayer(props: AudioPlayerProps) -> Element {
    let size_class = match props.size {
        AudioPlayerSize::Small => AudioPlayerClass::Sm,
        AudioPlayerSize::Medium => AudioPlayerClass::Md,
        AudioPlayerSize::Large => AudioPlayerClass::Lg,
    };

    let container_classes = ClassesBuilder::new()
        .add(AudioPlayerClass::Container)
        .add(size_class)
        .add_raw(&props.class)
        .build();

    rsx! {
        div {
            class: "{container_classes}",
            style: "{props.style}",

            // Cover and info section
            div { class: "{AudioPlayerClass::Header.as_class()}",
                if let Some(cover) = &props.cover {
                    div { class: "{AudioPlayerClass::Cover.as_class()}",
                        img {
                            src: "{cover}",
                            alt: props.title.as_deref().unwrap_or("Audio cover"),
                            class: "{AudioPlayerClass::CoverImage.as_class()}",
                        }
                    }
                }

                div { class: "{AudioPlayerClass::Info.as_class()}",
                    if let Some(title) = &props.title {
                        div { class: "{AudioPlayerClass::Title.as_class()}", "{title}" }
                    }
                    if let Some(artist) = &props.artist {
                        div { class: "{AudioPlayerClass::Artist.as_class()}", "{artist}" }
                    }
                }
            }

            // Audio element with native controls
            audio {
                class: "{AudioPlayerClass::Audio.as_class()}",
                src: "{props.src}",
                autoplay: props.autoplay,
                controls: props.controls,
                loop: props.loop_,
                muted: props.muted,
            }
        }
    }
}

impl StyledComponent for AudioPlayerComponent {
    fn styles() -> &'static str {
        r#"
.hi-audio-player {
    background-color: var(--hi-color-bg-container);
    border: 1px solid var(--hi-color-border);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
}

.hi-audio-player:hover {
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
}

.hi-audio-player-sm {
    max-width: 280px;
}

.hi-audio-player-md {
    max-width: 360px;
}

.hi-audio-player-lg {
    max-width: 480px;
}

[data-theme="dark"] .hi-audio-player {
    background-color: var(--hi-surface);
    border-color: var(--hi-color-border);
}

.hi-audio-player-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--hi-color-border);
}

.hi-audio-player-cover {
    width: 64px;
    height: 64px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    background-color: var(--hi-color-bg-elevated);
}

.hi-audio-player-cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.hi-audio-player-info {
    flex: 1;
    min-width: 0;
}

.hi-audio-player-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--hi-text-primary);
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.hi-audio-player-artist {
    font-size: 12px;
    color: var(--hi-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.hi-audio-player-audio {
    width: 100%;
    padding: 12px 16px;
}

.hi-audio-player-sm .hi-audio-player-header {
    padding: 12px;
}

.hi-audio-player-sm .hi-audio-player-cover {
    width: 48px;
    height: 48px;
}

.hi-audio-player-sm .hi-audio-player-title {
    font-size: 13px;
}

.hi-audio-player-sm .hi-audio-player-artist {
    font-size: 11px;
}

.hi-audio-player-lg .hi-audio-player-header {
    padding: 20px;
}

.hi-audio-player-lg .hi-audio-player-cover {
    width: 80px;
    height: 80px;
}

.hi-audio-player-lg .hi-audio-player-title {
    font-size: 16px;
}

.hi-audio-player-lg .hi-audio-player-artist {
    font-size: 13px;
}
"#
    }

    fn name() -> &'static str {
        "audio-player"
    }
}
