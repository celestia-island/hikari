//! VideoPlayer - Framework Agnostic State Model
//!
//! ## Migration Notice
//!
//! Previously a component using `web-sys` for video control and fullscreen.
//! Now provides a pure state model (migrated from legacy Dioxus) with playback controls and timing.
//!
//! ## Platform API
//!
//! Playback control delegates to `platform::video_play`, `platform::video_pause`,
//! `platform::video_seek`, `platform::video_set_muted`, `platform::video_set_volume`
//! (tairitsu WIT bindings via `html-media-element` interface).

use serde::{Deserialize, Serialize};
use tairitsu_vdom::{VElement, VNode, VText};

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default, Serialize, Deserialize)]
pub enum PlaybackStatus {
    #[default]
    Idle,
    Playing,
    Paused,
    Ended,
}

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct VideoPlayerState {
    pub src: String,
    pub title: Option<String>,
    pub poster: String,
    pub show_controls: bool,
    pub autoplay: bool,
    pub loop_playback: bool,
    pub class: String,
    pub is_playing: bool,
    pub is_muted: bool,
    pub volume: f64,
    pub current_time: f64,
    pub duration: f64,
    pub playback_status: PlaybackStatus,
    pub is_fullscreen: bool,
}

impl VideoPlayerState {
    pub fn new(src: impl Into<String>) -> Self {
        Self {
            src: src.into(),
            title: None,
            poster: String::new(),
            show_controls: true,
            autoplay: false,
            loop_playback: false,
            class: String::new(),
            is_playing: false,
            is_muted: false,
            volume: 1.0,
            current_time: 0.0,
            duration: 0.0,
            playback_status: PlaybackStatus::default(),
            is_fullscreen: false,
        }
    }

    pub fn with_title(mut self, title: impl Into<String>) -> Self {
        self.title = Some(title.into());
        self
    }

    pub fn with_poster(mut self, poster: impl Into<String>) -> Self {
        self.poster = poster.into();
        self
    }

    #[must_use]
    pub const fn with_show_controls(mut self, show: bool) -> Self {
        self.show_controls = show;
        self
    }

    #[must_use]
    pub const fn with_autoplay(mut self, autoplay: bool) -> Self {
        self.autoplay = autoplay;
        self
    }

    #[must_use]
    pub const fn with_loop(mut self, loop_playback: bool) -> Self {
        self.loop_playback = loop_playback;
        self
    }

    pub fn with_class(mut self, class: impl Into<String>) -> Self {
        self.class = class.into();
        self
    }

    #[must_use]
    pub const fn with_volume(mut self, volume: f64) -> Self {
        self.volume = volume.clamp(0.0, 1.0);
        self
    }

    pub const fn play(&mut self) {
        self.is_playing = true;
        self.playback_status = PlaybackStatus::Playing;
    }

    pub const fn pause(&mut self) {
        self.is_playing = false;
        self.playback_status = PlaybackStatus::Paused;
    }

    pub const fn toggle_playback(&mut self) -> bool {
        if self.is_playing {
            self.pause();
        } else {
            self.play();
        }
        self.is_playing
    }

    pub const fn toggle_mute(&mut self) -> bool {
        self.is_muted = !self.is_muted;
        self.is_muted
    }

    pub const fn set_volume(&mut self, volume: f64) {
        self.volume = volume.clamp(0.0, 1.0);
    }

    pub const fn seek(&mut self, time: f64) {
        self.current_time = time.max(0.0);
    }

    pub const fn set_current_time(&mut self, time: f64) {
        self.current_time = time.max(0.0);
    }

    pub const fn set_duration(&mut self, duration: f64) {
        self.duration = duration.max(0.0);
    }

    pub const fn set_ended(&mut self) {
        self.is_playing = false;
        self.playback_status = PlaybackStatus::Ended;
    }

    pub const fn set_fullscreen(&mut self, fullscreen: bool) {
        self.is_fullscreen = fullscreen;
    }

    pub const fn toggle_fullscreen(&mut self) -> bool {
        self.is_fullscreen = !self.is_fullscreen;
        self.is_fullscreen
    }

    #[must_use]
    pub fn progress_percent(&self) -> f64 {
        if self.duration <= 0.0 {
            0.0
        } else {
            (self.current_time / self.duration * 100.0).clamp(0.0, 100.0)
        }
    }

    #[must_use]
    pub fn formatted_current_time(&self) -> String {
        format_time(self.current_time)
    }

    #[must_use]
    pub fn formatted_duration(&self) -> String {
        format_time(self.duration)
    }

    #[must_use]
    pub fn formatted_progress(&self) -> String {
        format!(
            "{} / {}",
            self.formatted_current_time(),
            self.formatted_duration()
        )
    }

    #[must_use]
    pub fn class_string(&self) -> String {
        let base = "hk-video-player";
        if self.class.is_empty() {
            base.to_string()
        } else {
            format!("{} {}", base, self.class)
        }
    }
}

impl Default for VideoPlayerState {
    fn default() -> Self {
        Self::new("")
    }
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct PlaybackChangeEvent {
    pub is_playing: bool,
    pub status: PlaybackStatus,
}

#[derive(Clone, PartialEq, Debug)]
pub struct TimeUpdateEvent {
    pub current_time: f64,
    pub duration: f64,
}

fn format_time(seconds: f64) -> String {
    let mins = (seconds / 60.0) as u32;
    let secs = (seconds % 60.0) as u32;
    format!("{mins:02}:{secs:02}")
}

#[must_use]
pub fn render_video_player(state: &VideoPlayerState) -> VNode {
    let mut container_children: Vec<VNode> = Vec::new();

    if let Some(title) = &state.title {
        container_children.push(VNode::Element(
            VElement::new("div")
                .class("hk-video-title")
                .child(VNode::Text(VText::new(title.as_str()))),
        ));
    }

    let mut video = VElement::new("video")
        .class("hk-video-element")
        .attr("src", &state.src);

    if !state.poster.is_empty() {
        video = video.attr("poster", &state.poster);
    }

    if state.autoplay {
        video = video.attr("autoplay", "");
    }
    if state.loop_playback {
        video = video.attr("loop", "");
    }
    if state.is_muted {
        video = video.attr("muted", "");
    }

    container_children.push(VNode::Element(
        VElement::new("div")
            .class("hk-video-wrapper")
            .child(VNode::Element(video)),
    ));

    if state.show_controls {
        let play_label = if state.is_playing { "Pause" } else { "Play" };
        let play_icon = if state.is_playing { "Pause" } else { "Play" };
        let mute_icon = if state.is_muted { "Unmute" } else { "Mute" };

        let progress_style = format!("width: {}%;", state.progress_percent());

        let controls = VElement::new("div")
            .class("hk-video-controls")
            .child(VNode::Element(
                VElement::new("button")
                    .class("hk-video-control-btn")
                    .attr("aria-label", play_label)
                    .attr("data-action", "toggle-play")
                    .child(VNode::Text(VText::new(play_icon))),
            ))
            .child(VNode::Element(
                VElement::new("div")
                    .class("hk-video-progress")
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("hk-video-progress-bar")
                            .style(progress_style.as_str()),
                    )),
            ))
            .child(VNode::Element(
                VElement::new("span")
                    .class("hk-video-time")
                    .child(VNode::Text(VText::new(&state.formatted_progress()))),
            ))
            .child(VNode::Element(
                VElement::new("button")
                    .class("hk-video-control-btn")
                    .attr("aria-label", if state.is_muted { "Unmute" } else { "Mute" })
                    .attr("data-action", "toggle-mute")
                    .child(VNode::Text(VText::new(mute_icon))),
            ))
            .child(VNode::Element(
                VElement::new("button")
                    .class("hk-video-control-btn")
                    .attr("aria-label", "Fullscreen")
                    .attr("data-action", "toggle-fullscreen")
                    .child(VNode::Text(VText::new("Fullscreen"))),
            ));

        container_children.push(VNode::Element(controls));
    }

    VNode::Element(
        VElement::new("div")
            .class(state.class_string())
            .children(container_children),
    )
}

pub const VIDEO_PLAYER_STYLES: &str = r#"
.hk-video-player {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.hk-video-container {
  position: relative;
  background: var(--hi-surface);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

[data-theme="dark"] .hk-video-container {
  background: var(--hi-background);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.hk-video-title {
  padding: 12px 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--hi-text-primary);
  border-bottom: 1px solid var(--hi-border);
}

[data-theme="dark"] .hk-video-title {
  color: var(--hi-text-primary);
  border-bottom-color: var(--hi-border);
}

.hk-video-wrapper {
  position: relative;
  width: 100%;
}

.hk-video-element {
  width: 100%;
  display: block;
  background-color: #000;
}

.hk-video-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--hi-surface);
  border-top: 1px solid var(--hi-border);
}

[data-theme="dark"] .hk-video-controls {
  background: var(--hi-background);
  border-top-color: var(--hi-border);
}

.hk-video-time {
  font-size: 14px;
  color: var(--hi-text-secondary);
  min-width: 100px;
  text-align: center;
}

[data-theme="dark"] .hk-video-time {
  color: var(--hi-text-secondary);
}

.hk-video-progress {
  flex: 1;
  height: 4px;
  background: var(--hi-border);
  border-radius: 2px;
  overflow: hidden;
  cursor: pointer;
}

.hk-video-progress-bar {
  height: 100%;
  background: var(--hi-color-primary);
  transition: width 0.1s linear;
}
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_state() {
        let state = VideoPlayerState::new("video.mp4");
        assert_eq!(state.src, "video.mp4");
        assert!(!state.is_playing);
        assert!(!state.is_muted);
        assert!((state.volume - 1.0).abs() < 0.001);
        assert_eq!(state.playback_status, PlaybackStatus::Idle);
        assert!(!state.is_fullscreen);
    }

    #[test]
    fn test_builder() {
        let state = VideoPlayerState::new("video.mp4")
            .with_title("Test Video")
            .with_poster("poster.jpg")
            .with_show_controls(false)
            .with_autoplay(true)
            .with_loop(true)
            .with_class("custom")
            .with_volume(0.5);

        assert_eq!(state.title.as_deref(), Some("Test Video"));
        assert_eq!(state.poster, "poster.jpg");
        assert!(!state.show_controls);
        assert!(state.autoplay);
        assert!(state.loop_playback);
        assert_eq!(state.class, "custom");
        assert!((state.volume - 0.5).abs() < 0.001);
    }

    #[test]
    fn test_playback_controls() {
        let mut state = VideoPlayerState::new("video.mp4");

        state.play();
        assert!(state.is_playing);
        assert_eq!(state.playback_status, PlaybackStatus::Playing);

        state.pause();
        assert!(!state.is_playing);
        assert_eq!(state.playback_status, PlaybackStatus::Paused);

        state.toggle_playback();
        assert!(state.is_playing);
        assert_eq!(state.playback_status, PlaybackStatus::Playing);

        state.set_ended();
        assert!(!state.is_playing);
        assert_eq!(state.playback_status, PlaybackStatus::Ended);
    }

    #[test]
    fn test_mute_toggle() {
        let mut state = VideoPlayerState::new("video.mp4");
        assert!(!state.is_muted);

        assert!(state.toggle_mute());
        assert!(state.is_muted);

        assert!(!state.toggle_mute());
        assert!(!state.is_muted);
    }

    #[test]
    fn test_volume_clamp() {
        let state = VideoPlayerState::new("video.mp4").with_volume(2.0);
        assert!((state.volume - 1.0).abs() < 0.001);

        let state = VideoPlayerState::new("video.mp4").with_volume(-0.5);
        assert!((state.volume - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_seek_and_time() {
        let mut state = VideoPlayerState::new("video.mp4");
        state.set_duration(120.0);
        state.set_current_time(30.0);

        assert!((state.progress_percent() - 25.0).abs() < 0.001);
        assert_eq!(state.formatted_current_time(), "00:30");
        assert_eq!(state.formatted_duration(), "02:00");
        assert_eq!(state.formatted_progress(), "00:30 / 02:00");

        state.seek(90.0);
        assert!((state.progress_percent() - 75.0).abs() < 0.001);
    }

    #[test]
    fn test_progress_clamp() {
        let mut state = VideoPlayerState::new("video.mp4");
        state.set_duration(60.0);
        state.set_current_time(90.0);
        assert!((state.progress_percent() - 100.0).abs() < 0.001);
    }

    #[test]
    fn test_fullscreen() {
        let mut state = VideoPlayerState::new("video.mp4");
        assert!(state.toggle_fullscreen());
        assert!(state.is_fullscreen);
        assert!(!state.toggle_fullscreen());
        assert!(!state.is_fullscreen);
    }

    #[test]
    fn test_class_string() {
        let state = VideoPlayerState::new("video.mp4");
        assert_eq!(state.class_string(), "hk-video-player");

        let state = VideoPlayerState::new("video.mp4").with_class("custom");
        assert_eq!(state.class_string(), "hk-video-player custom");
    }

    #[test]
    fn test_default() {
        let state = VideoPlayerState::default();
        assert_eq!(state.src, "");
    }

    #[test]
    fn test_format_time() {
        assert_eq!(format_time(0.0), "00:00");
        assert_eq!(format_time(65.0), "01:05");
        assert_eq!(format_time(3661.0), "61:01");
    }
}
