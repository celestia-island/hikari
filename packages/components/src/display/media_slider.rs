// packages/components/src/display/media_slider.rs
// MediaSlider — mirror of the canonical Vue `HkMediaSlider` (the generic
// draggable `0..1` track both the seek bar and the volume track are built on).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkMediaSlider.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so every
// `.hk-media-slider*` class name is literal and identical in both forms.
//
// DOM contract (mirrors Vue's render output one-to-one):
//
//   div.hk-media-slider [.is-disabled] data-size={md|sm} role="slider"
//          tabindex="-1" [aria-label] aria-valuenow aria-valuemin="0"
//          aria-valuemax="100" [+host class]   (pointerdown/move/up/cancel)
//     div.hk-media-slider-buffered style="width:{buffered*100}%"   (buffered > 0)
//     div.hk-media-slider-fill     style="width:{ratio*100}%"
//     div.hk-media-slider-thumb    style="left:{ratio*100}%"
//
// Vue prop mapping: `ratio` → [`MediaSliderProps::ratio`], `buffered` /
// `disabled` / `ariaLabel` / `size` one-to-one, `update:ratio` →
// [`MediaSliderProps::on_update_ratio`]. The position math is Vue's helper by
// helper: `ratioFrom` / the `${n*100}%` templates / `Math.round(ratio*100)`
// all live in the free functions below so they are testable without a DOM.
//
// State contract (the tairitsu 0.5.22 limit this wave works under): the only
// non-reactive bit is the drag flag, a module-level `thread_local!` cell (the
// house pattern from `basic/slider.rs`) — it never drives rendering, so no
// `Signal`/`use_state` is involved. The track value itself is controlled-only:
// `ratio` in, one callback out.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * Vue attaches `pointermove` / `pointerup` / `pointercancel` to `window` on
//     mount so a drag keeps tracking outside the track, and calls
//     `setPointerCapture`. A component here cannot own window listeners and
//     pointer capture is not exposed, so tracking rides the root element's own
//     pointer events: a drag that leaves the track stops emitting until the
//     pointer returns; `up` / `cancel` on the root still end the drag.
//   * Vue measures its `trackRef` with `getBoundingClientRect()`. The mirror
//     uses the host-provided measurement of the event's `currentTarget`
//     (`tairitsu_vdom::get_bounding_client_rect`); when the host cannot
//     measure (non-DOM build → zero rect) the pointer arms degrade to a no-op
//     instead of emitting a bogus ratio.
//   * The rendered widths/offsets are NOT clamped here: Vue paints
//     `ratio * 100`% verbatim and leaves clamping to the pointer path and the
//     owning player (`media_player::media_player_progress_pct`).

use tairitsu_vdom::{DomHandle, PointerEvent, get_bounding_client_rect};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct MediaSliderComponent;

/// The two track heights (Vue: `"md" | "sm"`, default `md`) — `data-size`.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MediaSliderSize {
    #[default]
    Md,
    Sm,
}

impl MediaSliderSize {
    /// The root's `data-size` value exactly as Vue emits it.
    pub fn token(self) -> &'static str {
        match self {
            MediaSliderSize::Md => "md",
            MediaSliderSize::Sm => "sm",
        }
    }
}

/// Vue's `ratioFrom(event)`: clamp the pointer position across the measured
/// track into `0..1`. A zero-width rect (an unmeasurable host) answers `0`,
/// never a division blow-up.
pub fn media_slider_ratio_from_pointer(client_x: f64, rect_left: f64, rect_width: f64) -> f64 {
    if rect_width <= 0.0 {
        return 0.0;
    }
    ((client_x - rect_left) / rect_width).clamp(0.0, 1.0)
}

/// The `${ratio * 100}%` template Vue hands the inline style. Rust's shortest
/// float rendering matches JS's `String(n)` for every value these props carry.
pub fn media_slider_css_pct(ratio: f64) -> String {
    format!("{}%", ratio * 100.0)
}

/// `aria-valuenow={Math.round(ratio * 100)}`. JS `Math.round` rounds ties
/// toward `+∞`, while `f64::round` rounds them away from zero — the ratio is
/// non-negative, but the helper stays exact for the clamped domain.
pub fn media_slider_aria_value(ratio: f64) -> i64 {
    if !ratio.is_finite() {
        return 0;
    }
    (ratio * 100.0 + 0.5).floor() as i64
}

/// The root class list: `.hk-media-slider`, the `is-disabled` modifier, then
/// the host class last (Vue's attribute fallthrough order).
pub fn media_slider_root_classes(disabled: bool, class: &str) -> String {
    let mut classes = String::from("hk-media-slider");
    if disabled {
        classes.push_str(" is-disabled");
    }
    if !class.is_empty() {
        classes.push(' ');
        classes.push_str(class);
    }
    classes
}

thread_local! {
    /// WHICH sliders are being dragged, keyed by [`MediaSliderProps::instance_key`].
    /// A single global flag would make every slider on the page share the drag
    /// (a seek drag sliding over the volume bar would emit volume ratios), and
    /// an outside release could leave it stuck `true` forever.
    static MEDIA_SLIDER_DRAGGING: std::cell::RefCell<std::collections::BTreeSet<String>> =
        const { std::cell::RefCell::new(std::collections::BTreeSet::new()) };
}

fn media_slider_is_dragging(instance_key: &str) -> bool {
    MEDIA_SLIDER_DRAGGING.with(|set| set.borrow().contains(instance_key))
}

fn set_media_slider_dragging(instance_key: &str, value: bool) {
    MEDIA_SLIDER_DRAGGING.with(|set| {
        let mut set = set.borrow_mut();
        if value {
            set.insert(instance_key.to_string());
        } else {
            set.remove(instance_key);
        }
    });
}

/// The pointer's `0..1` ratio across the measured track, or `None` when the
/// host cannot measure the element (non-DOM builds report a zero-width rect).
fn media_slider_pointer_ratio(client_x: i32, current_target: Option<u64>) -> Option<f64> {
    let handle = current_target?;
    let rect = get_bounding_client_rect(DomHandle::from_raw(handle));
    if rect.width <= 0.0 {
        return None;
    }
    Some(media_slider_ratio_from_pointer(
        f64::from(client_x),
        rect.x,
        rect.width,
    ))
}

#[define_props]
pub struct MediaSliderProps {
    /// Registry slot for the drag flag — one entry per slider instance (see
    /// the module header's state contract).
    #[default]
    pub instance_key: String,

    /// Controlled position across the track, `0..1` (required upstream;
    /// `0.0` here because Rust props need a `Default`).
    #[default(0.0)]
    pub ratio: f64,

    /// Secondary (buffered) fill behind the played fill, `0..1`; the bar is
    /// only rendered above zero, exactly like Vue.
    #[default(0.0)]
    pub buffered: f64,

    #[default]
    pub disabled: bool,

    /// `aria-label` (Vue: `ariaLabel`); omitted when `None`.
    pub aria_label: Option<String>,

    #[default]
    pub size: MediaSliderSize,

    /// Vue attribute fallthrough onto the root `<div>`: the control bar's
    /// `.hk-media-controls-seek` / `.hk-media-controls-vol` hooks ride here.
    #[default]
    pub class: String,

    /// Emitted continuously while dragging (Vue: `update:ratio`).
    pub on_update_ratio: Option<EventHandler<f64>>,
}

#[component]
pub fn MediaSlider(props: MediaSliderProps) -> Element {
    let disabled = props.disabled;

    // Vue's `commit`: forward the freshly measured ratio.
    let on_update = props.on_update_ratio.clone();
    let commit = move |ratio: f64| {
        if let Some(handler) = on_update.as_ref() {
            handler.call(ratio);
        }
    };

    let drag_key_down = props.instance_key.clone();
    let commit_down = commit.clone();
    let handle_pointer_down = move |event: PointerEvent| {
        if disabled {
            return;
        }
        set_media_slider_dragging(&drag_key_down, true);
        if let Some(ratio) = media_slider_pointer_ratio(event.client_x, event.current_target) {
            commit_down(ratio);
        }
    };

    let drag_key_move = props.instance_key.clone();
    let commit_move = commit.clone();
    let handle_pointer_move = move |event: PointerEvent| {
        if disabled || !media_slider_is_dragging(&drag_key_move) {
            return;
        }
        // Vue's window `pointerup`: a move with no held button means the drag
        // ended OUTSIDE this slider, so the flag must clear instead of staying
        // stuck (which would keep emitting on later hovers).
        if event.buttons == 0 {
            set_media_slider_dragging(&drag_key_move, false);
            return;
        }
        if let Some(ratio) = media_slider_pointer_ratio(event.client_x, event.current_target) {
            commit_move(ratio);
        }
    };

    let drag_key_up = props.instance_key.clone();
    let handle_pointer_up = move |_: PointerEvent| set_media_slider_dragging(&drag_key_up, false);
    let drag_key_cancel = props.instance_key.clone();
    let handle_pointer_cancel =
        move |_: PointerEvent| set_media_slider_dragging(&drag_key_cancel, false);

    let fill_style = format!("width:{}", media_slider_css_pct(props.ratio));
    let thumb_style = format!("left:{}", media_slider_css_pct(props.ratio));
    let buffered_style = format!("width:{}", media_slider_css_pct(props.buffered));
    let aria_value = media_slider_aria_value(props.ratio).to_string();

    rsx! {
        div {
            class: media_slider_root_classes(disabled, &props.class),
            "data-size": props.size.token(),
            "role": "slider",
            tabindex: -1_i32,
            "aria-label": props.aria_label.clone(),
            "aria-valuenow": aria_value,
            "aria-valuemin": "0",
            "aria-valuemax": "100",
            onpointerdown: handle_pointer_down,
            onpointermove: handle_pointer_move,
            onpointerup: handle_pointer_up,
            onpointercancel: handle_pointer_cancel,
            if props.buffered > 0.0 {
                div {
                    class: "hk-media-slider-buffered",
                    style: buffered_style,
                }
            }
            div {
                class: "hk-media-slider-fill",
                style: fill_style,
            }
            div {
                class: "hk-media-slider-thumb",
                style: thumb_style,
            }
        }
    }
}

impl StyledComponent for MediaSliderComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-media-slider*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkMediaSlider.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "media-slider"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn count(haystack: &str, needle: &str) -> usize {
        haystack.matches(needle).count()
    }

    #[test]
    fn media_slider_size_tokens_match_the_vue_data_sizes() {
        assert_eq!(MediaSliderSize::Md.token(), "md");
        assert_eq!(MediaSliderSize::Sm.token(), "sm");
        assert_eq!(MediaSliderSize::default(), MediaSliderSize::Md);
    }

    #[test]
    fn media_slider_defaults_match_the_vue_props() {
        let props = MediaSliderProps::default();
        assert_eq!(props.ratio, 0.0);
        assert_eq!(props.buffered, 0.0);
        assert!(!props.disabled);
        assert_eq!(props.aria_label, None);
        assert_eq!(props.size, MediaSliderSize::Md);
        assert_eq!(props.class, "");
        assert!(props.on_update_ratio.is_none());
    }

    #[test]
    fn media_slider_ratio_from_pointer_clamps_into_the_track() {
        // Halfway, both ends, and out-of-track pointers saturate.
        assert_eq!(media_slider_ratio_from_pointer(250.0, 200.0, 100.0), 0.5);
        assert_eq!(media_slider_ratio_from_pointer(200.0, 200.0, 100.0), 0.0);
        assert_eq!(media_slider_ratio_from_pointer(300.0, 200.0, 100.0), 1.0);
        assert_eq!(media_slider_ratio_from_pointer(0.0, 200.0, 100.0), 0.0);
        assert_eq!(media_slider_ratio_from_pointer(900.0, 200.0, 100.0), 1.0);
        // A zero/negative-width rect answers 0 instead of dividing by zero.
        assert_eq!(media_slider_ratio_from_pointer(250.0, 200.0, 0.0), 0.0);
        assert_eq!(media_slider_ratio_from_pointer(250.0, 200.0, -10.0), 0.0);
    }

    #[test]
    fn media_slider_aria_value_uses_js_rounding() {
        assert_eq!(media_slider_aria_value(0.0), 0);
        assert_eq!(media_slider_aria_value(0.5), 50);
        assert_eq!(media_slider_aria_value(1.0), 100);
        // Ties round toward +∞ (JS `Math.round`), not to even.
        assert_eq!(media_slider_aria_value(0.005), 1);
        assert_eq!(media_slider_aria_value(0.125), 13);
        // Non-finite input cannot produce a bogus aria value.
        assert_eq!(media_slider_aria_value(f64::NAN), 0);
        assert_eq!(media_slider_aria_value(f64::INFINITY), 0);
    }

    #[test]
    fn media_slider_css_pct_matches_the_vue_template() {
        assert_eq!(media_slider_css_pct(0.0), "0%");
        assert_eq!(media_slider_css_pct(0.25), "25%");
        assert_eq!(media_slider_css_pct(0.5), "50%");
        assert_eq!(media_slider_css_pct(1.0), "100%");
        // No clamping in the paint path — Vue interpolates the raw ratio.
        assert_eq!(media_slider_css_pct(1.25), "125%");
    }

    #[test]
    fn media_slider_root_classes_carry_the_disabled_and_host_modifiers() {
        assert_eq!(media_slider_root_classes(false, ""), "hk-media-slider");
        assert_eq!(
            media_slider_root_classes(true, ""),
            "hk-media-slider is-disabled"
        );
        assert_eq!(
            media_slider_root_classes(false, "hk-media-controls-seek"),
            "hk-media-slider hk-media-controls-seek"
        );
        assert_eq!(
            media_slider_root_classes(true, "hk-media-controls-vol"),
            "hk-media-slider is-disabled hk-media-controls-vol"
        );
    }

    #[test]
    fn media_slider_renders_the_vue_dom_contract() {
        let html = MediaSlider(MediaSliderProps {
            ratio: 0.25,
            buffered: 0.5,
            aria_label: Some("Seek".to_string()),
            class: "hk-media-controls-seek".to_string(),
            ..Default::default()
        })
        .render_to_html();

        assert!(
            html.contains("hk-media-slider hk-media-controls-seek"),
            "{html}"
        );
        assert!(html.contains(r#"data-size="md""#), "{html}");
        assert!(html.contains(r#"role="slider""#), "{html}");
        assert!(html.contains(r#"tabindex="-1""#), "{html}");
        assert!(html.contains(r#"aria-label="Seek""#), "{html}");
        assert!(html.contains(r#"aria-valuenow="25""#), "{html}");
        assert!(html.contains(r#"aria-valuemin="0""#), "{html}");
        assert!(html.contains(r#"aria-valuemax="100""#), "{html}");
        // The secondary fill only exists above zero (Vue's `buffered > 0`).
        assert_eq!(count(&html, "hk-media-slider-buffered"), 1, "{html}");
        assert!(html.contains("width:50%"), "{html}");
        assert!(html.contains("hk-media-slider-fill"), "{html}");
        assert!(html.contains("width:25%"), "{html}");
        assert!(html.contains("hk-media-slider-thumb"), "{html}");
        assert!(html.contains("left:25%"), "{html}");
    }

    #[test]
    fn media_slider_omits_the_buffered_bar_at_zero_and_marks_disabled() {
        let html = MediaSlider(MediaSliderProps {
            ratio: 1.0,
            disabled: true,
            size: MediaSliderSize::Sm,
            ..Default::default()
        })
        .render_to_html();

        assert!(!html.contains("hk-media-slider-buffered"), "{html}");
        assert!(html.contains("hk-media-slider is-disabled"), "{html}");
        assert!(html.contains(r#"data-size="sm""#), "{html}");
        assert!(html.contains(r#"aria-valuenow="100""#), "{html}");
        assert!(html.contains("width:100%"), "{html}");
        assert!(html.contains("left:100%"), "{html}");
        // No aria-label attribute at all when the host gives none.
        assert!(!html.contains("aria-label"), "{html}");
    }

    #[test]
    fn media_slider_styles_come_from_the_canonical_vue_sheet() {
        let css = MediaSliderComponent::styles();
        // Selector spelling stays quote-agnostic here: the mirrored sheet is
        // compiled by the scss macro, so only the names/hooks are asserted.
        for needle in [
            ".hk-media-slider",
            ".hk-media-slider-buffered",
            ".hk-media-slider-fill",
            ".hk-media-slider-thumb",
            "data-size",
            ".is-disabled",
        ] {
            assert!(
                css.contains(needle),
                "media-slider css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored media-slider sheet"
        );
    }
}
