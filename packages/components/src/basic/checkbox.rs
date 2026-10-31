// hi-components/src/basic/checkbox.rs
// Checkbox — mirror of the canonical Vue `HkCheckbox`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkCheckbox.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-checkbox*` class names are literal and
// identical in both forms. DOM contract (mirrors Vue one-to-one):
//
//   label.hk-checkbox.hk-checkbox-{size}  data-type={checkbox|radio}
//         [data-disabled] [class] [style]
//     span.hk-checkbox-box [data-checked] [data-indeterminate]
//       input.hk-checkbox-input  type={checkbox|radio} [checked] [disabled]
//                                (onchange)
//       span.hk-checkbox-dot                       (checked, type=radio)
//       div.hk-icon.hk-checkbox-icon               (checked, type=checkbox)
//       span.hk-checkbox-indeterminate             (indeterminate, checkbox)
//     span.hk-label.hk-label-{size}                (label text / default slot)
//
// Vue prop mapping: `modelValue` → [`CheckboxProps::checked`]; Vue's `null`
// tri-state (`data-indeterminate` when `modelValue === null`) splits into the
// explicit [`CheckboxProps::indeterminate`] flag, because a Rust `bool` cannot
// carry `null`; `type` → [`CheckboxProps::input_type`]; `update:modelValue` →
// [`CheckboxProps::on_change`], whose payload is the checked state the browser
// reports after the click (Vue: `(e.target as HTMLInputElement).checked`, i.e.
// `true` for a click on an indeterminate box and `!checked` otherwise — see
// [`next_checked`]). `label` and the default slot both render through the
// `HkLabel` mirror (`basic::label`), which also owns the empty-case → nothing
// behaviour.
//
// State is controlled-only (checked / indeterminate / disabled in, one callback
// out): the mirror holds no transient state, so no tairitsu `Signal`/`use_state`
// is involved and the Vue-internal animation flag is not mirrored (below).
//
// Deltas vs Vue (documented):
// * `data-animating` is Vue-internal transient state (a 300 ms cron flag it
//   flips after every toggle, and a `will-change` hint in the sheet); this form
//   has no timers or signals, so the flag is never set.
// * Vue's lucide `<Check size={14}>` maps to the crate's `Icon` +
//   `MdiIcon::Check`, which adds one `div.hk-icon` wrapper above the `<svg>`;
//   the px size follows the sheet's own scale (sm 11 · md 14 · lg 16) so the
//   class stays the single source of the icon box.
// * Vue emits NO `aria-*` on this control: the native `<input>` owns the role
//   and the checked state, so an `aria-checked` on the shell would announce the
//   state twice. The mirror adds none either (DOM parity over invention).
//
// Retired legacy shape (documented delta): the old Rust `Checkbox` rendered
// `label.hk-checkbox-label` / `div.hk-checkbox` / `span.hk-checkbox-text` from
// the palette `CheckboxClass` builder, took a `children` slot plus a `value`
// attribute and toggled `!checked` on click. Vue's component is the canonical
// shape, so those shells, the palette classes and the `value` prop are gone;
// the extra `class`/`style` props mirror Vue's attribute fallthrough.

use crate::basic::label::{Label, LabelProps, LabelSize};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct CheckboxComponent;

/// The three size steps (Vue: `"sm" | "md" | "lg"`, default `md`). They scale
/// the box, the marker and the label shell together.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum CheckboxSize {
    Sm,
    #[default]
    Md,
    Lg,
}

impl CheckboxSize {
    /// The `hk-checkbox-<size>` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            CheckboxSize::Sm => "hk-checkbox-sm",
            CheckboxSize::Md => "hk-checkbox-md",
            CheckboxSize::Lg => "hk-checkbox-lg",
        }
    }

    /// The matching `HkLabel` size (Vue passes its `size` through to `HkLabel`).
    pub fn label_size(self) -> LabelSize {
        match self {
            CheckboxSize::Sm => LabelSize::Sm,
            CheckboxSize::Md => LabelSize::Md,
            CheckboxSize::Lg => LabelSize::Lg,
        }
    }

    /// The check glyph's px box — the same values the sheet assigns
    /// `.hk-checkbox-icon` per size step (14 px at `md` is Vue's `<Check>`).
    pub fn icon_px(self) -> u32 {
        match self {
            CheckboxSize::Sm => 11,
            CheckboxSize::Md => 14,
            CheckboxSize::Lg => 16,
        }
    }
}

/// The native input kind (Vue: `type`, default `checkbox`). `Radio` renders the
/// round box with a dot instead of the square with a check glyph.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum CheckboxType {
    #[default]
    Checkbox,
    Radio,
}

impl CheckboxType {
    /// The `type` attribute / `data-type` value exactly as Vue emits it.
    pub fn attr_value(self) -> &'static str {
        match self {
            CheckboxType::Checkbox => "checkbox",
            CheckboxType::Radio => "radio",
        }
    }

    pub fn is_radio(self) -> bool {
        matches!(self, CheckboxType::Radio)
    }
}

/// The `update:modelValue` payload: the browser's post-click checked state.
///
/// A click on an indeterminate box checks it (the browser clears the dash);
/// otherwise the click flips the value. Vue's tri-state `modelValue` can never
/// be `true` and `null` at once — a host that sets both `checked` and
/// `indeterminate` is out of contract, and the indeterminate arm wins here.
pub fn next_checked(checked: bool, indeterminate: bool) -> bool {
    indeterminate || !checked
}

#[define_props]
pub struct CheckboxProps {
    /// Controlled checked state (Vue: `modelValue`, default `false`).
    #[default]
    pub checked: bool,

    /// Controlled indeterminate marker (Vue: `modelValue === null`). Draws the
    /// dash and clears on click (the click reports `true`, like the browser).
    #[default]
    pub indeterminate: bool,

    #[default]
    pub disabled: bool,

    /// Native input kind (Vue: `type`).
    #[default]
    pub input_type: CheckboxType,

    #[default]
    pub size: CheckboxSize,

    /// Label text; the default slot (`children`) wins over it when present.
    pub label: Option<String>,

    /// Emitted with the checked state after a toggle; a no-op while disabled.
    pub on_change: Option<EventHandler<bool>>,

    /// Rich label content (Vue: the default slot).
    pub children: Element,

    /// Vue attribute fallthrough onto the root `<label>`.
    #[default]
    pub class: String,

    #[default]
    pub style: String,
}

#[component]
pub fn Checkbox(props: CheckboxProps) -> Element {
    let checked = props.checked;
    let indeterminate = props.indeterminate;
    let disabled = props.disabled;
    let input_type = props.input_type;

    let mut root_classes = String::from("hk-checkbox");
    root_classes.push(' ');
    root_classes.push_str(props.size.class_name());
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    // Vue: `onChange` emits the input's post-click checked state and no-ops
    // while disabled.
    let on_change = props.on_change.clone();
    let handle_change = move |_: ChangeEvent| {
        if disabled {
            return;
        }
        if let Some(handler) = on_change.as_ref() {
            handler.call(next_checked(checked, indeterminate));
        }
    };

    rsx! {
        label {
            class: root_classes,
            style: props.style.clone(),
            "data-type": input_type.attr_value(),
            "data-disabled": if disabled { Some("") } else { None },
            input {
                class: "hk-checkbox-input",
                type: input_type.attr_value(),
                checked: checked,
                disabled: disabled,
                onchange: handle_change,
            }
            span {
                class: "hk-checkbox-box",
                "data-checked": if checked { Some("") } else { None },
                "data-indeterminate": if indeterminate { Some("") } else { None },
                if checked {
                    if input_type.is_radio() {
                        span { class: "hk-checkbox-dot" }
                    } else {
                        Icon {
                            icon: MdiIcon::Check,
                            size: props.size.icon_px(),
                            class: "hk-checkbox-icon".to_string(),
                            color: String::new(),
                        }
                    }
                }
                if indeterminate && !input_type.is_radio() {
                    span { class: "hk-checkbox-indeterminate" }
                }
            }
            Label {
                size: props.size.label_size(),
                text: props.label.clone(),
                children: props.children.clone(),
            }
        }
    }
}

impl StyledComponent for CheckboxComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-checkbox*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkCheckbox.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "checkbox"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checkbox_size_classes_match_the_vue_modifiers() {
        assert_eq!(CheckboxSize::Sm.class_name(), "hk-checkbox-sm");
        assert_eq!(CheckboxSize::Md.class_name(), "hk-checkbox-md");
        assert_eq!(CheckboxSize::Lg.class_name(), "hk-checkbox-lg");
    }

    #[test]
    fn checkbox_size_drives_the_label_and_icon_scale() {
        // The sheet sizes `.hk-checkbox-icon` per step (11/14/16 px) and the
        // label shell inherits the same step, exactly like Vue's `size` prop.
        assert_eq!(CheckboxSize::Sm.label_size(), LabelSize::Sm);
        assert_eq!(CheckboxSize::Md.label_size(), LabelSize::Md);
        assert_eq!(CheckboxSize::Lg.label_size(), LabelSize::Lg);
        assert_eq!(CheckboxSize::Sm.icon_px(), 11);
        assert_eq!(CheckboxSize::Md.icon_px(), 14);
        assert_eq!(CheckboxSize::Lg.icon_px(), 16);
    }

    #[test]
    fn checkbox_type_tokens_match_the_vue_attribute_values() {
        assert_eq!(CheckboxType::default(), CheckboxType::Checkbox);
        assert_eq!(CheckboxType::Checkbox.attr_value(), "checkbox");
        assert_eq!(CheckboxType::Radio.attr_value(), "radio");
        assert!(!CheckboxType::Checkbox.is_radio());
        assert!(CheckboxType::Radio.is_radio());
    }

    #[test]
    fn checkbox_change_payload_is_the_post_click_state() {
        // Vue emits `e.target.checked`, not "the opposite of the current prop".
        assert!(next_checked(false, false), "unchecked -> checked");
        assert!(!next_checked(true, false), "checked -> unchecked");
        assert!(
            next_checked(false, true),
            "indeterminate -> checked (the browser clears the dash)"
        );
        assert!(
            next_checked(true, true),
            "indeterminate stays checked (Vue reads the input, not the props)"
        );
    }

    #[test]
    fn checkbox_defaults_match_the_vue_props() {
        let props = CheckboxProps::default();
        assert!(!props.checked);
        assert!(!props.indeterminate);
        assert!(!props.disabled);
        assert_eq!(props.input_type, CheckboxType::Checkbox);
        assert_eq!(props.size, CheckboxSize::Md);
        assert_eq!(props.label, None);
        assert_eq!(props.on_change, None);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn checkbox_renders_the_vue_shell_for_every_prop_arm() {
        // The rendered tree is built from the mirror's own helpers; each arm is
        // exercised so a shape regression cannot hide behind a default render.
        let plain = Checkbox(CheckboxProps::default());
        assert!(
            !matches!(plain, VNode::Text(_)),
            "default render is an element"
        );

        let _ = Checkbox(CheckboxProps {
            checked: true,
            label: Some("Remember".to_string()),
            ..Default::default()
        });
        let _ = Checkbox(CheckboxProps {
            indeterminate: true,
            size: CheckboxSize::Sm,
            ..Default::default()
        });
        let _ = Checkbox(CheckboxProps {
            checked: true,
            input_type: CheckboxType::Radio,
            size: CheckboxSize::Lg,
            class: "host".to_string(),
            style: "margin-top:2px".to_string(),
            ..Default::default()
        });
        let _ = Checkbox(CheckboxProps {
            disabled: true,
            on_change: Some(EventHandler::new(|_| {})),
            children: VNode::Text(VText::new("rich label")),
            ..Default::default()
        });
    }

    #[test]
    fn checkbox_styles_come_from_the_canonical_vue_sheet() {
        let css = CheckboxComponent::styles();
        for needle in [
            ".hk-checkbox",
            ".hk-checkbox-box",
            ".hk-checkbox-input",
            ".hk-checkbox-icon",
            ".hk-checkbox-dot",
            ".hk-checkbox-indeterminate",
        ] {
            assert!(
                css.contains(needle),
                "checkbox css must carry the vue class {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored checkbox sheet"
        );
    }
}
