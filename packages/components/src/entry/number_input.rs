// hi-components/src/entry/number_input.rs
// NumberInput — mirror of the canonical Vue `HkNumberInput`: the boxed number
// field (in-field affixes, native number semantics) carrying the shared
// `HkNumberSteppers` column.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkNumberInput.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so every `.hk-number-input*` / `.hk-input-label` name
// is literal and identical in both forms. DOM contract (mirrors Vue one-to-one;
// the deltas are marked [D]):
//
//   div.hk-number-input.hk-number-input-{sm|md|lg}
//        [.hk-number-input-disabled] [host class] (style: host style)
//     label.hk-input-label [for=id]                       [D] (label && !empty)
//       {label}
//     div.hk-number-input-inner
//       span.hk-number-input-prefix                        (slot wins over text)
//       input.hk-number-input-field
//             type="number" value={text} [min] [max] step={step}
//             [disabled] [placeholder] [id]
//             (oninput, onchange)
//       span.hk-number-input-suffix                        (slot wins over text)
//       NumberSteppers  (div.hk-number-input-steppers-{size}, always mounted;
//                        its buttons' `aria-label`s are that mirror's own
//                        contract — see `entry/number_steppers.rs`)
//
// Vue prop mapping: `modelValue` → [`NumberInputProps::value`],
// `min`/`max`/`step`/`disabled`/`placeholder`/`label`/`prefix`/`suffix`/`size`
// map one-to-one (`prefix`/`suffix` are the in-field TEXT props of the same
// name; the `#prefix`/`#suffix` slots arrive as
// [`NumberInputProps::prefix_slot`] / [`NumberInputProps::suffix_slot`] and win,
// exactly Vue's `slots.prefix || props.prefix`), and `update:modelValue` →
// [`NumberInputProps::oninput`].
//
// Behaviour, taken from Vue line by line (the free functions below are the
// testable kernels of it):
//   * `emitValue` CLAMPS only — it never snaps onto the step grid: a value
//     below `min` emits `min`, above `max` emits `max`, anything else emits
//     itself;
//   * the ± column is gated: `increment` does nothing unless
//     `max === undefined || modelValue < max` (mirror:
//     [`number_input_can_increment`]), `decrement` mirrors it against `min`
//     ([`number_input_can_decrement`]), and both then run the result through
//     `emitValue` (`value ± step`, clamped);
//   * typing goes `onInput → Number(target.value) → emitValue`;
//   * the columns render greyed at a dead end (`canUp` / `canDown`), so both
//     the button's `disabled` and the step guard come from one bound check.
//
// Deltas vs Vue (documented, not accidental):
//   * [D] CAPTION BINDING — Vue renders its caption as a bare
//     `<label class="hk-input-label">{label}</label>` with no `for`, so the
//     caption is not programmatically attached to the field. The mirror emits
//     `for={id}` (and the field's `id`) when the host passes
//     [`NumberInputProps::id`]; without it the label stays exactly Vue's
//     unbound caption (no generated id — tairitsu has no `useId()`).
//   * [D] `onchange` COMMIT CHANNEL — Vue has a single emit. The mirror splits
//     it: [`NumberInputProps::oninput`] is Vue's `update:modelValue` (per
//     keystroke and per step), while [`NumberInputProps::onchange`] fires on a
//     COMMIT only — the field's native `change` (blur / Enter) and every step
//     click. Both carry the same clamped value, so wiring only `oninput`
//     reproduces Vue exactly.
//   * [D] NON-FINITE COERCION — Vue forwards `Number(text)` verbatim, so
//     `"-"`, `"abc"` or a huge literal reach the model as `NaN`/`Infinity`.
//     The mirror never emits a non-finite value (props are `f64` and one `NaN`
//     poisons every later `<`/`>` bound test): the live path keeps JS's
//     `Number("") === 0` and drops an unparseable payload, the commit path also
//     drops an empty payload (the live path already reported it).
//   * [D] TEXT FORMATTING — Vue renders `value={modelValue}` (JS
//     `String(number)`). [`number_input_format`] matches it digit-for-digit
//     (`-0` normalized to `0`); magnitudes ≥ 1e21 print in full here instead of
//     JS's exponent notation — the browser normalizes the attribute anyway.
//   * the wrapper takes `class` / `style` attribute-fallthrough props (Vue
//     merges its own attrs), and `value` defaults to `0.0` because Rust props
//     must be `Default`-constructible (Vue declares `modelValue` required).
//
// Replaces the retired legacy `NumberInput` (this file, rewritten wholesale):
// the legacy build was an `InputWrapper` shell with `MdiIcon::Minus` /
// `MdiIcon::Plus` buttons, integer props (`value`/`min`/`max`/`step` as
// `i64`), a mandatory `EventHandler<i64> on_change`, an unwired
// `hk-palette` class family (`NumberInputClass`, `number-input-wrapper`) and a
// `Glow` preset — none of which exist in the Vue component. Retired with it:
// the `glow*` props, `NumberInputSize::to_wrapper_size`, the `InputWrapperItem`
// plumbing and the `type="text"` field (Vue uses `type="number"`, so the
// native arrow keys step and the native spin buttons are CSS-suppressed by the
// sheet). The `NumberInputSize` identifiers (`Small`/`Medium`/`Large`) survive
// unchanged, only their emitted classes are Vue's now; the enum itself lives in
// `entry/number_steppers.rs` next to the column that renders its size class.
//
// MIGRATION (this wave REPLACES the legacy Rust `NumberInput`): values are
// `f64` (Vue numbers) instead of integers, `min`/`max` are `Option<f64>`, the
// `glow*`/`GlowPreset` props are gone (no Vue counterpart), and the emit split
// follows Vue: `oninput` fires for every accepted value, `onchange` only on a
// commit (blur/Enter). Hosts comparing against a `props.value: i64` must widen.

use crate::entry::number_steppers::{
    NumberInputSize, NumberStepperDirection, NumberSteppers, NumberSteppersProps,
};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct NumberInputComponent;

/// Vue's `emitValue`, minus the emits: the value is CLAMPED onto the declared
/// bounds (never snapped to the step grid) and otherwise passed through.
/// `min` is tested first, exactly like the Vue source, so a degenerate
/// `min > max` resolves to `min` for a low value instead of panicking.
pub fn number_input_emit_value(value: f64, min: Option<f64>, max: Option<f64>) -> f64 {
    if let Some(min) = min
        && value < min
    {
        return min;
    }
    if let Some(max) = max
        && value > max
    {
        return max;
    }
    value
}

/// Vue's `canIncrement`: `max == null ? true : modelValue < max`.
pub fn number_input_can_increment(value: f64, max: Option<f64>) -> bool {
    max.is_none_or(|max| value < max)
}

/// Vue's `canDecrement`: `min == null ? true : modelValue > min`.
pub fn number_input_can_decrement(value: f64, min: Option<f64>) -> bool {
    min.is_none_or(|min| value > min)
}

/// Vue's `increment()` / `decrement()`: the direction is gated by its own
/// continuation flag, and an allowed step runs through
/// [`number_input_emit_value`]. `None` means "the button was dead — emit
/// nothing".
pub fn number_input_step_value(
    value: f64,
    min: Option<f64>,
    max: Option<f64>,
    step: f64,
    direction: NumberStepperDirection,
) -> Option<f64> {
    match direction {
        NumberStepperDirection::Up => {
            if !number_input_can_increment(value, max) {
                return None;
            }
            Some(number_input_emit_value(value + step, min, max))
        }
        NumberStepperDirection::Down => {
            if !number_input_can_decrement(value, min) {
                return None;
            }
            Some(number_input_emit_value(value - step, min, max))
        }
    }
}

/// The LIVE input path's coercion — JS `Number(text)`, which is `0` for an
/// empty/whitespace-only string. Non-finite results are dropped (see the
/// header delta): a `NaN` model value would silently break every bound test
/// downstream.
pub fn number_input_parse(text: &str) -> Option<f64> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        // JS: Number("") === Number("   ") === 0.
        return Some(0.0);
    }
    trimmed
        .parse::<f64>()
        .ok()
        .filter(|value| value.is_finite())
}

/// The COMMIT path's coercion (the mirror-only `onchange` channel): a commit
/// never invents a value, so an empty payload is ignored instead of becoming
/// `0`.
pub fn number_input_commit_parse(text: &str) -> Option<f64> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }
    trimmed
        .parse::<f64>()
        .ok()
        .filter(|value| value.is_finite())
}

/// The value as the field's `value` attribute: JS `String(number)`, except
/// that `-0` prints as `0` (JS drops the sign) and magnitudes ≥ 1e21 print in
/// full instead of JS's exponent notation (header delta [D]).
pub fn number_input_format(value: f64) -> String {
    if value == 0.0 {
        return "0".to_string();
    }
    value.to_string()
}

/// Vue's `wrapperClass` computed: `hk-number-input`, the size modifier, the
/// disabled marker when disabled, then the host class last.
pub fn number_input_classes(props: &NumberInputProps) -> String {
    let mut classes = String::from("hk-number-input");
    classes.push(' ');
    classes.push_str(props.size.class_name());
    if props.disabled {
        classes.push(' ');
        classes.push_str("hk-number-input-disabled");
    }
    if !props.class.is_empty() {
        classes.push(' ');
        classes.push_str(&props.class);
    }
    classes
}

#[define_props]
pub struct NumberInputProps {
    /// Controlled value (Vue: `modelValue`, default 0).
    #[default(0.0)]
    pub value: f64,

    /// Lower bound; also the decrement dead end (Vue default `undefined`).
    pub min: Option<f64>,

    /// Upper bound; also the increment dead end (Vue default `undefined`).
    pub max: Option<f64>,

    /// Step size used by the ± column and the native `step` attribute.
    #[default(1.0)]
    pub step: f64,

    #[default]
    pub disabled: bool,

    /// Native placeholder; `None` renders no attribute.
    pub placeholder: Option<String>,

    /// Caption above the box (Vue: `label`); empty means "no caption".
    pub label: Option<String>,

    /// In-field affix text before the input (Vue: `prefix`).
    pub prefix: Option<String>,

    /// In-field affix text after the input (Vue: `suffix`).
    pub suffix: Option<String>,

    /// Vue: the `#prefix` slot — wins over [`NumberInputProps::prefix`].
    pub prefix_slot: Option<Element>,

    /// Vue: the `#suffix` slot — wins over [`NumberInputProps::suffix`].
    pub suffix_slot: Option<Element>,

    /// Size step (`hk-number-input-{size}`), shared with the step column.
    #[default]
    pub size: NumberInputSize,

    /// Element id; when present, the caption's `for` points at the field and
    /// the field carries the id (delta [D] — Vue leaves the caption unbound).
    pub id: Option<String>,

    /// Host class appended last (Vue attribute fallthrough).
    #[default]
    pub class: String,

    /// Host style attribute (Vue attribute fallthrough).
    #[default]
    pub style: String,

    /// Vue's `update:modelValue` — live, per keystroke and per step.
    pub oninput: Option<EventHandler<f64>>,

    /// Commit channel (delta [D]): the field's native `change` (blur / Enter)
    /// and every step click, with the same clamped value as `oninput`.
    pub onchange: Option<EventHandler<f64>>,
}

#[component]
pub fn NumberInput(props: NumberInputProps) -> Element {
    let value = props.value;
    let min = props.min;
    let max = props.max;
    let step = props.step;
    let disabled = props.disabled;

    let can_up = number_input_can_increment(value, max);
    let can_down = number_input_can_decrement(value, min);

    // Vue truthiness: an empty string is falsy for the caption and for both
    // affix TEXT props (a provided slot always wins).
    let label_text = props.label.clone().filter(|label| !label.is_empty());
    let prefix_slot = props.prefix_slot.clone();
    let suffix_slot = props.suffix_slot.clone();
    let prefix_text = props.prefix.clone().unwrap_or_default();
    let suffix_text = props.suffix.clone().unwrap_or_default();
    let has_prefix = prefix_slot.is_some() || !prefix_text.is_empty();
    let has_suffix = suffix_slot.is_some() || !suffix_text.is_empty();
    // The affix CONTENT is resolved up front: a slot wins over the text prop,
    // and an empty-string prop renders nothing at all (Vue's truthiness test).
    // The text branch is a bare text node inside the affix span, exactly the
    // node Vue's `{props.prefix}` interpolation produces.
    let prefix_content = match prefix_slot {
        Some(slot) => slot,
        None => VNode::Text(VText::new(&prefix_text)),
    };
    let suffix_content = match suffix_slot {
        Some(slot) => slot,
        None => VNode::Text(VText::new(&suffix_text)),
    };

    let value_text = number_input_format(value);
    let step_text = number_input_format(step);
    // `Option<String>`: rsx bool attributes are presence-only and there is no
    // `Option<f64>` attribute impl, so the bound attributes are pre-formatted.
    let min_attr = min.map(number_input_format);
    let max_attr = max.map(number_input_format);
    let classes = number_input_classes(&props);

    // Live path: `Number(target.value)` → `emitValue`.
    let on_field_input = {
        let oninput = props.oninput.clone();
        move |event: InputEvent| {
            let Some(parsed) = number_input_parse(&event.data) else {
                return;
            };
            let next = number_input_emit_value(parsed, min, max);
            if let Some(handler) = oninput.as_ref() {
                handler.call(next);
            }
        }
    };

    // Commit path (delta [D]): the field's native `change`.
    let on_field_change = {
        let onchange = props.onchange.clone();
        move |event: ChangeEvent| {
            let Some(parsed) = number_input_commit_parse(&event.value) else {
                return;
            };
            let next = number_input_emit_value(parsed, min, max);
            if let Some(handler) = onchange.as_ref() {
                handler.call(next);
            }
        }
    };

    // The ± column: a step commit reports on BOTH channels (it is a live
    // change and a commit at once, like Vue's single emit is for hk-number).
    let on_step = {
        let oninput = props.oninput.clone();
        let onchange = props.onchange.clone();
        EventHandler::new(move |direction: NumberStepperDirection| {
            let Some(next) = number_input_step_value(value, min, max, step, direction) else {
                return;
            };
            if let Some(handler) = oninput.as_ref() {
                handler.call(next);
            }
            if let Some(handler) = onchange.as_ref() {
                handler.call(next);
            }
        })
    };

    rsx! {
        div {
            class: classes,
            style: props.style.clone(),
            if let Some(label) = label_text {
                label {
                    class: "hk-input-label",
                    "for": props.id.clone(),
                    "{label}"
                }
            }
            div {
                class: "hk-number-input-inner",
                if has_prefix {
                    span {
                        class: "hk-number-input-prefix",
                        {prefix_content}
                    }
                }
                input {
                    "type": "number",
                    class: "hk-number-input-field",
                    id: props.id.clone(),
                    value: value_text,
                    min: min_attr,
                    max: max_attr,
                    step: step_text,
                    disabled: disabled,
                    placeholder: props.placeholder.clone(),
                    oninput: on_field_input,
                    onchange: on_field_change,
                }
                if has_suffix {
                    span {
                        class: "hk-number-input-suffix",
                        {suffix_content}
                    }
                }
                NumberSteppers {
                    can_up,
                    can_down,
                    disabled,
                    size: props.size,
                    on_step: Some(on_step),
                }
            }
        }
    }
}

impl StyledComponent for NumberInputComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-number-input*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkNumberInput.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "number-input"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn number_input_emit_value_clamps_instead_of_snapping() {
        // In range → untouched (Vue never snaps onto the step grid).
        assert_eq!(number_input_emit_value(3.7, Some(0.0), Some(10.0)), 3.7);
        // Below min → min; above max → max.
        assert_eq!(number_input_emit_value(-5.0, Some(0.0), Some(10.0)), 0.0);
        assert_eq!(number_input_emit_value(50.0, Some(0.0), Some(10.0)), 10.0);
        // No bounds → passthrough.
        assert_eq!(number_input_emit_value(-5.0, None, None), -5.0);
        assert_eq!(number_input_emit_value(5.0, None, Some(10.0)), 5.0);
        assert_eq!(number_input_emit_value(5.0, Some(0.0), None), 5.0);
        // `min` is tested first, so a degenerate range resolves to min.
        assert_eq!(number_input_emit_value(-1.0, Some(10.0), Some(0.0)), 10.0);
    }

    #[test]
    fn number_input_bounds_match_the_vue_continuation_flags() {
        assert!(number_input_can_increment(9.0, Some(10.0)));
        assert!(!number_input_can_increment(10.0, Some(10.0)));
        assert!(number_input_can_increment(1e9, None));
        assert!(number_input_can_decrement(1.0, Some(0.0)));
        assert!(!number_input_can_decrement(0.0, Some(0.0)));
        assert!(number_input_can_decrement(-1e9, None));
    }

    #[test]
    fn number_input_step_value_gates_then_clamps() {
        // A step from the middle of the range lands exactly on value ± step.
        assert_eq!(
            number_input_step_value(4.0, None, None, 1.0, NumberStepperDirection::Up),
            Some(5.0)
        );
        assert_eq!(
            number_input_step_value(4.0, None, None, 1.0, NumberStepperDirection::Down),
            Some(3.0)
        );
        // One step from the bound still steps (Vue gates on `value < max`).
        assert_eq!(
            number_input_step_value(9.0, Some(0.0), Some(10.0), 1.0, NumberStepperDirection::Up),
            Some(10.0)
        );
        // At the bound the direction is dead → no emit.
        assert_eq!(
            number_input_step_value(10.0, Some(0.0), Some(10.0), 1.0, NumberStepperDirection::Up),
            None
        );
        assert_eq!(
            number_input_step_value(
                0.0,
                Some(0.0),
                Some(10.0),
                1.0,
                NumberStepperDirection::Down
            ),
            None
        );
        // A step that overshoots is clamped by `emitValue` (step 5 from 98).
        assert_eq!(
            number_input_step_value(98.0, None, Some(100.0), 5.0, NumberStepperDirection::Up),
            Some(100.0)
        );
        // A fractional step stays fractional (Vue's Number math, not integers).
        assert_eq!(
            number_input_step_value(1.5, None, None, 0.25, NumberStepperDirection::Up),
            Some(1.75)
        );
    }

    #[test]
    fn number_input_parse_follows_the_js_number_rule() {
        assert_eq!(number_input_parse("12"), Some(12.0));
        assert_eq!(number_input_parse(" 12.5 "), Some(12.5));
        assert_eq!(number_input_parse("-3"), Some(-3.0));
        // JS Number("") === 0 (and whitespace only too).
        assert_eq!(number_input_parse(""), Some(0.0));
        assert_eq!(number_input_parse("   "), Some(0.0));
        // Unparseable / non-finite payloads are dropped, never emitted.
        assert_eq!(number_input_parse("abc"), None);
        assert_eq!(number_input_parse("-"), None);
        assert_eq!(number_input_parse("1,5"), None);
        assert_eq!(number_input_parse("inf"), None);
        assert_eq!(number_input_parse("NaN"), None);
        // The commit channel refuses an empty payload (it invents nothing).
        assert_eq!(number_input_commit_parse(""), None);
        assert_eq!(number_input_commit_parse("   "), None);
        assert_eq!(number_input_commit_parse("7"), Some(7.0));
    }

    #[test]
    fn number_input_format_matches_js_string_of_a_number() {
        assert_eq!(number_input_format(0.0), "0");
        // JS String(-0) is "0": the sign is dropped, unlike f64::to_string.
        assert_eq!(number_input_format(-0.0), "0");
        assert_eq!(number_input_format(3.0), "3");
        assert_eq!(number_input_format(1.5), "1.5");
        assert_eq!(number_input_format(-2.25), "-2.25");
    }

    #[test]
    fn number_input_classes_follow_the_vue_wrapper_list() {
        let props = NumberInputProps::default();
        assert_eq!(
            number_input_classes(&props),
            "hk-number-input hk-number-input-md"
        );

        let props = NumberInputProps {
            disabled: true,
            size: NumberInputSize::Small,
            class: "host".to_string(),
            ..Default::default()
        };
        assert_eq!(
            number_input_classes(&props),
            "hk-number-input hk-number-input-sm hk-number-input-disabled host"
        );

        let props = NumberInputProps {
            size: NumberInputSize::Large,
            ..Default::default()
        };
        assert_eq!(
            number_input_classes(&props),
            "hk-number-input hk-number-input-lg"
        );
    }

    #[test]
    fn number_input_defaults_match_the_vue_props() {
        let props = NumberInputProps::default();
        assert_eq!(props.value, 0.0);
        assert_eq!(props.min, None);
        assert_eq!(props.max, None);
        assert_eq!(props.step, 1.0);
        assert!(!props.disabled);
        assert_eq!(props.placeholder, None);
        assert_eq!(props.label, None);
        assert_eq!(props.prefix, None);
        assert_eq!(props.suffix, None);
        assert!(props.prefix_slot.is_none());
        assert!(props.suffix_slot.is_none());
        assert_eq!(props.size, NumberInputSize::Medium);
        assert_eq!(props.id, None);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
        assert_eq!(props.oninput, None);
        assert_eq!(props.onchange, None);
    }

    #[test]
    fn number_input_renders_the_vue_field_shell() {
        let html = NumberInput(NumberInputProps {
            value: 3.0,
            min: Some(0.0),
            max: Some(10.0),
            step: 2.0,
            label: Some("Count".to_string()),
            prefix: Some("$".to_string()),
            suffix: Some("kg".to_string()),
            placeholder: Some("0".to_string()),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-number-input hk-number-input-md",
            "hk-input-label",
            ">Count<",
            "hk-number-input-inner",
            "hk-number-input-prefix",
            ">$<",
            "hk-number-input-field",
            "type=\"number\"",
            "value=\"3\"",
            "min=\"0\"",
            "max=\"10\"",
            "step=\"2\"",
            "placeholder=\"0\"",
            "hk-number-input-suffix",
            ">kg<",
            "hk-number-input-steppers",
            "hk-number-input-steppers-md",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The step column is the LAST child of the inner row, exactly like
        // Vue's render order (after the suffix).
        let suffix = html.find("hk-number-input-suffix").expect("suffix");
        let steppers = html.find("hk-number-input-steppers").expect("steppers");
        assert!(suffix < steppers, "{html}");
        // A live field at 3 of 0..10 renders no disabled marker and no
        // disabled attribute.
        assert!(!html.contains("hk-number-input-disabled"), "{html}");
        assert!(!html.contains("disabled"), "{html}");
    }

    #[test]
    fn number_input_binds_the_caption_and_prefers_the_slot() {
        let html = NumberInput(NumberInputProps {
            id: Some("qty".to_string()),
            label: Some("Quantity".to_string()),
            prefix: Some("IGNORED".to_string()),
            prefix_slot: Some(rsx! { span { class: "unit", "EUR" } }),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("for=\"qty\""), "{html}");
        assert!(html.contains("id=\"qty\""), "{html}");
        // The slot wins over the affix text prop (Vue precedence) ...
        assert!(html.contains("class=\"unit\""), "{html}");
        assert!(!html.contains("IGNORED"), "{html}");
        // ... and an unset suffix slot renders no suffix span at all.
        assert!(!html.contains("hk-number-input-suffix"), "{html}");
    }

    #[test]
    fn number_input_drops_empty_caption_and_affixes_and_marks_disabled() {
        let html = NumberInput(NumberInputProps {
            label: Some(String::new()),
            prefix: Some(String::new()),
            suffix: Some(String::new()),
            disabled: true,
            ..Default::default()
        })
        .render_to_html();
        // Vue's truthiness: "" is falsy for the caption and both affixes.
        assert!(!html.contains("hk-input-label"), "{html}");
        assert!(!html.contains("hk-number-input-prefix"), "{html}");
        assert!(!html.contains("hk-number-input-suffix"), "{html}");
        // Disabled: the wrapper marker plus the native attribute on the field
        // and on both step buttons (Vue: `disabled` on all three).
        assert!(html.contains("hk-number-input-disabled"), "{html}");
        assert_eq!(
            html.matches("disabled=\"disabled\"").count(),
            3,
            "field + both step buttons: {html}"
        );
    }

    #[test]
    fn number_input_renders_a_dead_end_column_from_its_bounds() {
        // At max: the up button is disabled, the down button is live.
        let html = NumberInput(NumberInputProps {
            value: 10.0,
            max: Some(10.0),
            ..Default::default()
        })
        .render_to_html();
        assert_eq!(
            html.matches("disabled=\"disabled\"").count(),
            1,
            "only the increment dead end is disabled: {html}"
        );
    }

    #[test]
    fn number_input_without_bounds_steps_freely() {
        let html = NumberInput(NumberInputProps {
            value: 1e9,
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("disabled"), "{html}");
        // No min/max attributes at all (Vue: `undefined` drops them).
        assert!(!html.contains("min=\""), "{html}");
        assert!(!html.contains("max=\""), "{html}");
    }

    #[test]
    fn number_input_styles_come_from_the_canonical_vue_sheet() {
        let css = NumberInputComponent::styles();
        for needle in [
            ".hk-number-input",
            ".hk-number-input-inner",
            ".hk-number-input-field",
            ".hk-number-input-prefix",
            ".hk-number-input-suffix",
            ".hk-input-label",
            ".hk-number-input-sm",
            ".hk-number-input-md",
            ".hk-number-input-lg",
        ] {
            assert!(
                css.contains(needle),
                "number input css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored number input sheet"
        );
    }
}
