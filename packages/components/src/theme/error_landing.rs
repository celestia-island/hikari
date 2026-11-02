// hi-components/src/theme/error_landing.rs
// ErrorLanding — mirror of the canonical Vue `HkErrorLanding`: the shared
// error landing card (full-viewport `page` variant or in-flow `inline`
// variant with `fill` seating).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkErrorLanding.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-error-landing*` class names are literal and identical in both forms.
// DOM contract (mirrors the Vue render output one-to-one):
//
//   div.hk-error-landing.is-{tone} [.is-inline] [.is-fill]
//     div.hk-error-landing__card
//       {brand slot}                                  (no wrapper of its own)
//       div.hk-error-landing__icon [aria-hidden]      (tone icon, 28px)
//       [code || status] div.hk-error-landing__meta
//         span.hk-badge.hk-badge-{tone}.hk-error-landing__code
//              [data-size=sm data-mono] {code}        (badge class falls
//              through onto the badge root, Vue's single-rooted contract)
//         span.hk-badge.hk-badge-muted.hk-error-landing__status
//              [data-size=sm data-mono] "HTTP {status}"
//       h1.hk-error-landing__title {title || defaultTitle}
//       [description] p.hk-error-landing__desc {description}
//       [children] div.hk-error-landing__details
//         div.hk-error-landing__details-label [aria-hidden]  (braces glyph
//                                                          + "Raw error
//                                                          details")
//         div.hk-error-landing__details-pane
//           div.hk-error-landing__details-body {children}    (the raw slot)
//       [actions || copy] div.hk-error-landing__actions [aria-live=polite]
//         [copyText] button.hk-btn… "Copy error details"     (FIRST, left of
//                                                          the host actions)
//         {actions slot}
//
// Prop/emit mapping (Vue → mirror): `title`/`description`/`code` arrive
// pre-translated (the landing only translates its OWN labels);
// `status` → `status: Option<i32>`, `copyText` → `copy_text`,
// `copyLabel` → `copy_label`, `tone` → [`ErrorLandingTone`], `variant` →
// [`ErrorLandingVariant`], `fill` → `fill` (only meaningful on `inline`,
// exactly like Vue's `props.fill && props.variant === "inline"` test).
//
// Deltas vs Vue (documented, not accidental):
//   * CLIPBOARD: Vue's built-in copy action runs `useClipboard().copy`
//     directly and flips its label/icon from the clipboard's internal
//     `copied` ref. wasip2 has no clipboard, so the button fires
//     [`ErrorLandingProps::on_copy`] and the HOST performs the copy; the
//     flipped state is the CONTROLLED [`ErrorLandingProps::copied`] prop
//     (the same split `overlay/protocol_modal.rs` documents). The button
//     still renders first-in-row and stays gated on `copy_text`.
//   * BRAND GLYPHS: the packed MDI set has no lucide `Braces`, `Copy` is
//     `ContentCopy`, and the info glyph is `Information` — the details-label
//     mark rides `MdiIcon::Code` (`code-braces`), the closest packed glyph.
//   * OVERLAY SCROLLBAR: Vue attaches the family overlay scrollbar to the
//     details body (both axes) and the sheet hides the native bar. The
//     overlay chrome has no tairitsu primitive this wave, so the standing
//     frame ships WITHOUT any scrollbar: the body still scrolls (the sheet's
//     `overflow: auto` rides along), only the painted thumb is absent.
//   * NO ResizeObserver passes: Vue re-reads the thumb geometry on content
//     resize. With no chrome attached there is nothing to refresh.

use hikari_i18n::t;
use hikari_icons::{Icon, MdiIcon};

use crate::basic::{Badge, BadgeSize, BadgeVariant, Button, ButtonSize, ButtonVariant};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ErrorLandingComponent;

/// Visual severity of the icon and accents (Vue: `"error" | "warning" |
/// "info"`, default `error`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ErrorLandingTone {
    #[default]
    Error,
    Warning,
    Info,
}

impl ErrorLandingTone {
    /// The `is-{tone}` modifier exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            ErrorLandingTone::Error => "is-error",
            ErrorLandingTone::Warning => "is-warning",
            ErrorLandingTone::Info => "is-info",
        }
    }

    /// The code chip's badge voice follows the landing tone (Vue:
    /// `codeBadgeVariant` — warning → warning, info → info, else error).
    pub fn code_badge_variant(self) -> BadgeVariant {
        match self {
            ErrorLandingTone::Error => BadgeVariant::Error,
            ErrorLandingTone::Warning => BadgeVariant::Warning,
            ErrorLandingTone::Info => BadgeVariant::Info,
        }
    }

    /// The headline glyph (Vue: `Info` for the info tone, `TriangleAlert`
    /// for error and warning).
    pub fn icon(self) -> MdiIcon {
        match self {
            ErrorLandingTone::Error | ErrorLandingTone::Warning => MdiIcon::AlertTriangle,
            ErrorLandingTone::Info => MdiIcon::Information,
        }
    }
}

/// Layout variant (Vue: `"page" | "inline"`, default `page`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ErrorLandingVariant {
    /// Owns a full-viewport backdrop.
    #[default]
    Page,
    /// In-flow card that fills its host region instead of the viewport.
    Inline,
}

/// The complete root class list in Vue's template order (base, tone, inline,
/// fill — fill only ever lands next to `inline`, like Vue's compound test).
pub fn error_landing_classes(
    tone: ErrorLandingTone,
    variant: ErrorLandingVariant,
    fill: bool,
) -> String {
    let mut classes = String::from("hk-error-landing ");
    classes.push_str(tone.class_name());
    if variant == ErrorLandingVariant::Inline {
        classes.push_str(" is-inline");
        if fill {
            classes.push_str(" is-fill");
        }
    }
    classes
}

/// Vue's `titleText`: an EMPTY title falls back to the bundle's default
/// headline (a non-empty string wins verbatim — Vue tests truthiness).
pub fn error_landing_title(title: &str) -> String {
    if title.is_empty() {
        t(
            "components.hk.errorLanding.defaultTitle",
            "Something went wrong",
        )
    } else {
        title.to_string()
    }
}

/// Vue's status chip text: `HTTP {status}`.
pub fn error_landing_status_chip(status: i32) -> String {
    format!("HTTP {status}")
}

/// Vue's `hasActions`: the row renders when the host feeds a copy payload OR
/// provides slot actions.
pub fn error_landing_has_actions(actions_slot: bool, copy_text: &str) -> bool {
    actions_slot || !copy_text.is_empty()
}

/// The built-in copy button's label (Vue: the flipped `copied` label, the
/// host override, then the bundle default).
pub fn error_landing_copy_label(copied: bool, copy_label: &str) -> String {
    if copied {
        t("components.hk.errorLanding.copied", "Copied")
    } else if copy_label.is_empty() {
        t(
            "components.hk.errorLanding.copyDetails",
            "Copy error details",
        )
    } else {
        copy_label.to_string()
    }
}

/// The built-in copy button's glyph (Vue: `Check` once copied, `Copy` at
/// rest).
pub fn error_landing_copy_icon(copied: bool) -> MdiIcon {
    if copied {
        MdiIcon::Check
    } else {
        MdiIcon::ContentCopy
    }
}

/// Appends `extra` to a vnode's ROOT element class list — how the landing
/// puts `.hk-error-landing__code` / `__status` ON the badge root: Vue relies
/// on HkBadge being single-rooted so the class falls through; the Rust
/// `Badge` has no `class` prop, so its output is post-processed here instead
/// (the DOM ends up byte-identical).
pub fn error_landing_with_extra_class(node: VNode, extra: &str) -> VNode {
    match node {
        VNode::Element(mut el) => {
            el.class = std::mem::take(&mut el.class).add(extra);
            VNode::Element(el)
        }
        other => other,
    }
}

#[define_props]
pub struct ErrorLandingProps {
    /// Pre-translated headline; empty falls back to the bundle default.
    #[default]
    pub title: String,

    /// Pre-translated secondary text; newlines render as line breaks (the
    /// sheet's `white-space: pre-line`).
    #[default]
    pub description: String,

    /// Wire error code chip (e.g. `unknown_provider`); empty omits the chip.
    #[default]
    pub code: String,

    /// HTTP status chip (e.g. 400); `None` omits the chip.
    pub status: Option<i32>,

    /// Full error info the built-in copy action hands to the host (empty
    /// disables the action).
    #[default]
    pub copy_text: String,

    /// Wording override for the built-in copy button; empty uses the bundle.
    #[default]
    pub copy_label: String,

    /// Visual severity (Vue default `error`).
    #[default]
    pub tone: ErrorLandingTone,

    /// Layout variant (Vue default `page`).
    #[default]
    pub variant: ErrorLandingVariant,

    /// Fill seating — grow into a definite-height flex pane and let the
    /// details frame compress (inline variant only, like Vue).
    #[default]
    pub fill: bool,

    /// Brand slot content, rendered at the card's top edge.
    pub brand: Option<Element>,

    /// The raw-details slot (Vue: the default slot — hosts render a JSON
    /// tree there). `Some` renders the standing details frame.
    pub children: Option<Element>,

    /// Host action buttons, seated AFTER the built-in copy action.
    pub actions: Option<Element>,

    /// The flipped state of the built-in copy button (controlled — the
    /// clipboard itself is host-owned, see the header deltas).
    #[default]
    pub copied: bool,

    /// The built-in copy verb — the host performs the actual clipboard write
    /// (see the header deltas).
    pub on_copy: Option<EventHandler<()>>,
}

#[component]
pub fn ErrorLanding(props: ErrorLandingProps) -> Element {
    let classes = error_landing_classes(props.tone, props.variant, props.fill);
    let title_text = error_landing_title(&props.title);
    let has_details = props.children.is_some();
    let has_actions = error_landing_has_actions(props.actions.is_some(), &props.copy_text);
    let details_label = t("components.hk.errorLanding.rawDetails", "Raw error details");

    // The chips: the landing-scoped classes land on the BADGE roots (see
    // [`error_landing_with_extra_class`]).
    let code_chip = (!props.code.is_empty()).then(|| {
        error_landing_with_extra_class(
            Badge(BadgeProps {
                variant: props.tone.code_badge_variant(),
                size: BadgeSize::Sm,
                mono: true,
                children: VNode::Text(VText::new(&props.code)),
                ..Default::default()
            }),
            "hk-error-landing__code",
        )
    });
    let status_chip = props.status.map(|status| {
        error_landing_with_extra_class(
            Badge(BadgeProps {
                variant: BadgeVariant::Muted,
                size: BadgeSize::Sm,
                mono: true,
                children: VNode::Text(VText::new(&error_landing_status_chip(status))),
                ..Default::default()
            }),
            "hk-error-landing__status",
        )
    });
    let has_meta = code_chip.is_some() || status_chip.is_some();

    // The built-in copy action: gated on `copy_text`, seated FIRST (left of
    // every host action) — the host owns the clipboard write.
    let copy_button = (!props.copy_text.is_empty()).then(|| {
        let on_copy = props.on_copy.clone();
        let label = error_landing_copy_label(props.copied, &props.copy_label);
        rsx! {
            Button {
                variant: ButtonVariant::Ghost,
                size: ButtonSize::Sm,
                icon: Some(rsx! {
                    Icon {
                        icon: error_landing_copy_icon(props.copied),
                        size: 12,
                    }
                }),
                label: Some(label),
                onclick: Some(event_handler(move |_event: MouseEvent| {
                    if let Some(handler) = on_copy.as_ref() {
                        handler.call(());
                    }
                })),
                children: empty_vnode(),
            }
        }
    });

    let mut card = VElement::new("div").class("hk-error-landing__card");
    if let Some(brand) = &props.brand {
        card = card.child(brand.clone());
    }
    card = card.child(VNode::Element(Box::new(
        VElement::new("div")
            .class("hk-error-landing__icon")
            .attr("aria-hidden", "true")
            .child(Icon(IconProps {
                icon: props.tone.icon(),
                size: 28,
                ..Default::default()
            })),
    )));

    if has_meta {
        let mut meta = VElement::new("div").class("hk-error-landing__meta");
        if let Some(chip) = code_chip {
            meta = meta.child(chip);
        }
        if let Some(chip) = status_chip {
            meta = meta.child(chip);
        }
        card = card.child(VNode::Element(Box::new(meta)));
    }

    card = card.child(VNode::Element(Box::new(
        VElement::new("h1")
            .class("hk-error-landing__title")
            .child(VNode::Text(VText::new(&title_text))),
    )));

    if !props.description.is_empty() {
        card = card.child(VNode::Element(Box::new(
            VElement::new("p")
                .class("hk-error-landing__desc")
                .child(VNode::Text(VText::new(&props.description))),
        )));
    }

    if has_details && let Some(details) = &props.children {
        let label_row = VElement::new("div")
            .class("hk-error-landing__details-label")
            .attr("aria-hidden", "true")
            .child(Icon(IconProps {
                icon: MdiIcon::Code,
                size: 11,
                ..Default::default()
            }))
            .child(VNode::Text(VText::new(&details_label)));
        let body = VElement::new("div")
            .class("hk-error-landing__details-body")
            .child(details.clone());
        let pane = VElement::new("div")
            .class("hk-error-landing__details-pane")
            .child(VNode::Element(Box::new(body)));
        card = card.child(VNode::Element(Box::new(
            VElement::new("div")
                .class("hk-error-landing__details")
                .child(VNode::Element(Box::new(label_row)))
                .child(VNode::Element(Box::new(pane))),
        )));
    }

    if has_actions {
        let mut actions = VElement::new("div")
            .class("hk-error-landing__actions")
            .attr("aria-live", "polite");
        if let Some(copy_button) = copy_button {
            actions = actions.child(copy_button);
        }
        if let Some(slot) = &props.actions {
            actions = actions.child(slot.clone());
        }
        card = card.child(VNode::Element(Box::new(actions)));
    }

    let root = VElement::new("div")
        .class(classes)
        .child(VNode::Element(Box::new(card)));
    VNode::Element(Box::new(root))
}

impl StyledComponent for ErrorLandingComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-error-landing*` names literal so this CSS matches Vue).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkErrorLanding.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "error-landing"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_landing_tone_classes_match_the_vue_modifiers() {
        assert_eq!(ErrorLandingTone::Error.class_name(), "is-error");
        assert_eq!(ErrorLandingTone::Warning.class_name(), "is-warning");
        assert_eq!(ErrorLandingTone::Info.class_name(), "is-info");
    }

    #[test]
    fn error_landing_classes_follow_the_vue_template_order() {
        // page variant: base + tone only.
        assert_eq!(
            error_landing_classes(ErrorLandingTone::Error, ErrorLandingVariant::Page, false),
            "hk-error-landing is-error"
        );
        assert_eq!(
            error_landing_classes(ErrorLandingTone::Info, ErrorLandingVariant::Inline, false),
            "hk-error-landing is-info is-inline"
        );
        // fill lands next to inline only (Vue's compound test).
        assert_eq!(
            error_landing_classes(ErrorLandingTone::Warning, ErrorLandingVariant::Inline, true),
            "hk-error-landing is-warning is-inline is-fill"
        );
        // fill WITHOUT inline is dropped, exactly like Vue.
        assert_eq!(
            error_landing_classes(ErrorLandingTone::Error, ErrorLandingVariant::Page, true),
            "hk-error-landing is-error"
        );
    }

    #[test]
    fn error_landing_tone_drives_the_badge_voice_and_the_icon() {
        assert_eq!(
            ErrorLandingTone::Error.code_badge_variant().class_name(),
            "hk-badge-error"
        );
        assert_eq!(
            ErrorLandingTone::Warning.code_badge_variant().class_name(),
            "hk-badge-warning"
        );
        assert_eq!(
            ErrorLandingTone::Info.code_badge_variant().class_name(),
            "hk-badge-info"
        );
        assert_eq!(ErrorLandingTone::Error.icon(), MdiIcon::AlertTriangle);
        assert_eq!(ErrorLandingTone::Warning.icon(), MdiIcon::AlertTriangle);
        assert_eq!(ErrorLandingTone::Info.icon(), MdiIcon::Information);
    }

    #[test]
    fn error_landing_title_and_chip_helpers_match_vue() {
        assert_eq!(error_landing_title(""), "Something went wrong");
        assert_eq!(error_landing_title("Boom"), "Boom");
        assert_eq!(error_landing_status_chip(400), "HTTP 400");
        assert_eq!(error_landing_status_chip(503), "HTTP 503");
        assert_eq!(
            error_landing_title(""),
            t(
                "components.hk.errorLanding.defaultTitle",
                "Something went wrong"
            )
        );
    }

    #[test]
    fn error_landing_actions_row_composition_matches_vue() {
        // The row rides on the copy payload OR the actions slot.
        assert!(error_landing_has_actions(false, "full error"));
        assert!(error_landing_has_actions(true, ""));
        assert!(!error_landing_has_actions(false, ""));
        // The copy label: flipped → override → bundle.
        assert_eq!(error_landing_copy_label(false, ""), "Copy error details");
        assert_eq!(error_landing_copy_label(false, "Copy log"), "Copy log");
        assert_eq!(error_landing_copy_label(true, "Copy log"), "Copied");
        assert_eq!(error_landing_copy_icon(false), MdiIcon::ContentCopy);
        assert_eq!(error_landing_copy_icon(true), MdiIcon::Check);
    }

    #[test]
    fn error_landing_defaults_match_the_vue_props() {
        let props = ErrorLandingProps::default();
        assert_eq!(props.title, "");
        assert_eq!(props.description, "");
        assert_eq!(props.code, "");
        assert!(props.status.is_none());
        assert_eq!(props.copy_text, "");
        assert_eq!(props.copy_label, "");
        assert_eq!(props.tone, ErrorLandingTone::Error);
        assert_eq!(props.variant, ErrorLandingVariant::Page);
        assert!(!props.fill);
        assert!(props.brand.is_none());
        assert!(props.children.is_none());
        assert!(props.actions.is_none());
        assert!(!props.copied);
        assert!(props.on_copy.is_none());
    }

    #[test]
    fn error_landing_renders_the_vue_card() {
        let html = ErrorLanding(ErrorLandingProps {
            title: "Provider refused".to_string(),
            description: "The wire hung up".to_string(),
            code: "unknown_provider".to_string(),
            status: Some(400),
            copy_text: "Provider refused: raw…".to_string(),
            children: Some(rsx! {
                pre { "raw payload" }
            }),
            actions: Some(rsx! {
                button { class: "host-retry", "Retry" }
            }),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            r#"class="hk-error-landing is-error""#,
            "hk-error-landing__card",
            "hk-error-landing__icon",
            "hk-error-landing__meta",
            // The landing-scoped classes land ON the badge roots.
            "hk-error-landing__code",
            "hk-error-landing__status",
            "unknown_provider",
            "HTTP 400",
            "hk-error-landing__title",
            "Provider refused",
            "hk-error-landing__desc",
            "hk-error-landing__details",
            "hk-error-landing__details-label",
            "hk-error-landing__details-pane",
            "hk-error-landing__details-body",
            "raw payload",
            "aria-live=\"polite\"",
            "Copy error details",
            "host-retry",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The copy action seats FIRST, left of the host actions.
        let copy = html.find("Copy error details").expect("copy action");
        let retry = html.find("host-retry").expect("host action");
        assert!(copy < retry, "{html}");
        // The muted status chip keeps its own voice next to the toned one.
        assert!(html.contains("hk-badge-muted"), "{html}");
        assert!(html.contains("hk-badge-error"), "{html}");
    }

    #[test]
    fn error_landing_bare_render_keeps_the_contract_minimal() {
        let html = ErrorLanding(ErrorLandingProps::default()).render_to_html();
        // The fallback headline arrives from the bundle default.
        assert!(html.contains("Something went wrong"), "{html}");
        // No chips, no details, no actions row.
        assert!(!html.contains("hk-error-landing__meta"), "{html}");
        assert!(!html.contains("hk-error-landing__details"), "{html}");
        assert!(!html.contains("hk-error-landing__actions"), "{html}");
    }

    #[test]
    fn error_landing_with_extra_class_lands_on_the_root() {
        let badge = Badge(BadgeProps {
            variant: BadgeVariant::Error,
            children: VNode::Text(VText::new("x")),
            ..Default::default()
        });
        let patched = error_landing_with_extra_class(badge, "hk-error-landing__code");
        match patched {
            VNode::Element(el) => {
                assert!(el.class.to_string().contains("hk-badge-error"));
                assert!(el.class.to_string().contains("hk-error-landing__code"));
            }
            other => panic!("expected an element, got {other:?}"),
        }
    }

    #[test]
    fn error_landing_styles_come_from_the_canonical_vue_sheet() {
        let css = ErrorLandingComponent::styles();
        for needle in [
            ".hk-error-landing",
            ".hk-error-landing__card",
            ".hk-error-landing__details-pane",
            ".hk-error-landing.is-inline",
        ] {
            assert!(
                css.contains(needle),
                "error-landing css must carry {needle}: {css}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored error-landing sheet"
        );
        assert_eq!(ErrorLandingComponent::name(), "error-landing");
    }
}
