//! AudioWaveform - Framework Agnostic State Model
//!
//! ## Migration Notice
//!
//! Previously a Dioxus component using Web Audio API (`AudioContext`, `AnalyserNode`)
//! via `web-sys`. Now provides a pure state model with rendering data.
//!
//! ## Missing Platform API
//!
//! The tairitsu platform layer lacks Web Audio API support:
//! - `AudioContext` creation and management
//! - `AnalyserNode` for real-time frequency/time-domain analysis
//! - `MediaElementSourceNode` for connecting `<audio>` to analysis graph
//!
//! Until these are available, waveform data must be provided externally
//! or generated synthetically via `AudioWaveformState::generate_synth_waveform()`.

use serde::{Deserialize, Serialize};

use tairitsu_vdom::{VElement, VNode, VText};

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default, Serialize, Deserialize)]
pub enum WaveformColor {
    #[default]
    Primary,
    Success,
    Warning,
    Danger,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default, Serialize, Deserialize)]
pub enum PlaybackState {
    #[default]
    Stopped,
    Playing,
    Paused,
}

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct AudioWaveformState {
    pub src: String,
    pub waveform_color: WaveformColor,
    pub show_controls: bool,
    pub class: String,
    pub is_playing: bool,
    pub current_time: f64,
    pub duration: f64,
    pub volume: f64,
    pub playback_state: PlaybackState,
    pub waveform_data: Vec<f32>,
    pub is_loaded: bool,
    pub bar_count: usize,
    pub fft_size: usize,
}

impl AudioWaveformState {
    pub fn new(src: impl Into<String>) -> Self {
        Self {
            src: src.into(),
            waveform_color: WaveformColor::default(),
            show_controls: true,
            class: String::new(),
            is_playing: false,
            current_time: 0.0,
            duration: 0.0,
            volume: 1.0,
            playback_state: PlaybackState::default(),
            waveform_data: Vec::new(),
            is_loaded: false,
            bar_count: 40,
            fft_size: 512,
        }
    }

    pub fn with_color(mut self, color: WaveformColor) -> Self {
        self.waveform_color = color;
        self
    }

    pub fn with_show_controls(mut self, show: bool) -> Self {
        self.show_controls = show;
        self
    }

    pub fn with_class(mut self, class: impl Into<String>) -> Self {
        self.class = class.into();
        self
    }

    pub fn with_volume(mut self, volume: f64) -> Self {
        self.volume = volume.clamp(0.0, 1.0);
        self
    }

    pub fn with_bar_count(mut self, count: usize) -> Self {
        self.bar_count = count;
        self
    }

    pub fn with_fft_size(mut self, size: usize) -> Self {
        self.fft_size = size;
        self
    }

    pub fn toggle_playback(&mut self) -> bool {
        self.is_playing = !self.is_playing;
        self.playback_state = if self.is_playing {
            PlaybackState::Playing
        } else {
            PlaybackState::Paused
        };
        self.is_playing
    }

    pub fn play(&mut self) {
        self.is_playing = true;
        self.playback_state = PlaybackState::Playing;
    }

    pub fn pause(&mut self) {
        self.is_playing = false;
        self.playback_state = PlaybackState::Paused;
    }

    pub fn stop(&mut self) {
        self.is_playing = false;
        self.playback_state = PlaybackState::Stopped;
        self.current_time = 0.0;
    }

    pub fn set_current_time(&mut self, time: f64) {
        self.current_time = time.max(0.0);
    }

    pub fn set_duration(&mut self, duration: f64) {
        self.duration = duration.max(0.0);
    }

    pub fn set_waveform_data(&mut self, data: Vec<f32>) {
        self.waveform_data = data;
        self.is_loaded = true;
    }

    pub fn progress_percent(&self) -> f64 {
        if self.duration <= 0.0 {
            0.0
        } else {
            (self.current_time / self.duration * 100.0).clamp(0.0, 100.0)
        }
    }

    pub fn generate_synth_waveform(&mut self) {
        let data: Vec<f32> = (0..self.bar_count)
            .map(|i| 0.2 + (i as f32 * 0.8).sin().abs() * 0.8)
            .collect();
        self.set_waveform_data(data);
    }

    pub fn waveform_bars(&self) -> Vec<(usize, f32)> {
        if !self.is_loaded {
            return Vec::new();
        }
        self.waveform_data
            .iter()
            .enumerate()
            .map(|(i, amplitude)| (i, *amplitude))
            .collect()
    }

    pub fn bar_style(&self, amplitude: f32) -> String {
        let height = 20.0 + amplitude * 80.0;
        let opacity = 0.3 + amplitude * 0.7;
        format!("height: {}px; opacity: {};", height, opacity)
    }

    pub fn color_class(&self) -> &'static str {
        match self.waveform_color {
            WaveformColor::Primary => "hi-waveform-Primary",
            WaveformColor::Success => "hi-waveform-Success",
            WaveformColor::Warning => "hi-waveform-Warning",
            WaveformColor::Danger => "hi-waveform-Danger",
        }
    }

    pub fn class_string(&self) -> String {
        let base = format!("hi-audio-waveform {}", self.color_class());
        if self.class.is_empty() {
            base
        } else {
            format!("{} {}", base, self.class)
        }
    }

    pub fn formatted_current_time(&self) -> String {
        format_time(self.current_time)
    }

    pub fn formatted_duration(&self) -> String {
        format_time(self.duration)
    }
}

impl Default for AudioWaveformState {
    fn default() -> Self {
        Self::new("")
    }
}

#[derive(Clone, PartialEq, Debug)]
pub struct WaveformReadyEvent {
    pub data: Vec<f32>,
}

#[derive(Clone, PartialEq, Debug)]
pub struct PlaybackChangeEvent {
    pub is_playing: bool,
    pub state: PlaybackState,
}

fn format_time(seconds: f64) -> String {
    let mins = (seconds / 60.0) as u32;
    let secs = (seconds % 60.0) as u32;
    format!("{:02}:{:02}", mins, secs)
}

pub fn render_audio_waveform(state: &AudioWaveformState) -> VNode {
    let mut container_children: Vec<VNode> = Vec::new();

    container_children.push(VNode::Element(
        VElement::new("audio")
            .attr("src", &state.src)
            .attr("preload", "metadata"),
    ));

    let bars = state.waveform_bars();
    let mut bars_container = VElement::new("div").class("hi-waveform-bars");

    if !bars.is_empty() {
        let bar_nodes: Vec<VNode> = bars
            .iter()
            .map(|(_i, amplitude)| {
                VNode::Element(
                    VElement::new("div")
                        .class("hi-waveform-bar")
                        .attr("style", state.bar_style(*amplitude)),
                )
            })
            .collect();
        bars_container = bars_container.children(bar_nodes);
    } else {
        let placeholder_count = state.bar_count.min(20);
        let placeholder_bars: Vec<VNode> = (0..placeholder_count)
            .map(|i| {
                let h = 20.0 + (i as f32 * 0.8).sin().abs() * 40.0;
                let style = format!("height: {}px; opacity: 0.3;", h);
                VNode::Element(
                    VElement::new("div")
                        .class("hi-waveform-bar hi-waveform-bar--placeholder")
                        .attr("style", style),
                )
            })
            .collect();
        bars_container = bars_container.children(placeholder_bars);
    }

    container_children.push(VNode::Element(
        VElement::new("div")
            .class("hi-waveform-container")
            .attr("data-action", "waveform-click")
            .child(VNode::Element(bars_container)),
    ));

    if state.show_controls {
        let play_label = if state.is_playing { "Pause" } else { "Play" };
        let play_icon = if state.is_playing { "Pause" } else { "Play" };
        let progress_width = format!("{}%", state.progress_percent());
        let time_display = format!(
            "{} / {}",
            state.formatted_current_time(),
            state.formatted_duration()
        );

        let controls = VElement::new("div")
            .class("hi-audio-controls")
            .child(VNode::Element(
                VElement::new("button")
                    .class("hi-audio-control-btn")
                    .attr("aria-label", play_label)
                    .attr("data-action", "toggle-play")
                    .child(VNode::Text(VText::new(play_icon))),
            ))
            .child(VNode::Element(
                VElement::new("div")
                    .class("hi-audio-progress")
                    .attr("data-action", "audio-seek")
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("hi-audio-progress-bar")
                            .attr("style", format!("width: {};", progress_width)),
                    )),
            ))
            .child(VNode::Element(
                VElement::new("span")
                    .class("hi-audio-time")
                    .child(VNode::Text(VText::new(&time_display))),
            ));

        container_children.push(VNode::Element(controls));
    }

    VNode::Element(
        VElement::new("div")
            .class(state.class_string())
            .children(container_children),
    )
}

pub const AUDIO_WAVEFORM_STYLES: &str = r#"
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
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_state() {
        let state = AudioWaveformState::new("test.mp3");
        assert_eq!(state.src, "test.mp3");
        assert!(!state.is_playing);
        assert_eq!(state.playback_state, PlaybackState::Stopped);
        assert_eq!(state.volume, 1.0);
        assert!(!state.is_loaded);
        assert!(state.waveform_data.is_empty());
    }

    #[test]
    fn test_builder() {
        let state = AudioWaveformState::new("audio.mp3")
            .with_color(WaveformColor::Danger)
            .with_show_controls(false)
            .with_class("custom")
            .with_volume(0.5)
            .with_bar_count(60)
            .with_fft_size(1024);

        assert_eq!(state.waveform_color, WaveformColor::Danger);
        assert!(!state.show_controls);
        assert_eq!(state.class, "custom");
        assert!((state.volume - 0.5).abs() < 0.001);
        assert_eq!(state.bar_count, 60);
        assert_eq!(state.fft_size, 1024);
    }

    #[test]
    fn test_playback_controls() {
        let mut state = AudioWaveformState::new("test.mp3");

        state.play();
        assert!(state.is_playing);
        assert_eq!(state.playback_state, PlaybackState::Playing);

        state.pause();
        assert!(!state.is_playing);
        assert_eq!(state.playback_state, PlaybackState::Paused);

        state.toggle_playback();
        assert!(state.is_playing);
        assert_eq!(state.playback_state, PlaybackState::Playing);

        state.stop();
        assert!(!state.is_playing);
        assert_eq!(state.playback_state, PlaybackState::Stopped);
        assert_eq!(state.current_time, 0.0);
    }

    #[test]
    fn test_time_and_progress() {
        let mut state = AudioWaveformState::new("test.mp3");
        state.set_duration(120.0);
        state.set_current_time(30.0);

        assert!((state.progress_percent() - 25.0).abs() < 0.001);
        assert_eq!(state.formatted_current_time(), "00:30");
        assert_eq!(state.formatted_duration(), "02:00");
    }

    #[test]
    fn test_progress_clamp() {
        let mut state = AudioWaveformState::new("test.mp3");
        state.set_duration(60.0);
        state.set_current_time(90.0);
        assert!((state.progress_percent() - 100.0).abs() < 0.001);
    }

    #[test]
    fn test_synth_waveform() {
        let mut state = AudioWaveformState::new("test.mp3");
        state.generate_synth_waveform();

        assert!(state.is_loaded);
        assert_eq!(state.waveform_data.len(), 40);
        assert!(state.waveform_data[0] >= 0.0 && state.waveform_data[0] <= 1.0);
    }

    #[test]
    fn test_waveform_bars() {
        let mut state = AudioWaveformState::new("test.mp3");
        assert!(state.waveform_bars().is_empty());

        state.generate_synth_waveform();
        let bars = state.waveform_bars();
        assert_eq!(bars.len(), 40);
        assert_eq!(bars[0].0, 0);
    }

    #[test]
    fn test_bar_style() {
        let state = AudioWaveformState::new("test.mp3");
        let style = state.bar_style(0.5);
        assert!(style.contains("height: 60px"));
        assert!(style.contains("opacity: 0.65"));
    }

    #[test]
    fn test_class_string() {
        let state = AudioWaveformState::new("test.mp3")
            .with_color(WaveformColor::Success)
            .with_class("my-class");
        let class = state.class_string();
        assert!(class.contains("hi-audio-waveform"));
        assert!(class.contains("hi-waveform-Success"));
        assert!(class.contains("my-class"));
    }

    #[test]
    fn test_volume_clamp() {
        let state = AudioWaveformState::new("test.mp3").with_volume(2.0);
        assert!((state.volume - 1.0).abs() < 0.001);

        let state = AudioWaveformState::new("test.mp3").with_volume(-0.5);
        assert!((state.volume - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_set_waveform_data() {
        let mut state = AudioWaveformState::new("test.mp3");
        let data = vec![0.1, 0.5, 0.9, 0.3];
        state.set_waveform_data(data.clone());

        assert!(state.is_loaded);
        assert_eq!(state.waveform_data, data);
    }

    #[test]
    fn test_format_time() {
        assert_eq!(format_time(0.0), "00:00");
        assert_eq!(format_time(65.0), "01:05");
        assert_eq!(format_time(3661.0), "61:01");
    }

    #[test]
    fn test_default() {
        let state = AudioWaveformState::default();
        assert_eq!(state.src, "");
    }
}
