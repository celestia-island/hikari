// hi-components/src/display/empty_state.rs
// EmptyState — mirror of the canonical Vue `HkEmptyState`: the shared
// "nothing here yet" panel (bounded page card or stretched fill region) with a
// loading variant.
//
// Sources mirrored: `packages/vue/src/components/HkEmptyState.tsx` and its
// sheet. The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkEmptyState.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the `.hk-empty-*`
// class names are literal and identical in both forms. DOM contract (mirrors
// Vue one-to-one):
//
//   div.hk-empty-state.hk-empty-state--{page|fill}
//       [.hk-empty-state--loading] [.hk-empty-state--boxed]
//       role="status" aria-busy="true"                    (loading only)
//     span.hk-empty-sr-only {loading text}                (loading only)
//     div.hk-spinner-wrapper.hk-spinner-centered          (HSpinner `center`)
//   -- or --
//     div.hk-empty-icon
//       {icon slot | the default 48px package glyph}
//     p.hk-empty-title?      {title}
//     p.hk-empty-desc?       {description}
//     div.hk-empty-action    {action slot}                (non-loading only)
//
// The default glyph is authored as MARKUP and mounted through
// `dangerous_inner_html` on its own `display:contents` host: rsx `svg {}` maps
// to `document.createElement` (HTML namespace) in this host stack, so an
// element tree would never paint, and innerHTML parsing puts the nodes in the
// SVG namespace (ledger L49, same shape as `feedback/progress_ring.rs`). The
// markup is a static constant — no caller string reaches it, so it needs no
// escaper.
//
// Deltas vs Vue (documented):
//   * Vue takes an icon COMPONENT (`props.icon`) plus an `icon` slot that wins
//     over it; the mirror takes one `icon: Option<Element>` — the host builds
//     the vnode, which is the slot form of the same precedence.
//   * `hk-empty-action` is rendered even when the slot is empty, exactly like
//     Vue (`slots.action?.()` inside the div); an absent slot is
//     `empty_vnode()`.
//   * New file: the legacy Rust `Empty` (`hk-empty-container` / `hk-empty-img`
//     / …) is retired with this wave — this is a different, Vue-shaped
//     component.

use crate::feedback::{Spinner, SpinnerProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct EmptyStateComponent;

/// The default 48px glyph (Vue's inline `<svg>`), byte-identical to the Vue
/// markup. Mounted through `dangerous_inner_html` — see the header.
const EMPTY_STATE_ICON_SVG: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>"#;

/// Vue's `fit` prop: `page` = a bounded card on desktop, `fill` = stretch to
/// the host container.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum EmptyStateFit {
    #[default]
    Page,
    Fill,
}

impl EmptyStateFit {
    /// The `hk-empty-state--{fit}` modifier exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            EmptyStateFit::Page => "hk-empty-state--page",
            EmptyStateFit::Fill => "hk-empty-state--fill",
        }
    }
}

/// The complete root class list in Vue's template order (base, fit, loading,
/// boxed).
pub fn empty_state_classes(fit: EmptyStateFit, loading: bool, boxed: bool) -> String {
    let mut classes = String::from("hk-empty-state ");
    classes.push_str(fit.class_name());
    if loading {
        classes.push_str(" hk-empty-state--loading");
    }
    if boxed {
        classes.push_str(" hk-empty-state--boxed");
    }
    classes
}

#[define_props]
pub struct EmptyStateProps {
    /// Heading text; absent (or empty) omits `p.hk-empty-title` — Vue's
    /// default is `undefined` and its template tests truthiness.
    pub title: Option<String>,

    /// Supporting copy; same truthiness rule as `title`.
    pub description: Option<String>,

    /// Icon slot content (wins over nothing else — see the header delta: Vue's
    /// `props.icon` component and its `icon` slot collapse into this one
    /// field).
    pub icon: Option<Element>,

    /// Loading variant: only the centered spinner plus the screen-reader text.
    #[default]
    pub loading: bool,

    /// `page` (default) or `fill`.
    #[default]
    pub fit: EmptyStateFit,

    /// Draw the component's own surface (Vue default false — most hosts bring
    /// their own surface).
    #[default]
    pub boxed: bool,

    /// Action slot content, rendered inside `div.hk-empty-action` (non-loading
    /// only, even when empty).
    pub action: Option<Element>,
}

#[component]
pub fn EmptyState(props: EmptyStateProps) -> Element {
    let classes = empty_state_classes(props.fit, props.loading, props.boxed);
    let mut root = VElement::new("div").class(classes);

    if props.loading {
        // The status region needs text content, or screen readers announce an
        // empty live region when the spinner appears.
        let loading_text = hikari_i18n::t("components.hk.emptyState.loading", "Loading");
        root = root
            .attr("role", "status")
            .attr("aria-busy", "true")
            .child(VNode::Element(Box::new(
                VElement::new("span")
                    .class("hk-empty-sr-only")
                    .child(VNode::Text(VText::new(&loading_text))),
            )))
            .child(Spinner(SpinnerProps {
                center: true,
                ..Default::default()
            }));
        return VNode::Element(Box::new(root));
    }

    let mut icon_box = VElement::new("div").class("hk-empty-icon");
    icon_box = match props.icon {
        Some(icon) => icon_box.child(icon),
        // `display:contents` keeps the host out of the flex layout, so the
        // parsed SVG becomes the icon box's only child — Vue's shape.
        None => icon_box.child(VNode::Element(Box::new(
            VElement::new("div")
                .style("display:contents")
                .dangerous_inner_html(EMPTY_STATE_ICON_SVG),
        ))),
    };
    root = root.child(VNode::Element(Box::new(icon_box)));

    // Vue tests truthiness: an empty string renders nothing.
    if let Some(title) = props.title.filter(|text| !text.is_empty()) {
        root = root.child(VNode::Element(Box::new(
            VElement::new("p")
                .class("hk-empty-title")
                .child(VNode::Text(VText::new(&title))),
        )));
    }
    if let Some(description) = props.description.filter(|text| !text.is_empty()) {
        root = root.child(VNode::Element(Box::new(
            VElement::new("p")
                .class("hk-empty-desc")
                .child(VNode::Text(VText::new(&description))),
        )));
    }
    root = root.child(VNode::Element(Box::new(
        VElement::new("div")
            .class("hk-empty-action")
            .child(props.action.unwrap_or_else(empty_vnode)),
    )));

    VNode::Element(Box::new(root))
}

impl StyledComponent for EmptyStateComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkEmptyState.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "empty-state"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_state_fit_classes_match_vue() {
        assert_eq!(EmptyStateFit::Page.class_name(), "hk-empty-state--page");
        assert_eq!(EmptyStateFit::Fill.class_name(), "hk-empty-state--fill");
    }

    #[test]
    fn empty_state_classes_follow_the_vue_template_order() {
        assert_eq!(
            empty_state_classes(EmptyStateFit::Page, false, false),
            "hk-empty-state hk-empty-state--page"
        );
        assert_eq!(
            empty_state_classes(EmptyStateFit::Fill, true, true),
            "hk-empty-state hk-empty-state--fill hk-empty-state--loading hk-empty-state--boxed"
        );
    }

    #[test]
    fn empty_state_defaults_match_the_vue_props() {
        let props = EmptyStateProps::default();
        assert!(props.title.is_none());
        assert!(props.description.is_none());
        assert!(props.icon.is_none());
        assert!(!props.loading);
        assert_eq!(props.fit, EmptyStateFit::Page);
        assert!(!props.boxed);
        assert!(props.action.is_none());
    }

    #[test]
    fn empty_state_renders_the_icon_title_description_and_action() {
        let html = EmptyState(EmptyStateProps {
            title: Some("Nothing here".to_string()),
            description: Some("Create the first item".to_string()),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-empty-state hk-empty-state--page",
            "hk-empty-icon",
            "hk-empty-title",
            "hk-empty-desc",
            "hk-empty-action",
            // The default glyph must ride the inner_html host, not a dropped
            // rsx `svg {}`.
            "display:contents",
            "<polyline points=\"22 12 16 12 14 15 10 15 8 12 2 12\"",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(!html.contains("aria-busy"), "{html}");
    }

    #[test]
    fn empty_state_loading_renders_a_status_region_with_spinner_only() {
        let html = EmptyState(EmptyStateProps {
            loading: true,
            title: Some("ignored while loading".to_string()),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "role=\"status\"",
            "aria-busy=\"true\"",
            "hk-empty-sr-only",
            "hk-spinner-wrapper hk-spinner-centered",
            "Loading",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        for needle in ["hk-empty-icon", "hk-empty-title", "hk-empty-action"] {
            assert!(!html.contains(needle), "loading must omit {needle}: {html}");
        }
    }

    #[test]
    fn empty_state_text_is_escaped() {
        let html = EmptyState(EmptyStateProps {
            title: Some("<script>alert(1)</script>".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("<script>"), "title must be escaped: {html}");
        assert!(html.contains("&lt;script&gt;"), "{html}");
    }

    #[test]
    fn empty_state_styles_come_from_the_canonical_vue_sheet() {
        let css = EmptyStateComponent::styles();
        for needle in [".hk-empty-state", ".hk-empty-icon", ".hk-empty-sr-only"] {
            assert!(
                css.contains(needle),
                "empty-state css must carry {needle}: {css}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored empty-state sheet"
        );
    }
}
