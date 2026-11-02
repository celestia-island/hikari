// hi-components/src/basic/slider_field.rs
// SliderField — mirror of the canonical Vue `HkSliderField`: the boxed form
// row where an `HkSlider` rides between a LEADING and a TRAILING slot (either
// may host arbitrary content — a value editor, a dropdown, a badge). The
// slider takes all the room the slots leave; the box owns border/padding so the
// row reads as one control. Purely generic: it has no idea what the value
// means.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkSliderField.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so `.hk-slider-field*` names are literal and
// identical in both forms. DOM contract (mirrors Vue one-to-one):
//
//   div.hk-slider-field[.is-disabled]   role="group" [aria-label]
//        [host class] (style: host style)
//     div.hk-slider-field-slot[data-side="leading"]    (leading slot)
//     div.hk-slider.hk-slider-field-slider             (the HkSlider mirror)
//         [.is-disabled] [data-size] role="slider" tabindex aria-valuemin /
//         aria-valuemax / aria-valuenow / aria-valuetext [aria-label]
//       span.hk-slider-tick…  div.hk-slider-fill  div.hk-slider-thumb
//     div.hk-slider-field-slot[data-side="trailing"]   (trailing slot)
//
// Vue prop mapping: `modelValue` → [`SliderFieldProps::value`],
// `min`/`max`/`step`/`disabled`/`showTicks` map one-to-one, `size` →
// [`SliderSize`] (the Slider mirror's own two-step enum — Vue declares the same
// `"sm" | "md"`), `ariaLabel` → [`SliderFieldProps::aria_label`] (emitted on the
// group AND forwarded to the slider, exactly like Vue), `formatValue` →
// [`SliderFieldProps::format_value`], `#leading` / `#trailing` →
// [`SliderFieldProps::leading`] / [`SliderFieldProps::trailing`], and
// `update:modelValue` → [`SliderFieldProps::on_input`].
//
// Pass-through only: the field owns NO value math — the inner slider clamps,
// snaps and formats, and every interaction lands on
// [`SliderFieldProps::on_input`] unchanged (Vue's own re-emit is the identity
// function). So there is no state, no registry and no callback of its own; the
// whole component is controlled props in, one callback out.
//
// The inner slider is mounted with `class="hk-slider-field-slider"`, so its
// root class list is `hk-slider hk-slider-field-slider` (plus `is-disabled`
// when disabled) — the same merge Vue's attribute fallthrough produces.
//
// Deltas vs Vue (documented, not accidental):
//   * the root also takes the mirror-wide `class` / `style`
//     attribute-fallthrough props (Vue merges the attrs itself), appended /
//     applied without touching the fixed `.hk-slider-field` names;
//   * `value` defaults to `0.0` because Rust props must be
//     `Default`-constructible (Vue declares `modelValue` required).
//
// New file: the family had no Rust counterpart.

use crate::basic::slider::{Slider, SliderProps, SliderSize};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SliderFieldComponent;

/// Vue's root class list: `hk-slider-field`, the `is-disabled` marker when
/// disabled (empty entries dropped by `filter(Boolean)`), then the host class.
pub fn slider_field_classes(props: &SliderFieldProps) -> String {
    let mut classes = String::from("hk-slider-field");
    if props.disabled {
        classes.push_str(" is-disabled");
    }
    if !props.class.is_empty() {
        classes.push(' ');
        classes.push_str(&props.class);
    }
    classes
}

#[define_props]
pub struct SliderFieldProps {
    /// Controlled value (Vue: `modelValue`, required there; `0.0` here so the
    /// props stay `Default`-constructible).
    #[default(0.0)]
    pub value: f64,

    #[default(0.0)]
    pub min: f64,

    #[default(100.0)]
    pub max: f64,

    /// Snap step — every emitted value lands on the `min + n * step` grid.
    #[default(1.0)]
    pub step: f64,

    #[default]
    pub disabled: bool,

    /// Render one tick dot per stop (Vue: `showTicks`).
    #[default]
    pub show_ticks: bool,

    /// Slider size step, passed straight to the inner slider (Vue: `"sm" |
    /// "md"`, default `md`).
    #[default]
    pub size: SliderSize,

    /// `role="group"` / slider accessible name (Vue: `ariaLabel`); the mirror
    /// keeps Vue's double emission (group + slider).
    pub aria_label: Option<String>,

    /// `aria-valuetext` formatter, forwarded to the slider (Vue:
    /// `formatValue`).
    pub format_value: Option<Callback<f64, String>>,

    /// Vue: the `#leading` slot.
    pub leading: Option<Element>,

    /// Vue: the `#trailing` slot.
    pub trailing: Option<Element>,

    /// Vue: `update:modelValue`, forwarded from the inner slider.
    pub on_input: Option<EventHandler<f64>>,

    /// Host class appended last (Vue attribute fallthrough).
    #[default]
    pub class: String,

    /// Host style attribute (Vue attribute fallthrough).
    #[default]
    pub style: String,
}

#[component]
pub fn SliderField(props: SliderFieldProps) -> Element {
    let classes = slider_field_classes(&props);

    // The inner slider takes the remaining width; its own props are forwarded
    // one-for-one, with Vue's `hk-slider-field-slider` class appended to its
    // root class list.
    let slider = Slider(SliderProps {
        value: props.value,
        min: props.min,
        max: props.max,
        step: props.step,
        disabled: props.disabled,
        show_ticks: props.show_ticks,
        size: props.size,
        aria_label: props.aria_label.clone(),
        format_value: props.format_value.clone(),
        on_input: props.on_input.clone(),
        class: "hk-slider-field-slider".to_string(),
        style: String::new(),
    });

    let leading = props.leading.clone();
    let trailing = props.trailing.clone();

    rsx! {
        div {
            class: classes,
            style: props.style.clone(),
            "role": "group",
            "aria-label": props.aria_label.clone(),
            if let Some(leading) = leading {
                div {
                    class: "hk-slider-field-slot",
                    "data-side": "leading",
                    {leading}
                }
            }
            {slider}
            if let Some(trailing) = trailing {
                div {
                    class: "hk-slider-field-slot",
                    "data-side": "trailing",
                    {trailing}
                }
            }
        }
    }
}

impl StyledComponent for SliderFieldComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-slider-field*` names literal so this CSS matches Vue).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkSliderField.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "slider-field"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slider_field_classes_follow_the_vue_root_list() {
        let props = SliderFieldProps::default();
        assert_eq!(slider_field_classes(&props), "hk-slider-field");

        let props = SliderFieldProps {
            disabled: true,
            ..Default::default()
        };
        assert_eq!(slider_field_classes(&props), "hk-slider-field is-disabled");

        let props = SliderFieldProps {
            disabled: true,
            class: "host".to_string(),
            ..Default::default()
        };
        assert_eq!(
            slider_field_classes(&props),
            "hk-slider-field is-disabled host"
        );
    }

    #[test]
    fn slider_field_defaults_match_the_vue_props() {
        let props = SliderFieldProps::default();
        // Vue declares `modelValue` required; Rust props need a Default.
        assert_eq!(props.value, 0.0);
        assert_eq!(props.min, 0.0);
        assert_eq!(props.max, 100.0);
        assert_eq!(props.step, 1.0);
        assert!(!props.disabled);
        assert!(!props.show_ticks);
        assert_eq!(props.size, SliderSize::Md);
        assert_eq!(props.aria_label, None);
        assert_eq!(props.format_value, None);
        assert!(props.leading.is_none());
        assert!(props.trailing.is_none());
        assert_eq!(props.on_input, None);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn slider_field_renders_the_boxed_row_with_both_slots() {
        let html = SliderField(SliderFieldProps {
            value: 30.0,
            aria_label: Some("Volume".to_string()),
            leading: Some(rsx! { span { class: "lead", "L" } }),
            trailing: Some(rsx! { span { class: "trail", "R" } }),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "class=\"hk-slider-field\"",
            "role=\"group\"",
            "hk-slider-field-slot",
            "data-side=\"leading\"",
            "data-side=\"trailing\"",
            "hk-slider hk-slider-field-slider",
            "hk-slider-fill",
            "hk-slider-thumb",
            "class=\"lead\"",
            "class=\"trail\"",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Vue emits the aria-label on the GROUP and forwards it to the slider.
        assert_eq!(html.matches("aria-label=\"Volume\"").count(), 2, "{html}");
        // The slider sits between the two slots, exactly like Vue's render.
        let leading = html.find("data-side=\"leading\"").expect("leading");
        let slider = html.find("hk-slider-field-slider").expect("slider");
        let trailing = html.find("data-side=\"trailing\"").expect("trailing");
        assert!(leading < slider && slider < trailing, "{html}");
        // The value rides the slider's own DOM contract unchanged.
        assert!(html.contains("style=\"left:30%\""), "{html}");
        assert!(html.contains("style=\"width:30%\""), "{html}");
    }

    #[test]
    fn slider_field_renders_no_slot_wrappers_without_slots() {
        let html = SliderField(SliderFieldProps {
            value: 10.0,
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("hk-slider-field-slot"), "{html}");
        // No aria-label attribute at all when unset (Vue: `undefined`).
        assert!(!html.contains("aria-label"), "{html}");
        // The group role survives without a name.
        assert!(html.contains("role=\"group\""), "{html}");
    }

    #[test]
    fn slider_field_disables_the_group_and_the_slider() {
        let html = SliderField(SliderFieldProps {
            value: 20.0,
            disabled: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains("class=\"hk-slider-field is-disabled\""),
            "{html}"
        );
        // The inner slider carries the same marker plus its forwarded class.
        assert!(
            html.contains("class=\"hk-slider is-disabled hk-slider-field-slider\""),
            "{html}"
        );
        assert!(html.contains("aria-disabled=\"true\""), "{html}");
        assert!(html.contains("tabindex=\"-1\""), "{html}");
    }

    #[test]
    fn slider_field_forwards_size_ticks_and_formatter() {
        let html = SliderField(SliderFieldProps {
            value: 2.0,
            min: 0.0,
            max: 4.0,
            step: 1.0,
            show_ticks: true,
            size: SliderSize::Sm,
            format_value: Some(Callback::new(|value: f64| format!("{value} dB"))),
            ..Default::default()
        })
        .render_to_html();
        // data-size rides the inner slider (Vue passes `size` straight through).
        assert!(html.contains("data-size=\"sm\""), "{html}");
        // One tick per stop, 0..4 → 5 ticks.
        assert_eq!(
            html.matches("hk-slider-tick").count(),
            5,
            "tick count: {html}"
        );
        // The formatter becomes aria-valuetext.
        assert!(html.contains("aria-valuetext=\"2 dB\""), "{html}");
    }

    #[test]
    fn slider_field_styles_come_from_the_canonical_vue_sheet() {
        let css = SliderFieldComponent::styles();
        for needle in [
            ".hk-slider-field",
            ".hk-slider-field.is-disabled",
            ".hk-slider-field-slider",
            ".hk-slider-field-slot",
        ] {
            assert!(
                css.contains(needle),
                "slider field css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored slider field sheet"
        );
    }
}
