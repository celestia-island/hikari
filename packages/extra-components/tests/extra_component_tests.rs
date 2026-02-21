// Extra component smoke tests
// These are simple compilation and rendering tests
// Full E2E tests would require Playwright/WebDriver setup

#[cfg(test)]
mod tests {

    use dioxus::prelude::*;

    #[test]
    fn test_collapsible_component_exists() {
        let _ = || {
            rsx! {
                hikari_extra_components::extra::Collapsible {
                    title: "Test Panel".to_string(),
                    expanded: true,
                    position: hikari_extra_components::extra::CollapsiblePosition::Right,
                    div { "Content" }
                }
            }
        };
    }

    #[test]
    fn test_drag_layer_component_exists() {
        let _ = || {
            rsx! {
                hikari_extra_components::extra::DragLayer {
                    initial_x: 100.0,
                    initial_y: 100.0,
                    constraints: hikari_extra_components::extra::DragConstraints {
                        min_x: Some(0.0),
                        max_x: Some(500.0),
                        min_y: Some(0.0),
                        max_y: Some(500.0),
                    },
                    div { "Drag me" }
                }
            }
        };
    }

    #[test]
    fn test_zoom_controls_component_exists() {
        let _ = || {
            rsx! {
                hikari_extra_components::extra::ZoomControls {
                    zoom: 1.0,
                    on_zoom_change: dioxus::prelude::Callback::new(|_| {}),
                }
            }
        };
    }

    #[test]
    fn test_video_player_component_exists() {
        let _ = || {
            rsx! {
                hikari_extra_components::extra::VideoPlayer {
                    src: "https://example.com/video.mp4".to_string(),
                    show_controls: true,
                }
            }
        };
    }

    #[test]
    fn test_rich_text_editor_component_exists() {
        let _ = || {
            rsx! {
                hikari_extra_components::extra::RichTextEditor {
                    content: "Test content".to_string(),
                    show_toolbar: true,
                }
            }
        };
    }

    #[test]
    fn test_audio_waveform_component_exists() {
        let _ = || {
            rsx! {
                hikari_extra_components::extra::AudioWaveform {
                    src: "https://example.com/audio.mp3".to_string(),
                    show_controls: true,
                }
            }
        };
    }
}
