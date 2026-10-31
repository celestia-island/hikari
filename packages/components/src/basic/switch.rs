// hi-components/src/basic/switch.rs
// Switch — mirror of the canonical Vue `HkSwitch`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkSwitch.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-switch*` class names are literal and
// identical in both forms. DOM contract (mirrors Vue one-to-one):
//
//   label.hk-switch.hk-switch-{size}.hk-switch-{color}
//         [data-checked] [data-disabled] [class] [style]
//     input.hk-switch-input  type=checkbox [checked] [disabled]  (onchange)
//     span.hk-switch-track                                       (onclick)
//       span.hk-switch-thumb
//       span.hk-switch-content.hk-switch-content-off  {uncheckedContent}  (!checked)
//       span.hk-switch-content.hk-switch-content-on   {checkedContent}    (checked)
//     span.hk-label.hk-label-{size}                              (label / slot)
//
// Vue prop mapping: `modelValue` → [`SwitchProps::checked`]; `checkedContent` /
// `uncheckedContent` → [`SwitchProps::checked_content`] /
// [`SwitchProps::unchecked_content`] (plain strings in Vue — they ride INSIDE
// the track, next to the thumb); `update:modelValue` →
// [`SwitchProps::on_change`] with the toggled value. Both Vue toggle paths are
// mirrored: the native input's `change`, and the track's `click` — which calls
// `prevent_default()` first, exactly like Vue, so the label does not activate
// the input a second time and one click emits one event.
//
// State is controlled-only (checked / disabled in, one callback out): the sheet
// drives every visual from the root's `data-*` markers, so no tairitsu
// `Signal`/`use_state` is involved.
//
// Deltas vs Vue (documented):
// * Vue emits NO `aria-checked` (nor any `aria-*`) here: the wrapped native
//   `<input type="checkbox">` owns the role and the state, and the track is
//   decorative paint around it. The mirror therefore adds none — an
//   `aria-checked` on the label would announce the state twice.
// * The legacy Rust `Switch` is retired: its `variant`
//   (`Default`/`Text`/`Icon`/`Custom`), `SwitchContent`
//   (`Text`/`Icon`/`Image`) and `SwitchIcon` props have no Vue counterpart
//   (Vue's content faces are plain `checkedContent`/`uncheckedContent`
//   strings), and its hand-rolled inline sheet is replaced by the canonical
//   HkSwitch sheet. `SwitchColor` keeps its name but now covers Vue's four
//   inks (`primary` / `secondary` / `danger` / `warning`) instead of two.

use crate::basic::label::{Label, LabelProps, LabelSize};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SwitchComponent;

/// The three track sizes (Vue: `"sm" | "md" | "lg"`, default `md`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SwitchSize {
    Sm,
    #[default]
    Md,
    Lg,
}

impl SwitchSize {
    /// The `hk-switch-<size>` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            SwitchSize::Sm => "hk-switch-sm",
            SwitchSize::Md => "hk-switch-md",
            SwitchSize::Lg => "hk-switch-lg",
        }
    }

    /// The matching `HkLabel` size (Vue passes its `size` through to `HkLabel`).
    pub fn label_size(self) -> LabelSize {
        match self {
            SwitchSize::Sm => LabelSize::Sm,
            SwitchSize::Md => LabelSize::Md,
            SwitchSize::Lg => LabelSize::Lg,
        }
    }
}

/// The four checked inks (Vue: `"primary" | "secondary" | "danger" | "warning"`,
/// default `primary`). The sheet colors the checked track from this modifier only;
/// the unchecked track is the shared neutral fill.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SwitchColor {
    #[default]
    Primary,
    Secondary,
    Danger,
    Warning,
}

impl SwitchColor {
    /// The `hk-switch-<color>` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            SwitchColor::Primary => "hk-switch-primary",
            SwitchColor::Secondary => "hk-switch-secondary",
            SwitchColor::Danger => "hk-switch-danger",
            SwitchColor::Warning => "hk-switch-warning",
        }
    }
}

/// The `update:modelValue` payload (Vue `toggle()`): the flipped value.
pub fn toggled(checked: bool) -> bool {
    !checked
}

#[define_props]
pub struct SwitchProps {
    /// Controlled checked state (Vue: `modelValue`, default `false`).
    #[default]
    pub checked: bool,

    #[default]
    pub disabled: bool,

    #[default]
    pub size: SwitchSize,

    /// Checked ink (Vue: `color`).
    #[default]
    pub color: SwitchColor,

    /// Label text; the default slot (`children`) wins over it when present.
    pub label: Option<String>,

    /// Text shown inside the track while checked (Vue: `checkedContent`).
    pub checked_content: Option<String>,

    /// Text shown inside the track while unchecked (Vue: `uncheckedContent`).
    pub unchecked_content: Option<String>,

    /// Emitted with the toggled value; a no-op while disabled.
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
pub fn Switch(props: SwitchProps) -> Element {
    let checked = props.checked;
    let disabled = props.disabled;

    let mut root_classes = String::from("hk-switch");
    root_classes.push(' ');
    root_classes.push_str(props.size.class_name());
    root_classes.push(' ');
    root_classes.push_str(props.color.class_name());
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    // Vue renders a content face only when it is non-empty AND on its side.
    let off_content = if checked {
        None
    } else {
        props
            .unchecked_content
            .clone()
            .filter(|text| !text.is_empty())
    };
    let on_content = if checked {
        props
            .checked_content
            .clone()
            .filter(|text| !text.is_empty())
    } else {
        None
    };

    // Vue's two toggle paths: the input's `change`, and the track's `click`
    // (which preventDefaults first so the label does not fire a second one).
    let on_change = props.on_change.clone();
    let handle_change = move |_: ChangeEvent| {
        if disabled {
            return;
        }
        if let Some(handler) = on_change.as_ref() {
            handler.call(toggled(checked));
        }
    };

    let on_change_click = props.on_change.clone();
    let handle_track_click = move |event: MouseEvent| {
        event.prevent_default();
        if disabled {
            return;
        }
        if let Some(handler) = on_change_click.as_ref() {
            handler.call(toggled(checked));
        }
    };

    rsx! {
        label {
            class: root_classes,
            style: props.style.clone(),
            "data-checked": if checked { Some("") } else { None },
            "data-disabled": if disabled { Some("") } else { None },
            input {
                class: "hk-switch-input",
                type: "checkbox",
                checked: checked,
                disabled: disabled,
                onchange: handle_change,
            }
            span {
                class: "hk-switch-track",
                onclick: handle_track_click,
                span { class: "hk-switch-thumb" }
                if let Some(text) = off_content {
                    span { class: "hk-switch-content hk-switch-content-off",
                        "{text}"
                    }
                }
                if let Some(text) = on_content {
                    span { class: "hk-switch-content hk-switch-content-on",
                        "{text}"
                    }
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

impl StyledComponent for SwitchComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-switch*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkSwitch.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "switch"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn switch_size_classes_match_the_vue_modifiers() {
        assert_eq!(SwitchSize::Sm.class_name(), "hk-switch-sm");
        assert_eq!(SwitchSize::Md.class_name(), "hk-switch-md");
        assert_eq!(SwitchSize::Lg.class_name(), "hk-switch-lg");
    }

    #[test]
    fn switch_color_classes_match_the_vue_modifiers() {
        assert_eq!(SwitchColor::Primary.class_name(), "hk-switch-primary");
        assert_eq!(SwitchColor::Secondary.class_name(), "hk-switch-secondary");
        assert_eq!(SwitchColor::Danger.class_name(), "hk-switch-danger");
        assert_eq!(SwitchColor::Warning.class_name(), "hk-switch-warning");
    }

    #[test]
    fn switch_size_drives_the_label_shell() {
        assert_eq!(SwitchSize::Sm.label_size(), LabelSize::Sm);
        assert_eq!(SwitchSize::Md.label_size(), LabelSize::Md);
        assert_eq!(SwitchSize::Lg.label_size(), LabelSize::Lg);
    }

    #[test]
    fn switch_toggle_payload_is_the_flipped_value() {
        assert!(toggled(false));
        assert!(!toggled(true));
    }

    #[test]
    fn switch_defaults_match_the_vue_props() {
        let props = SwitchProps::default();
        assert!(!props.checked);
        assert!(!props.disabled);
        assert_eq!(props.size, SwitchSize::Md);
        assert_eq!(props.color, SwitchColor::Primary);
        assert_eq!(props.label, None);
        assert_eq!(props.checked_content, None);
        assert_eq!(props.unchecked_content, None);
        assert_eq!(props.on_change, None);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn switch_renders_the_vue_shell_for_every_prop_arm() {
        let plain = Switch(SwitchProps::default());
        assert!(
            !matches!(plain, VNode::Text(_)),
            "default render is an element"
        );

        let _ = Switch(SwitchProps {
            checked: true,
            color: SwitchColor::Danger,
            size: SwitchSize::Lg,
            checked_content: Some("ON".to_string()),
            unchecked_content: Some("OFF".to_string()),
            label: Some("Enabled".to_string()),
            ..Default::default()
        });
        let _ = Switch(SwitchProps {
            disabled: true,
            size: SwitchSize::Sm,
            on_change: Some(EventHandler::new(|_| {})),
            class: "host".to_string(),
            style: "margin-top:2px".to_string(),
            children: VNode::Text(VText::new("rich label")),
            ..Default::default()
        });
    }

    #[test]
    fn switch_styles_come_from_the_canonical_vue_sheet() {
        let css = SwitchComponent::styles();
        for needle in [
            ".hk-switch",
            ".hk-switch-track",
            ".hk-switch-thumb",
            ".hk-switch-content",
            ".hk-switch-content-on",
            ".hk-switch-content-off",
            ".hk-switch-danger",
            ".hk-switch-warning",
        ] {
            assert!(
                css.contains(needle),
                "switch css must carry the vue class {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored switch sheet"
        );
    }
}
