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
//          aria-valuemax="100" [+host class]   (mousedown/move/up — L88 delta)
//     (root carries an inline --hk-media-slider-rail-inset:{6}px var)
//     div.hk-media-slider-buffered style="width:calc(F% - Npx)"  (buffered > 0)
//     div.hk-media-slider-fill     style="width:calc(F% - Npx)"
//     div.hk-media-slider-thumb    style="left:calc(F% ± Npx)"
//
// Rail geometry (2026-11-11, mirrored from Vue): the drawable rail is inset
// by the thumb radius (6px) at each end — a thumb parked on 0/1 rests ON the
// rail and the fill starts flat at the rail edge (a rounded cap on a thin
// saturated bar reads as a pointed nib).
//
// Vue prop mapping: `ratio` → [`MediaSliderProps::ratio`], `buffered` /
// `disabled` / `ariaLabel` / `size` one-to-one, `update:ratio` →
// [`MediaSliderProps::on_update_ratio`]. The position math is Vue's helper by
// helper: `ratioFrom` / the rail calc emitters / `Math.round(ratio*100)`
// all live in the free functions below so they are testable without a DOM.
//
// State contract (the tairitsu 0.5.22 limit this wave works under): the only
// non-reactive bit is the drag flag, a module-level `thread_local!` cell (the
// house pattern from `basic/slider.rs`) — it never drives rendering, so no
// `Signal`/`use_state` is involved. The track value itself is controlled-only:
// `ratio` in, one callback out.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * MOUSE-FAMILY BINDINGS. The track binds `mousedown` / `mousemove` /
//     `mouseup` and every handler takes a `MouseEvent`. Wire update: the
//     pointer family is typed on this wire since tairitsu 0.5.24 (ledger
//     L88's never-fires window is closed), so the mouse-only choice is a
//     convention, not a platform necessity. Consequences unchanged: a touch
//     screen produces no `mousemove` sequence, so TOUCH seeking is
//     unavailable (a tap still seeks), and this channel has no
//     `pointercancel`.
//   * Vue attaches `pointermove` / `pointerup` / `pointercancel` to `window` on
//     mount so a drag keeps tracking outside the track, and calls
//     `setPointerCapture`. A component here cannot own window listeners —
//     `tairitsu_vdom::DomOps` is element-scoped, with no document/window
//     registration seam — and pointer capture is not exposed, so tracking rides
//     the root element's own mouse events: a drag that leaves the track stops
//     emitting until the pointer returns.
//   * A RELEASE OUTSIDE THE TRACK IS NOT LOST: the root `mouseup` ends a
//     release inside the track, and a `mousemove` reporting `buttons == 0` ends
//     a drag whose release happened elsewhere (Vue's window `pointerup` edge,
//     recovered from the button state — the same guard `basic/slider.rs`,
//     `scene/minimap.rs` and `basic/color_picker.rs` carry).
//   * Vue measures its `trackRef` with `getBoundingClientRect()`. The mirror
//     uses the host-provided measurement of the event's `currentTarget`
//     (`tairitsu_vdom::get_bounding_client_rect`); when the host cannot
//     measure (non-DOM build → zero rect) the pointer arms degrade to a no-op
//     instead of emitting a bogus ratio.
//   * The rendered widths/offsets are NOT clamped here: Vue paints
//     `ratio * 100`% verbatim and leaves clamping to the pointer path and the
//     owning player (`media_player::media_player_progress_pct`).

use tairitsu_vdom::{DomHandle, get_bounding_client_rect};

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

/// The thumb radius: the thumb is 12px at every size (the sheet's
/// `.hk-media-slider-thumb`), so the drawable rail insets 6px per end. Must
/// match Vue's `RAIL_INSET_PX` and the sheet's inline var fallback
/// (`--hk-media-slider-rail-inset`).
pub const MEDIA_SLIDER_RAIL_INSET_PX: f64 = 6.0;

/// Vue round4: `Math.round(n * 1e4) / 1e4` — kills the float dust of the
/// linear calc expansion (ties toward +∞ like JS `Math.round`).
fn media_slider_round4(value: f64) -> f64 {
    (value * 1e4 + 0.5).floor() / 1e4
}

/// Vue's `ratioFrom(event)`: clamp the pointer position across the measured
/// INSET rail into `0..1` (2026-11-11 rail-inset geometry — a thumb parked on
/// 0/1 must rest ON the rail). A zero-width rect, or one thinner than both
/// insets (an unmeasurable host), answers `0`, never a division blow-up.
pub fn media_slider_ratio_from_pointer(
    client_x: f64,
    rect_left: f64,
    rect_width: f64,
    inset_px: f64,
) -> f64 {
    let rail = rect_width - inset_px * 2.0;
    if rect_width <= 0.0 || rail <= 0.0 {
        return 0.0;
    }
    ((client_x - rect_left - inset_px) / rail).clamp(0.0, 1.0)
}

/// The fill/buffered width along the rail: `railLength·f` as the linear
/// calc expansion `calc(F% - Npx)` — the exact string Vue emits (Rust's
/// shortest float rendering matches JS number-to-string here).
pub fn media_slider_rail_width(ratio: f64, inset_px: f64) -> String {
    let px = media_slider_round4(inset_px * 2.0 * ratio);
    format!("calc({}% - {px}px)", media_slider_round4(ratio * 100.0))
}

/// The thumb center ON the rail: `inset + railLength·f` as
/// `calc(F% ± Npx)`.
pub fn media_slider_rail_pos(ratio: f64, inset_px: f64) -> String {
    let px = media_slider_round4(inset_px * (1.0 - 2.0 * ratio));
    let op = if px < 0.0 { " - " } else { " + " };
    format!(
        "calc({}%{op}{}px)",
        media_slider_round4(ratio * 100.0),
        px.abs()
    )
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
        MEDIA_SLIDER_RAIL_INSET_PX,
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
    let handle_mouse_down = move |event: MouseEvent| {
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
    let handle_mouse_move = move |event: MouseEvent| {
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
    let handle_mouse_up = move |_: MouseEvent| set_media_slider_dragging(&drag_key_up, false);

    let fill_style = format!(
        "width:{}",
        media_slider_rail_width(props.ratio, MEDIA_SLIDER_RAIL_INSET_PX)
    );
    let thumb_style = format!(
        "left:{}",
        media_slider_rail_pos(props.ratio, MEDIA_SLIDER_RAIL_INSET_PX)
    );
    let buffered_style = format!(
        "width:{}",
        media_slider_rail_width(props.buffered, MEDIA_SLIDER_RAIL_INSET_PX)
    );
    let aria_value = media_slider_aria_value(props.ratio).to_string();

    rsx! {
        div {
            class: media_slider_root_classes(disabled, &props.class),
            style: format!("--hk-media-slider-rail-inset:{MEDIA_SLIDER_RAIL_INSET_PX}px"),
            "data-size": props.size.token(),
            "role": "slider",
            tabindex: -1_i32,
            "aria-label": props.aria_label.clone(),
            "aria-valuenow": aria_value,
            "aria-valuemin": "0",
            "aria-valuemax": "100",
            onmousedown: handle_mouse_down,
            onmousemove: handle_mouse_move,
            onmouseup: handle_mouse_up,
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
    fn media_slider_ratio_from_pointer_clamps_into_the_inset_rail() {
        // 200px rect, 6px insets → a 188px drawable rail.
        assert_eq!(
            media_slider_ratio_from_pointer(206.0, 200.0, 200.0, 6.0),
            0.0
        );
        assert_eq!(
            media_slider_ratio_from_pointer(394.0, 200.0, 200.0, 6.0),
            1.0
        );
        assert_eq!(
            media_slider_ratio_from_pointer(300.0, 200.0, 200.0, 6.0),
            0.5
        );
        // Out-of-rail pointers saturate (never extrapolate).
        assert_eq!(media_slider_ratio_from_pointer(0.0, 200.0, 200.0, 6.0), 0.0);
        assert_eq!(
            media_slider_ratio_from_pointer(900.0, 200.0, 200.0, 6.0),
            1.0
        );
        // A zero/negative-width rect, or one thinner than both insets,
        // answers 0 instead of dividing by zero.
        assert_eq!(media_slider_ratio_from_pointer(250.0, 200.0, 0.0, 6.0), 0.0);
        assert_eq!(
            media_slider_ratio_from_pointer(250.0, 200.0, -10.0, 6.0),
            0.0
        );
        assert_eq!(
            media_slider_ratio_from_pointer(250.0, 200.0, 10.0, 6.0),
            0.0
        );
    }

    #[test]
    fn media_slider_rail_emission_matches_the_vue_strings() {
        // Endpoints park the thumb ON the rail; the fill closes it off.
        assert_eq!(media_slider_rail_width(0.0, 6.0), "calc(0% - 0px)");
        assert_eq!(media_slider_rail_width(1.0, 6.0), "calc(100% - 12px)");
        assert_eq!(media_slider_rail_pos(0.0, 6.0), "calc(0% + 6px)");
        assert_eq!(media_slider_rail_pos(1.0, 6.0), "calc(100% - 6px)");
        // Quarter/half values (the html contract tests' ratios).
        assert_eq!(media_slider_rail_width(0.25, 6.0), "calc(25% - 3px)");
        assert_eq!(media_slider_rail_width(0.5, 6.0), "calc(50% - 6px)");
        assert_eq!(media_slider_rail_pos(0.25, 6.0), "calc(25% + 3px)");
        assert_eq!(media_slider_rail_pos(0.5, 6.0), "calc(50% + 0px)");
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
        // The inset-rail geometry: the rail var on the root, the buffered
        // and fill widths anchored at the rail start, the thumb ON the rail.
        assert!(html.contains("--hk-media-slider-rail-inset:6px"), "{html}");
        assert!(html.contains("width:calc(50% - 6px)"), "{html}");
        assert!(html.contains("hk-media-slider-fill"), "{html}");
        assert!(html.contains("width:calc(25% - 3px)"), "{html}");
        assert!(html.contains("hk-media-slider-thumb"), "{html}");
        assert!(html.contains("left:calc(25% + 3px)"), "{html}");
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
        assert!(html.contains("width:calc(100% - 12px)"), "{html}");
        assert!(html.contains("left:calc(100% - 6px)"), "{html}");
        // No aria-label attribute at all when the host gives none.
        assert!(!html.contains("aria-label"), "{html}");
    }

    #[test]
    fn media_slider_drag_registry_is_per_instance() {
        // R3 M5b restored the global-flag behaviour and every gate stayed green;
        // this pins the per-key semantics (one slider never marks another).
        set_media_slider_dragging("a", true);
        assert!(media_slider_is_dragging("a"));
        assert!(!media_slider_is_dragging("b"));
        set_media_slider_dragging("b", true);
        set_media_slider_dragging("a", false);
        assert!(!media_slider_is_dragging("a"));
        assert!(media_slider_is_dragging("b"));
        set_media_slider_dragging("b", false);
        assert!(!media_slider_is_dragging("b"));
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
