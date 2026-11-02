// hi-components/src/basic/button.rs
// Button — mirror of the canonical Vue `HkButton` (the canonical button).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkButton.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.hk-btn*` class names are literal and identical in both forms. The DOM
// contract below mirrors the Vue render output one-to-one:
//
//   button.hk-btn.hk-btn-{variant}.hk-btn-{size}
//          [.hk-btn-block] [.hk-btn-loading] [.hk-btn-has-shortcut]
//          [.hk-btn-label-collapse-{bp}] [.hk-btn-icon-only] [host class]
//          type="button" [disabled] [aria-label] [aria-busy=true] [autofocus]
//          (style: host style attribute; omitted when unset)
//     span > svg.hk-btn-ring            (loading only; 14px SMIL ring)
//     span.hk-btn-icon                  (prefix glyph; hidden while loading)
//     span.hk-btn-label | default slot  (`label` wins over the slot)
//     span.hk-btn-suffix                (suffix glyph)
//     kbd.hk-kbd.hk-kbd-sm              (`shortcut` renders HKbd size=sm)
//
// Vue prop mapping: `variant` → [`ButtonVariant`], `size` → [`ButtonSize`]
// (`xs|sm|md|lg`), `collapseLabel` → [`ButtonProps::collapse_label`],
// `ariaLabel` → [`ButtonProps::aria_label`] (falls back to `label`, exactly
// Vue's `ariaLabel ?? label`), `type` → [`ButtonProps::button_type`].
// Replaces the retired legacy `Button` (`hk-button*` classes, three-layer
// `--hi-button-*` overrides, `width` / `animation` / Glow wrapper presets,
// `data-button-animation` / `data-animation-id` hooks).
//
// Deltas vs Vue (documented, not accidental):
//   * `icon` / `suffix` are Element SLOTS, not glyph names. Vue resolves a
//     name string through `HIcon` (size 16) and wraps it in `.hk-btn-icon`;
//     the Rust icon set is a typed enum with no runtime name registry, so the
//     host passes the glyph vnode (conventionally
//     `Icon { icon: MdiIcon::X, size: 16 }`) and the mirror keeps the same
//     `.hk-btn-icon` / `.hk-btn-suffix` boxes around it. Consequence: an
//     empty-string name cannot be told apart from `None` (Vue treats `""` as
//     "no glyph").
//   * `{...attrs}` passthrough has no tairitsu equivalent. The DOM-relevant
//     keys are explicit props: `button_type` (Vue: `attrs.type || "button"`),
//     `autofocus`, `style`, `class` (Vue merges `attrs.class` into the class
//     list, so it is appended last here too).
//   * The loading ring is emitted as trusted static markup through
//     `dangerous_inner_html` — the path `hikari_icons::Icon` and
//     `utils::icon_helper::icon_vnode` already use. Two reasons: tairitsu
//     creates elements with a plain `createElement(localName)` (no SVG
//     namespace), so an `svg {}` rsx child lands in the HTML namespace; and
//     the SMIL `<animateTransform>` tag cannot be spelled in `rsx!` at all
//     (capitalized tags are components), so the rotation has to travel as
//     markup either way. The inner markup is byte-identical to Vue's; one
//     wrapper `<span>` carries it.
//   * The crate's `hikari_icons::Icon` renders a `div.hk-icon` carrying inline
//     px `width`/`height` (Vue's `HIcon` emits a `span.hk-icon` sized by CSS),
//     so the sheet's `.hk-btn-xs .hk-btn-icon .hk-icon { inline-size: 100% }`
//     scale (the 13px xs glyph) cannot win over the inline size — the host
//     picks the glyph size (Vue always passes 16 and lets CSS shrink it).

use crate::basic::kbd::{Kbd, KbdProps, KbdSize};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ButtonComponent;

/// The five variants (Vue: `"primary" | "secondary" | "ghost" | "danger" |
/// "outline"`, default `primary`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonVariant {
    #[default]
    Primary,
    Secondary,
    Ghost,
    Danger,
    Outline,
}

impl ButtonVariant {
    /// The `hk-btn-{variant}` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            ButtonVariant::Primary => "hk-btn-primary",
            ButtonVariant::Secondary => "hk-btn-secondary",
            ButtonVariant::Ghost => "hk-btn-ghost",
            ButtonVariant::Danger => "hk-btn-danger",
            ButtonVariant::Outline => "hk-btn-outline",
        }
    }
}

/// The four size steps (Vue: `"xs" | "sm" | "md" | "lg"`, default `md`).
/// The size owns padding / font-size / min-height in the sheet; the glyph
/// size does NOT scale with it (Vue `HkButton.tsx` renders every size at 16 —
/// only the xs CSS chain shrinks the box).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonSize {
    Xs,
    Sm,
    #[default]
    Md,
    Lg,
}

impl ButtonSize {
    /// The `hk-btn-{size}` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            ButtonSize::Xs => "hk-btn-xs",
            ButtonSize::Sm => "hk-btn-sm",
            ButtonSize::Md => "hk-btn-md",
            ButtonSize::Lg => "hk-btn-lg",
        }
    }
}

/// Breakpoints below which a `collapseLabel` button hides its label and
/// collapses to the icon-only square (Vue: `ButtonLabelCollapse`). The px
/// values live in the sheet (`sm` 640 / `md` 768 / `lg` 1024 / `xl` 1280);
/// a media query cannot read a constant, so keep the two in sync. `xs` is
/// deliberately absent — collapse-at-xs means "always collapsed", which is
/// just the icon prop + a label-less button.
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum ButtonLabelCollapse {
    Sm,
    Md,
    Lg,
    Xl,
}

impl ButtonLabelCollapse {
    /// The `hk-btn-label-collapse-{bp}` modifier class exactly as Vue emits
    /// it.
    pub fn class_name(self) -> &'static str {
        match self {
            ButtonLabelCollapse::Sm => "hk-btn-label-collapse-sm",
            ButtonLabelCollapse::Md => "hk-btn-label-collapse-md",
            ButtonLabelCollapse::Lg => "hk-btn-label-collapse-lg",
            ButtonLabelCollapse::Xl => "hk-btn-label-collapse-xl",
        }
    }
}

#[define_props]
pub struct ButtonProps {
    /// Semantic variant (`hk-btn-{variant}`); also the ink/fill pair.
    #[default]
    pub variant: ButtonVariant,

    /// Size step (`hk-btn-{size}`).
    #[default]
    pub size: ButtonSize,

    /// Busy state: renders the SMIL ring, hides the prefix glyph and forces
    /// `disabled` (Vue: `disabled || loading`) while keeping the button
    /// mounted and `aria-busy`.
    #[default]
    pub loading: bool,

    /// Native `disabled` (plus `loading`, which disables as well).
    #[default]
    pub disabled: bool,

    /// Full-width presentation (`hk-btn-block`); also suppresses the
    /// label-collapse class (a full-width button has nothing to collapse
    /// into).
    #[default]
    pub block: bool,

    /// Accessible name override; when unset the `label` text is used
    /// (Vue: `ariaLabel ?? label`).
    pub aria_label: Option<String>,

    /// Plain-text label rendered in `.hk-btn-label` after the glyph. When
    /// set, the default slot is IGNORED (one label source per button) and the
    /// accessible name falls back to this text, so the button keeps its name
    /// at breakpoints where the visible label is `display: none`.
    pub label: Option<String>,

    /// Breakpoint below which the label hides and the button collapses to the
    /// icon-only square. Requires `label`; ignored with `block` and with
    /// `shortcut` (the chip is an extra child the square width would clip),
    /// exactly like Vue.
    pub collapse_label: Option<ButtonLabelCollapse>,

    /// Keyboard shortcut hint, rendered as `HKbd` (`size: sm`) in a trailing
    /// chip. Presence adds `hk-btn-has-shortcut` and excludes the icon-only
    /// square.
    pub shortcut: Option<String>,

    /// Prefix glyph slot, rendered inside `.hk-btn-icon` and hidden while
    /// `loading` (Vue: the `icon` name prop through `HIcon`; see the file
    /// header delta).
    pub icon: Option<Element>,

    /// Suffix glyph slot, rendered inside `.hk-btn-suffix` (stays visible
    /// while loading, like Vue).
    pub suffix: Option<Element>,

    /// Default slot: the button body when no `label` text is given.
    pub children: Element,

    /// Click handler (Vue: the `click` emit).
    pub onclick: Option<EventHandler<MouseEvent>>,

    /// Extra class appended after the whole `.hk-btn*` family (Vue merges
    /// `attrs.class` last).
    #[default]
    pub class: String,

    /// Host `style` attribute (Vue: `attrs.style || undefined` — omitted when
    /// empty).
    #[default]
    pub style: String,

    /// `type` attribute (Vue: `attrs.type || "button"`).
    #[default("button".to_string())]
    pub button_type: String,

    /// Autofocus attribute (Vue: attrs passthrough).
    #[default]
    pub autofocus: bool,
}

/// Vue's loading ring: the inline 16-unit SVG with a 0.7s SMIL rotation that
/// renders identically where CSS animation contexts are suspended. Emitted as
/// trusted static markup (see the file header delta) — the `<svg>` inside is
/// byte-identical to `HkButton.tsx`.
const BUTTON_RING_SVG: &str = r#"<svg class="hk-btn-ring" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.8"></circle><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="30 11"><animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.7s" repeatCount="indefinite"></animateTransform></circle></svg>"#;

/// Vue: `props.shortcut` is a truthy-string test, so an empty string is "no
/// shortcut".
fn button_has_shortcut(shortcut: Option<&str>) -> bool {
    shortcut.is_some_and(|value| !value.is_empty())
}

/// True when a slot carries nothing to render. Vue tests `!slots.default`;
/// tairitsu passes the slot as a vnode, so the empty cases are the default
/// (empty fragment), `empty_vnode()` (blank text) and a fragment of those.
fn slot_is_empty(node: &VNode) -> bool {
    match node {
        VNode::Fragment(nodes) => nodes.iter().all(slot_is_empty),
        VNode::Text(text) => text.text.is_empty(),
        VNode::Element(_) | VNode::DynamicText(_) => false,
    }
}

/// Vue's icon-only contract, re-evaluated per render (it is NOT a computed:
/// the default slot is not reactive, so a cached flag would go stale when a
/// parent toggles the label slot without touching the icon props). The
/// button collapses to the HIconButton-family square when it carries a glyph
/// and no text; a shortcut chip is excluded (it is an extra flex child the
/// fixed square width would clip), and a `label` prop counts as text.
pub fn button_icon_only(props: &ButtonProps) -> bool {
    slot_is_empty(&props.children)
        && props.label.is_none()
        && (props.icon.is_some() || props.suffix.is_some())
        && !button_has_shortcut(props.shortcut.as_deref())
}

/// The complete class list in the exact order of Vue's `buttonClass`
/// computed, with empty entries dropped and the host `class` appended last.
pub fn button_classes(props: &ButtonProps, icon_only: bool) -> String {
    let has_shortcut = button_has_shortcut(props.shortcut.as_deref());
    let mut classes = String::from("hk-btn");
    classes.push(' ');
    classes.push_str(props.variant.class_name());
    classes.push(' ');
    classes.push_str(props.size.class_name());
    if props.block {
        classes.push(' ');
        classes.push_str("hk-btn-block");
    }
    if props.loading {
        classes.push(' ');
        classes.push_str("hk-btn-loading");
    }
    if has_shortcut {
        classes.push(' ');
        classes.push_str("hk-btn-has-shortcut");
    }
    // Vue: `collapseLabel && label && !block && !shortcut` — the label must be
    // non-empty text (the responsive collapse needs a label to hide).
    if let Some(collapse) = props.collapse_label {
        let label_is_text = props
            .label
            .as_deref()
            .is_some_and(|label| !label.is_empty());
        if label_is_text && !props.block && !has_shortcut {
            classes.push(' ');
            classes.push_str(collapse.class_name());
        }
    }
    if icon_only {
        classes.push(' ');
        classes.push_str("hk-btn-icon-only");
    }
    if !props.class.is_empty() {
        classes.push(' ');
        classes.push_str(&props.class);
    }
    classes
}

#[component]
pub fn Button(props: ButtonProps) -> Element {
    let icon_only = button_icon_only(&props);
    let classes = button_classes(&props, icon_only);

    let ButtonProps {
        loading,
        disabled,
        aria_label,
        label,
        shortcut,
        icon,
        suffix,
        children,
        onclick,
        style,
        button_type,
        autofocus,
        ..
    } = props;

    let has_shortcut = button_has_shortcut(shortcut.as_deref());

    // Vue: `aria-label={ariaLabel ?? label}` — the nullish coalescing keeps an
    // explicit empty string, so this is `or`, not a truthiness test.
    let aria_label = aria_label.or_else(|| label.clone());
    // Vue: `aria-busy={loading || undefined}`.
    let aria_busy = if loading {
        Some("true".to_string())
    } else {
        None
    };
    // Vue: `style={attrs.style || undefined}`.
    let style_attr = if style.is_empty() { None } else { Some(style) };

    // Vue: an explicit `label` wins over the default slot (one label source
    // per button); an empty label falls through to the slot.
    let label_or_slot = match label.as_deref() {
        Some(text) if !text.is_empty() => rsx! {
            span { class: "hk-btn-label", "{text}" }
        },
        _ => children.clone(),
    };

    rsx! {
        button {
            class: classes,
            "type": button_type,
            disabled: disabled || loading,
            "aria-label": aria_label,
            "aria-busy": aria_busy,
            autofocus: autofocus,
            style: style_attr,
            onclick: move |e: MouseEvent| {
                if let Some(handler) = onclick.as_ref() {
                    handler.call(e.clone());
                }
            },
            if loading {
                // Trusted static markup (see the file header): the ring must
                // keep its SMIL rotation and its literal `.hk-btn-ring` class.
                span { dangerous_inner_html: BUTTON_RING_SVG }
            }
            if !loading {
                if let Some(glyph) = icon.clone() {
                    span { class: "hk-btn-icon",
                        {glyph}
                    }
                }
            }
            {label_or_slot.clone()}
            if let Some(glyph) = suffix.clone() {
                span { class: "hk-btn-suffix",
                    {glyph}
                }
            }
            if has_shortcut {
                Kbd {
                    keys: shortcut.clone().unwrap_or_default(),
                    size: KbdSize::Sm,
                }
            }
        }
    }
}

impl StyledComponent for ButtonComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-btn*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkButton.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "button"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn glyph() -> Element {
        rsx! {
            span { class: "test-glyph" }
        }
    }

    #[test]
    fn button_variant_class_names_match_the_vue_modifiers() {
        assert_eq!(ButtonVariant::Primary.class_name(), "hk-btn-primary");
        assert_eq!(ButtonVariant::Secondary.class_name(), "hk-btn-secondary");
        assert_eq!(ButtonVariant::Ghost.class_name(), "hk-btn-ghost");
        assert_eq!(ButtonVariant::Danger.class_name(), "hk-btn-danger");
        assert_eq!(ButtonVariant::Outline.class_name(), "hk-btn-outline");
    }

    #[test]
    fn button_size_class_names_match_the_vue_modifiers() {
        assert_eq!(ButtonSize::Xs.class_name(), "hk-btn-xs");
        assert_eq!(ButtonSize::Sm.class_name(), "hk-btn-sm");
        assert_eq!(ButtonSize::Md.class_name(), "hk-btn-md");
        assert_eq!(ButtonSize::Lg.class_name(), "hk-btn-lg");
    }

    #[test]
    fn button_label_collapse_class_names_match_the_vue_modifiers() {
        assert_eq!(
            ButtonLabelCollapse::Sm.class_name(),
            "hk-btn-label-collapse-sm"
        );
        assert_eq!(
            ButtonLabelCollapse::Md.class_name(),
            "hk-btn-label-collapse-md"
        );
        assert_eq!(
            ButtonLabelCollapse::Lg.class_name(),
            "hk-btn-label-collapse-lg"
        );
        assert_eq!(
            ButtonLabelCollapse::Xl.class_name(),
            "hk-btn-label-collapse-xl"
        );
    }

    #[test]
    fn button_defaults_match_the_vue_props() {
        let props = ButtonProps::default();
        // Vue: variant primary, size md, everything else false/undefined.
        assert_eq!(props.variant, ButtonVariant::Primary);
        assert_eq!(props.size, ButtonSize::Md);
        assert!(!props.loading);
        assert!(!props.disabled);
        assert!(!props.block);
        assert_eq!(props.aria_label, None);
        assert_eq!(props.label, None);
        assert_eq!(props.collapse_label, None);
        assert_eq!(props.shortcut, None);
        assert!(props.icon.is_none());
        assert!(props.suffix.is_none());
        assert!(slot_is_empty(&props.children));
        assert!(props.onclick.is_none());
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
        // Vue: `attrs.type || "button"`.
        assert_eq!(props.button_type, "button");
        assert!(!props.autofocus);
    }

    #[test]
    fn button_class_list_matches_the_vue_computed() {
        let mut props = ButtonProps {
            variant: ButtonVariant::Outline,
            size: ButtonSize::Sm,
            class: "host-class".to_string(),
            ..Default::default()
        };
        assert_eq!(
            button_classes(&props, false),
            "hk-btn hk-btn-outline hk-btn-sm host-class"
        );

        props.block = true;
        props.loading = true;
        assert_eq!(
            button_classes(&props, true),
            "hk-btn hk-btn-outline hk-btn-sm hk-btn-block hk-btn-loading hk-btn-icon-only host-class"
        );
    }

    #[test]
    fn button_class_list_adds_the_shortcut_hook() {
        let props = ButtonProps {
            shortcut: Some("Ctrl+K".to_string()),
            ..Default::default()
        };
        assert_eq!(
            button_classes(&props, false),
            "hk-btn hk-btn-primary hk-btn-md hk-btn-has-shortcut"
        );
        // Vue: an EMPTY shortcut string is falsy — no hook, no chip.
        let empty = ButtonProps {
            shortcut: Some(String::new()),
            ..Default::default()
        };
        assert_eq!(
            button_classes(&empty, false),
            "hk-btn hk-btn-primary hk-btn-md"
        );
        assert!(!button_has_shortcut(empty.shortcut.as_deref()));
    }

    #[test]
    fn button_class_list_gates_the_collapse_class_exactly_like_vue() {
        let labelled = || ButtonProps {
            label: Some("Save".to_string()),
            collapse_label: Some(ButtonLabelCollapse::Sm),
            ..Default::default()
        };
        assert!(
            button_classes(&labelled(), false).contains("hk-btn-label-collapse-sm"),
            "label + collapseLabel must emit the responsive hook"
        );

        // Without a label there is nothing to hide.
        let no_label = ButtonProps {
            collapse_label: Some(ButtonLabelCollapse::Sm),
            ..Default::default()
        };
        assert!(!button_classes(&no_label, false).contains("hk-btn-label-collapse"));
        // An empty label is falsy in Vue too.
        let empty_label = ButtonProps {
            label: Some(String::new()),
            collapse_label: Some(ButtonLabelCollapse::Sm),
            ..Default::default()
        };
        assert!(!button_classes(&empty_label, false).contains("hk-btn-label-collapse"));
        // `block` and `shortcut` both suppress the collapse class.
        let mut blocked = labelled();
        blocked.block = true;
        assert!(!button_classes(&blocked, false).contains("hk-btn-label-collapse"));
        let mut chipped = labelled();
        chipped.shortcut = Some("Ctrl+K".to_string());
        assert!(!button_classes(&chipped, false).contains("hk-btn-label-collapse"));
    }

    #[test]
    fn button_icon_only_contract_matches_vue() {
        // Glyph + no text → the HIconButton-family square.
        let icon_only = ButtonProps {
            icon: Some(glyph()),
            ..Default::default()
        };
        assert!(button_icon_only(&icon_only));
        let suffix_only = ButtonProps {
            suffix: Some(glyph()),
            ..Default::default()
        };
        assert!(button_icon_only(&suffix_only));

        // Default-slot content counts as text.
        let with_slot = ButtonProps {
            icon: Some(glyph()),
            children: VNode::Text(VText::new("Go")),
            ..Default::default()
        };
        assert!(!button_icon_only(&with_slot));
        // A `label` prop counts as text even when empty (`label !== undefined`).
        let with_label = ButtonProps {
            icon: Some(glyph()),
            label: Some(String::new()),
            ..Default::default()
        };
        assert!(!button_icon_only(&with_label));
        // A shortcut chip is an extra flex child the square would clip.
        let with_shortcut = ButtonProps {
            icon: Some(glyph()),
            shortcut: Some("Ctrl+K".to_string()),
            ..Default::default()
        };
        assert!(!button_icon_only(&with_shortcut));
        // No glyph at all.
        let text_only = ButtonProps {
            children: VNode::Text(VText::new("Save")),
            ..Default::default()
        };
        assert!(!button_icon_only(&text_only));
    }

    #[test]
    fn button_slot_emptiness_matches_the_vue_slot_test() {
        assert!(slot_is_empty(&empty_vnode()));
        assert!(slot_is_empty(&VNode::Fragment(Vec::new())));
        assert!(slot_is_empty(&VNode::Fragment(vec![
            VNode::Fragment(Vec::new()),
            VNode::Text(VText::new("")),
        ])));
        assert!(!slot_is_empty(&VNode::Text(VText::new("x"))));
        assert!(!slot_is_empty(&glyph()));
    }

    #[test]
    fn button_loading_ring_keeps_the_vue_dom_contract() {
        // The ring ships from trusted static markup; it must carry the literal
        // Vue class and the SMIL child the CSS-only fallback cannot express.
        assert!(BUTTON_RING_SVG.contains("class=\"hk-btn-ring\""));
        assert!(BUTTON_RING_SVG.contains("viewBox=\"0 0 16 16\""));
        assert!(BUTTON_RING_SVG.contains("<animateTransform"));
        assert!(BUTTON_RING_SVG.contains("aria-hidden=\"true\""));
    }

    #[test]
    fn button_styles_come_from_the_canonical_vue_sheet() {
        let css = ButtonComponent::styles();
        for class in [
            ".hk-btn",
            ".hk-btn-primary",
            ".hk-btn-secondary",
            ".hk-btn-outline",
            ".hk-btn-ghost",
            ".hk-btn-danger",
            ".hk-btn-xs",
            ".hk-btn-sm",
            ".hk-btn-md",
            ".hk-btn-lg",
            ".hk-btn-icon",
            ".hk-btn-suffix",
            ".hk-btn-label",
            ".hk-btn-block",
            ".hk-btn-loading",
            ".hk-btn-icon-only",
            ".hk-btn-label-collapse-sm",
            ".hk-btn-label-collapse-xl",
        ] {
            assert!(
                css.contains(class),
                "button css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored button sheet"
        );
        // The retired legacy family must not leak back in (`.hk-btn*` is the
        // new one — only the historical `.hk-button*` prefix is banned).
        assert!(
            !css.contains(".hk-button"),
            "legacy .hk-button classes are retired"
        );
    }
}
