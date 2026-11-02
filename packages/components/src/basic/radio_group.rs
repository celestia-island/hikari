// hi-components/src/basic/radio_group.rs
// RadioGroup — mirror of the canonical Vue `HkRadio`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkRadio.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-radio*` class names are literal and
// identical in both forms. DOM contract (mirrors Vue one-to-one):
//
//   div.hk-radio-group.hk-radio-group-{direction}.hk-radio-group-{size}
//         [class] [style]
//     label.hk-radio [data-disabled] data-size={size}        (one per option)
//       span.hk-radio-box [data-checked]
//         input.hk-radio-input  type=radio value={value} [checked] [disabled]
//                               (onchange)
//         span.hk-radio-dot                   (selected option only)
//       span.hk-label.hk-label-{size}         (option label text)
//
// Vue prop mapping: `modelValue` → [`RadioGroupProps::value`] (the selected
// option's value, `None` = nothing selected, which is Vue's `null` default),
// `update:modelValue` → [`RadioGroupProps::on_change`] with the option's value.
// A row that is already selected emits nothing — the native radio only fires
// `change` when it BECOMES checked, and Vue's handler rides that event.
//
// State is controlled-only (value / disabled in, one callback out): the mirror
// holds no selection state of its own, so no tairitsu `Signal`/`use_state` is
// involved.
//
// Retired legacy API (documented delta — Vue's HkRadio is a GROUP component):
// * `RadioGroup`'s `name` / `children` / `RadioContext` contract is gone: Vue
//   does not group natively (it renders `input[type=radio]` rows without a
//   `name`) and takes its rows from the `options` array, so the context
//   provider, `RadioButton`, the standalone-row composition and the `name`
//   prop are all retired.
// * [`RadioButtonProps`] survives only as a migration-window alias for call
//   sites that still spell the legacy type; the prelude re-export was retired
//   in this same change, so nothing in the crate needs the alias — delete it
//   with the next breaking window.
// * Vue's `label` SCOPED slot (rich per-option content) has no Rust prop
//   equivalent; each row renders its `label` string through the `HkLabel`
//   mirror. Vue's `key={opt.value}` is a virtual-DOM hint with no `rsx!` slot
//   (it would leak into the DOM as an attribute), so rows render in order.
// * Option values are `string | number` in Vue; the mirror models the DOM
//   string form (`String`) — a numeric option is compared in its string form,
//   which is what the rendered `value` attribute carries anyway.
// * `direction` keeps the legacy enum name but flips its default to Vue's
//   `horizontal` (the legacy default was vertical).

use crate::basic::label::{Label, LabelProps, LabelSize};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct RadioGroupComponent;

/// One selectable row (Vue: `HkRadioOption`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct RadioOption {
    /// The value emitted when this row is chosen / rendered in `value`.
    pub value: String,
    /// The row's label text (Vue: `label`).
    pub label: String,
    /// Disables this row on top of the group-level `disabled`.
    pub disabled: bool,
}

impl RadioOption {
    /// Shorthand for the common single-line option.
    pub fn new(value: impl Into<String>, label: impl Into<String>) -> Self {
        Self {
            value: value.into(),
            label: label.into(),
            disabled: false,
        }
    }
}

/// The two flow directions (Vue: `"horizontal" | "vertical"`, default
/// `horizontal`). They only change the group's flex direction / wrapping.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum RadioDirection {
    #[default]
    Horizontal,
    Vertical,
}

impl RadioDirection {
    /// The `hk-radio-group-<direction>` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            RadioDirection::Horizontal => "hk-radio-group-horizontal",
            RadioDirection::Vertical => "hk-radio-group-vertical",
        }
    }
}

/// The three size steps (Vue: `"sm" | "md" | "lg"`, default `md`). The sheet
/// scales the group gap, the box and the dot from the same step.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum RadioSize {
    Sm,
    #[default]
    Md,
    Lg,
}

impl RadioSize {
    /// The `hk-radio-group-<size>` modifier class exactly as Vue emits it.
    pub fn group_class_name(self) -> &'static str {
        match self {
            RadioSize::Sm => "hk-radio-group-sm",
            RadioSize::Md => "hk-radio-group-md",
            RadioSize::Lg => "hk-radio-group-lg",
        }
    }

    /// The row's `data-size` value — the sheet's box/dot scale hooks on it.
    pub fn data_size(self) -> &'static str {
        match self {
            RadioSize::Sm => "sm",
            RadioSize::Md => "md",
            RadioSize::Lg => "lg",
        }
    }

    /// The matching `HkLabel` size (Vue passes its `size` through to `HkLabel`).
    pub fn label_size(self) -> LabelSize {
        match self {
            RadioSize::Sm => LabelSize::Sm,
            RadioSize::Md => LabelSize::Md,
            RadioSize::Lg => LabelSize::Lg,
        }
    }
}

#[define_props]
pub struct RadioGroupProps {
    /// The selected option's value (Vue: `modelValue`, default `null`).
    pub value: Option<String>,

    /// The rows, in render order (Vue: `options`, required).
    pub options: Vec<RadioOption>,

    /// Group-wide disable; a row's own `disabled` is OR-ed with it.
    #[default]
    pub disabled: bool,

    #[default]
    pub direction: RadioDirection,

    #[default]
    pub size: RadioSize,

    /// Emitted with the chosen option's value (never for the current one).
    pub on_change: Option<EventHandler<String>>,

    /// Vue attribute fallthrough onto the root `<div>`.
    #[default]
    pub class: String,

    #[default]
    pub style: String,
}

/// Migration-window alias — see the "Retired legacy API" note in the file
/// header: `prelude.rs` still re-exports the legacy name, so the alias keeps
/// that re-export compiling until the prelude line is removed with it.
pub type RadioButtonProps = RadioGroupProps;

#[component]
pub fn RadioGroup(props: RadioGroupProps) -> Element {
    let selected = props.value.clone();
    let group_disabled = props.disabled;
    let size = props.size;

    let mut group_classes = String::from("hk-radio-group");
    group_classes.push(' ');
    group_classes.push_str(props.direction.class_name());
    group_classes.push(' ');
    group_classes.push_str(size.group_class_name());
    if !props.class.is_empty() {
        group_classes.push(' ');
        group_classes.push_str(&props.class);
    }

    rsx! {
        div {
            class: group_classes,
            style: props.style.clone(),
            for option in props.options.iter() {
                {
                    let is_selected = selected.as_deref() == Some(option.value.as_str());
                    let is_disabled = group_disabled || option.disabled;
                    let option_value = option.value.clone();
                    let option_label = option.label.clone();
                    let on_change = props.on_change.clone();
                    let handle_change = move |_: ChangeEvent| {
                        // A native radio only fires `change` on the row that
                        // BECOMES checked, and a disabled row fires nothing.
                        if is_disabled || is_selected {
                            return;
                        }
                        if let Some(handler) = on_change.as_ref() {
                            handler.call(option_value.clone());
                        }
                    };
                    rsx! {
                        label {
                            class: "hk-radio",
                            "data-disabled": if is_disabled { Some("") } else { None },
                            "data-size": size.data_size(),
                            span {
                                class: "hk-radio-box",
                                "data-checked": if is_selected { Some("") } else { None },
                                input {
                                    class: "hk-radio-input",
                                    type: "radio",
                                    value: option.value.clone(),
                                    checked: is_selected,
                                    disabled: is_disabled,
                                    onchange: handle_change,
                                }
                                if is_selected {
                                    span { class: "hk-radio-dot" }
                                }
                            }
                            Label {
                                size: size.label_size(),
                                text: Some(option_label),
                            }
                        }
                    }
                }
            }
        }
    }
}

impl StyledComponent for RadioGroupComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-radio*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkRadio.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "radio"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn radio_direction_classes_match_the_vue_modifiers() {
        assert_eq!(
            RadioDirection::Horizontal.class_name(),
            "hk-radio-group-horizontal"
        );
        assert_eq!(
            RadioDirection::Vertical.class_name(),
            "hk-radio-group-vertical"
        );
    }

    #[test]
    fn radio_size_tokens_match_the_vue_modifiers() {
        assert_eq!(RadioSize::Sm.group_class_name(), "hk-radio-group-sm");
        assert_eq!(RadioSize::Md.group_class_name(), "hk-radio-group-md");
        assert_eq!(RadioSize::Lg.group_class_name(), "hk-radio-group-lg");
        assert_eq!(RadioSize::Sm.data_size(), "sm");
        assert_eq!(RadioSize::Md.data_size(), "md");
        assert_eq!(RadioSize::Lg.data_size(), "lg");
        assert_eq!(RadioSize::Sm.label_size(), LabelSize::Sm);
        assert_eq!(RadioSize::Lg.label_size(), LabelSize::Lg);
    }

    #[test]
    fn radio_defaults_match_the_vue_props() {
        let props = RadioGroupProps::default();
        assert_eq!(props.value, None);
        assert!(props.options.is_empty());
        assert!(!props.disabled);
        assert_eq!(props.direction, RadioDirection::Horizontal);
        assert_eq!(props.size, RadioSize::Md);
        assert_eq!(props.on_change, None);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn radio_option_helper_and_disabled_or() {
        let option = RadioOption {
            value: "b".to_string(),
            label: "Beta".to_string(),
            disabled: false,
        };
        assert_eq!(RadioOption::new("b", "Beta"), option);
        assert!(!RadioOption::new("a", "Alpha").disabled);
    }

    #[test]
    fn radio_renders_the_vue_shell_for_every_prop_arm() {
        let plain = RadioGroup(RadioGroupProps::default());
        assert!(
            !matches!(plain, VNode::Text(_)),
            "default render is an element"
        );

        let options = vec![
            RadioOption::new("a", "Alpha"),
            RadioOption {
                value: "b".to_string(),
                label: "Beta".to_string(),
                disabled: true,
            },
        ];
        let _ = RadioGroup(RadioGroupProps {
            value: Some("b".to_string()),
            options: options.clone(),
            ..Default::default()
        });
        let _ = RadioGroup(RadioGroupProps {
            value: Some("a".to_string()),
            options,
            disabled: true,
            direction: RadioDirection::Vertical,
            size: RadioSize::Lg,
            on_change: Some(EventHandler::new(|_| {})),
            class: "host".to_string(),
            style: "margin-top:2px".to_string(),
        });
    }

    #[test]
    fn radio_styles_come_from_the_canonical_vue_sheet() {
        let css = RadioGroupComponent::styles();
        for needle in [
            ".hk-radio-group",
            ".hk-radio-group-horizontal",
            ".hk-radio-group-vertical",
            ".hk-radio",
            ".hk-radio-box",
            ".hk-radio-input",
            ".hk-radio-dot",
        ] {
            assert!(
                css.contains(needle),
                "radio css must carry the vue class {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored radio sheet"
        );
    }
}
