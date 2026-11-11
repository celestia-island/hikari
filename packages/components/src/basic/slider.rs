// hi-components/src/basic/slider.rs
// Slider — mirror of the canonical Vue `HkSlider` (the form/settings range
// control; the hover-only `HkMediaSlider` seek primitive is a different
// component and has no Rust mirror here).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkSlider.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-slider*` class names are literal and
// identical in both forms. DOM contract (mirrors Vue one-to-one):
//
//   div.hk-slider[.is-disabled]  data-size={sm|md} role="slider"
//         tabindex={0|-1} aria-label aria-valuemin aria-valuemax
//         aria-valuenow aria-valuetext [aria-disabled]
//         style="--hk-slider-rail-inset:{inset}px" (the inset rail geometry)
//         (mousedown/move/up, keydown — see the L88 delta below)
//     span.hk-slider-tick [data-active] style="left:calc(F% ± Npx)"
//         aria-hidden="true"
//     div.hk-slider-fill   style="width:calc(F% - Npx)"
//     div.hk-slider-thumb  style="left:calc(F% ± Npx)"
//
// Rail geometry (2026-11-11, mirrored from Vue): the drawable rail is
// inset by the thumb radius at each end, so a thumb parked on the
// first/last stop rests ON the rail, the endpoint tick dot centers sit
// one dot-radius further inside (never past the caps), and the fill
// starts FLAT at the rail edge with a rounded end cap. The sheet
// consumes the inline `--hk-slider-rail-inset` var for the track/fill
// edges; the position strings are the linear calc expansion of
// `inset + (100% - 2·inset)·f` (identical geometry, cssstyle-stable).
//
// Vue prop mapping: `modelValue` → [`SliderProps::value`]; `showTicks` →
// [`SliderProps::show_ticks`]; `ariaLabel` → [`SliderProps::aria_label`];
// `formatValue` → [`SliderProps::format_value`] (the `aria-valuetext`
// formatter, a `Callback` because its return type is not unit);
// `update:modelValue` → [`SliderProps::on_input`], emitted continuously while
// dragging and once per keyboard step, exactly like Vue's live emit. The value
// math is Vue's, helper by helper: `snap()` / `pct` / `ticks` / `valueText` all
// live in the free functions below so they are testable without a DOM.
//
// State is controlled-only (value / min / max / step / disabled in, one
// callback out), so no tairitsu `Signal`/`use_state` is involved. The only
// non-reactive bit is the drag flag, a module-level `thread_local!` cell (the house
// pattern from `feedback/tooltip.rs`) — it never drives rendering.
//
// Deltas vs Vue (documented):
// * MOUSE-FAMILY BINDINGS. The track binds `mousedown` / `mousemove` /
//   `mouseup` and every handler takes a `MouseEvent`. Wire update: the
//   pointer family is typed on this wire since tairitsu 0.5.24 (ledger
//   L88's never-fires window is closed), so the mouse-only choice is a
//   convention, not a platform necessity. Consequences unchanged: a touch
//   screen produces no `mousemove` sequence, so TOUCH dragging is
//   unavailable (a tap still sets the value), and this channel has no
//   `pointercancel`.
// * Vue attaches the drag's `pointermove` / `pointerup` / `pointercancel`
//   listeners to `window` on mount so a drag keeps tracking outside the track.
//   A component here cannot own window listeners — `tairitsu_vdom::DomOps` is
//   element-scoped, with no document/window registration seam — and
//   `setPointerCapture` is not exposed, so tracking rides the root element's
//   own mouse events: a drag that leaves the track stops emitting until the
//   pointer returns.
// * A RELEASE OUTSIDE THE TRACK IS NOT LOST, it is recovered from the button
//   state: the root `mouseup` ends a release inside the track, and a
//   `mousemove` reporting `buttons == 0` ends a drag whose release happened
//   elsewhere (Vue's window `pointerup` edge). Without that guard the drag flag
//   would stay armed and a later HOVER would write values. This is the same
//   `buttons == 0` fallback `display/media_slider.rs`, `scene/minimap.rs` and
//   `basic/color_picker.rs` carry. A gesture the browser ABORTS (a touch-scroll
//   takeover) has no mouse-channel edge of its own, but the flag is never
//   permanently stuck: both edges above clear it.
// * Vue measures its `trackRef` with `getBoundingClientRect()`. The mirror uses
//   the host-provided measurement for the event's `currentTarget` handle
//   (`tairitsu_vdom::get_bounding_client_rect`); when the host cannot measure
//   (non-DOM build → zero rect) the pointer arms degrade to a no-op instead of
//   emitting a bogus value. Keyboard stepping is unaffected.
// * The legacy Rust `Slider` is retired: it rendered `hk-slider-rail` /
//   `hk-slider-track` / `hk-slider-handle` plus a hidden native
//   `<input type=range>`, took integer (`i32`) bounds and `on_change`; Vue's
//   component is the canonical shape (float math, `on_input`, ticks, aria
//   surface), so those shells, the hidden input, `SliderSize::Large` (Vue has
//   only `sm` / `md`) and the `on_change` name are gone. `value` is `f64` and
//   defaults to `0.0` because Rust props must be `Default`-constructible (Vue
//   declares `modelValue` required).

use std::cell::Cell;

use tairitsu_vdom::{DomHandle, get_bounding_client_rect};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SliderComponent;

/// The two track sizes (Vue: `"sm" | "md"`, default `md`) — `data-size`.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SliderSize {
    Sm,
    #[default]
    Md,
}

impl SliderSize {
    /// The root's `data-size` value exactly as Vue emits it.
    pub fn data_size(self) -> &'static str {
        match self {
            SliderSize::Sm => "sm",
            SliderSize::Md => "md",
        }
    }
}

/// Vue's `safeStep`: a non-positive step falls back to `1`.
pub fn slider_safe_step(step: f64) -> f64 {
    if step > 0.0 { step } else { 1.0 }
}

/// JS `Math.round` — ties round toward `+∞`, while `f64::round` rounds ties
/// away from zero (which would snap negative step counts the other way).
fn js_round(value: f64) -> f64 {
    (value + 0.5).floor()
}

/// JS `Number(value.toFixed(6))` — the float-drift killer Vue applies after
/// snapping. `f64::INFINITY` / `NaN` stringify to text Rust cannot parse back;
/// those keep the un-truncated value instead of panicking.
fn js_to_fixed6(value: f64) -> f64 {
    format!("{value:.6}").parse::<f64>().unwrap_or(value)
}

thread_local! {
    /// Whether a pointer drag is in flight (single-pointer, wasm single-thread).
    static SLIDER_DRAGGING: Cell<bool> = const { Cell::new(false) };
}

fn slider_is_dragging() -> bool {
    SLIDER_DRAGGING.with(|flag| flag.get())
}

fn set_slider_dragging(value: bool) {
    SLIDER_DRAGGING.with(|flag| flag.set(value));
}

/// Vue: `Math.min(max, Math.max(min, value))`. A degenerate `min > max`
/// resolves to `max` like the JS expression (where `f64::clamp` would panic).
fn slider_clamp(value: f64, min: f64, max: f64) -> f64 {
    if min > max {
        return max;
    }
    value.clamp(min, max)
}

/// Vue's `snap()`: round onto the `min + n * step` grid, kill float drift with
/// `toFixed(6)`, then clamp into `[min, max]`.
pub fn slider_snap(value: f64, min: f64, max: f64, step: f64) -> f64 {
    let safe_step = slider_safe_step(step);
    let snapped = min + js_round((value - min) / safe_step) * safe_step;
    slider_clamp(js_to_fixed6(snapped), min, max)
}

/// The thumb/fill position as a percentage of the `[min, max]` span; `0` for a
/// degenerate range (Vue: `span > 0 ? … : 0`).
pub fn slider_pct(value: f64, min: f64, max: f64) -> f64 {
    let span = max - min;
    if span > 0.0 {
        (value - min) / span * 100.0
    } else {
        0.0
    }
}

/// The drawable rail's end inset in px: the thumb radius per size (the sheet
/// draws 14px md / 12px sm thumbs). Must match Vue's `RAIL_INSET_PX` and the
/// sheet's thumb diameters.
pub fn slider_rail_inset_px(size: SliderSize) -> f64 {
    match size {
        SliderSize::Sm => 6.0,
        SliderSize::Md => 7.0,
    }
}

/// Vue round4: `Math.round(n * 1e4) / 1e4` — kills the float dust of the
/// linear calc expansion (ties toward +∞ like `js_round`).
fn round4(value: f64) -> f64 {
    js_round(value * 1e4) / 1e4
}

/// A position ON the inset rail (thumb center; tick centers pass one
/// dot-radius as `extra_inset_px` so the endpoint dots stay inside the
/// caps). Emitted as the linear calc expansion of
/// `inset + (100% - 2·inset)·f` — the exact string Vue emits.
pub fn slider_rail_pos(fraction: f64, inset_px: f64, extra_inset_px: f64) -> String {
    let inset = inset_px + extra_inset_px;
    let percent = round4(fraction * 100.0);
    let px = round4(inset * (1.0 - 2.0 * fraction));
    if px < 0.0 {
        format!("calc({percent}% - {}px)", px.abs())
    } else {
        format!("calc({percent}% + {px}px)")
    }
}

/// The fill width along the inset rail: `railLength·f` as `calc(F% - Npx)`.
pub fn slider_rail_width(fraction: f64, inset_px: f64) -> String {
    let percent = round4(fraction * 100.0);
    let px = round4(inset_px * 2.0 * fraction);
    format!("calc({percent}% - {px}px)")
}

/// One tick per step, as `left` percentages; bare for degenerate ranges and for
/// unreadable tick density (Vue: `count < 2 || count > 32`).
pub fn slider_tick_positions(min: f64, max: f64, step: f64, show_ticks: bool) -> Vec<f64> {
    if !show_ticks {
        return Vec::new();
    }
    let count = js_round((max - min) / slider_safe_step(step));
    if count < 2.0 || count > 32.0 {
        return Vec::new();
    }
    let count = count as usize;
    (0..=count)
        .map(|index| (index as f64 / count as f64) * 100.0)
        .collect()
}

/// `aria-valuetext`: the host formatter when given, otherwise the number's
/// shortest round-trip rendering (Vue: `String(value)`).
pub fn slider_value_text(value: f64, format: Option<&Callback<f64, String>>) -> String {
    match format {
        Some(formatter) => formatter.call(value),
        None => value.to_string(),
    }
}

/// The snapped value at a pointer ratio across the INSET rail span — Vue's
/// `valueFrom()` minus the rect lookup (`ratio` is already
/// `(clientX - left - inset) / (width - 2·inset)`).
pub fn slider_value_from_ratio(ratio: f64, min: f64, max: f64, step: f64) -> f64 {
    let ratio = ratio.clamp(0.0, 1.0);
    slider_snap(min + ratio * (max - min), min, max, step)
}

/// The pointer's `0..1` ratio across the measured INSET rail, or `None` when
/// the host cannot measure the element (non-DOM builds report a zero-width
/// rect) or the rail is degenerate (element thinner than both insets).
/// The pointer's `0..1` ratio across an INSET rail of `rect_width` px whose
/// left edge sits at `rect_x` — Vue's `valueFrom()` mapping minus the DOM
/// lookup. `None` when the rail is degenerate (zero-width element, or
/// thinner than both insets): the caller keeps the current value instead of
/// inventing a position. A pure function so the mapping (which only has a
/// DOM seam in production) stays mutation-testable.
pub fn slider_pointer_ratio(
    client_x: f64,
    rect_x: f64,
    rect_width: f64,
    inset_px: f64,
) -> Option<f64> {
    let rail = rect_width - inset_px * 2.0;
    if rect_width <= 0.0 || rail <= 0.0 {
        return None;
    }
    Some(((client_x - rect_x - inset_px) / rail).clamp(0.0, 1.0))
}

/// The DOM seam: the host-provided measurement for the event's
/// `currentTarget` handle feeds [`slider_pointer_ratio`].
fn pointer_ratio(client_x: i32, current_target: Option<u64>, inset_px: f64) -> Option<f64> {
    let handle = current_target?;
    let rect = get_bounding_client_rect(DomHandle::from_raw(handle));
    slider_pointer_ratio(f64::from(client_x), rect.x, rect.width, inset_px)
}

#[define_props]
pub struct SliderProps {
    /// Controlled value (Vue: `modelValue`, required there; `0.0` here because
    /// Rust props need a `Default`).
    #[default(0.0)]
    pub value: f64,

    #[default(0.0)]
    pub min: f64,

    #[default(100.0)]
    pub max: f64,

    /// Snap step; non-positive values fall back to `1` (Vue's `safeStep`).
    #[default(1.0)]
    pub step: f64,

    #[default]
    pub disabled: bool,

    /// Render one tick dot per stop (Vue: `showTicks`).
    #[default]
    pub show_ticks: bool,

    #[default]
    pub size: SliderSize,

    /// `aria-label` (Vue: `ariaLabel`); omitted when `None`.
    pub aria_label: Option<String>,

    /// `aria-valuetext` formatter (Vue: `formatValue`).
    pub format_value: Option<Callback<f64, String>>,

    /// Emitted with the snapped value while interacting (Vue:
    /// `update:modelValue`, emitted continuously like Vue's drag/keyboard path).
    pub on_input: Option<EventHandler<f64>>,

    /// Vue attribute fallthrough onto the root `<div>`.
    #[default]
    pub class: String,

    #[default]
    pub style: String,
}

#[component]
pub fn Slider(props: SliderProps) -> Element {
    let min = props.min;
    let max = props.max;
    let step = props.step;
    let disabled = props.disabled;

    // Vue: value = snap(min(max(modelValue, min), max)) — clamp first, then snap.
    let value = slider_snap(slider_clamp(props.value, min, max), min, max, step);
    let pct = slider_pct(value, min, max);
    let ticks = slider_tick_positions(min, max, step, props.show_ticks);
    let value_text = slider_value_text(value, props.format_value.as_ref());
    // The inset-rail geometry (2026-11-11, mirrored from Vue): one number
    // feeds the inline var, the position strings and the pointer mapping.
    let rail_inset = slider_rail_inset_px(props.size);

    let mut root_classes = String::from("hk-slider");
    if disabled {
        root_classes.push_str(" is-disabled");
    }
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    // Drag flag: NON-reactive by design (it never drives rendering). It lives
    // in a module registry rather than a per-render `Rc<Cell<bool>>`: a value
    // change re-renders this component mid-drag, and a fresh cell would read
    // `false` forever after (while the stale closures kept flipping a dead
    // cell). One pointer drags one slider at a time, so a singleton is exact.

    // Vue's `commit()`: emit only when the snapped value actually moves.
    let on_input = props.on_input.clone();
    let commit = move |next: f64| {
        if next == value {
            return;
        }
        if let Some(handler) = on_input.as_ref() {
            handler.call(next);
        }
    };

    let commit_down = commit.clone();
    let handle_mouse_down = move |event: MouseEvent| {
        if disabled {
            return;
        }
        set_slider_dragging(true);
        if let Some(ratio) = pointer_ratio(event.client_x, event.current_target, rail_inset) {
            commit_down(slider_value_from_ratio(ratio, min, max, step));
        }
    };

    let commit_move = commit.clone();
    let handle_mouse_move = move |event: MouseEvent| {
        if disabled || !slider_is_dragging() {
            return;
        }
        // Vue's window `pointerup`: a move with no button held means the drag
        // ended OUTSIDE this track, so the flag must clear instead of staying
        // armed (which would keep writing values on later hovers).
        if event.buttons == 0 {
            set_slider_dragging(false);
            return;
        }
        if let Some(ratio) = pointer_ratio(event.client_x, event.current_target, rail_inset) {
            commit_move(slider_value_from_ratio(ratio, min, max, step));
        }
    };

    let handle_mouse_up = move |_: MouseEvent| set_slider_dragging(false);

    // Vue's keyboard map: arrows step once, PageUp/Down step 4×, Home/End jump.
    let commit_key = commit.clone();
    let handle_keydown = move |event: KeyboardEvent| {
        if disabled {
            return;
        }
        let safe_step = slider_safe_step(step);
        let big = safe_step * 4.0;
        // `KeyboardEvent::key` is a field on tairitsu 0.5.22.
        let next = match event.key.as_str() {
            "ArrowRight" | "ArrowUp" => value + safe_step,
            "ArrowLeft" | "ArrowDown" => value - safe_step,
            "PageUp" => value + big,
            "PageDown" => value - big,
            "Home" => min,
            "End" => max,
            _ => return,
        };
        event.prevent_default();
        commit_key(slider_snap(next, min, max, step));
    };

    // Ticks are pre-built: an rsx `for` body cannot host a `let` block.
    let tick_nodes: Vec<VNode> = ticks
        .iter()
        .map(|left| {
            let active = *left <= pct + 0.001;
            rsx! {
                span {
                    class: "hk-slider-tick",
                    "data-active": if active { Some("") } else { None },
                    style: format!("left:{}", slider_rail_pos(left / 100.0, rail_inset, 1.0)),
                    "aria-hidden": "true",
                }
            }
        })
        .collect();

    rsx! {
        div {
            class: root_classes,
            style: if props.style.is_empty() {
                format!("--hk-slider-rail-inset:{rail_inset}px")
            } else {
                format!("{};--hk-slider-rail-inset:{rail_inset}px", props.style)
            },
            "data-size": props.size.data_size(),
            "role": "slider",
            tabindex: if disabled { -1_i32 } else { 0 },
            "aria-label": props.aria_label.clone(),
            "aria-valuemin": min,
            "aria-valuemax": max,
            "aria-valuenow": value,
            "aria-valuetext": value_text,
            "aria-disabled": if disabled { Some("true") } else { None },
            onmousedown: handle_mouse_down,
            onmousemove: handle_mouse_move,
            onmouseup: handle_mouse_up,
            onkeydown: handle_keydown,
            {VNode::Fragment(tick_nodes)}
            div {
                class: "hk-slider-fill",
                style: format!("width:{}", slider_rail_width(pct / 100.0, rail_inset)),
            }
            div {
                class: "hk-slider-thumb",
                style: format!("left:{}", slider_rail_pos(pct / 100.0, rail_inset, 0.0)),
            }
        }
    }
}

impl StyledComponent for SliderComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-slider*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkSlider.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "slider"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slider_size_tokens_match_the_vue_data_sizes() {
        assert_eq!(SliderSize::Sm.data_size(), "sm");
        assert_eq!(SliderSize::Md.data_size(), "md");
        assert_eq!(SliderSize::default(), SliderSize::Md);
    }

    #[test]
    fn slider_snap_matches_the_vue_math() {
        // On-grid values stay put; off-grid values land on the nearest stop.
        assert_eq!(slider_snap(50.0, 0.0, 100.0, 1.0), 50.0);
        assert_eq!(slider_snap(50.4, 0.0, 100.0, 1.0), 50.0);
        assert_eq!(slider_snap(50.6, 0.0, 100.0, 1.0), 51.0);
        // Ties round toward +inf, JS-style (f64::round would too at +.5 here).
        assert_eq!(slider_snap(50.5, 0.0, 100.0, 1.0), 51.0);
        // The step grid is anchored at min, not at 0.
        assert_eq!(slider_snap(7.0, 5.0, 15.0, 2.0), 7.0);
        assert_eq!(slider_snap(8.0, 5.0, 15.0, 2.0), 9.0);
        // Out-of-range input clamps into [min, max].
        assert_eq!(slider_snap(-40.0, 0.0, 100.0, 1.0), 0.0);
        assert_eq!(slider_snap(400.0, 0.0, 100.0, 1.0), 100.0);
        // A non-positive step falls back to 1 (Vue's safeStep).
        assert_eq!(slider_snap(3.2, 0.0, 100.0, 0.0), 3.0);
        // Float drift is truncated to six decimals, like `Number(toFixed(6))`.
        assert_eq!(slider_snap(0.30000000000000004, 0.0, 1.0, 0.1), 0.3);
    }

    #[test]
    fn slider_pct_matches_the_vue_span_math() {
        assert_eq!(slider_pct(0.0, 0.0, 100.0), 0.0);
        assert_eq!(slider_pct(50.0, 0.0, 100.0), 50.0);
        assert_eq!(slider_pct(100.0, 0.0, 100.0), 100.0);
        assert_eq!(slider_pct(5.0, 5.0, 15.0), 0.0);
        assert_eq!(slider_pct(10.0, 5.0, 15.0), 50.0);
        // Degenerate span renders at the start, never a division blow-up.
        assert_eq!(slider_pct(10.0, 10.0, 10.0), 0.0);
    }

    #[test]
    fn slider_ticks_match_the_vue_density_guard() {
        assert!(slider_tick_positions(0.0, 100.0, 1.0, false).is_empty());
        let ticks = slider_tick_positions(0.0, 4.0, 1.0, true);
        assert_eq!(ticks, vec![0.0, 25.0, 50.0, 75.0, 100.0]);
        // count < 2 → bare.
        assert!(slider_tick_positions(0.0, 1.0, 1.0, true).is_empty());
        // count > 32 → bare.
        assert!(slider_tick_positions(0.0, 40.0, 1.0, true).is_empty());
    }

    #[test]
    fn slider_value_text_uses_the_host_formatter() {
        assert_eq!(slider_value_text(50.0, None), "50");
        assert_eq!(slider_value_text(0.5, None), "0.5");
        let percent = Callback::new(|value: f64| format!("{value}%"));
        assert_eq!(slider_value_text(50.0, Some(&percent)), "50%");
    }

    #[test]
    fn slider_value_from_ratio_matches_the_vue_pointer_math() {
        assert_eq!(slider_value_from_ratio(0.0, 0.0, 100.0, 1.0), 0.0);
        assert_eq!(slider_value_from_ratio(1.0, 0.0, 100.0, 1.0), 100.0);
        assert_eq!(slider_value_from_ratio(0.5, 0.0, 100.0, 1.0), 50.0);
        assert_eq!(slider_value_from_ratio(0.5, 10.0, 20.0, 1.0), 15.0);
        // The ratio itself clamps, so a pointer past either end saturates.
        assert_eq!(slider_value_from_ratio(-2.0, 0.0, 100.0, 1.0), 0.0);
        assert_eq!(slider_value_from_ratio(9.0, 0.0, 100.0, 1.0), 100.0);
    }

    #[test]
    fn slider_rail_geometry_matches_the_vue_emission() {
        // Inset = thumb radius per size (the sheet's 14px md / 12px sm).
        assert_eq!(slider_rail_inset_px(SliderSize::Md), 7.0);
        assert_eq!(slider_rail_inset_px(SliderSize::Sm), 6.0);
        // Thumb center rides the rail; mid-rail is the pure center.
        assert_eq!(slider_rail_pos(0.5, 7.0, 0.0), "calc(50% + 0px)");
        assert_eq!(slider_rail_width(0.5, 7.0), "calc(50% - 7px)");
        // Endpoint stops park the thumb ON the rail (never past the cap).
        assert_eq!(slider_rail_pos(0.0, 7.0, 0.0), "calc(0% + 7px)");
        assert_eq!(slider_rail_pos(1.0, 7.0, 0.0), "calc(100% - 7px)");
        // Tick centers carry the extra dot radius: flush INSIDE the caps.
        assert_eq!(slider_rail_pos(0.0, 7.0, 1.0), "calc(0% + 8px)");
        assert_eq!(slider_rail_pos(1.0, 7.0, 1.0), "calc(100% - 8px)");
        // sm geometry.
        assert_eq!(slider_rail_pos(0.0, 6.0, 1.0), "calc(0% + 7px)");
        assert_eq!(slider_rail_pos(1.0, 6.0, 0.0), "calc(100% - 6px)");
        assert_eq!(slider_rail_width(1.0, 6.0), "calc(100% - 12px)");
        // A value at 30% on the md rail (slider_field's HTML assertion).
        assert_eq!(slider_rail_width(0.3, 7.0), "calc(30% - 4.2px)");
        assert_eq!(slider_rail_pos(0.3, 7.0, 0.0), "calc(30% + 2.8px)");
        // Float dust is rounded away before formatting (no 4.2000000001px).
        assert_eq!(
            slider_rail_pos(0.123456789, 7.0, 0.0),
            "calc(12.3457% + 5.2716px)"
        );
    }

    #[test]
    fn slider_defaults_match_the_vue_props() {
        let props = SliderProps::default();
        assert_eq!(props.value, 0.0);
        assert_eq!(props.min, 0.0);
        assert_eq!(props.max, 100.0);
        assert_eq!(props.step, 1.0);
        assert!(!props.disabled);
        assert!(!props.show_ticks);
        assert_eq!(props.size, SliderSize::Md);
        assert_eq!(props.aria_label, None);
        assert_eq!(props.format_value, None);
        assert_eq!(props.on_input, None);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn slider_renders_the_vue_shell_for_every_prop_arm() {
        let plain = Slider(SliderProps::default());
        assert!(
            !matches!(plain, VNode::Text(_)),
            "default render is an element"
        );

        let _ = Slider(SliderProps {
            value: 40.0,
            show_ticks: true,
            aria_label: Some("Volume".to_string()),
            format_value: Some(Callback::new(|value: f64| format!("{value}%"))),
            on_input: Some(EventHandler::new(|_| {})),
            ..Default::default()
        });
        let _ = Slider(SliderProps {
            value: 1.5,
            min: 0.5,
            max: 2.5,
            step: 0.25,
            size: SliderSize::Sm,
            disabled: true,
            class: "host".to_string(),
            style: "margin-top:2px".to_string(),
            ..Default::default()
        });
    }

    #[test]
    fn slider_pointer_ratio_maps_into_the_inset_rail() {
        // 200px rect, 7px insets → a 186px drawable rail.
        assert_eq!(slider_pointer_ratio(7.0, 0.0, 200.0, 7.0), Some(0.0));
        assert_eq!(slider_pointer_ratio(193.0, 0.0, 200.0, 7.0), Some(1.0));
        assert_eq!(slider_pointer_ratio(100.0, 0.0, 200.0, 7.0), Some(0.5));
        // Presses past either rail end saturate (not extrapolate).
        assert_eq!(slider_pointer_ratio(0.0, 0.0, 200.0, 7.0), Some(0.0));
        assert_eq!(slider_pointer_ratio(250.0, 0.0, 200.0, 7.0), Some(1.0));
        // The minimap press case: (46-7)/186 — the OLD full-width mapping
        // would say 46/200 = 0.23; the inset mapping must NOT.
        let ratio = slider_pointer_ratio(46.0, 0.0, 200.0, 7.0).unwrap();
        assert!((ratio - (46.0 - 7.0) / 186.0).abs() < 1e-9);
        assert!((ratio - 0.23).abs() > 0.01);
        // Degenerate rails keep the current value (None → no emit).
        assert_eq!(slider_pointer_ratio(100.0, 0.0, 0.0, 7.0), None);
        assert_eq!(slider_pointer_ratio(100.0, 0.0, 10.0, 7.0), None);
    }

    #[test]
    fn slider_renders_rail_inset_ticks_inside_the_caps() {
        let html = Slider(SliderProps {
            value: 0.0,
            min: 0.0,
            max: 100.0,
            step: 25.0,
            show_ticks: true,
            ..Default::default()
        })
        .render_to_html();
        // Endpoint tick centers carry the dot-radius inset (md): flush
        // INSIDE the rail caps, never past them.
        assert!(html.contains(r#"style="left:calc(0% + 8px)""#), "{html}");
        assert!(html.contains(r#"style="left:calc(100% - 8px)""#), "{html}");
        // Five stops render five ticks.
        assert_eq!(html.matches("hk-slider-tick").count(), 5, "{html}");
        // The value sits on the first stop: its tick is active.
        assert!(html.contains("data-active"), "{html}");
    }

    #[test]
    fn slider_clamps_before_snapping_like_vue() {
        // Vue: snap(clamp(value)) — an out-of-range value lands on the snap
        // grid inside the range (10 → snap(10)=9 on a step-3 grid from 0..10),
        // NOT at the clamped endpoint.
        let html = Slider(SliderProps {
            value: 100.0,
            min: 0.0,
            max: 10.0,
            step: 3.0,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"aria-valuenow="9""#), "{html}");
        assert!(
            html.contains(r#"style="width:calc(90% - 12.6px)""#),
            "{html}"
        );
    }

    #[test]
    fn slider_degenerate_range_does_not_panic() {
        let _ = Slider(SliderProps {
            value: 5.0,
            min: 10.0,
            max: 0.0,
            ..Default::default()
        });
    }

    #[test]
    fn slider_styles_come_from_the_canonical_vue_sheet() {
        let css = SliderComponent::styles();
        for needle in [
            ".hk-slider",
            ".hk-slider-fill",
            ".hk-slider-thumb",
            ".hk-slider-tick",
            "data-active",
            ".is-disabled",
        ] {
            assert!(
                css.contains(needle),
                "slider css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored slider sheet"
        );
    }
}
