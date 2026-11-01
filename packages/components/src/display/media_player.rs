// packages/components/src/display/media_player.rs
// MediaPlayer — mirror of the canonical Vue `HkMediaPlayer` (the thin shell
// that owns the media element and composes the visualizer + control bar).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkMediaPlayer.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so every
// `.hk-media-player*` class name is literal and identical in both forms.
//
// DOM contract (mirrors Vue's render output):
//
//   div.hk-media-player.hk-media-player--{audio|video} [.is-fullscreen]
//          [+host class]
//     ── audio ──
//     div.hk-media-visualizer        (HkMediaVisualizer, from `spectrum`)
//     ── video ──
//     div.hk-media-player-video      (Vue's <video> seat; `stage` mounts here)
//     div.hk-media-controls          (HkMediaControlBar)
//
// Vue prop mapping: `src` / `type` / `poster` → [`MediaPlayerProps::src`] /
// [`MediaPlayerProps::kind`] / [`MediaPlayerProps::poster`]. Everything Vue
// keeps as internal reactive state (`playing`, `current`, `duration`,
// `buffered`, `volume`, `muted`, `rateIdx`, `isFullscreen`) is a CONTROLLED
// prop here, and every intent Vue's element handlers performed locally
// (`togglePlay`, `seekToRatio`, `setVolume`, `toggleMute`, `cycleRate`,
// `toggleFullscreen`) is a callback the host performs. The derived values are
// the Vue computeds, helper by helper: `progress` / `bufferedPct` /
// `rate = MEDIA_RATES[rateIdx]` / `seekToRatio`'s clamp and the mute-at-zero
// rule of `setVolume` all live in the free functions below.
//
// State contract (the tairitsu 0.5.22 limit this wave works under): the mirror
// keeps NO playback state — not a `Signal`, not a `Cell`. Playback belongs to
// the host (see the deltas); the component is a pure function of its props.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * There is no `<audio>` / `<video>` element capability in this host stack:
//     no media element can be created, attached to, or driven, so the mirror
//     renders the player SHELL only. The host owns the element and the
//     playback; it feeds `playing` / `current` / `duration` / `buffered` in,
//     performs the intents it receives back, and mounts its own player surface
//     through the `stage` slot for `kind == Video` (the slot renders inside
//     `div.hk-media-player-video`, which keeps the sheet's sizing and black
//     seat). `src` / `poster` are carried for that host element and are not
//     rendered — the same "carried for type parity" contract as
//     `TimelineStep::icon`.
//   * Vue reads `document.fullscreenElement` and calls `requestFullscreen`;
//     neither exists here, so `is_fullscreen` is a prop and
//     `on_toggle_fullscreen` asks the host to do it. `is-fullscreen` keeps
//     driving the sheet's layout exactly as in Vue.
//   * The audio element's event wiring (`timeupdate`, `durationchange`,
//     `loadedmetadata`, `volumechange`, `play`, `pause`, `ended`) is host-side
//     state production; the mirror never subscribes to anything.
//   * `spectrum` replaces `HkMediaVisualizer`'s `mediaRef`: the host samples
//     its analyser and passes the byte frame (see `media_visualizer.rs`).

use crate::display::media_control_bar::{MediaControlBar, MediaControlBarProps};
use crate::display::media_visualizer::{MediaVisualizer, MediaVisualizerProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct MediaPlayerComponent;

/// Playback rate presets cycled by the control bar's rate button (Vue:
/// `MEDIA_RATES`).
pub const MEDIA_PLAYER_RATES: [f64; 5] = [0.5, 1.0, 1.25, 1.5, 2.0];

/// Which shell the player renders (Vue: `"video" | "audio"`, required there).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MediaPlayerKind {
    #[default]
    Audio,
    Video,
}

impl MediaPlayerKind {
    /// The `hk-media-player--{kind}` modifier token exactly as Vue emits it.
    pub fn token(self) -> &'static str {
        match self {
            MediaPlayerKind::Audio => "audio",
            MediaPlayerKind::Video => "video",
        }
    }
}

/// Vue: `const rate = computed(() => MEDIA_RATES[rateIdx.value])`. An
/// out-of-range index saturates on the last preset instead of panicking.
pub fn media_player_rate(index: usize) -> f64 {
    MEDIA_PLAYER_RATES[index.min(MEDIA_PLAYER_RATES.len() - 1)]
}

/// Vue: `rateIdx = (rateIdx + 1) % MEDIA_RATES.length` — the cycle the rate
/// button drives.
pub fn media_player_cycle_rate_index(index: usize) -> usize {
    (index + 1) % MEDIA_PLAYER_RATES.len()
}

/// Vue: `duration > 0 ? (current / duration) * 100 : 0`, clamped to `0..=100`
/// because a controlled `current` can arrive past the loaded duration while a
/// media element's own `timeupdate` could not.
pub fn media_player_progress_pct(current: f64, duration: f64) -> f64 {
    if duration <= 0.0 || duration.is_nan() || !current.is_finite() {
        return 0.0;
    }
    ((current / duration) * 100.0).clamp(0.0, 100.0)
}

/// Vue: `duration > 0 ? (buffered / duration) * 100 : 0`, same clamp.
pub fn media_player_buffered_pct(buffered: f64, duration: f64) -> f64 {
    if duration <= 0.0 || duration.is_nan() || !buffered.is_finite() {
        return 0.0;
    }
    ((buffered / duration) * 100.0).clamp(0.0, 100.0)
}

/// Vue's `seekToRatio`: clamp the ratio into `0..=1`, then scale by the
/// duration. An unloaded duration seeks nowhere.
pub fn media_player_seek_time(ratio: f64, duration: f64) -> f64 {
    if duration <= 0.0 || duration.is_nan() || !ratio.is_finite() {
        return 0.0;
    }
    ratio.clamp(0.0, 1.0) * duration
}

/// Vue's `setVolume` clamp: `Math.max(0, Math.min(1, v))`, with a non-finite
/// controlled value pinned to zero instead of poisoning the volume.
pub fn media_player_clamp_volume(volume: f64) -> f64 {
    if volume.is_nan() {
        return 0.0;
    }
    volume.clamp(0.0, 1.0)
}

/// Vue's `setVolume` mute rule: `muted = val === 0` (a zero volume IS muted).
pub fn media_player_muted_after_set(volume: f64) -> bool {
    media_player_clamp_volume(volume) == 0.0
}

/// Vue: `showFullscreen={props.type === "video"}` — fullscreen is a video verb.
pub fn media_player_show_fullscreen(kind: MediaPlayerKind) -> bool {
    kind == MediaPlayerKind::Video
}

/// The root class list: `.hk-media-player`, the `--{kind}` modifier, the
/// `is-fullscreen` state, then the host class last (Vue's array → join order).
pub fn media_player_root_classes(
    kind: MediaPlayerKind,
    is_fullscreen: bool,
    class: &str,
) -> String {
    let mut classes = format!("hk-media-player hk-media-player--{}", kind.token());
    if is_fullscreen {
        classes.push_str(" is-fullscreen");
    }
    if !class.is_empty() {
        classes.push(' ');
        classes.push_str(class);
    }
    classes
}

#[define_props]
pub struct MediaPlayerProps {
    /// Which shell to render (Vue: `type`, required there).
    #[default]
    pub kind: MediaPlayerKind,

    /// Media source, carried for the host's media element (not rendered).
    #[default]
    pub src: String,

    /// Poster image, carried for the host's media element (not rendered).
    pub poster: Option<String>,

    /// Whether playback is running (Vue: internal `playing`).
    #[default]
    pub playing: bool,

    /// Elapsed seconds (Vue: internal `current`).
    #[default(0.0)]
    pub current: f64,

    /// Total seconds (Vue: internal `duration`).
    #[default(0.0)]
    pub duration: f64,

    /// Buffered seconds (Vue: internal `buffered`).
    #[default(0.0)]
    pub buffered: f64,

    /// Volume in `0..1` (Vue initialises it from the element, `1` before load).
    #[default(1.0)]
    pub volume: f64,

    #[default]
    pub muted: bool,

    /// Index into [`MEDIA_PLAYER_RATES`] (Vue: internal `rateIdx`, starts at 1
    /// so the initial rate is `1x`).
    #[default(1)]
    pub rate_index: usize,

    #[default]
    pub is_fullscreen: bool,

    /// Frequency-bin frame for the audio visualizer (Vue: the analyser's
    /// `getByteFrequencyData` bytes; empty = not playing).
    pub spectrum: Vec<u8>,

    /// Host media surface for the video shell (see the file header deltas).
    pub stage: Option<Element>,

    /// Vue attribute fallthrough onto the root `<div>`.
    #[default]
    pub class: String,

    /// Vue: `togglePlay` — the host starts/stops its element.
    pub on_toggle_play: Option<EventHandler<()>>,

    /// Vue: `seekToRatio` — `0..1` across the duration.
    pub on_seek: Option<EventHandler<f64>>,

    /// Vue: `setVolume` — `0..1`.
    pub on_set_volume: Option<EventHandler<f64>>,

    /// Vue: `toggleMute`.
    pub on_toggle_mute: Option<EventHandler<()>>,

    /// Vue: `cycleRate` — the host advances `rate_index`.
    pub on_cycle_rate: Option<EventHandler<()>>,

    /// Vue: `toggleFullscreen`.
    pub on_toggle_fullscreen: Option<EventHandler<()>>,
}

#[component]
pub fn MediaPlayer(props: MediaPlayerProps) -> Element {
    let controls = MediaControlBar(MediaControlBarProps {
        playing: props.playing,
        current: props.current,
        duration: props.duration,
        // The two computeds Vue feeds the bar.
        progress: media_player_progress_pct(props.current, props.duration),
        buffered_pct: media_player_buffered_pct(props.buffered, props.duration),
        volume: props.volume,
        muted: props.muted,
        rate: media_player_rate(props.rate_index),
        is_fullscreen: props.is_fullscreen,
        show_fullscreen: media_player_show_fullscreen(props.kind),
        on_toggle_play: props.on_toggle_play.clone(),
        on_seek: props.on_seek.clone(),
        on_set_volume: props.on_set_volume.clone(),
        on_toggle_mute: props.on_toggle_mute.clone(),
        on_cycle_rate: props.on_cycle_rate.clone(),
        on_toggle_fullscreen: props.on_toggle_fullscreen.clone(),
        ..Default::default()
    });

    let mut root = VElement::new("div").class(media_player_root_classes(
        props.kind,
        props.is_fullscreen,
        &props.class,
    ));

    match props.kind {
        MediaPlayerKind::Audio => {
            root = root.child(MediaVisualizer(MediaVisualizerProps {
                levels: props.spectrum.clone(),
                ..Default::default()
            }));
        }
        MediaPlayerKind::Video => {
            // Vue's `<video src poster class="hk-media-player-video">` seat.
            // The element itself is host-side (see the deltas); the slot's
            // content renders inside the same box.
            let mut stage = VElement::new("div").class("hk-media-player-video");
            if let Some(content) = props.stage.clone() {
                stage = stage.child(content);
            }
            root = root.child(VNode::Element(Box::new(stage)));
        }
    }

    root = root.child(controls);
    VNode::Element(Box::new(root))
}

impl StyledComponent for MediaPlayerComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps every
        // `.hk-media-player*` name literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkMediaPlayer.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "media-player"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn count(haystack: &str, needle: &str) -> usize {
        haystack.matches(needle).count()
    }

    #[test]
    fn media_player_defaults_match_the_vue_props() {
        let props = MediaPlayerProps::default();
        assert_eq!(props.kind, MediaPlayerKind::Audio);
        assert_eq!(props.src, "");
        assert_eq!(props.poster, None);
        assert!(!props.playing);
        assert_eq!(props.current, 0.0);
        assert_eq!(props.duration, 0.0);
        assert_eq!(props.buffered, 0.0);
        assert_eq!(props.volume, 1.0);
        assert!(!props.muted);
        // Vue: `rateIdx = ref(1)` → the initial rate is `1x`.
        assert_eq!(props.rate_index, 1);
        assert_eq!(media_player_rate(props.rate_index), 1.0);
        assert!(!props.is_fullscreen);
        assert!(props.spectrum.is_empty());
        assert!(props.stage.is_none());
        assert_eq!(props.class, "");
        assert!(props.on_toggle_play.is_none());
        assert!(props.on_seek.is_none());
        assert!(props.on_set_volume.is_none());
        assert!(props.on_toggle_mute.is_none());
        assert!(props.on_cycle_rate.is_none());
        assert!(props.on_toggle_fullscreen.is_none());
    }

    #[test]
    fn media_player_kind_tokens_match_the_vue_modifiers() {
        assert_eq!(MediaPlayerKind::Audio.token(), "audio");
        assert_eq!(MediaPlayerKind::Video.token(), "video");
        assert_eq!(
            media_player_root_classes(MediaPlayerKind::Audio, false, ""),
            "hk-media-player hk-media-player--audio"
        );
        assert_eq!(
            media_player_root_classes(MediaPlayerKind::Video, false, ""),
            "hk-media-player hk-media-player--video"
        );
        assert_eq!(
            media_player_root_classes(MediaPlayerKind::Video, true, "host"),
            "hk-media-player hk-media-player--video is-fullscreen host"
        );
    }

    #[test]
    fn media_player_rate_presets_and_cycle_match_the_vue_table() {
        assert_eq!(MEDIA_PLAYER_RATES, [0.5, 1.0, 1.25, 1.5, 2.0]);
        assert_eq!(media_player_rate(0), 0.5);
        assert_eq!(media_player_rate(2), 1.25);
        assert_eq!(media_player_rate(4), 2.0);
        // Out-of-range indexes saturate on the last preset.
        assert_eq!(media_player_rate(9), 2.0);
        // The cycle wraps back to the first preset after the last one.
        assert_eq!(media_player_cycle_rate_index(0), 1);
        assert_eq!(media_player_cycle_rate_index(3), 4);
        assert_eq!(media_player_cycle_rate_index(4), 0);
    }

    #[test]
    fn media_player_progress_clamps_within_the_duration() {
        assert_eq!(media_player_progress_pct(0.0, 0.0), 0.0);
        assert_eq!(media_player_progress_pct(5.0, 0.0), 0.0);
        assert_eq!(media_player_progress_pct(0.0, 100.0), 0.0);
        assert_eq!(media_player_progress_pct(50.0, 100.0), 50.0);
        assert_eq!(media_player_progress_pct(100.0, 100.0), 100.0);
        // A controlled `current` past the duration cannot paint past the end.
        assert_eq!(media_player_progress_pct(250.0, 100.0), 100.0);
        assert_eq!(media_player_progress_pct(-5.0, 100.0), 0.0);
        assert_eq!(media_player_progress_pct(f64::NAN, 100.0), 0.0);
        // Buffered uses the same duration guard and span.
        assert_eq!(media_player_buffered_pct(0.0, 0.0), 0.0);
        assert_eq!(media_player_buffered_pct(25.0, 100.0), 25.0);
        assert_eq!(media_player_buffered_pct(400.0, 100.0), 100.0);
    }

    #[test]
    fn media_player_seek_time_clamps_the_ratio() {
        assert_eq!(media_player_seek_time(0.0, 100.0), 0.0);
        assert_eq!(media_player_seek_time(0.5, 100.0), 50.0);
        assert_eq!(media_player_seek_time(1.0, 100.0), 100.0);
        // The ratio itself clamps, so a pointer past either end saturates.
        assert_eq!(media_player_seek_time(-3.0, 100.0), 0.0);
        assert_eq!(media_player_seek_time(9.0, 100.0), 100.0);
        // An unloaded element seeks nowhere.
        assert_eq!(media_player_seek_time(0.5, 0.0), 0.0);
        assert_eq!(media_player_seek_time(f64::NAN, 100.0), 0.0);
    }

    #[test]
    fn media_player_volume_set_clamps_and_mutes_at_zero() {
        assert_eq!(media_player_clamp_volume(0.0), 0.0);
        assert_eq!(media_player_clamp_volume(0.42), 0.42);
        assert_eq!(media_player_clamp_volume(1.0), 1.0);
        // `Math.max(0, Math.min(1, v))`.
        assert_eq!(media_player_clamp_volume(4.0), 1.0);
        assert_eq!(media_player_clamp_volume(-2.0), 0.0);
        assert_eq!(media_player_clamp_volume(f64::NAN), 0.0);
        // Vue: `muted.value = val === 0` — only the bottom of the range mutes.
        assert!(media_player_muted_after_set(0.0));
        assert!(media_player_muted_after_set(-1.0));
        assert!(!media_player_muted_after_set(0.01));
        assert!(!media_player_muted_after_set(1.0));
    }

    #[test]
    fn media_player_fullscreen_is_a_video_verb() {
        assert!(!media_player_show_fullscreen(MediaPlayerKind::Audio));
        assert!(media_player_show_fullscreen(MediaPlayerKind::Video));
    }

    #[test]
    fn media_player_audio_shell_renders_the_visualizer_and_the_bar() {
        let html = MediaPlayer(MediaPlayerProps {
            src: "track.ogg".to_string(),
            spectrum: vec![0, 255],
            playing: true,
            current: 5.0,
            duration: 65.0,
            ..Default::default()
        })
        .render_to_html();

        assert!(
            html.contains("hk-media-player hk-media-player--audio"),
            "{html}"
        );
        // Audio: the spectrum box, never the video seat.
        assert!(html.contains("hk-media-visualizer"), "{html}");
        assert_eq!(count(&html, r#"data-el="bar""#), 2, "{html}");
        assert!(!html.contains("hk-media-player-video"), "{html}");
        // The shared control bar rides along with its own contract.
        assert!(html.contains("hk-media-controls"), "{html}");
        assert!(html.contains(r#"aria-label="Pause""#), "{html}");
        assert!(html.contains(">0:05 / 1:05<"), "{html}");
        // Fullscreen is withheld for audio.
        assert!(!html.contains(r#"aria-label="Fullscreen""#), "{html}");
        // `src` is carried for the host, not rendered.
        assert!(!html.contains("track.ogg"), "{html}");
    }

    #[test]
    fn media_player_video_shell_renders_the_seat_and_the_fullscreen_verb() {
        let html = MediaPlayer(MediaPlayerProps {
            kind: MediaPlayerKind::Video,
            src: "clip.mp4".to_string(),
            poster: Some("poster.png".to_string()),
            is_fullscreen: true,
            duration: 90.0,
            stage: Some(rsx! {
                div { class: "host-surface" }
            }),
            ..Default::default()
        })
        .render_to_html();

        assert!(
            html.contains("hk-media-player hk-media-player--video"),
            "{html}"
        );
        assert!(html.contains("is-fullscreen"), "{html}");
        // Video: the media seat with the host surface mounted inside it.
        assert!(html.contains("hk-media-player-video"), "{html}");
        assert!(html.contains("host-surface"), "{html}");
        assert!(!html.contains("hk-media-visualizer"), "{html}");
        // Fullscreen appears for video, labelled for the current state.
        assert!(html.contains(r#"aria-label="Exit fullscreen""#), "{html}");
        assert!(html.contains("hk-media-controls"), "{html}");
        // The source/poster stay host-side.
        assert!(!html.contains("clip.mp4"), "{html}");
        assert!(!html.contains("poster.png"), "{html}");
    }

    #[test]
    fn media_player_bare_video_seat_renders_without_a_stage() {
        let html = MediaPlayer(MediaPlayerProps {
            kind: MediaPlayerKind::Video,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"class="hk-media-player-video""#), "{html}");
        assert!(!html.contains("hk-media-visualizer"), "{html}");
    }

    #[test]
    fn media_player_styles_come_from_the_canonical_vue_sheet() {
        let css = MediaPlayerComponent::styles();
        for needle in [
            ".hk-media-player",
            ".hk-media-player.is-fullscreen",
            ".hk-media-player-video",
        ] {
            assert!(
                css.contains(needle),
                "media-player css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored media-player sheet"
        );
    }
}
