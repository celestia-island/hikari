// packages/components/src/display/media_control_bar.rs
// MediaControlBar — mirror of the canonical Vue `HkMediaControlBar` (the shared
// transport bar used under both the audio and the video player).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkMediaControlBar.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so every
// `.hk-media-*` class name is literal and identical in both forms.
//
// DOM contract (mirrors Vue's render output one-to-one):
//
//   div.hk-media-controls
//     button.hk-btn.hk-btn-ghost.hk-btn-sm.hk-media-btn.hk-media-play
//            type="button" aria-label={Play|Pause}   {Pause|Play glyph}
//     div.hk-media-slider.hk-media-controls-seek     (HkMediaSlider, md)
//     span.hk-media-time                               "m:ss / m:ss"
//     div.hk-media-volume
//       button.hk-btn.hk-btn-ghost.hk-btn-sm.hk-media-btn
//              type="button" aria-label={Mute|Unmute} {Volume2|VolumeX glyph}
//       div.hk-media-slider.hk-media-controls-vol    (HkMediaSlider, sm)
//     button.hk-btn.hk-btn-ghost.hk-btn-sm.hk-media-btn.hk-media-rate
//            type="button" aria-label={Playback speed}  {rate}x
//     button.hk-btn.hk-btn-ghost.hk-btn-sm.hk-media-btn   (showFullscreen)
//            type="button" aria-label={Fullscreen|Exit fullscreen}  {glyph}
//
// Vue prop mapping: `playing` / `current` / `duration` / `progress` /
// `bufferedPct` / `volume` / `muted` / `rate` / `isFullscreen` /
// `showFullscreen` / `disabled` one-to-one; the six emits become
// `on_toggle_play` / `on_seek` / `on_set_volume` / `on_toggle_mute` /
// `on_cycle_rate` / `on_toggle_fullscreen`. Vue's exported helper
// `formatMediaTime` is [`format_media_time`], and every ratio the bar derives
// (`progress/100`, `bufferedPct/100`, `muted ? 0 : volume`) is a free function
// below so it is testable without a DOM.
//
// The bar is presentational in both forms — it reflects controller state via
// props and forwards intents via callbacks; no state is kept here.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * Vue composes its buttons through `HButton` with a lucide node as the
//     default slot. The mirror composes the same `.hk-btn*` markup through the
//     mirrored `basic::Button` and passes a typed MDI glyph
//     (`hikari_icons::Icon`, the crate's icon set has no lucide runtime
//     registry) — the emitted `.hk-media-btn` / `.hk-btn` classes and the
//     button order are byte-identical, only the `<svg>` body of the glyph
//     differs (the same delta `basic/button.rs` documents for its slots). The
//     glyph still rides the crate's `dangerous_inner_html` mount (an rsx
//     `svg {}` never paints in this host stack) inside the crate's sized
//     `div.hk-icon` box, the shape every other mirrored family ships for typed
//     glyphs; `.hk-media-btn` sizes the button itself, so no
//     `display:contents` re-parenting is needed here.
//   * `HkMediaSlider` is composed directly (not through `rsx!`) so the seek /
//     volume hooks (`.hk-media-controls-seek` / `.hk-media-controls-vol`)
//     ride its `class` prop, exactly the way Vue's attribute fallthrough
//     lands them.
//   * The ARIA labels resolve through `hikari_i18n` under the
//     `components.hk.mediaControlBar.*` keys (Vue uses
//     `hikari::mediaPlayer.*`; the Rust mirror uses the family namespace).

use hikari_i18n::t;
use hikari_icons::{Icon, MdiIcon};

use crate::basic::button::{Button, ButtonProps, ButtonSize, ButtonVariant};
use crate::display::media_slider::{MediaSlider, MediaSliderProps, MediaSliderSize};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct MediaControlBarComponent;

/// Vue's exported `formatMediaTime(sec)`: `mm:ss` (`m` unpadded, `s` always
/// two digits). Non-finite or negative input formats as `0:00`.
pub fn format_media_time(sec: f64) -> String {
    let sec = if sec.is_finite() && sec >= 0.0 {
        sec
    } else {
        0.0
    };
    let minutes = (sec / 60.0).floor();
    let seconds = (sec % 60.0).floor();
    format!("{minutes}:{:02}", seconds as i64)
}

/// The `current / duration` time readout (Vue:
/// `{formatMediaTime(current)} / {formatMediaTime(duration)}`).
pub fn media_control_bar_time_text(current: f64, duration: f64) -> String {
    format!(
        "{} / {}",
        format_media_time(current),
        format_media_time(duration)
    )
}

/// The play button's accessible name (Vue:
/// `t("hikari::mediaPlayer.pause" | "…play")`).
pub fn media_control_bar_play_label(playing: bool) -> String {
    if playing {
        t("components.hk.mediaControlBar.pause", "Pause")
    } else {
        t("components.hk.mediaControlBar.play", "Play")
    }
}

/// The mute button's accessible name.
pub fn media_control_bar_mute_label(muted: bool) -> String {
    if muted {
        t("components.hk.mediaControlBar.unmute", "Unmute")
    } else {
        t("components.hk.mediaControlBar.mute", "Mute")
    }
}

/// The fullscreen button's accessible name.
pub fn media_control_bar_fullscreen_label(is_fullscreen: bool) -> String {
    if is_fullscreen {
        t(
            "components.hk.mediaControlBar.exitFullscreen",
            "Exit fullscreen",
        )
    } else {
        t("components.hk.mediaControlBar.fullscreen", "Fullscreen")
    }
}

/// The seek track's accessible name.
pub fn media_control_bar_seek_label() -> String {
    t("components.hk.mediaControlBar.seek", "Seek")
}

/// The volume track's accessible name.
pub fn media_control_bar_volume_label() -> String {
    t("components.hk.mediaControlBar.volume", "Volume")
}

/// The rate button's accessible name.
pub fn media_control_bar_speed_label() -> String {
    t("components.hk.mediaControlBar.speed", "Playback speed")
}

/// The rate button's visible text (Vue: `{rate}x`).
pub fn media_control_bar_rate_label(rate: f64) -> String {
    format!("{rate}x")
}

/// Vue: `:ratio="progress / 100"` — the seek track's `0..1` position.
pub fn media_control_bar_seek_ratio(progress: f64) -> f64 {
    progress / 100.0
}

/// Vue: `:buffered="bufferedPct / 100"` — the secondary fill's `0..1` share.
pub fn media_control_bar_buffered_ratio(buffered_pct: f64) -> f64 {
    buffered_pct / 100.0
}

/// Vue: `:ratio="muted ? 0 : volume"` — muting pins the track to zero without
/// destroying the remembered volume.
pub fn media_control_bar_volume_ratio(muted: bool, volume: f64) -> f64 {
    if muted { 0.0 } else { volume }
}

/// Vue: `:disabled="disabled || duration <= 0"` — an unloaded stream cannot be
/// scrubbed.
pub fn media_control_bar_seek_disabled(disabled: bool, duration: f64) -> bool {
    disabled || duration <= 0.0
}

/// Vue: `muted || volume === 0` selects the crossed-out speaker glyph.
pub fn media_control_bar_shows_muted_glyph(muted: bool, volume: f64) -> bool {
    muted || volume == 0.0
}

/// The transport button shared by the play / mute / fullscreen slots: the
/// mirrored `basic::Button` in Vue's `ghost` + `sm` recipe, with the host class
/// appended last and the unit emit adapted to a `MouseEvent` handler.
fn media_control_bar_button(
    class: &str,
    aria_label: String,
    glyph: Element,
    handler: &Option<EventHandler<()>>,
) -> VNode {
    let onclick = match handler {
        Some(handler) => {
            let handler = handler.clone();
            Some(EventHandler::new(move |_event: MouseEvent| {
                handler.call(());
            }))
        }
        None => None,
    };
    Button(ButtonProps {
        variant: ButtonVariant::Ghost,
        size: ButtonSize::Sm,
        class: class.to_string(),
        aria_label: Some(aria_label),
        children: glyph,
        onclick,
        ..Default::default()
    })
}

#[define_props]
pub struct MediaControlBarProps {
    #[default]
    pub playing: bool,

    /// Elapsed seconds (Vue: `current`).
    #[default(0.0)]
    pub current: f64,

    /// Total seconds (Vue: `duration`); `<= 0` disables the seek track.
    #[default(0.0)]
    pub duration: f64,

    /// Seek position in percent of the duration (Vue: `progress`).
    #[default(0.0)]
    pub progress: f64,

    /// Buffered share in percent of the duration (Vue: `bufferedPct`).
    #[default(0.0)]
    pub buffered_pct: f64,

    /// Volume in `0..1` (Vue default 1).
    #[default(1.0)]
    pub volume: f64,

    #[default]
    pub muted: bool,

    /// Playback rate preset currently active (Vue default 1).
    #[default(1.0)]
    pub rate: f64,

    #[default]
    pub is_fullscreen: bool,

    /// Render the fullscreen verb (Vue: `showFullscreen`, set by the video
    /// player only).
    #[default]
    pub show_fullscreen: bool,

    #[default]
    pub disabled: bool,

    /// Vue: `togglePlay`.
    pub on_toggle_play: Option<EventHandler<()>>,

    /// Vue: `seek` — the `0..1` ratio picked on the seek track.
    pub on_seek: Option<EventHandler<f64>>,

    /// Vue: `setVolume` — the `0..1` volume picked on the volume track.
    pub on_set_volume: Option<EventHandler<f64>>,

    /// Vue: `toggleMute`.
    pub on_toggle_mute: Option<EventHandler<()>>,

    /// Vue: `cycleRate`.
    pub on_cycle_rate: Option<EventHandler<()>>,

    /// Vue: `toggleFullscreen`.
    pub on_toggle_fullscreen: Option<EventHandler<()>>,
}

#[component]
pub fn MediaControlBar(props: MediaControlBarProps) -> Element {
    let muted_glyph = media_control_bar_shows_muted_glyph(props.muted, props.volume);

    let play_button = media_control_bar_button(
        "hk-media-btn hk-media-play",
        media_control_bar_play_label(props.playing),
        if props.playing {
            rsx! {
                Icon { icon: MdiIcon::Pause, size: 16 }
            }
        } else {
            rsx! {
                Icon { icon: MdiIcon::Play, size: 16 }
            }
        },
        &props.on_toggle_play,
    );

    // Distinct registry keys: the seek and the volume slider share a page, and a
    // shared drag flag would let one drive the other (R2 S1).
    let seek = MediaSlider(MediaSliderProps {
        instance_key: "hk-media-controls-seek".to_string(),
        class: "hk-media-controls-seek".to_string(),
        ratio: media_control_bar_seek_ratio(props.progress),
        buffered: media_control_bar_buffered_ratio(props.buffered_pct),
        disabled: media_control_bar_seek_disabled(props.disabled, props.duration),
        aria_label: Some(media_control_bar_seek_label()),
        size: MediaSliderSize::Md,
        on_update_ratio: props.on_seek.clone(),
    });

    let time_text = media_control_bar_time_text(props.current, props.duration);

    let mute_button = media_control_bar_button(
        "hk-media-btn",
        media_control_bar_mute_label(props.muted),
        if muted_glyph {
            rsx! {
                Icon { icon: MdiIcon::VolumeMute, size: 15 }
            }
        } else {
            rsx! {
                Icon { icon: MdiIcon::VolumeHigh, size: 15 }
            }
        },
        &props.on_toggle_mute,
    );

    let volume_slider = MediaSlider(MediaSliderProps {
        instance_key: "hk-media-controls-vol".to_string(),
        class: "hk-media-controls-vol".to_string(),
        ratio: media_control_bar_volume_ratio(props.muted, props.volume),
        aria_label: Some(media_control_bar_volume_label()),
        size: MediaSliderSize::Sm,
        on_update_ratio: props.on_set_volume.clone(),
        ..Default::default()
    });

    let rate_text = media_control_bar_rate_label(props.rate);
    let rate_button = media_control_bar_button(
        "hk-media-btn hk-media-rate",
        media_control_bar_speed_label(),
        VNode::Text(VText::new(&rate_text)),
        &props.on_cycle_rate,
    );

    let fullscreen_button = media_control_bar_button(
        "hk-media-btn",
        media_control_bar_fullscreen_label(props.is_fullscreen),
        if props.is_fullscreen {
            rsx! {
                Icon { icon: MdiIcon::FullscreenExit, size: 15 }
            }
        } else {
            rsx! {
                Icon { icon: MdiIcon::Fullscreen, size: 15 }
            }
        },
        &props.on_toggle_fullscreen,
    );

    rsx! {
        div { class: "hk-media-controls",
            {play_button}
            {seek}
            span { class: "hk-media-time", "{time_text}" }
            div { class: "hk-media-volume",
                {mute_button}
                {volume_slider}
            }
            {rate_button}
            if props.show_fullscreen {
                {fullscreen_button}
            }
        }
    }
}

impl StyledComponent for MediaControlBarComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps every
        // `.hk-media-*` name literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkMediaControlBar.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "media-control-bar"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn count(haystack: &str, needle: &str) -> usize {
        haystack.matches(needle).count()
    }

    #[test]
    fn media_control_bar_defaults_match_the_vue_props() {
        let props = MediaControlBarProps::default();
        assert!(!props.playing);
        assert_eq!(props.current, 0.0);
        assert_eq!(props.duration, 0.0);
        assert_eq!(props.progress, 0.0);
        assert_eq!(props.buffered_pct, 0.0);
        assert_eq!(props.volume, 1.0);
        assert!(!props.muted);
        assert_eq!(props.rate, 1.0);
        assert!(!props.is_fullscreen);
        assert!(!props.show_fullscreen);
        assert!(!props.disabled);
        assert!(props.on_toggle_play.is_none());
        assert!(props.on_seek.is_none());
        assert!(props.on_set_volume.is_none());
        assert!(props.on_toggle_mute.is_none());
        assert!(props.on_cycle_rate.is_none());
        assert!(props.on_toggle_fullscreen.is_none());
    }

    #[test]
    fn format_media_time_matches_the_vue_helper() {
        assert_eq!(format_media_time(0.0), "0:00");
        assert_eq!(format_media_time(5.0), "0:05");
        assert_eq!(format_media_time(5.99), "0:05");
        assert_eq!(format_media_time(59.9), "0:59");
        assert_eq!(format_media_time(60.0), "1:00");
        assert_eq!(format_media_time(65.5), "1:05");
        // Minutes are not padded, seconds always are.
        assert_eq!(format_media_time(3600.0), "60:00");
        // Negative and non-finite input format as zero, never as "-1:59".
        assert_eq!(format_media_time(-1.0), "0:00");
        assert_eq!(format_media_time(f64::NAN), "0:00");
        assert_eq!(format_media_time(f64::INFINITY), "0:00");
        // The readout joins both ends with Vue's ` / ` separator.
        assert_eq!(media_control_bar_time_text(5.0, 65.0), "0:05 / 1:05");
    }

    #[test]
    fn media_control_bar_ratios_match_the_vue_bindings() {
        assert_eq!(media_control_bar_seek_ratio(0.0), 0.0);
        assert_eq!(media_control_bar_seek_ratio(50.0), 0.5);
        assert_eq!(media_control_bar_seek_ratio(100.0), 1.0);
        assert_eq!(media_control_bar_buffered_ratio(25.0), 0.25);
        // Mutting pins the volume track to zero while the remembered volume
        // stays untouched (Vue: `muted ? 0 : volume`).
        assert_eq!(media_control_bar_volume_ratio(false, 0.8), 0.8);
        assert_eq!(media_control_bar_volume_ratio(true, 0.8), 0.0);
        assert_eq!(media_control_bar_volume_ratio(true, 0.0), 0.0);
    }

    #[test]
    fn media_control_bar_seek_arms_follow_the_duration() {
        assert!(!media_control_bar_seek_disabled(false, 12.0));
        assert!(media_control_bar_seek_disabled(true, 12.0));
        // An unloaded / unknown duration cannot be scrubbed.
        assert!(media_control_bar_seek_disabled(false, 0.0));
        assert!(media_control_bar_seek_disabled(false, -1.0));
    }

    #[test]
    fn media_control_bar_muted_glyph_follows_mute_and_zero_volume() {
        assert!(media_control_bar_shows_muted_glyph(true, 0.8));
        assert!(media_control_bar_shows_muted_glyph(false, 0.0));
        assert!(!media_control_bar_shows_muted_glyph(false, 0.8));
        assert!(media_control_bar_shows_muted_glyph(true, 0.0));
    }

    #[test]
    fn media_control_bar_rate_label_matches_the_vue_interpolation() {
        // Vue renders `{props.rate}x`, i.e. JS's shortest number rendering.
        assert_eq!(media_control_bar_rate_label(0.5), "0.5x");
        assert_eq!(media_control_bar_rate_label(1.0), "1x");
        assert_eq!(media_control_bar_rate_label(1.25), "1.25x");
        assert_eq!(media_control_bar_rate_label(1.5), "1.5x");
        assert_eq!(media_control_bar_rate_label(2.0), "2x");
    }

    #[test]
    fn media_control_bar_labels_resolve_to_english() {
        // No locale is installed in a unit test, so `t` answers its English
        // fallback — the same words Vue passes.
        assert_eq!(media_control_bar_play_label(false), "Play");
        assert_eq!(media_control_bar_play_label(true), "Pause");
        assert_eq!(media_control_bar_mute_label(false), "Mute");
        assert_eq!(media_control_bar_mute_label(true), "Unmute");
        assert_eq!(media_control_bar_fullscreen_label(false), "Fullscreen");
        assert_eq!(media_control_bar_fullscreen_label(true), "Exit fullscreen");
        assert_eq!(media_control_bar_seek_label(), "Seek");
        assert_eq!(media_control_bar_volume_label(), "Volume");
        assert_eq!(media_control_bar_speed_label(), "Playback speed");
    }

    #[test]
    fn media_control_bar_renders_the_vue_dom_contract() {
        let html = MediaControlBar(MediaControlBarProps {
            playing: true,
            current: 5.0,
            duration: 65.0,
            progress: 25.0,
            buffered_pct: 50.0,
            volume: 0.5,
            rate: 1.25,
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains("hk-media-controls"), "{html}");
        // Play slot: ghost/sm button carrying the host hooks + the pause verb.
        assert!(html.contains("hk-media-btn hk-media-play"), "{html}");
        assert!(html.contains("hk-btn-ghost"), "{html}");
        assert!(html.contains("hk-btn-sm"), "{html}");
        assert!(html.contains(r#"aria-label="Pause""#), "{html}");
        // Seek + volume tracks ride the slider component's own contract.
        assert!(
            html.contains("hk-media-slider hk-media-controls-seek"),
            "{html}"
        );
        assert!(
            html.contains("hk-media-slider hk-media-controls-vol"),
            "{html}"
        );
        assert!(html.contains(r#"aria-valuenow="25""#), "{html}");
        assert!(html.contains(r#"aria-valuenow="50""#), "{html}");
        assert!(html.contains(r#"aria-label="Seek""#), "{html}");
        assert!(html.contains(r#"aria-label="Volume""#), "{html}");
        // The time readout is a single text node.
        assert!(html.contains(">0:05 / 1:05<"), "{html}");
        assert!(html.contains("hk-media-volume"), "{html}");
        // Rate verb carries the visible `{rate}x` label.
        assert!(html.contains("hk-media-rate"), "{html}");
        assert!(html.contains(">1.25x<"), "{html}");
        assert!(html.contains(r#"aria-label="Playback speed""#), "{html}");
        // The video-only fullscreen verb is withheld for the audio player.
        assert!(!html.contains("Fullscreen"), "{html}");
        // Three transport buttons: play, mute, rate.
        assert_eq!(count(&html, "hk-media-btn"), 3, "{html}");
    }

    #[test]
    fn media_control_bar_shows_the_fullscreen_verb_for_video() {
        let html = MediaControlBar(MediaControlBarProps {
            show_fullscreen: true,
            duration: 90.0,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"aria-label="Fullscreen""#), "{html}");
        assert_eq!(count(&html, "hk-media-btn"), 4, "{html}");

        let html = MediaControlBar(MediaControlBarProps {
            show_fullscreen: true,
            is_fullscreen: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"aria-label="Exit fullscreen""#), "{html}");
    }

    #[test]
    fn media_control_bar_disables_the_seek_track_without_a_duration() {
        let html = MediaControlBar(MediaControlBarProps::default()).render_to_html();
        assert!(
            html.contains("hk-media-slider is-disabled hk-media-controls-seek"),
            "{html}"
        );
        // The volume track is never disabled by the bar.
        assert!(
            !html.contains("is-disabled hk-media-controls-vol"),
            "{html}"
        );
        // Unknown duration reads `0:00 / 0:00`.
        assert!(html.contains(">0:00 / 0:00<"), "{html}");
    }

    #[test]
    fn media_control_bar_styles_come_from_the_canonical_vue_sheet() {
        let css = MediaControlBarComponent::styles();
        for needle in [
            ".hk-media-controls",
            ".hk-media-btn.hk-btn",
            ".hk-media-play.hk-btn",
            ".hk-media-controls-seek",
            ".hk-media-time",
            ".hk-media-volume",
            ".hk-media-controls-vol",
            ".hk-media-rate",
        ] {
            assert!(
                css.contains(needle),
                "media-control-bar css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored media-control-bar sheet"
        );
    }
}
