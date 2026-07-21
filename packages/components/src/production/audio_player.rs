// packages/components/src/production/audio_player.rs
// Audio player component with Arknights + FUI styling

use hikari_palette::classes::{AudioPlayerClass, ClassesBuilder, UtilityClass};

use crate::{prelude::*, styled::StyledComponent};

pub struct AudioPlayerComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum AudioPlayerSize {
    #[default]
    Medium,
    Small,
    Large,
}

/// Props for the AudioPlayer component
#[define_props]
pub struct AudioPlayerProps {
    pub src: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub cover: Option<String>,
    #[default(false)]
    pub autoplay: bool,
    #[default(true)]
    pub controls: bool,
    #[default(false)]
    pub loop_: bool,
    #[default(false)]
    pub muted: bool,
    pub size: AudioPlayerSize,
    #[default(String::default())]
    pub class: String,
    #[default(String::default())]
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
        div { class: container_classes, style: props.style,

            // Cover and info section
            div { class: AudioPlayerClass::Header.as_class(),
                if let Some(cover) = &props.cover {
                    div { class: AudioPlayerClass::Cover.as_class(),
                        img {
                            src: cover,
                            alt: props.title.as_deref().unwrap_or("Audio cover"),
                            class: AudioPlayerClass::CoverImage.as_class(),
                        }
                    }
                }

                div { class: AudioPlayerClass::Info.as_class(),
                    if let Some(title) = &props.title {
                        div { class: AudioPlayerClass::Title.as_class(), "{title}" }
                    }
                    if let Some(artist) = &props.artist {
                        div { class: AudioPlayerClass::Artist.as_class(), "{artist}" }
                    }
                }
            }

            // Audio element with native controls
            audio {
                class: AudioPlayerClass::Audio.as_class(),
                src: props.src,
                autoplay: props.autoplay,
                controls: props.controls,
                r#loop: props.loop_,
                muted: props.muted,
            }
        }
    }
}

impl StyledComponent for AudioPlayerComponent {
    fn styles() -> &'static str {
        r#"
.hk-audio-player {
    background-color: var(--hi-color-bg-container);
    border: 1px solid var(--hi-color-border);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
}

.hk-audio-player:hover {
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
}

.hk-audio-player-sm {
    max-width: 280px;
}

.hk-audio-player-md {
    max-width: 360px;
}

.hk-audio-player-lg {
    max-width: 480px;
}

[data-theme="dark"] .hk-audio-player {
    background-color: var(--hi-surface);
    border-color: var(--hi-color-border);
}

.hk-audio-player-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--hi-color-border);
}

.hk-audio-player-cover {
    width: 64px;
    height: 64px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    background-color: var(--hi-color-bg-elevated);
}

.hk-audio-player-cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.hk-audio-player-info {
    flex: 1;
    min-width: 0;
}

.hk-audio-player-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--hi-text-primary);
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.hk-audio-player-artist {
    font-size: 12px;
    color: var(--hi-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.hk-audio-player-audio {
    width: 100%;
    padding: 12px 16px;
}

.hk-audio-player-sm .hk-audio-player-header {
    padding: 12px;
}

.hk-audio-player-sm .hk-audio-player-cover {
    width: 48px;
    height: 48px;
}

.hk-audio-player-sm .hk-audio-player-title {
    font-size: 13px;
}

.hk-audio-player-sm .hk-audio-player-artist {
    font-size: 11px;
}

.hk-audio-player-lg .hk-audio-player-header {
    padding: 20px;
}

.hk-audio-player-lg .hk-audio-player-cover {
    width: 80px;
    height: 80px;
}

.hk-audio-player-lg .hk-audio-player-title {
    font-size: 16px;
}

.hk-audio-player-lg .hk-audio-player-artist {
    font-size: 13px;
}
"#
    }

    fn name() -> &'static str {
        "audio-player"
    }
}
