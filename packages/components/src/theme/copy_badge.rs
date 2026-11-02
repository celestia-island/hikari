// hi-components/src/theme/copy_badge.rs
// CopyBadge — mirror of the canonical Vue `HkCopyBadge` (the house standard
// for interactive TAGS: a HkBadge that never selects text and instead copies
// on click, with a "click to copy" tooltip).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkCopyBadge.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-badge.hk-copy-badge` selector matches
// literally in both forms — the interactive class MUST land on the badge
// root itself.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   [enabled]  Tooltip(text = tooltip ?? "Click to copy")
//     span.hk-tooltip-wrapper … span.hk-tooltip-trigger
//       span.hk-badge.hk-badge-{variant} .hk-copy-badge [host class]
//            role="button" tabindex="0" [data-size] [data-pill="false"]
//            [data-mono] [data-uppercase] [data-dot-only]
//            (style: --hk-badge-{text,bg,border} overrides)
//         span[data-el="dot"]?  {label}
//   [disabled] the same badge span WITHOUT `hk-copy-badge`, the button
//              semantics, the handlers or any tooltip chrome.
//
// Behaviour taken from the Vue component, not reinvented:
//   * `activate()` — disabled returns; `action` REPLACES the copy behavior
//     outright; otherwise the payload copies only when non-empty
//     ([`copy_badge_activation`]);
//   * the payload — `value` when provided (verbatim, even untrimmed; an
//     EMPTY value is Vue-falsy and never copies), otherwise the rendered
//     text trimmed ([`copy_badge_payload`]);
//   * the click stops propagation FIRST (a tag inside a selectable row
//     copies without selecting the row), then activates;
//   * the keyboard path — Enter/Space preventDefault + stopPropagation,
//     then the same activation;
//   * the tooltip text — `tooltip ?? t("hikari::clipboard.clickToCopy")`
//     ([`copy_badge_tooltip_text`]; the Rust bundle already carries the key
//     as `components.hk.clipboard.clickToCopy`).
//
// Adaptation deltas vs Vue (deliberate, listed instead of hidden):
//   * CLIPBOARD — wasip2 has NO clipboard API and the crate ships none, so
//     the shared `useClipboardWithToast` path becomes an `on_copy` sink
//     ([`Callback<String>`]): the mirror fires it with the payload and the
//     host owns the write + the confirming toast (same seam as the
//     `HkToast` / share-bar mirrors).
//   * COPIED-TIMEOUT — the 2s `copied` reset lives in Vue's `useClipboard`;
//     the host that mirrors that state gets the window as
//     [`COPY_BADGE_COPIED_RESET_MS`] instead of a magic number.
//   * PAYLOAD SOURCE — Vue reads the badge root's `textContent` when no
//     `value` is given; a tairitsu `Element` exposes no text, so the face
//     text rides the explicit `label` prop (rendered AND payload base).
//   * BADGE FACE — the mirrored `basic::badge::Badge` has no class/attr
//     passthrough, but `.hk-copy-badge` must sit ON the badge root (the
//     sheet's `.hk-badge.hk-copy-badge` selector) — so the face span is
//     assembled here, reusing `BadgeVariant` / `BadgeSize` as the single
//     source of the variant/size tokens (the same fork `filter_bar` made
//     for its count chip).
//   * ARIA-DESCRIBEDBY — Vue links the badge to the tooltip popup id via
//     slot props while visible; the mirrored `Tooltip` owns its
//     wrapper-level describedby, so the badge-level link does not exist.
//   * DEV WARN — Vue's `console.warn` for `action` without `tooltip` has no
//     release-channel twin here; the contract stays documented on
//     [`copy_badge_activation`] (`action` wins, `tooltip` should accompany).
//
// The component is STATELESS (nothing to store; ledger L48 never comes into
// play). Interaction binds the mouse family (ledger L67): `onclick` carries
// the press; Enter/Space ride `onkeydown` exactly like Vue's keydown hook.

use hikari_i18n::t;

use crate::basic::badge::{BadgeSize, BadgeVariant};
use crate::feedback::tooltip::{Tooltip, TooltipProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct CopyBadgeComponent;

/// Vue's `useClipboard` copied-state window: how long `copied` stays true
/// after a successful write before the 2s `setTimeout` resets it. The
/// mirror's host owns that state (see the CLIPBOARD delta).
pub const COPY_BADGE_COPIED_RESET_MS: u64 = 2000;

/// The outcome of one activation, verbatim from Vue's `activate()`:
/// nothing (disabled / empty payload), the custom action, or a copy with
/// the resolved payload.
#[derive(Clone, PartialEq, Debug)]
pub enum CopyBadgeActivation {
    /// Disabled, or the payload resolved empty (`if (!text) return;`).
    None,
    /// `action` replaced the copy behavior outright.
    Action,
    /// Copy the resolved payload through the host's `on_copy` sink.
    Copy(String),
}

/// Vue's `tooltipText` computed: `props.tooltip ?? t("hikari::
/// clipboard.clickToCopy", "Click to copy")` — the Rust bundle carries the
/// key as `components.hk.clipboard.clickToCopy`.
pub fn copy_badge_tooltip_text(tooltip: Option<&str>) -> String {
    match tooltip {
        Some(tooltip) => tooltip.to_string(),
        None => t("components.hk.clipboard.clickToCopy", "Click to copy"),
    }
}

/// Vue's `copyPayload()`: `value` verbatim when provided (an EMPTY value is
/// falsy and never copies — `if (!text) return;` catches it), otherwise the
/// rendered label trimmed. `None` = "nothing to copy".
pub fn copy_badge_payload(value: Option<&str>, label: &str) -> Option<String> {
    match value {
        Some(value) if !value.is_empty() => Some(value.to_string()),
        Some(_) => None,
        None => {
            let label = label.trim();
            (!label.is_empty()).then(|| label.to_string())
        }
    }
}

/// Vue's `activate()` as one pure step: disabled → nothing; `action` → the
/// action replaces the copy outright; otherwise the payload copies only
/// when non-empty.
pub fn copy_badge_activation(
    disabled: bool,
    action: bool,
    value: Option<&str>,
    label: &str,
) -> CopyBadgeActivation {
    if disabled {
        return CopyBadgeActivation::None;
    }
    if action {
        return CopyBadgeActivation::Action;
    }
    match copy_badge_payload(value, label) {
        Some(payload) => CopyBadgeActivation::Copy(payload),
        None => CopyBadgeActivation::None,
    }
}

/// The badge face classes: the mirrored Badge's own class pair, the
/// interactive `hk-copy-badge` hook (absent when disabled — Vue's
/// `props.disabled ? attrClass : ["hk-copy-badge", attrClass]`), then the
/// host class appended last (Vue merges `attrs.class` there).
pub fn copy_badge_face_classes(variant: BadgeVariant, disabled: bool, class: &str) -> String {
    let mut out = format!("hk-badge {}", variant.class_name());
    if !disabled {
        out.push_str(" hk-copy-badge");
    }
    if !class.is_empty() {
        out.push(' ');
        out.push_str(class);
    }
    out
}

#[define_props]
pub struct CopyBadgeProps {
    /// What a click copies; `None` falls back to the rendered `label`
    /// (Vue: the badge root's `textContent`, trimmed).
    pub value: Option<String>,

    /// Tooltip override; `None` uses the localized "Click to copy".
    pub tooltip: Option<String>,

    /// Swaps the click behavior outright (must come with a custom
    /// `tooltip` so the hint stops claiming copy — Vue warns otherwise).
    pub action: Option<Callback<()>>,

    /// Render the inert badge face: no tooltip, no click, no cursor.
    #[default]
    pub disabled: bool,

    // ── HkBadge passthrough (Vue defaults) ─────────────────────────────
    #[default]
    pub variant: BadgeVariant,

    #[default]
    pub dot: bool,

    #[default]
    pub size: BadgeSize,

    #[default]
    pub mono: bool,

    #[default]
    pub uppercase: bool,

    #[default(true)]
    pub pill: bool,

    pub color: Option<String>,

    pub bg_color: Option<String>,

    pub border_color: Option<String>,

    /// The rendered badge text (also the default copy payload base).
    #[default]
    pub label: String,

    /// Host class merged onto the badge root (Vue: `attrs.class`).
    #[default]
    pub class: String,

    /// Copy sink — receives the resolved payload (wasip2 has no clipboard;
    /// see the CLIPBOARD delta).
    pub on_copy: Option<Callback<String>>,
}

/// Run one resolved activation against the seams (the shared body of the
/// click and keyboard handlers; `disabled` was already ruled out by the
/// caller — the handlers only exist on the interactive face).
fn copy_badge_run_activation(
    action: &Option<Callback<()>>,
    on_copy: &Option<Callback<String>>,
    value: Option<&str>,
    label: &str,
) {
    match copy_badge_activation(false, action.is_some(), value, label) {
        CopyBadgeActivation::Action => {
            if let Some(action) = action.as_ref() {
                action.call(());
            }
        }
        CopyBadgeActivation::Copy(payload) => {
            if let Some(on_copy) = on_copy.as_ref() {
                on_copy.call(payload);
            }
        }
        CopyBadgeActivation::None => {}
    }
}

#[component]
pub fn CopyBadge(props: CopyBadgeProps) -> Element {
    let interactive = !props.disabled;

    let has_content = !props.label.is_empty();
    // HkBadge's own rule: a dot with no content collapses to dot-only.
    let dot_only = props.dot && !has_content;

    let mut style = String::new();
    if let Some(color) = &props.color {
        style.push_str(&format!("--hk-badge-text:{color};"));
    }
    if let Some(bg) = &props.bg_color {
        style.push_str(&format!("--hk-badge-bg:{bg};"));
    }
    if let Some(border) = &props.border_color {
        style.push_str(&format!("--hk-badge-border:{border};"));
    }

    let mut face = VElement::new("span").class(copy_badge_face_classes(
        props.variant,
        props.disabled,
        &props.class,
    ));
    face = face.attr("data-size", props.size.data_size());
    if !props.pill {
        face = face.attr("data-pill", "false");
    }
    if props.mono {
        face = face.attr("data-mono", "");
    }
    if props.uppercase {
        face = face.attr("data-uppercase", "");
    }
    if dot_only {
        face = face.attr("data-dot-only", "");
    }
    if !style.is_empty() {
        face = face.style(style);
    }
    if props.dot {
        face = face.child(rsx! {
            span { "data-el": "dot" }
        });
    }
    if has_content {
        face = face.child(VNode::Text(VText::new(&props.label)));
    }

    if interactive {
        // The activation seam: action replaces the copy outright; the copy
        // path hands the resolved payload to the host sink. Each handler
        // owns its own clones (both are `FnMut` on the same face).
        let click_action = props.action.clone();
        let click_on_copy = props.on_copy.clone();
        let click_value = props.value.clone();
        let click_label = props.label.clone();
        let key_action = props.action.clone();
        let key_on_copy = props.on_copy.clone();
        let key_value = props.value.clone();
        let key_label = props.label.clone();
        face = face
            .attr("role", "button")
            .attr("tabindex", "0")
            .on_click(move |event: MouseEvent| {
                // A tag inside a clickable row copies itself without
                // triggering the row.
                event.stop_propagation();
                copy_badge_run_activation(
                    &click_action,
                    &click_on_copy,
                    click_value.as_deref(),
                    &click_label,
                );
            })
            .on_keydown(move |event: KeyboardEvent| {
                if event.key != "Enter" && event.key != " " {
                    return;
                }
                event.prevent_default();
                event.stop_propagation();
                copy_badge_run_activation(
                    &key_action,
                    &key_on_copy,
                    key_value.as_deref(),
                    &key_label,
                );
            });

        Tooltip(TooltipProps {
            text: copy_badge_tooltip_text(props.tooltip.as_deref()),
            children: VNode::Element(Box::new(face)),
            ..Default::default()
        })
    } else {
        VNode::Element(Box::new(face))
    }
}

impl StyledComponent for CopyBadgeComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-copy-badge` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkCopyBadge.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "copy-badge"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Walk the tree and return every element carrying one of `keys` in its
    /// event-handler map (DOM-contract probe for the interaction seam).
    fn elements_with_handler(node: &VNode, key: &str, out: &mut Vec<String>) {
        match node {
            VNode::Element(element) => {
                if element.event_handlers.contains_key(key) {
                    out.push(element.class.to_string());
                }
                for child in &element.children {
                    elements_with_handler(child, key, out);
                }
            }
            VNode::Fragment(children) => {
                for child in children {
                    elements_with_handler(child, key, out);
                }
            }
            VNode::Text(_) | VNode::DynamicText(_) => {}
        }
    }

    #[test]
    fn copy_badge_defaults_match_the_vue_props() {
        let props = CopyBadgeProps::default();
        assert!(!props.disabled);
        assert_eq!(props.variant, BadgeVariant::Default);
        assert!(!props.dot);
        assert_eq!(props.size, BadgeSize::Md);
        assert!(!props.mono);
        assert!(!props.uppercase);
        assert!(props.pill);
        assert!(props.value.is_none());
        assert!(props.tooltip.is_none());
        assert!(props.action.is_none());
        assert!(props.color.is_none());
        assert!(props.bg_color.is_none());
        assert!(props.border_color.is_none());
        assert_eq!(props.label, "");
        assert_eq!(props.class, "");
        assert!(props.on_copy.is_none());
    }

    #[test]
    fn copy_badge_tooltip_text_follows_tooltip_or_the_locale_default() {
        assert_eq!(
            copy_badge_tooltip_text(None),
            "Click to copy",
            "falls back to the localized default"
        );
        assert_eq!(copy_badge_tooltip_text(Some("Open panel")), "Open panel");
    }

    #[test]
    fn copy_badge_payload_mirrors_vues_copy_payload() {
        // `value` wins verbatim — untrimmed, like Vue.
        assert_eq!(
            copy_badge_payload(Some("  long-id-770f625  "), "#770f"),
            Some("  long-id-770f625  ".to_string())
        );
        // An EMPTY value is Vue-falsy: nothing to copy.
        assert_eq!(copy_badge_payload(Some(""), "#770f"), None);
        // Without a value the rendered label is the payload, trimmed.
        assert_eq!(
            copy_badge_payload(None, "  #770f  "),
            Some("#770f".to_string())
        );
        assert_eq!(copy_badge_payload(None, "   "), None);
        assert_eq!(copy_badge_payload(None, ""), None);
    }

    #[test]
    fn copy_badge_activation_runs_vues_activate_order() {
        // Disabled wins over everything.
        assert_eq!(
            copy_badge_activation(true, true, Some("x"), "y"),
            CopyBadgeActivation::None
        );
        // The action replaces the copy outright — even with an empty label.
        assert_eq!(
            copy_badge_activation(false, true, None, ""),
            CopyBadgeActivation::Action
        );
        // Copy fires only with a non-empty payload.
        assert_eq!(
            copy_badge_activation(false, false, Some("x"), ""),
            CopyBadgeActivation::Copy("x".to_string())
        );
        assert_eq!(
            copy_badge_activation(false, false, None, "  #770f "),
            CopyBadgeActivation::Copy("#770f".to_string())
        );
        assert_eq!(
            copy_badge_activation(false, false, None, "  "),
            CopyBadgeActivation::None
        );
    }

    #[test]
    fn copy_badge_face_classes_carry_the_interactive_hook() {
        assert_eq!(
            copy_badge_face_classes(BadgeVariant::Default, false, ""),
            "hk-badge hk-badge-default hk-copy-badge"
        );
        // Disabled drops the hook but keeps the host class merge.
        assert_eq!(
            copy_badge_face_classes(BadgeVariant::Muted, true, "host"),
            "hk-badge hk-badge-muted host"
        );
        assert_eq!(
            copy_badge_face_classes(BadgeVariant::Error, false, "host"),
            "hk-badge hk-badge-error hk-copy-badge host"
        );
    }

    #[test]
    fn copy_badge_copied_reset_window_is_vues_two_seconds() {
        assert_eq!(COPY_BADGE_COPIED_RESET_MS, 2000);
    }

    #[test]
    fn copy_badge_renders_the_vue_dom_contract() {
        let html = CopyBadge(CopyBadgeProps {
            label: "#770f".to_string(),
            ..Default::default()
        })
        .render_to_html();

        // The tooltip wrap (Vue: HkTooltip) around the interactive face.
        assert!(html.contains(r#"class="hk-tooltip-wrapper""#), "{html}");
        assert!(html.contains("Click to copy"), "{html}");
        // The face: badge pair + interactive hook + button semantics + text.
        for needle in [
            r#"class="hk-badge hk-badge-default hk-copy-badge""#,
            r#"role="button""#,
            r#"tabindex="0""#,
            r#"data-size="md""#,
            ">#770f<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
    }

    #[test]
    fn copy_badge_binds_the_mouse_and_keyboard_seams_only_when_interactive() {
        let mut clickers = Vec::new();
        elements_with_handler(
            &CopyBadge(CopyBadgeProps {
                label: "#770f".to_string(),
                ..Default::default()
            }),
            "click",
            &mut clickers,
        );
        assert_eq!(
            clickers,
            vec!["hk-badge hk-badge-default hk-copy-badge".to_string()],
            "the click seam binds on the face itself (mouse family, ledger L67)"
        );

        let mut keyed = Vec::new();
        elements_with_handler(&CopyBadge(CopyBadgeProps::default()), "keydown", &mut keyed);
        assert_eq!(
            keyed,
            vec!["hk-badge hk-badge-default hk-copy-badge".to_string()]
        );
    }

    #[test]
    fn copy_badge_disabled_renders_the_plain_badge_face() {
        let html = CopyBadge(CopyBadgeProps {
            label: "#770f".to_string(),
            disabled: true,
            class: "host".to_string(),
            ..Default::default()
        })
        .render_to_html();

        // The inert face: no interactive hook, no button semantics, no
        // tooltip chrome — but the host class still merges.
        assert!(
            html.contains(r#"class="hk-badge hk-badge-default host""#),
            "{html}"
        );
        assert!(!html.contains("hk-copy-badge"), "{html}");
        assert!(!html.contains(r#"role="button""#), "{html}");
        assert!(!html.contains("tabindex"), "{html}");
        assert!(!html.contains("hk-tooltip"), "{html}");
    }

    #[test]
    fn copy_badge_renders_the_dot_and_override_pass_through() {
        let html = CopyBadge(CopyBadgeProps {
            label: "#770f".to_string(),
            dot: true,
            variant: BadgeVariant::Success,
            size: BadgeSize::Sm,
            mono: true,
            uppercase: true,
            pill: false,
            color: Some("red".to_string()),
            bg_color: Some("black".to_string()),
            border_color: Some("gray".to_string()),
            value: Some("770f625-full".to_string()),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-badge hk-badge-success hk-copy-badge""#,
            r#"data-size="sm""#,
            r#"data-pill="false""#,
            "data-mono",
            "data-uppercase",
            r#"data-el="dot""#,
            r#"--hk-badge-text:red"#,
            r#"--hk-badge-bg:black"#,
            r#"--hk-badge-border:gray"#,
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // dot + content → NOT dot-only.
        assert!(!html.contains("data-dot-only"), "{html}");
    }

    #[test]
    fn copy_badge_styles_come_from_the_canonical_vue_sheet() {
        let css = CopyBadgeComponent::styles();
        // The sheet's one selector needs BOTH classes on one node — the
        // exact contract the face assembly above keeps.
        assert!(
            css.contains(".hk-badge.hk-copy-badge"),
            "copy badge css must keep the same-node selector"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored copy-badge sheet"
        );
    }
}
