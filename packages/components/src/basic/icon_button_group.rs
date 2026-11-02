// hi-components/src/basic/icon_button_group.rs
// IconButtonGroup — mirror of the canonical Vue `HkIconButtonGroup` (the
// icon-only member of the button-group family).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkIconButtonGroup.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.hk-icon-group*` class names are literal and identical in both forms.
// The DOM contract below mirrors the Vue render output one-to-one:
//
//   div.hk-icon-group.hk-icon-group-{mode}.hk-icon-group-{variant}
//                    .hk-icon-group-{size}           (role: group | radiogroup)
//     span.hk-icon-group-slider-thumb               (see the thumb rule below)
//     span.hk-tooltip-wrapper                       (only while the item keeps
//       span.hk-tooltip-trigger                      a tooltip — the crate's
//         button.hk-icon-group-item                  mirrored `Tooltip`)
//           data-key, data-active, role,            (role / aria-checked only
//           aria-checked, aria-pressed,             in "single"; aria-pressed
//           aria-disabled, aria-label, disabled     only in "multiple")
//           span.hk-icon-group-item-icon
//             div.hk-icon                           (the MDI glyph)
//       div#hk-tooltip-{n}.hk-tooltip-popup          (the bubble)
//     button.hk-icon-group-item                     (a suppressed tooltip
//                                                     renders the bare item)
//
// Two orthogonal prop axes, exactly like Vue: `mode` is the SEMANTIC axis
// ("buttons" = action strip, "single" = radio, "multiple" = toggle set) and
// `variant` is the VISUAL one ("track" / "plain" / "slider"). The slider
// thumb exists only for "single" WITH an active key — "multiple" tints each
// item instead, because one thumb cannot hop between simultaneous
// selections.
//
// Behaviour is Vue's `onSelect` branch for branch:
//   * group-disabled or item-disabled → nothing at all (no callback fires),
//   * "buttons"  → `on_select` on EVERY click (no selection state exists),
//   * "single"   → radio semantics: a click on the ALREADY active key is a
//                  full no-op (neither callback fires), any other key emits
//                  the new value and then `on_select`,
//   * "multiple" → toggles the key into / out of the set (`[...current, key]`
//                  when absent — the key lands LAST, exactly Vue) and then
//                  fires `on_select`.
// The emit ORDER is Vue's: the model value first, `select` second.
//
// The click decision is the pure `click_action`, so the disabled / radio
// no-op / toggle rules are unit-tested without a renderer; the Vue suite
// pins the same three cases.
//
// STATE IS CONTROLLED ONLY. tairitsu 0.5.22 component-body hooks are
// render-scoped (`use_signal` allocates a NEW Signal on every render, and
// `use_state` is one slot shared by every instance of a component type), so
// the group keeps no state: the host owns the value and re-renders on
// `on_value_change`, which is the Vue controlled contract anyway.
//
// Prop mapping — Vue's `modelValue: string | string[] | null` is a union a
// single Rust field cannot carry, so it is SPLIT IN TWO and `mode` selects
// which one is read (the other is ignored):
//   "single"   → `value: Option<String>`   (`None` = nothing active)
//   "multiple" → `values: Vec<String>`     (empty = nothing active)
//   "buttons"  → neither is read
// That keeps one props shape per host call site instead of a tagged enum at
// every use, and each mode carries a precise type (no `string | string[]`).
//
// Adaptation deltas vs Vue (deliberate, listed instead of hidden):
//   * `on_value_change(IconButtonGroupValue)` is the Rust ring of Vue's
//     `update:modelValue` emit: `Single(key)` ↔ the string payload,
//     `Multiple(keys)` ↔ the string[] payload — the union the emit carries.
//   * `aria_label` is an explicit prop standing in for Vue's attribute
//     fallthrough (`inheritAttrs: false` + `{...attrs}`): consumers such as
//     `HkMfaVerifyCard` pass `aria-label` onto the root, and mirrored props
//     have no attribute spread.
//   * `icon` is a REQUIRED typed `MdiIcon` (Vue takes an optional loose
//     vnode). Consequences: no `.hk-icon-group-item-initial` fallback for a
//     missing icon (that sheet class stays unused in the Rust form), and the
//     glyph size comes from `IconButtonGroupSize::glyph_px` — half the item
//     box (18 / 22 / 26 px), whose md step is the 22px the one real consumer
//     already passes — instead of a host-sized vnode.
//   * The `marker` / `data-marker` status dot is NOT mirrored in this wave
//     (it is outside the prop list this component ships); the sheet's
//     `.hk-icon-group-item-marker*` rules stay unused by the Rust form.
//   * `aria-disabled` is emitted ALONGSIDE the native `disabled` attribute
//     when an item is dead (Vue relies on the attribute alone). This is the
//     one additive DOM difference, kept because the family's brief calls for
//     the state on the item; it is absent on live items, so enabled markup is
//     byte-identical to Vue and dropping the field is a one-line revert.
//   * No vnode keys: Vue's `key` is a reconciliation hint with no DOM trace,
//     while the crate's rsx `key:` attribute would LEAK a literal `key`
//     attribute into the markup. The item list is reconciled positionally.
//   * The tooltip wrapper is the crate's mirrored `Tooltip`, so its own
//     documented deltas (no clamp / flip pass, no popup manager) apply.

use hikari_icons::{Icon, MdiIcon};

use crate::feedback::{TOOLTIP_DEFAULT_DELAY_MS, Tooltip, TooltipPlacement};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct IconButtonGroupComponent;

/// The three working modes (Vue: `"buttons" | "single" | "multiple"`,
/// default `"buttons"`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum IconButtonGroupMode {
    #[default]
    Buttons,
    Single,
    Multiple,
}

impl IconButtonGroupMode {
    /// The `hk-icon-group-{mode}` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            IconButtonGroupMode::Buttons => "hk-icon-group-buttons",
            IconButtonGroupMode::Single => "hk-icon-group-single",
            IconButtonGroupMode::Multiple => "hk-icon-group-multiple",
        }
    }

    /// The group role (Vue: `mode === "single" ? "radiogroup" : "group"`).
    pub fn group_role(self) -> &'static str {
        match self {
            IconButtonGroupMode::Single => "radiogroup",
            IconButtonGroupMode::Buttons | IconButtonGroupMode::Multiple => "group",
        }
    }

    /// Whether this mode is the radio-semantics selector.
    pub fn is_single(self) -> bool {
        matches!(self, IconButtonGroupMode::Single)
    }

    /// Whether this mode is the toggle-set selector.
    pub fn is_multiple(self) -> bool {
        matches!(self, IconButtonGroupMode::Multiple)
    }
}

/// The visual treatments, orthogonal to the semantic mode (Vue default
/// `"track"`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum IconButtonGroupVariant {
    #[default]
    Track,
    Plain,
    Slider,
}

impl IconButtonGroupVariant {
    /// The `hk-icon-group-{variant}` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            IconButtonGroupVariant::Track => "hk-icon-group-track",
            IconButtonGroupVariant::Plain => "hk-icon-group-plain",
            IconButtonGroupVariant::Slider => "hk-icon-group-slider",
        }
    }
}

/// The three size steps (Vue default `"md"`). Each names the item box in the
/// sheet: sm 2.25rem (36px), md 2.75rem (44px), lg 3.25rem (52px).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum IconButtonGroupSize {
    Sm,
    #[default]
    Md,
    Lg,
}

impl IconButtonGroupSize {
    /// The `hk-icon-group-{size}` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            IconButtonGroupSize::Sm => "hk-icon-group-sm",
            IconButtonGroupSize::Md => "hk-icon-group-md",
            IconButtonGroupSize::Lg => "hk-icon-group-lg",
        }
    }

    /// The glyph size in px — half the item box (Vue leaves the size to the
    /// icon vnode the host passes; the md step matches the 22px the one real
    /// consumer uses).
    pub fn glyph_px(self) -> u32 {
        match self {
            IconButtonGroupSize::Sm => 18,
            IconButtonGroupSize::Md => 22,
            IconButtonGroupSize::Lg => 26,
        }
    }
}

/// One selectable icon in the group (Vue: `HkIconButtonGroupOption`).
///
/// `label` is BOTH the accessible name and the default tooltip text — an
/// icon-only control without a label is an a11y hole, which is why the field
/// is not optional here (Vue requires it for the same reason).
#[derive(Clone, PartialEq, Debug)]
pub struct HkIconButtonGroupOption {
    /// Stable identity — the value surfaced through `value` / `values` and
    /// through `data-key`.
    pub key: String,

    /// The glyph (Vue: a prebuilt vnode — brand SVG, lucide component, img;
    /// the Rust form takes the typed MDI icon instead).
    pub icon: MdiIcon,

    /// Accessible name AND the default tooltip text.
    pub label: String,

    /// Tooltip text override; an EMPTY string suppresses the tooltip
    /// wrapper entirely (Vue: `option.tooltip !== undefined ? … : label`).
    pub tooltip: Option<String>,

    /// A dead item: it keeps its place and its active state but no click
    /// reaches it (Vue: `disabled={props.disabled || option.disabled}`).
    pub disabled: bool,
}

impl HkIconButtonGroupOption {
    /// The common case — an enabled, tooltip-follows-label item.
    pub fn new(key: impl Into<String>, icon: MdiIcon, label: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            icon,
            label: label.into(),
            tooltip: None,
            disabled: false,
        }
    }
}

/// The value Vue's `update:modelValue` emit carries (`string | string[]`),
/// spelled as a Rust enum so one callback can serve either mode.
#[derive(Clone, PartialEq, Debug)]
pub enum IconButtonGroupValue {
    /// `single` mode: the newly active key.
    Single(String),
    /// `multiple` mode: the full next key set.
    Multiple(Vec<String>),
}

/// What a click on one item does — Vue's `onSelect` early-return structure
/// as a value, so the radio no-op and the toggle rule are testable.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum IconButtonGroupAction {
    /// Nothing happens at all (dead group / dead item, or the radio no-op).
    Ignore,
    /// `buttons` mode: only `select` fires, no value exists to change.
    SelectOnly,
    /// `single` mode: emit the key as the new value.
    SelectSingle,
    /// `multiple` mode: toggle the key in / out of the set.
    ToggleMultiple,
}

/// Props for the IconButtonGroup component.
#[define_props]
pub struct IconButtonGroupProps {
    /// The items, in render order.
    #[default]
    pub options: Vec<HkIconButtonGroupOption>,

    /// The active key — read in `single` mode only (`None` = nothing
    /// active). See the file header for the `modelValue` split.
    pub value: Option<String>,

    /// The active keys — read in `multiple` mode only (empty = nothing
    /// active). Order is preserved: a toggled-on key lands last, like Vue's
    /// `[...current, key]`.
    #[default]
    pub values: Vec<String>,

    /// The semantic mode (radiogroup / toggle set / plain action strip).
    #[default]
    pub mode: IconButtonGroupMode,

    /// The visual treatment, orthogonal to `mode`.
    #[default]
    pub variant: IconButtonGroupVariant,

    /// The size step (also picks the glyph size).
    #[default]
    pub size: IconButtonGroupSize,

    /// Kill the whole group: every item renders disabled and no click fires
    /// (Vue: `disabled`).
    #[default]
    pub disabled: bool,

    /// Where the per-item tooltip is anchored (Vue: `tooltipPlacement`).
    #[default]
    pub tooltip_placement: TooltipPlacement,

    /// Milliseconds before the tooltip appears (Vue: `tooltipDelay`, 300 —
    /// the same default the mirrored `Tooltip` carries).
    #[default(TOOLTIP_DEFAULT_DELAY_MS)]
    pub tooltip_delay: u32,

    /// The group's accessible name. Mirrors Vue's attribute fallthrough onto
    /// the root (`aria-label`); `None` leaves the group unnamed.
    pub aria_label: Option<String>,

    /// Extra class appended to the root class list (Vue: class fallthrough).
    #[default]
    pub class: String,

    /// An item was activated (or toggled). Never fires for a no-op re-click
    /// of the already-active key in `single` mode, and never for a disabled
    /// group or item.
    pub on_select: Option<EventHandler<String>>,

    /// The v-model ring: fires BEFORE `on_select`, with the value Vue's
    /// `update:modelValue` would carry for this mode.
    pub on_value_change: Option<EventHandler<IconButtonGroupValue>>,
}

/// Vue's `isActive(key)` as a pure predicate: `buttons` mode has no
/// selection state at all, `single` compares the key, `multiple` looks the
/// key up in the set.
fn option_is_active(
    key: &str,
    mode: IconButtonGroupMode,
    value: Option<&str>,
    values: &[String],
) -> bool {
    match mode {
        IconButtonGroupMode::Buttons => false,
        IconButtonGroupMode::Single => value == Some(key),
        IconButtonGroupMode::Multiple => values.iter().any(|active| active == key),
    }
}

/// Vue's `activeIndex` computed (`options.findIndex(o => isActive(o.key))`),
/// with `None` standing in for Vue's `-1`.
fn active_index(
    options: &[HkIconButtonGroupOption],
    mode: IconButtonGroupMode,
    value: Option<&str>,
    values: &[String],
) -> Option<usize> {
    options
        .iter()
        .position(|option| option_is_active(&option.key, mode, value, values))
}

/// Vue's `showThumb`: the sliding pill exists only for a single-selection
/// slider strip that HAS an active key — `multiple` tints each item instead
/// and `buttons` has no selection at all.
fn show_slider_thumb(
    mode: IconButtonGroupMode,
    variant: IconButtonGroupVariant,
    active_index: Option<usize>,
) -> bool {
    variant == IconButtonGroupVariant::Slider && mode.is_single() && active_index.is_some()
}

/// The thumb's inline style — Vue's `thumbStyle`:
/// `--hk-icon-group-active-index: String(Math.max(activeIndex, 0))`. The
/// sheet turns that index into `translateX(index × (item-size + gap))`, so a
/// retuned size keeps the thumb aligned with no JS measurement.
fn thumb_style(active_index: Option<usize>) -> String {
    format!(
        "--hk-icon-group-active-index:{}",
        active_index.unwrap_or_default()
    )
}

/// Vue's `onSelect` decision as a pure value (see
/// [`IconButtonGroupAction`]).
fn click_action(
    mode: IconButtonGroupMode,
    group_disabled: bool,
    item_disabled: bool,
    active: bool,
) -> IconButtonGroupAction {
    if group_disabled || item_disabled {
        return IconButtonGroupAction::Ignore;
    }
    match mode {
        IconButtonGroupMode::Buttons => IconButtonGroupAction::SelectOnly,
        // Radio semantics: re-clicking the active key emits nothing.
        IconButtonGroupMode::Single if active => IconButtonGroupAction::Ignore,
        IconButtonGroupMode::Single => IconButtonGroupAction::SelectSingle,
        IconButtonGroupMode::Multiple => IconButtonGroupAction::ToggleMultiple,
    }
}

/// Vue's `multiple` toggle: `[...current, key]` when the key is absent
/// (appended LAST, so the set order stays stable), filtered when present.
fn next_multiple_values(current: &[String], key: &str) -> Vec<String> {
    if current.iter().any(|active| active == key) {
        current
            .iter()
            .filter(|active| active.as_str() != key)
            .cloned()
            .collect()
    } else {
        let mut next = current.to_vec();
        next.push(key.to_string());
        next
    }
}

/// The tooltip text for one item, resolved (`tooltip !== undefined ?
/// tooltip : label`) and normalized: an empty result — an explicit `""`
/// override or an empty label — suppresses the wrapper, which is Vue's
/// `tooltip ?` render guard.
fn option_tooltip_text(option: &HkIconButtonGroupOption) -> Option<String> {
    let text = match &option.tooltip {
        Some(override_text) => override_text.clone(),
        None => option.label.clone(),
    };
    if text.is_empty() { None } else { Some(text) }
}

/// The root class list in Vue's computed order — base, mode, variant, size —
/// with the host `class` appended last (Vue merges the fallthrough class into
/// the same list).
fn group_classes(
    mode: IconButtonGroupMode,
    variant: IconButtonGroupVariant,
    size: IconButtonGroupSize,
    class: &str,
) -> String {
    let mut classes = format!(
        "hk-icon-group {} {} {}",
        mode.class_name(),
        variant.class_name(),
        size.class_name()
    );
    if !class.is_empty() {
        classes.push(' ');
        classes.push_str(class);
    }
    classes
}

/// The icon-only button-group family: a selector (radio / toggle set) or a
/// tight action strip, every item icon-only and tooltip-wrapped.
///
/// Fully controlled — the host owns `value` / `values` and re-renders with
/// what `on_value_change` reported (see the file header on tairitsu 0.5.22
/// render-scoped hooks).
#[component]
pub fn IconButtonGroup(props: IconButtonGroupProps) -> Element {
    let mode = props.mode;
    let variant = props.variant;
    let group_disabled = props.disabled;
    let glyph_px = props.size.glyph_px();

    // Copied out so the per-item closures can own what they need while the
    // option list stays borrowed for the render below.
    let active_key = props.value.clone();
    let active_keys = props.values.clone();

    let active = active_index(&props.options, mode, active_key.as_deref(), &active_keys);
    let classes = group_classes(mode, variant, props.size, &props.class);
    let group_role = mode.group_role();

    let on_select = props.on_select.clone();
    let on_value_change = props.on_value_change.clone();

    let mut children: Vec<VNode> = Vec::with_capacity(props.options.len() + 1);

    // Vue renders the thumb FIRST, behind every item, and only when a
    // single-selection slider strip has an active key to point at.
    if show_slider_thumb(mode, variant, active) {
        let style = thumb_style(active);
        children.push(rsx! {
            span {
                class: "hk-icon-group-slider-thumb",
                "aria-hidden": "true",
                style: style,
            }
        });
    }

    for option in props.options.iter() {
        let is_active = option_is_active(&option.key, mode, active_key.as_deref(), &active_keys);
        let item_disabled = option.disabled;
        let disabled = group_disabled || item_disabled;
        let action = click_action(mode, group_disabled, item_disabled, is_active);

        // Vue emits each ARIA carrier only in the mode that owns it, and
        // `data-active` whenever the item is active (value "true": Vue
        // renders the boolean through the dataset, not an empty attribute).
        let item_role: Option<&'static str> = if mode.is_single() {
            Some("radio")
        } else {
            None
        };
        let data_active: Option<&'static str> = if is_active { Some("true") } else { None };
        let aria_checked: Option<&'static str> = if mode.is_single() {
            Some(if is_active { "true" } else { "false" })
        } else {
            None
        };
        let aria_pressed: Option<&'static str> = if mode.is_multiple() {
            Some(if is_active { "true" } else { "false" })
        } else {
            None
        };
        // Additive delta vs Vue (see the file header): a dead item carries the
        // state in ARIA as well as in the native `disabled` attribute. Live
        // items stay attribute-free, so enabled markup matches Vue exactly.
        let aria_disabled: Option<&'static str> = if disabled { Some("true") } else { None };

        // The handler owns its own copy of everything it reads — Vue's
        // `onSelect` reads the CURRENT props, and so does this closure with
        // the value the host rendered it with.
        let key_for_click = option.key.clone();
        let values_for_click = active_keys.clone();
        let on_select_for_click = on_select.clone();
        let on_value_change_for_click = on_value_change.clone();

        let on_click = move |_event: MouseEvent| {
            if action == IconButtonGroupAction::Ignore {
                return;
            }
            match action {
                IconButtonGroupAction::Ignore => {}
                IconButtonGroupAction::SelectOnly => {}
                IconButtonGroupAction::SelectSingle => {
                    if let Some(handler) = on_value_change_for_click.as_ref() {
                        handler.call(IconButtonGroupValue::Single(key_for_click.clone()));
                    }
                }
                IconButtonGroupAction::ToggleMultiple => {
                    let next = next_multiple_values(&values_for_click, &key_for_click);
                    if let Some(handler) = on_value_change_for_click.as_ref() {
                        handler.call(IconButtonGroupValue::Multiple(next));
                    }
                }
            }
            // Vue's emit order: the model value first, `select` second.
            if let Some(handler) = on_select_for_click.as_ref() {
                handler.call(key_for_click.clone());
            }
        };

        let button: VNode = rsx! {
            button {
                class: "hk-icon-group-item",
                "type": "button",
                "data-key": option.key.clone(),
                "data-active": data_active,
                "role": item_role,
                "aria-checked": aria_checked,
                "aria-pressed": aria_pressed,
                "aria-disabled": aria_disabled,
                "aria-label": option.label.clone(),
                disabled: disabled,
                onclick: on_click,
                span {
                    class: "hk-icon-group-item-icon",
                    Icon {
                        icon: option.icon,
                        size: glyph_px,
                    }
                }
            }
        };

        // Vue wraps the item in an HkTooltip while it has text and renders
        // it bare otherwise; an empty `tooltip` override is the documented
        // way to suppress the hover reveal (while keeping the label).
        children.push(match option_tooltip_text(option) {
            Some(text) => rsx! {
                Tooltip {
                    text,
                    placement: props.tooltip_placement,
                    delay: props.tooltip_delay,
                    children: button,
                }
            },
            None => button,
        });
    }

    rsx! {
        div {
            class: classes,
            "role": group_role,
            "aria-label": props.aria_label.clone(),
            {VNode::Fragment(children)}
        }
    }
}

impl StyledComponent for IconButtonGroupComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-icon-group*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkIconButtonGroup.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "icon-button-group"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options() -> Vec<HkIconButtonGroupOption> {
        vec![
            HkIconButtonGroupOption::new("totp", MdiIcon::Check, "TOTP"),
            HkIconButtonGroupOption::new("passkey", MdiIcon::Help, "Passkey"),
        ]
    }

    fn root_element(node: &VNode) -> &VElement {
        match node {
            VNode::Element(element) => element.as_ref(),
            _ => panic!("the group root must be a single element"),
        }
    }

    fn collect_by_tag<'a>(node: &'a VNode, tag: &str, out: &mut Vec<&'a VElement>) {
        match node {
            VNode::Element(element) => {
                if element.tag == tag {
                    out.push(element);
                }
                for child in &element.children {
                    collect_by_tag(child, tag, out);
                }
            }
            VNode::Fragment(children) => {
                for child in children {
                    collect_by_tag(child, tag, out);
                }
            }
            VNode::Text(_) | VNode::DynamicText(_) => {}
        }
    }

    fn by_tag<'a>(node: &'a VNode, tag: &str) -> Vec<&'a VElement> {
        let mut out = Vec::new();
        collect_by_tag(node, tag, &mut out);
        out
    }

    fn count_class(node: &VNode, class: &str) -> usize {
        match node {
            VNode::Element(element) => {
                let here = element
                    .class
                    .to_string()
                    .split_whitespace()
                    .any(|name| name == class) as usize;
                here + element
                    .children
                    .iter()
                    .map(|child| count_class(child, class))
                    .sum::<usize>()
            }
            VNode::Fragment(children) => {
                children.iter().map(|child| count_class(child, class)).sum()
            }
            VNode::Text(_) | VNode::DynamicText(_) => 0,
        }
    }

    fn attr<'a>(element: &'a VElement, name: &str) -> Option<&'a str> {
        element.attributes.get(name).map(String::as_str)
    }

    #[test]
    fn icon_button_group_mode_class_names_match_the_vue_modifiers() {
        assert_eq!(
            IconButtonGroupMode::Buttons.class_name(),
            "hk-icon-group-buttons"
        );
        assert_eq!(
            IconButtonGroupMode::Single.class_name(),
            "hk-icon-group-single"
        );
        assert_eq!(
            IconButtonGroupMode::Multiple.class_name(),
            "hk-icon-group-multiple"
        );
        // Vue: `mode === "single" ? "radiogroup" : "group"`.
        assert_eq!(IconButtonGroupMode::Single.group_role(), "radiogroup");
        assert_eq!(IconButtonGroupMode::Buttons.group_role(), "group");
        assert_eq!(IconButtonGroupMode::Multiple.group_role(), "group");
    }

    #[test]
    fn icon_button_group_variant_and_size_class_names_match_the_vue_modifiers() {
        assert_eq!(
            IconButtonGroupVariant::Track.class_name(),
            "hk-icon-group-track"
        );
        assert_eq!(
            IconButtonGroupVariant::Plain.class_name(),
            "hk-icon-group-plain"
        );
        assert_eq!(
            IconButtonGroupVariant::Slider.class_name(),
            "hk-icon-group-slider"
        );
        assert_eq!(IconButtonGroupSize::Sm.class_name(), "hk-icon-group-sm");
        assert_eq!(IconButtonGroupSize::Md.class_name(), "hk-icon-group-md");
        assert_eq!(IconButtonGroupSize::Lg.class_name(), "hk-icon-group-lg");
        // Glyph steps: half the 36 / 44 / 52 px item box.
        assert_eq!(IconButtonGroupSize::Sm.glyph_px(), 18);
        assert_eq!(IconButtonGroupSize::Md.glyph_px(), 22);
        assert_eq!(IconButtonGroupSize::Lg.glyph_px(), 26);
    }

    #[test]
    fn icon_button_group_defaults_match_the_vue_props() {
        let props = IconButtonGroupProps::default();
        assert!(props.options.is_empty());
        // Vue: `modelValue` default null — both carriers start empty.
        assert!(props.value.is_none());
        assert!(props.values.is_empty());
        assert_eq!(props.mode, IconButtonGroupMode::Buttons);
        assert_eq!(props.variant, IconButtonGroupVariant::Track);
        assert_eq!(props.size, IconButtonGroupSize::Md);
        assert!(!props.disabled);
        assert_eq!(props.tooltip_placement, TooltipPlacement::Top);
        assert_eq!(props.tooltip_delay, TOOLTIP_DEFAULT_DELAY_MS);
        assert_eq!(props.tooltip_delay, 300, "Vue's tooltipDelay default");
        assert!(props.aria_label.is_none());
        assert_eq!(props.class, "");
        assert!(props.on_select.is_none());
        assert!(props.on_value_change.is_none());
    }

    #[test]
    fn icon_button_group_root_classes_follow_the_vue_order() {
        let classes = group_classes(
            IconButtonGroupMode::Single,
            IconButtonGroupVariant::Slider,
            IconButtonGroupSize::Lg,
            "",
        );
        assert_eq!(
            classes,
            "hk-icon-group hk-icon-group-single hk-icon-group-slider hk-icon-group-lg"
        );
        // The host class rides last and never leaves a dangling space.
        assert_eq!(
            group_classes(
                IconButtonGroupMode::Buttons,
                IconButtonGroupVariant::Plain,
                IconButtonGroupSize::Sm,
                "s-mfa-factors"
            ),
            "hk-icon-group hk-icon-group-buttons hk-icon-group-plain hk-icon-group-sm s-mfa-factors"
        );
    }

    #[test]
    fn icon_button_group_active_index_is_a_pure_lookup() {
        let opts = options();
        let totp = "totp";
        let passkey = "passkey";
        // "buttons" has no selection state, whatever the value says.
        assert_eq!(
            active_index(&opts, IconButtonGroupMode::Buttons, Some(passkey), &[]),
            None
        );
        // "single" compares the key.
        assert_eq!(
            active_index(&opts, IconButtonGroupMode::Single, Some(totp), &[]),
            Some(0)
        );
        assert_eq!(
            active_index(&opts, IconButtonGroupMode::Single, Some(passkey), &[]),
            Some(1)
        );
        assert_eq!(
            active_index(&opts, IconButtonGroupMode::Single, None, &[]),
            None
        );
        assert_eq!(
            active_index(&opts, IconButtonGroupMode::Single, Some("unknown"), &[]),
            None
        );
        // "multiple" looks the key up in the set (the FIRST active wins).
        let active: Vec<String> = vec!["passkey".to_string()];
        assert_eq!(
            active_index(&opts, IconButtonGroupMode::Multiple, None, &active),
            Some(1)
        );
    }

    #[test]
    fn icon_button_group_slider_thumb_only_for_single_with_an_active_key() {
        assert!(show_slider_thumb(
            IconButtonGroupMode::Single,
            IconButtonGroupVariant::Slider,
            Some(0)
        ));
        // No active key: nothing to point the pill at.
        assert!(!show_slider_thumb(
            IconButtonGroupMode::Single,
            IconButtonGroupVariant::Slider,
            None
        ));
        // "multiple" tints each item instead — one thumb cannot hop.
        assert!(!show_slider_thumb(
            IconButtonGroupMode::Multiple,
            IconButtonGroupVariant::Slider,
            Some(0)
        ));
        // Only the slider variant renders a thumb.
        assert!(!show_slider_thumb(
            IconButtonGroupMode::Single,
            IconButtonGroupVariant::Track,
            Some(0)
        ));
        assert!(!show_slider_thumb(
            IconButtonGroupMode::Buttons,
            IconButtonGroupVariant::Slider,
            None
        ));
    }

    #[test]
    fn icon_button_group_thumb_style_uses_the_index_variable() {
        assert_eq!(thumb_style(Some(0)), "--hk-icon-group-active-index:0");
        assert_eq!(thumb_style(Some(2)), "--hk-icon-group-active-index:2");
        // Vue's `Math.max(activeIndex, 0)` floor for the no-selection value.
        assert_eq!(thumb_style(None), "--hk-icon-group-active-index:0");
    }

    #[test]
    fn icon_button_group_click_semantics_match_the_vue_contract() {
        // "buttons": select on every click, nothing to change.
        assert_eq!(
            click_action(IconButtonGroupMode::Buttons, false, false, false),
            IconButtonGroupAction::SelectOnly
        );
        // "single": the active key is a full no-op (radio semantics)…
        assert_eq!(
            click_action(IconButtonGroupMode::Single, false, false, true),
            IconButtonGroupAction::Ignore
        );
        // …while any other key becomes the new value.
        assert_eq!(
            click_action(IconButtonGroupMode::Single, false, false, false),
            IconButtonGroupAction::SelectSingle
        );
        // "multiple": toggle.
        assert_eq!(
            click_action(IconButtonGroupMode::Multiple, false, false, true),
            IconButtonGroupAction::ToggleMultiple
        );
        // Dead group or dead item: nothing at all, in every mode.
        for mode in [
            IconButtonGroupMode::Buttons,
            IconButtonGroupMode::Single,
            IconButtonGroupMode::Multiple,
        ] {
            assert_eq!(
                click_action(mode, true, false, false),
                IconButtonGroupAction::Ignore,
                "a disabled group swallows every click"
            );
            assert_eq!(
                click_action(mode, false, true, false),
                IconButtonGroupAction::Ignore,
                "a disabled item swallows its click"
            );
        }
    }

    #[test]
    fn icon_button_group_multiple_toggle_appends_like_vue() {
        let current = vec!["passkey".to_string()];
        // Vue: `[...current, key]` — the new key lands last.
        assert_eq!(
            next_multiple_values(&current, "totp"),
            vec!["passkey".to_string(), "totp".to_string()]
        );
        // Vue: `current.filter(k => k !== key)`.
        assert_eq!(
            next_multiple_values(&current, "passkey"),
            Vec::<String>::new()
        );
        // Order of the untouched keys is preserved.
        let both = vec!["totp".to_string(), "passkey".to_string()];
        assert_eq!(
            next_multiple_values(&both, "totp"),
            vec!["passkey".to_string()]
        );
    }

    #[test]
    fn icon_button_group_tooltip_text_resolution_matches_vue() {
        // Unset → the label is the hover text.
        assert_eq!(
            option_tooltip_text(&HkIconButtonGroupOption::new("a", MdiIcon::Check, "Alpha")),
            Some("Alpha".to_string())
        );
        // An explicit override wins…
        let overridden = HkIconButtonGroupOption {
            tooltip: Some("Already verified".to_string()),
            ..HkIconButtonGroupOption::new("a", MdiIcon::Check, "Alpha")
        };
        assert_eq!(
            option_tooltip_text(&overridden),
            Some("Already verified".to_string())
        );
        // …and an EMPTY override suppresses the wrapper (Vue's `tooltip ?`).
        let suppressed = HkIconButtonGroupOption {
            tooltip: Some(String::new()),
            ..HkIconButtonGroupOption::new("a", MdiIcon::Check, "Alpha")
        };
        assert!(option_tooltip_text(&suppressed).is_none());
    }

    #[test]
    fn icon_button_group_buttons_mode_renders_a_plain_group() {
        let node = IconButtonGroup(IconButtonGroupProps {
            options: options(),
            ..Default::default()
        });
        let root = root_element(&node);
        assert_eq!(root.tag, "div");
        assert_eq!(
            root.class.to_string(),
            "hk-icon-group hk-icon-group-buttons hk-icon-group-track hk-icon-group-md"
        );
        assert_eq!(attr(root, "role"), Some("group"));
        // No aria_label → no attribute (Vue's fallthrough is absent).
        assert!(attr(root, "aria-label").is_none());

        let buttons = by_tag(&node, "button");
        assert_eq!(buttons.len(), 2);
        assert_eq!(buttons[0].class.to_string(), "hk-icon-group-item");
        assert_eq!(attr(buttons[0], "type"), Some("button"));
        assert_eq!(attr(buttons[0], "data-key"), Some("totp"));
        assert_eq!(attr(buttons[0], "aria-label"), Some("TOTP"));
        // No selection state exists in buttons mode.
        assert!(attr(buttons[0], "data-active").is_none());
        assert!(attr(buttons[0], "role").is_none());
        assert!(attr(buttons[0], "aria-checked").is_none());
        assert!(attr(buttons[0], "aria-pressed").is_none());
        // The HkTooltip popup owns the hover text — the button has no title.
        assert!(attr(buttons[0], "title").is_none());
        assert!(attr(buttons[0], "disabled").is_none());
        // A live item carries no disabled state at all.
        assert!(attr(buttons[0], "aria-disabled").is_none());
        // Every item is tooltip-wrapped (the label is the default text).
        assert_eq!(count_class(&node, "hk-tooltip-wrapper"), 2);
        assert_eq!(count_class(&node, "hk-icon-group-slider-thumb"), 0);
    }

    #[test]
    fn icon_button_group_single_mode_is_a_radiogroup() {
        let node = IconButtonGroup(IconButtonGroupProps {
            options: options(),
            mode: IconButtonGroupMode::Single,
            value: Some("totp".to_string()),
            ..Default::default()
        });
        let root = root_element(&node);
        assert_eq!(attr(root, "role"), Some("radiogroup"));
        assert!(
            root.class.to_string().contains("hk-icon-group-single"),
            "single modifier: {:?}",
            root.class
        );

        let buttons = by_tag(&node, "button");
        // Vue marks the active item through data-active="true" + aria-checked.
        assert_eq!(attr(buttons[0], "role"), Some("radio"));
        assert_eq!(attr(buttons[0], "aria-checked"), Some("true"));
        assert_eq!(attr(buttons[0], "data-active"), Some("true"));
        assert_eq!(attr(buttons[1], "role"), Some("radio"));
        assert_eq!(attr(buttons[1], "aria-checked"), Some("false"));
        assert!(attr(buttons[1], "data-active").is_none());
        // Single mode never carries the toggle-set attribute.
        assert!(attr(buttons[0], "aria-pressed").is_none());
    }

    #[test]
    fn icon_button_group_multiple_mode_mirrors_aria_pressed() {
        let node = IconButtonGroup(IconButtonGroupProps {
            options: options(),
            mode: IconButtonGroupMode::Multiple,
            values: vec!["passkey".to_string()],
            ..Default::default()
        });
        let root = root_element(&node);
        assert_eq!(attr(root, "role"), Some("group"));

        let buttons = by_tag(&node, "button");
        assert_eq!(attr(buttons[0], "aria-pressed"), Some("false"));
        assert_eq!(attr(buttons[1], "aria-pressed"), Some("true"));
        assert_eq!(attr(buttons[1], "data-active"), Some("true"));
        assert!(attr(buttons[0], "data-active").is_none());
        // Multiple mode carries neither the radio role nor aria-checked.
        assert!(attr(buttons[0], "role").is_none());
        assert!(attr(buttons[1], "aria-checked").is_none());
    }

    #[test]
    fn icon_button_group_slider_renders_the_index_thumb() {
        let node = IconButtonGroup(IconButtonGroupProps {
            options: options(),
            mode: IconButtonGroupMode::Single,
            variant: IconButtonGroupVariant::Slider,
            value: Some("passkey".to_string()),
            ..Default::default()
        });
        // The thumb renders FIRST, behind every item (the first span in
        // document order inside the group).
        let spans = by_tag(&node, "span");
        assert!(
            !spans.is_empty(),
            "a slider strip renders spans (thumb + tooltip wrappers)"
        );
        let thumb = spans[0];
        assert_eq!(
            thumb.class.to_string(),
            "hk-icon-group-slider-thumb",
            "the thumb is the first node of the strip"
        );
        assert_eq!(attr(thumb, "aria-hidden"), Some("true"));
        assert_eq!(
            thumb.style.to_string(),
            "--hk-icon-group-active-index:1",
            "thumb position = the active index"
        );

        // No active key → no thumb at all.
        let no_selection = IconButtonGroup(IconButtonGroupProps {
            options: options(),
            mode: IconButtonGroupMode::Single,
            variant: IconButtonGroupVariant::Slider,
            ..Default::default()
        });
        assert_eq!(count_class(&no_selection, "hk-icon-group-slider-thumb"), 0);

        // Multiple + slider tints items instead of rendering a thumb.
        let multiple = IconButtonGroup(IconButtonGroupProps {
            options: options(),
            mode: IconButtonGroupMode::Multiple,
            variant: IconButtonGroupVariant::Slider,
            values: vec!["totp".to_string()],
            ..Default::default()
        });
        assert_eq!(count_class(&multiple, "hk-icon-group-slider-thumb"), 0);
        let multiple_buttons = by_tag(&multiple, "button");
        assert_eq!(
            attr(multiple_buttons[0], "data-active"),
            Some("true"),
            "the per-item tint is the only active indication left"
        );
    }

    #[test]
    fn icon_button_group_tooltip_override_suppresses_the_wrapper() {
        let node = IconButtonGroup(IconButtonGroupProps {
            options: vec![
                HkIconButtonGroupOption::new("a", MdiIcon::Check, "Alpha"),
                HkIconButtonGroupOption {
                    tooltip: Some(String::new()),
                    ..HkIconButtonGroupOption::new("b", MdiIcon::Help, "Beta")
                },
            ],
            ..Default::default()
        });
        assert_eq!(
            count_class(&node, "hk-tooltip-wrapper"),
            1,
            "an empty override suppresses the wrapper"
        );
        // The label stays the accessible name either way.
        let buttons = by_tag(&node, "button");
        assert_eq!(attr(buttons[1], "aria-label"), Some("Beta"));
    }

    #[test]
    fn icon_button_group_disabled_state_reaches_every_item() {
        // Group-level disable disables all items (Vue: `props.disabled ||
        // option.disabled`).
        let dead = IconButtonGroup(IconButtonGroupProps {
            options: options(),
            disabled: true,
            ..Default::default()
        });
        for button in by_tag(&dead, "button") {
            assert_eq!(attr(button, "disabled"), Some("disabled"));
            // Additive delta vs Vue: the dead state is mirrored in ARIA too.
            assert_eq!(attr(button, "aria-disabled"), Some("true"));
        }

        // Item-level disable leaves its siblings alive.
        let mixed = IconButtonGroup(IconButtonGroupProps {
            options: vec![
                HkIconButtonGroupOption {
                    disabled: true,
                    ..HkIconButtonGroupOption::new("a", MdiIcon::Check, "Alpha")
                },
                HkIconButtonGroupOption::new("b", MdiIcon::Help, "Beta"),
            ],
            ..Default::default()
        });
        let buttons = by_tag(&mixed, "button");
        assert_eq!(attr(buttons[0], "disabled"), Some("disabled"));
        assert_eq!(attr(buttons[0], "aria-disabled"), Some("true"));
        assert!(attr(buttons[1], "disabled").is_none());
        assert!(attr(buttons[1], "aria-disabled").is_none());
    }

    #[test]
    fn icon_button_group_root_carries_the_host_class_and_label() {
        let node = IconButtonGroup(IconButtonGroupProps {
            options: options(),
            class: "s-mfa-factors".to_string(),
            aria_label: Some("验证方式".to_string()),
            ..Default::default()
        });
        let root = root_element(&node);
        assert_eq!(
            root.class.to_string(),
            "hk-icon-group hk-icon-group-buttons hk-icon-group-track hk-icon-group-md s-mfa-factors"
        );
        assert_eq!(attr(root, "aria-label"), Some("验证方式"));
    }

    #[test]
    fn icon_button_group_glyph_follows_the_size_step() {
        let node = IconButtonGroup(IconButtonGroupProps {
            options: options(),
            size: IconButtonGroupSize::Sm,
            ..Default::default()
        });
        let glyphs = by_tag(&node, "div")
            .into_iter()
            .filter(|element| element.class.to_string().starts_with("hk-icon "))
            .collect::<Vec<_>>();
        assert_eq!(glyphs.len(), 2, "one glyph per item");
        assert!(
            glyphs[0].style.to_string().contains("width:18px"),
            "the sm glyph is 18px, got {:?}",
            glyphs[0].style
        );
    }

    #[test]
    fn icon_button_group_styles_come_from_the_canonical_vue_sheet() {
        let css = IconButtonGroupComponent::styles();
        assert!(
            css.contains(".hk-icon-group") && css.contains(".hk-icon-group-item"),
            "icon button group css must carry the vue classes"
        );
        // The thumb rule consumes the index variable the component writes —
        // one side of that contract without the other paints no thumb.
        assert!(
            css.contains(".hk-icon-group-slider-thumb")
                && css.contains("--hk-icon-group-active-index"),
            "the sheet must keep the thumb rule the component positions"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored icon button group sheet"
        );
    }
}
