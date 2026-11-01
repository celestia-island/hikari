// hi-components/src/display/countdown_digit.rs
// CountdownDigit — mirror of the canonical Vue `HkCountdownDigit`: a single
// rolling countdown cell ("5s", "4s", …) that flips the outgoing digit up and
// the incoming one in.
//
// Source mirrored: `packages/vue/src/components/HkCountdownDigit.tsx`.
// SHEET: the Vue component ships NO stylesheet. It is self-contained: every
// visual lives in an inline `style` attribute and the two keyframes ride an
// inline `<style>` element, so the emitted classes (`hk-countdown-digit`,
// `hk-countdown-digit-slot`, `hk-flip-out`, `hk-flip-in`) are HOOKS only —
// nothing in the Vue library or the Rust bundle paints them. `styles()` is
// therefore `""` on purpose (see the assertion in the tests), and
// `styled.rs` must not expect CSS from this name.
//
// DOM contract (mirrors Vue one-to-one):
//
//   span.hk-countdown-digit            (inline: inline-flex, tabular-nums, 1em)
//     span.hk-countdown-digit-slot     (inline: relative, overflow:hidden, 1ch)
//         key={flip generation}         (Vue's `:key` — a new key re-creates
//                                        the slot so both keyframes restart)
//       span.hk-flip-out {previous digit}
//       span.hk-flip-in  {current digit}
//     span {"s"}                       (inline: 0.75em, opacity 0.6)
//     style {the two @keyframes}
//
// State home: tairitsu 0.5.22 has no per-instance component state (and the
// mirror forbids `use_signal` / `use_state`), so the previous digit and the
// flip generation live in a module `thread_local!` registry keyed by
// [`CountdownDigitProps::instance_key`] — the pattern
// `basic/rolling_number.rs` uses. Without a key every instance shares one
// default slot; pass distinct keys when two countdown digits render at once.
//
// Deltas vs Vue (documented):
//   * `String(props.value)` is mirrored for the countdown range — integers,
//     plain decimals, `±0`, `NaN`, `±Infinity`. Extreme magnitudes (≥1e21) use
//     Rust's plain-decimal form instead of JS's exponent form.
//   * Vue bumps `key` on every value change, which re-creates the slot pair;
//     the mirror keys the slot by the registry's flip generation, which is the
//     same guarantee through tairitsu's keyed child diff (`vnode::diff`).
//   * Vue keeps the stale `oldDigit` in the DOM after the flip plays out; the
//     mirror's registry stores only the last label, so a re-render of an
//     unchanged value renders the resting pair (out == into). The flip-out
//     span is `animation-fill-mode: both`, so it is invisible either way — the
//     visible end state is identical.
//   * no unmount hook exists, so the registry entry is never released (same
//     trade-off as rolling_number: a remounted instance re-uses its slot).

use std::cell::RefCell;
use std::collections::HashMap;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct CountdownDigitComponent;

/// Root inline style (Vue's inline object, kebab-cased).
const COUNTDOWN_DIGIT_ROOT_STYLE: &str = "display:inline-flex;align-items:center;gap:0;font-variant-numeric:tabular-nums;height:1em;line-height:1;font-weight:700";

/// The flip window's inline style: one `1ch` cell, overflow hidden.
const COUNTDOWN_DIGIT_SLOT_STYLE: &str = "position:relative;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;height:1em;width:1ch";

/// Outgoing digit (flips up and fades out).
const COUNTDOWN_DIGIT_OUT_STYLE: &str =
    "display:block;line-height:1;animation:hk-flip-out 0.3s cubic-bezier(0.4,0,0.2,1) both";

/// Incoming digit (slides up from below).
const COUNTDOWN_DIGIT_IN_STYLE: &str = "display:block;line-height:1;position:absolute;inset:0;animation:hk-flip-in 0.3s cubic-bezier(0.4,0,0.2,1) both";

/// The trailing lowercase unit.
const COUNTDOWN_DIGIT_UNIT_STYLE: &str = "font-size:0.75em;opacity:0.6;font-weight:400";

/// The keyframes Vue injects per instance, byte-identical (the sheet-less
/// contract depends on them being in the component's own `<style>` element).
const COUNTDOWN_DIGIT_KEYFRAMES: &str = "@keyframes hk-flip-out { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-1em); opacity: 0; } } @keyframes hk-flip-in { 0% { transform: translateY(1em); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }";

/// The flip pair of one render: the outgoing slice (Vue's `oldDigit`), the
/// incoming slice (Vue's `newDigit`), the slot generation (Vue's `key`) and
/// whether the value actually moved.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct CountdownFrame {
    pub out: String,
    pub into: String,
    pub generation: u32,
    pub changed: bool,
}

/// Vue's `String(props.value)` for the countdown range (see the header delta
/// for the extreme-magnitude exception).
pub fn countdown_digit_label(value: f64) -> String {
    if value.is_nan() {
        return "NaN".to_string();
    }
    if value.is_infinite() {
        return if value.is_sign_negative() {
            "-Infinity".to_string()
        } else {
            "Infinity".to_string()
        };
    }
    // JS `String(-0)` is "0"; Rust renders "-0".
    if value == 0.0 {
        return "0".to_string();
    }
    value.to_string()
}

/// The pure flip-pair derivation (Vue's `watch(() => props.value)`): the first
/// render pairs the value with itself at generation 0, a change carries the
/// previous label out and bumps the generation, a repeated value is a no-op.
pub fn countdown_frame(label: &str, previous: Option<&str>, generation: u32) -> CountdownFrame {
    match previous {
        Some(previous) if previous != label => CountdownFrame {
            out: previous.to_string(),
            into: label.to_string(),
            generation: generation.wrapping_add(1),
            changed: true,
        },
        Some(previous) => CountdownFrame {
            out: previous.to_string(),
            into: label.to_string(),
            generation,
            changed: false,
        },
        None => CountdownFrame {
            out: label.to_string(),
            into: label.to_string(),
            generation,
            changed: false,
        },
    }
}

/// One instance's flip memory (Vue keeps `oldDigit` / `newDigit` / `key` in the
/// setup scope).
#[derive(Default)]
struct CountdownDigitSlot {
    label: Option<String>,
    generation: u32,
}

thread_local! {
    static COUNTDOWN_DIGITS: RefCell<HashMap<String, CountdownDigitSlot>> =
        RefCell::new(HashMap::new());
}

/// Feed one rendered label through the flip state machine and return the frame
/// to draw.
fn countdown_digit_frame(instance_key: &str, label: &str) -> CountdownFrame {
    COUNTDOWN_DIGITS.with(|slots| {
        let mut slots = slots.borrow_mut();
        let slot = slots.entry(instance_key.to_string()).or_default();
        let frame = countdown_frame(label, slot.label.as_deref(), slot.generation);
        slot.label = Some(label.to_string());
        slot.generation = frame.generation;
        frame
    })
}

#[define_props]
pub struct CountdownDigitProps {
    /// The countdown value (Vue: `value`, Number, default 0).
    #[default(0.0)]
    pub value: f64,

    /// Mirror-only: instance identity for the flip registry (see the header
    /// state note). Vue keeps the same state inside the component instance.
    #[default]
    pub instance_key: String,
}

#[component]
pub fn CountdownDigit(props: CountdownDigitProps) -> Element {
    let label = countdown_digit_label(props.value);
    let frame = countdown_digit_frame(&props.instance_key, &label);

    let slot = VElement::new("span")
        .class("hk-countdown-digit-slot")
        .style(COUNTDOWN_DIGIT_SLOT_STYLE)
        // Vue's `:key` bump: a new key makes the diff drop the old slot and
        // mount a fresh one, restarting both keyframes from 0%.
        .key(&frame.generation.to_string())
        .child(VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-flip-out")
                .style(COUNTDOWN_DIGIT_OUT_STYLE)
                .child(VNode::Text(VText::new(&frame.out))),
        )))
        .child(VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-flip-in")
                .style(COUNTDOWN_DIGIT_IN_STYLE)
                .child(VNode::Text(VText::new(&frame.into))),
        )));

    let root = VElement::new("span")
        .class("hk-countdown-digit")
        .style(COUNTDOWN_DIGIT_ROOT_STYLE)
        .child(VNode::Element(Box::new(slot)))
        .child(VNode::Element(Box::new(
            VElement::new("span")
                .style(COUNTDOWN_DIGIT_UNIT_STYLE)
                .child(VNode::Text(VText::new("s"))),
        )))
        .child(VNode::Element(Box::new(
            VElement::new("style").child(VNode::Text(VText::new(COUNTDOWN_DIGIT_KEYFRAMES))),
        )));

    VNode::Element(Box::new(root))
}

impl StyledComponent for CountdownDigitComponent {
    /// No Vue sheet exists for this component — every rule is inline and the
    /// keyframes ride the component's own `<style>` element (see the header).
    fn styles() -> &'static str {
        ""
    }

    fn name() -> &'static str {
        "countdown-digit"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn countdown_digit_label_matches_js_string_of_number() {
        assert_eq!(countdown_digit_label(0.0), "0");
        assert_eq!(countdown_digit_label(-0.0), "0");
        assert_eq!(countdown_digit_label(5.0), "5");
        assert_eq!(countdown_digit_label(4.5), "4.5");
        assert_eq!(countdown_digit_label(-3.0), "-3");
        assert_eq!(countdown_digit_label(f64::NAN), "NaN");
        assert_eq!(countdown_digit_label(f64::INFINITY), "Infinity");
        assert_eq!(countdown_digit_label(f64::NEG_INFINITY), "-Infinity");
    }

    #[test]
    fn countdown_frame_initial_render_pairs_the_value_with_itself() {
        let frame = countdown_frame("5", None, 0);
        assert_eq!(frame.out, "5");
        assert_eq!(frame.into, "5");
        assert_eq!(frame.generation, 0);
        assert!(!frame.changed);
    }

    #[test]
    fn countdown_frame_carries_the_previous_slice_out_and_bumps_the_generation() {
        let frame = countdown_frame("4", Some("5"), 0);
        assert_eq!(frame.out, "5");
        assert_eq!(frame.into, "4");
        assert_eq!(frame.generation, 1);
        assert!(frame.changed);
    }

    #[test]
    fn countdown_frame_is_a_no_op_for_a_repeated_value() {
        let frame = countdown_frame("4", Some("4"), 3);
        assert_eq!(frame.out, "4");
        assert_eq!(frame.into, "4");
        assert_eq!(frame.generation, 3);
        assert!(!frame.changed);
    }

    #[test]
    fn countdown_digit_defaults_match_the_vue_props() {
        let props = CountdownDigitProps::default();
        assert_eq!(props.value, 0.0);
        assert_eq!(props.instance_key, "");
    }

    #[test]
    fn countdown_digit_renders_the_flip_pair_unit_and_keyframes() {
        let html = CountdownDigit(CountdownDigitProps {
            value: 5.0,
            instance_key: "render-contract".to_string(),
        })
        .render_to_html();
        for needle in [
            "hk-countdown-digit",
            "hk-countdown-digit-slot",
            "hk-flip-out",
            "hk-flip-in",
            "@keyframes hk-flip-out",
            "@keyframes hk-flip-in",
            "font-variant-numeric:tabular-nums",
            "width:1ch",
            ">s</span>",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Both flip spans carry the value on the first render.
        assert_eq!(html.matches(">5</span>").count(), 2, "{html}");
    }

    #[test]
    fn countdown_digit_flip_carries_the_previous_slice_after_a_change() {
        let first = CountdownDigit(CountdownDigitProps {
            value: 5.0,
            instance_key: "flip-change".to_string(),
        })
        .render_to_html();
        assert!(first.contains(">5</span>"), "{first}");

        let second = CountdownDigit(CountdownDigitProps {
            value: 4.0,
            instance_key: "flip-change".to_string(),
        })
        .render_to_html();
        assert!(
            second.contains("hk-flip-out"),
            "the outgoing span must stay mounted: {second}"
        );
        assert!(
            second.contains(">5</span>") && second.contains(">4</span>"),
            "the flip pair must carry old 5 and new 4: {second}"
        );
    }

    #[test]
    fn countdown_digit_has_no_sheet() {
        // The Vue component ships no stylesheet and the classes are hooks only;
        // `styles()` staying empty is the contract, not an omission.
        assert_eq!(CountdownDigitComponent::styles(), "");
        assert!(!CountdownDigitComponent::styles().contains("CSS generation failed"));
    }
}
