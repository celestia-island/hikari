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
//         (pointerdown/move/up/cancel, keydown)
//     span.hk-slider-tick [data-active] style="left:{x}%" aria-hidden="true"
//     div.hk-slider-fill   style="width:{pct}%"
//     div.hk-slider-thumb  style="left:{pct}%"
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
// non-reactive bit is the drag flag, a plain `Rc<Cell<bool>>` (the house
// pattern from `feedback/tooltip.rs`) — it never drives rendering.
//
// Deltas vs Vue (documented):
// * Vue attaches the drag's `pointermove` / `pointerup` / `pointercancel`
//   listeners to `window` on mount so a drag keeps tracking outside the track.
//   A component here cannot own window listeners and `setPointerCapture` is not
//   exposed, so tracking rides the root element's own pointer events: a drag
//   that leaves the track stops emitting until the pointer returns. `up` /
//   `cancel` on the root still end the drag.
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
use std::rc::Rc;

use tairitsu_vdom::{DomHandle, PointerEvent, get_bounding_client_rect};

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

/// The snapped value at a pointer ratio across the span — Vue's `valueFrom()`
/// minus the rect lookup (`ratio` is already `(clientX - left) / width`).
pub fn slider_value_from_ratio(ratio: f64, min: f64, max: f64, step: f64) -> f64 {
    let ratio = ratio.clamp(0.0, 1.0);
    slider_snap(min + ratio * (max - min), min, max, step)
}

/// The pointer's `0..1` ratio across the measured track, or `None` when the
/// host cannot measure the element (non-DOM builds report a zero-width rect).
fn pointer_ratio(client_x: i32, current_target: Option<u64>) -> Option<f64> {
    let handle = current_target?;
    let rect = get_bounding_client_rect(DomHandle::from_raw(handle));
    if rect.width <= 0.0 {
        return None;
    }
    Some(((f64::from(client_x) - rect.x) / rect.width).clamp(0.0, 1.0))
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

    let value = slider_snap(props.value, min, max, step);
    let pct = slider_pct(value, min, max);
    let ticks = slider_tick_positions(min, max, step, props.show_ticks);
    let value_text = slider_value_text(value, props.format_value.as_ref());

    let mut root_classes = String::from("hk-slider");
    if disabled {
        root_classes.push_str(" is-disabled");
    }
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    // Drag flag: plain non-reactive state (`Rc<Cell<bool>>`, house pattern from
    // `feedback/tooltip.rs`) — it never drives rendering, so no Signal.
    let dragging = Rc::new(Cell::new(false));

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

    let drag_down = Rc::clone(&dragging);
    let commit_down = commit.clone();
    let handle_pointer_down = move |event: PointerEvent| {
        if disabled {
            return;
        }
        drag_down.set(true);
        if let Some(ratio) = pointer_ratio(event.client_x, event.current_target) {
            commit_down(slider_value_from_ratio(ratio, min, max, step));
        }
    };

    let drag_move = Rc::clone(&dragging);
    let commit_move = commit.clone();
    let handle_pointer_move = move |event: PointerEvent| {
        if disabled || !drag_move.get() {
            return;
        }
        if let Some(ratio) = pointer_ratio(event.client_x, event.current_target) {
            commit_move(slider_value_from_ratio(ratio, min, max, step));
        }
    };

    let drag_up = Rc::clone(&dragging);
    let handle_pointer_up = move |_: PointerEvent| drag_up.set(false);

    let drag_cancel = Rc::clone(&dragging);
    let handle_pointer_cancel = move |_: PointerEvent| drag_cancel.set(false);

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
                    style: format!("left:{left}%"),
                    "aria-hidden": "true",
                }
            }
        })
        .collect();

    rsx! {
        div {
            class: root_classes,
            style: props.style.clone(),
            "data-size": props.size.data_size(),
            "role": "slider",
            tabindex: if disabled { -1_i32 } else { 0 },
            "aria-label": props.aria_label.clone(),
            "aria-valuemin": min,
            "aria-valuemax": max,
            "aria-valuenow": value,
            "aria-valuetext": value_text,
            "aria-disabled": if disabled { Some("true") } else { None },
            onpointerdown: handle_pointer_down,
            onpointermove: handle_pointer_move,
            onpointerup: handle_pointer_up,
            onpointercancel: handle_pointer_cancel,
            onkeydown: handle_keydown,
            {VNode::Fragment(tick_nodes)}
            div {
                class: "hk-slider-fill",
                style: format!("width:{pct}%"),
            }
            div {
                class: "hk-slider-thumb",
                style: format!("left:{pct}%"),
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
