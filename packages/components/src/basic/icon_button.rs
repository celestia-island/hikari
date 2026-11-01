// hi-components/src/basic/icon_button.rs
// IconButton — mirror of the canonical Vue `HkIconButton` (the square
// icon-only trigger every chrome row uses).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkIconButton.scss`, which also pulls in
// `HkIconButtonVars.scss`; both vendored under `src/styles/vue-mirror/` and
// guarded by `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so
// the `.hk-icon-button*` class names are literal and identical in both forms.
// The DOM contract below mirrors the Vue render output one-to-one:
//
//   button.hk-icon-button.hk-icon-button-{size}.hk-icon-button-{variant}
//          [host class]
//          [disabled] [aria-label] [autofocus]
//          (style: host style attribute; omitted when unset)
//     span.hk-icon-button-icon
//       ── precedence (Vue: icon slot > default slot > icon prop > fallback) ──
//       <icon slot>  |  <default slot>  |  HIcon(size)  |  placeholder circle
//     span.hk-icon-button-dot.hk-corner-badge-{dotVariant}   (`dot` only)
//          role="img" [aria-label]  |  aria-hidden="true"
//
// Vue prop mapping: `size` → [`IconButtonSize`] (the six chrome steps
// 16|24|28|32|36|40, default 32), `variant` → [`IconButtonVariant`],
// `dotVariant` → [`IconButtonDotVariant`] (HkCornerBadge's
// `CornerBadgeVariant` name set). The rendered glyph box is chosen by Vue's
// `glyphSize` computed (`size >= 32 ? 20 : 16`), mirrored as
// [`IconButtonSize::glyph_px`].
// Replaces the retired legacy `IconButton` (Glow wrapper + `glow*` presets,
// `--hi-*` inline overrides, `hk-button*` companion classes, `data-animation-id`).
//
// Deltas vs Vue (documented, not accidental):
//   * `icon` is a typed `Option<MdiIcon>`, not a name string: the Rust icon
//     set resolves through the `MdiIcon` enum (Vue resolves names through
//     `HIcon`'s registry and paints functional keys from the material pack).
//     `None` therefore reaches Vue's placeholder branch, which a required
//     glyph could not.
//   * `{...attrs}` passthrough has no tairitsu equivalent: `aria_label`,
//     `button_type` (Vue: `attrs.type`; NOT emitted by default — the Vue
//     template sets no `type`, unlike HkButton) and `autofocus` are explicit
//     props, and a host `class` is appended after the size/variant classes.
//   * The glyph box is pinned by the sheet in Vue (`.hk-icon-button-icon svg
//     { width: var(--hi-icon-button-icon-size) }` → 12px on the 16/24 steps,
//     16px on 28…40), while `hikari_icons::Icon` hard-codes an inline
//     `width`/`height` that outranks it. The mirror therefore renders Vue's
//     `glyphSize` (`size >= 32 ? 20 : 16`) as real pixels: identical at 28,
//     +4px at 16/24 (16 vs 12) and at 32/36/40 (20 vs 16).
//   * The placeholder circle and the status dot's tone: the fallback glyph is
//     trusted static markup through `dangerous_inner_html` (tairitsu's element
//     tree has no SVG-namespace creation path, so an `svg {}` rsx child would
//     be an HTML element); the `<svg>` inside is byte-identical to Vue. The
//     dot keeps Vue's `hk-corner-badge-{variant}` class; those tone rules live
//     in `HkCornerBadge.scss`, which IS mirrored and registered through
//     `StyleRegistry::register_vue_chrome` ("vue-corner-badge").

use hikari_icons::{Icon, MdiIcon};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct IconButtonComponent;

/// The six chrome sizes (Vue: `16 | 24 | 28 | 32 | 36 | 40`, default 32).
/// 28 is the header-chrome step (same box as HkThemeToggle's trigger); 24
/// reads visibly smaller beside it.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum IconButtonSize {
    S16,
    S24,
    S28,
    #[default]
    S32,
    S36,
    S40,
}

impl IconButtonSize {
    /// The `hk-icon-button-{px}` class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            IconButtonSize::S16 => "hk-icon-button-16",
            IconButtonSize::S24 => "hk-icon-button-24",
            IconButtonSize::S28 => "hk-icon-button-28",
            IconButtonSize::S32 => "hk-icon-button-32",
            IconButtonSize::S36 => "hk-icon-button-36",
            IconButtonSize::S40 => "hk-icon-button-40",
        }
    }

    /// The square box in px (the sheet's `--hi-icon-button-size` step).
    pub fn px(self) -> u32 {
        match self {
            IconButtonSize::S16 => 16,
            IconButtonSize::S24 => 24,
            IconButtonSize::S28 => 28,
            IconButtonSize::S32 => 32,
            IconButtonSize::S36 => 36,
            IconButtonSize::S40 => 40,
        }
    }

    /// The glyph box in px, exactly Vue's `glyphSize` computed
    /// (`size >= 32 ? 20 : 16`).
    pub fn glyph_px(self) -> u32 {
        if self.px() >= 32 { 20 } else { 16 }
    }
}

/// The five inks (Vue: `"ghost" | "primary" | "secondary" | "danger" |
/// "success"`, default `ghost`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum IconButtonVariant {
    #[default]
    Ghost,
    Primary,
    Secondary,
    Danger,
    Success,
}

impl IconButtonVariant {
    /// The `hk-icon-button-{variant}` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            IconButtonVariant::Ghost => "hk-icon-button-ghost",
            IconButtonVariant::Primary => "hk-icon-button-primary",
            IconButtonVariant::Secondary => "hk-icon-button-secondary",
            IconButtonVariant::Danger => "hk-icon-button-danger",
            IconButtonVariant::Success => "hk-icon-button-success",
        }
    }
}

/// The button-owned status dot's tone (Vue: HkCornerBadge's
/// `CornerBadgeVariant`, default `success`). The class only sets
/// `--hk-badge-bg`; see the file-header delta for the sheet caveat.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum IconButtonDotVariant {
    Default,
    Primary,
    #[default]
    Success,
    Error,
    Warning,
    Info,
    Muted,
}

impl IconButtonDotVariant {
    /// The `hk-corner-badge-{variant}` class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            IconButtonDotVariant::Default => "hk-corner-badge-default",
            IconButtonDotVariant::Primary => "hk-corner-badge-primary",
            IconButtonDotVariant::Success => "hk-corner-badge-success",
            IconButtonDotVariant::Error => "hk-corner-badge-error",
            IconButtonDotVariant::Warning => "hk-corner-badge-warning",
            IconButtonDotVariant::Info => "hk-corner-badge-info",
            IconButtonDotVariant::Muted => "hk-corner-badge-muted",
        }
    }
}

/// Vue's no-glyph fallback: a bare 24-unit circle drawn in `currentColor`.
/// Emitted as trusted static markup (see the file-header delta).
const ICON_BUTTON_PLACEHOLDER_SVG: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>"#;

/// The complete class list in Vue's order (`hk-icon-button`, the size step,
/// the variant step) with the host class appended last.
pub fn icon_button_classes(props: &IconButtonProps) -> String {
    let mut classes = format!(
        "hk-icon-button {} {}",
        props.size.class_name(),
        props.variant.class_name()
    );
    if !props.class.is_empty() {
        classes.push(' ');
        classes.push_str(&props.class);
    }
    classes
}

/// True when a slot carries nothing to render (Vue tests `!slots.default`).
/// tairitsu hands the slot over as a vnode, so the empty cases are the
/// default (empty fragment), `empty_vnode()` (blank text) and fragments of
/// those.
fn slot_is_empty(node: &VNode) -> bool {
    match node {
        VNode::Fragment(nodes) => nodes.iter().all(slot_is_empty),
        VNode::Text(text) => text.text.is_empty(),
        VNode::Element(_) | VNode::DynamicText(_) => false,
    }
}

#[define_props]
pub struct IconButtonProps {
    /// The glyph (Rust: a typed MDI icon — Vue passes a name string through
    /// `HIcon`). `None` renders Vue's placeholder circle unless a slot
    /// provides the glyph.
    pub icon: Option<MdiIcon>,

    /// Ink (`hk-icon-button-{variant}`).
    #[default]
    pub variant: IconButtonVariant,

    /// Box step (`hk-icon-button-{size}`).
    #[default]
    pub size: IconButtonSize,

    /// Native `disabled`.
    #[default]
    pub disabled: bool,

    /// Button-owned status dot (`.hk-icon-button-dot`), laid out INSIDE the
    /// button's own box so the mark and the control read as one silhouette.
    #[default]
    pub dot: bool,

    /// Tone of the status dot.
    #[default]
    pub dot_variant: IconButtonDotVariant,

    /// Accessible name for the dot. Without it the dot is aria-hidden
    /// decoration for state the button already announces.
    pub dot_label: Option<String>,

    /// Accessible name for the button itself (Vue: `attrs['aria-label']`).
    pub aria_label: Option<String>,

    /// Named `icon` slot: wins over the default slot and the `icon` prop
    /// (Vue: `slots.icon`).
    pub icon_slot: Option<Element>,

    /// Default slot: a natural `<HIconButton><Icon/></HIconButton>`
    /// composition. Wins over the `icon` prop, loses to `icon_slot`.
    pub children: Element,

    /// Click handler (Vue: the `click` emit).
    pub onclick: Option<EventHandler<MouseEvent>>,

    /// Extra class appended after the size/variant classes.
    #[default]
    pub class: String,

    /// Host `style` attribute; omitted when empty.
    #[default]
    pub style: String,

    /// `type` attribute passthrough. `None` emits NO `type` — exactly the Vue
    /// template, which (unlike HkButton) sets none.
    pub button_type: Option<String>,

    /// Autofocus attribute (Vue: attrs passthrough).
    #[default]
    pub autofocus: bool,
}

#[component]
pub fn IconButton(props: IconButtonProps) -> Element {
    let classes = icon_button_classes(&props);
    let glyph_px = props.size.glyph_px();

    // Vue: `slots.icon` → `slots.default` → the `icon` name prop → the
    // placeholder circle. Every branch keeps the same glyph box.
    let icon_box = if let Some(slot) = props.icon_slot.clone() {
        rsx! {
            span { class: "hk-icon-button-icon",
                {slot}
            }
        }
    } else if !slot_is_empty(&props.children) {
        rsx! {
            span { class: "hk-icon-button-icon",
                {props.children.clone()}
            }
        }
    } else if let Some(icon) = props.icon {
        rsx! {
            span { class: "hk-icon-button-icon",
                Icon { icon, size: glyph_px }
            }
        }
    } else {
        rsx! {
            span {
                class: "hk-icon-button-icon",
                dangerous_inner_html: ICON_BUTTON_PLACEHOLDER_SVG,
            }
        }
    };

    // Bind the moved fields before the rsx tree (the click handler is not
    // Copy, so it is cloned out of the props).
    let disabled = props.disabled;
    let dot = props.dot;
    let dot_variant = props.dot_variant;
    let dot_label = props.dot_label.clone();
    let aria_label = props.aria_label.clone();
    let onclick = props.onclick.clone();

    // Vue: `aria-hidden={dotLabel ? undefined : "true"}` and
    // `role={dotLabel ? "img" : undefined}` — the dot is decoration unless the
    // host names it.
    let dot_is_named = dot_label.is_some();
    let dot_role = dot_is_named.then(|| "img".to_string());
    let dot_aria_hidden = (!dot_is_named).then(|| "true".to_string());

    let style_attr = if props.style.is_empty() {
        None
    } else {
        Some(props.style.clone())
    };
    let button_type = props.button_type.clone();
    let autofocus = props.autofocus;

    rsx! {
        button {
            class: classes,
            "type": button_type,
            disabled: disabled,
            "aria-label": aria_label,
            autofocus: autofocus,
            style: style_attr,
            onclick: move |e: MouseEvent| {
                if let Some(handler) = onclick.as_ref() {
                    handler.call(e.clone());
                }
            },
            {icon_box}
            if dot {
                span {
                    class: format!("hk-icon-button-dot {}", dot_variant.class_name()),
                    "role": dot_role,
                    "aria-hidden": dot_aria_hidden,
                    "aria-label": dot_label,
                }
            }
        }
    }
}

impl StyledComponent for IconButtonComponent {
    fn styles() -> &'static str {
        // The dot tones live in the mirrored HkCornerBadge sheet, which the
        // registry path registers separately (`register_vue_chrome`); this
        // component's own table covers the button chrome only.
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-icon-button*` names literal so this CSS matches the Vue build;
        // the sheet `@use`s HkIconButtonVars.scss, so both land in one table).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkIconButton.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "icon-button"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn icon_button_size_classes_and_pixels_match_vue() {
        assert_eq!(IconButtonSize::S16.class_name(), "hk-icon-button-16");
        assert_eq!(IconButtonSize::S24.class_name(), "hk-icon-button-24");
        assert_eq!(IconButtonSize::S28.class_name(), "hk-icon-button-28");
        assert_eq!(IconButtonSize::S32.class_name(), "hk-icon-button-32");
        assert_eq!(IconButtonSize::S36.class_name(), "hk-icon-button-36");
        assert_eq!(IconButtonSize::S40.class_name(), "hk-icon-button-40");

        assert_eq!(IconButtonSize::S16.px(), 16);
        assert_eq!(IconButtonSize::S24.px(), 24);
        assert_eq!(IconButtonSize::S28.px(), 28);
        assert_eq!(IconButtonSize::S32.px(), 32);
        assert_eq!(IconButtonSize::S36.px(), 36);
        assert_eq!(IconButtonSize::S40.px(), 40);

        // Vue: `glyphSize = size >= 32 ? 20 : 16`.
        assert_eq!(IconButtonSize::S16.glyph_px(), 16);
        assert_eq!(IconButtonSize::S24.glyph_px(), 16);
        assert_eq!(IconButtonSize::S28.glyph_px(), 16);
        assert_eq!(IconButtonSize::S32.glyph_px(), 20);
        assert_eq!(IconButtonSize::S36.glyph_px(), 20);
        assert_eq!(IconButtonSize::S40.glyph_px(), 20);
    }

    #[test]
    fn icon_button_variant_class_names_match_the_vue_modifiers() {
        assert_eq!(
            IconButtonVariant::Ghost.class_name(),
            "hk-icon-button-ghost"
        );
        assert_eq!(
            IconButtonVariant::Primary.class_name(),
            "hk-icon-button-primary"
        );
        assert_eq!(
            IconButtonVariant::Secondary.class_name(),
            "hk-icon-button-secondary"
        );
        assert_eq!(
            IconButtonVariant::Danger.class_name(),
            "hk-icon-button-danger"
        );
        assert_eq!(
            IconButtonVariant::Success.class_name(),
            "hk-icon-button-success"
        );
    }

    #[test]
    fn icon_button_dot_variant_class_names_match_the_corner_badge_family() {
        // Vue borrows HkCornerBadge's tone classes verbatim.
        assert_eq!(
            IconButtonDotVariant::Default.class_name(),
            "hk-corner-badge-default"
        );
        assert_eq!(
            IconButtonDotVariant::Primary.class_name(),
            "hk-corner-badge-primary"
        );
        assert_eq!(
            IconButtonDotVariant::Success.class_name(),
            "hk-corner-badge-success"
        );
        assert_eq!(
            IconButtonDotVariant::Error.class_name(),
            "hk-corner-badge-error"
        );
        assert_eq!(
            IconButtonDotVariant::Warning.class_name(),
            "hk-corner-badge-warning"
        );
        assert_eq!(
            IconButtonDotVariant::Info.class_name(),
            "hk-corner-badge-info"
        );
        assert_eq!(
            IconButtonDotVariant::Muted.class_name(),
            "hk-corner-badge-muted"
        );
    }

    #[test]
    fn icon_button_defaults_match_the_vue_props() {
        let props = IconButtonProps::default();
        assert_eq!(props.icon, None);
        assert_eq!(props.variant, IconButtonVariant::Ghost);
        assert_eq!(props.size, IconButtonSize::S32);
        assert!(!props.disabled);
        assert!(!props.dot);
        assert_eq!(props.dot_variant, IconButtonDotVariant::Success);
        assert_eq!(props.dot_label, None);
        assert_eq!(props.aria_label, None);
        assert_eq!(props.icon_slot, None);
        assert!(slot_is_empty(&props.children));
        assert!(props.onclick.is_none());
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
        // Unlike HkButton, the Vue template emits no `type` at all.
        assert_eq!(props.button_type, None);
        assert!(!props.autofocus);
    }

    #[test]
    fn icon_button_classes_match_the_vue_order() {
        let props = IconButtonProps {
            size: IconButtonSize::S28,
            variant: IconButtonVariant::Danger,
            class: "host".to_string(),
            ..Default::default()
        };
        assert_eq!(
            icon_button_classes(&props),
            "hk-icon-button hk-icon-button-28 hk-icon-button-danger host"
        );
        assert_eq!(
            icon_button_classes(&IconButtonProps::default()),
            "hk-icon-button hk-icon-button-32 hk-icon-button-ghost"
        );
    }

    #[test]
    fn icon_button_slot_emptiness_matches_the_vue_slot_test() {
        assert!(slot_is_empty(&empty_vnode()));
        assert!(slot_is_empty(&VNode::Fragment(Vec::new())));
        assert!(!slot_is_empty(&VNode::Text(VText::new("x"))));
    }

    #[test]
    fn icon_button_placeholder_keeps_the_vue_fallback_markup() {
        // Vue renders this bare svg (no class of its own — the sheet sizes
        // `.hk-icon-button-icon svg`) when there is no slot and no icon name.
        assert!(ICON_BUTTON_PLACEHOLDER_SVG.starts_with("<svg"));
        assert!(ICON_BUTTON_PLACEHOLDER_SVG.contains(r#"viewBox="0 0 24 24""#));
        assert!(ICON_BUTTON_PLACEHOLDER_SVG.contains(r#"<circle cx="12" cy="12" r="10">"#));
        assert!(
            !ICON_BUTTON_PLACEHOLDER_SVG.contains("class="),
            "the Vue fallback svg carries no class"
        );
    }

    #[test]
    fn icon_button_styles_come_from_the_canonical_vue_sheet() {
        let css = IconButtonComponent::styles();
        for class in [
            ".hk-icon-button",
            ".hk-icon-button-16",
            ".hk-icon-button-24",
            ".hk-icon-button-28",
            ".hk-icon-button-32",
            ".hk-icon-button-36",
            ".hk-icon-button-40",
            ".hk-icon-button-ghost",
            ".hk-icon-button-primary",
            ".hk-icon-button-secondary",
            ".hk-icon-button-danger",
            ".hk-icon-button-success",
            ".hk-icon-button-icon",
            ".hk-icon-button-dot",
        ] {
            assert!(
                css.contains(class),
                "icon-button css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored icon button sheet"
        );
        // The retired Glow wrapper hook must be gone.
        assert!(
            !css.contains("hk-glow"),
            "the Glow wrapper is retired for the button family"
        );
    }
}
