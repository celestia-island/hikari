// hi-extra-components/src/extra/audio_waveform.rs
// AudioWaveform component with Arknights + FUI styling

use dioxus::prelude::*;
use hikari_components::basic::IconButton;
use hikari_icons::MdiIcon;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum WaveformColor {
    #[default]
    Primary,
    Success,
    Warning,
    Danger,
}

#[derive(Clone, PartialEq, Props)]
pub struct AudioWaveformProps {
    /// Audio source URL
    pub src: String,

    /// Waveform color
    #[props(default)]
    pub waveform_color: WaveformColor,

    /// Whether to show playback controls
    #[props(default)]
    pub show_controls: bool,

    /// Additional CSS class
    #[props(default)]
    pub class: String,

    /// Callback when playback starts
    #[props(default)]
    pub on_play: Option<EventHandler<()>>,

    /// Callback when playback pauses
    #[props(default)]
    pub on_pause: Option<EventHandler<()>>,
}

/// AudioWaveform component with visualization
///
/// An audio player with waveform visualization using existing components.
///
/// # Examples
///
/// ## Basic Usage
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_extra_components::AudioWaveform;
///
/// fn app() -> Element {
///     rsx! {
///         AudioWaveform {
///             src: "https://example.com/audio.mp3".to_string(),
///             show_controls: true,
///         }
///     }
/// }
/// ```
#[component]
pub fn AudioWaveform(props: AudioWaveformProps) -> Element {
    let mut is_playing = use_signal(|| false);
    let current_time = use_signal(|| 0.0f64);
    let duration = use_signal(|| 0.0f64);
    let mut volume = use_signal(|| 1.0f64);

    let waveform_classes = format!("hi-audio-waveform hi-waveform-{:?}", props.waveform_color);

    let toggle_playback = move |_| {
        is_playing.set(!is_playing());
    };

    let _handle_volume_change = move |vol: bool| {
        volume.set(if vol { 1.0 } else { 0.0 });
    };

    // Generate fake waveform bars (in real implementation, this would come from audio analysis)
    let waveform_bars = (0..40).map(|i| {
        let height = 20.0 + (i as f64 * 0.8).sin().abs() as f64 * 40.0;
        let opacity = 0.3 + (i as f64 / 40.0) * 0.7;
        rsx! {
            div {
                key: "{i}",
                class: "hi-waveform-bar",
                style: "height: {height}px; opacity: {opacity};"
            }
        }
    });

    rsx! {
        div { class: "{waveform_classes} {props.class}",
            // Audio element (hidden)
            audio {
                src: "{props.src}",
            }

            // Waveform visualization
            div { class: "hi-waveform-container",
                div { class: "hi-waveform-bars",
                    { waveform_bars }
                }
            }

            // Playback controls
            if props.show_controls {
                div { class: "hi-audio-controls",
                    // Play/Pause button - use Icon
                    IconButton {
                        icon: if is_playing() {
                            MdiIcon::Pause
                        } else {
                            MdiIcon::Play
                        },
                        onclick: toggle_playback,
                    }

                    // Progress bar
                    div { class: "hi-audio-progress",
                        div {
                            class: "hi-audio-progress-bar",
                            style: "width: {(current_time() / duration() * 100.0)}%;"
                        }
                    }

                    // Time display
                    div { class: "hi-audio-time",
                        "{format_time(current_time())} / {format_time(duration())}"
                    }
                }
            }
        }
    }
}

fn format_time(seconds: f64) -> String {
    let mins = (seconds / 60.0) as u32;
    let secs = (seconds % 60.0) as u32;
    format!("{:02}:{:02}", mins, secs)
}

/// AudioWaveform component's type wrapper for StyledComponent
pub struct AudioWaveformComponent;

impl hikari_components::StyledComponent for AudioWaveformComponent {
    fn styles() -> &'static str {
        r#"
.hi-audio-waveform {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  background: var(--hi-surface);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

[data-theme="dark"] .hi-audio-waveform {
  background: var(--hi-background);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.hi-waveform-container {
  margin: 16px 0;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hi-waveform-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 100%;
  width: 100%;
  justify-content: center;
}

.hi-waveform-bar {
  width: 8px;
  background: var(--hi-color-primary);
  border-radius: 2px;
  transition: all 0.2s ease;
}

.hi-waveform-Primary .hi-waveform-bar {
  background: var(--hi-color-primary);
}

.hi-waveform-Success .hi-waveform-bar {
  background: var(--hi-color-success);
}

.hi-waveform-Warning .hi-waveform-bar {
  background: var(--hi-color-warning);
}

.hi-waveform-Danger .hi-waveform-bar {
  background: var(--hi-color-error);
}

.hi-audio-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
}

.hi-audio-progress {
  flex: 1;
  height: 4px;
  background: var(--hi-border);
  border-radius: 2px;
  overflow: hidden;
}

[data-theme="dark"] .hi-audio-progress {
  background: var(--hi-border);
}

.hi-audio-progress-bar {
  height: 100%;
  background: var(--hi-color-primary);
  transition: width 0.1s linear;
}

.hi-audio-time {
  font-size: 12px;
  color: var(--hi-text-secondary);
  min-width: 100px;
  text-align: center;
}

[data-theme="dark"] .hi-audio-time {
  color: var(--hi-text-secondary);
}
"#
    }

    fn name() -> &'static str {
        "audio_waveform"
    }
}
