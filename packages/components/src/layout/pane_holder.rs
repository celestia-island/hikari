// packages/components/src/layout/pane_holder.rs
// PaneHolder — mirror of the canonical Vue `HkPaneHolder` (the keep-mounted
// pane slot).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkPaneHolder.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so `.hk-pane-holder` and
// the `hk-pane-holder-in` keyframes are literal and identical in both forms.
//
// DOM contract (mirrors Vue's render output one-to-one):
//
//   <tag.hk-pane-holder[data-active]> [+host class]
//     {children}
//
// `tag` is Vue's `"div" | "section"` choice (default `div`); `data-active` is a
// PRESENCE attribute emitted only while the pane is active — the sheet reads
// `&[data-active]` for `display: block` plus its one-shot opacity reveal, and
// leaves every other state at `display: none`.
//
// Why this holder exists (Vue's TSX doc, kept here because it is the whole
// contract): the third pane-swap surface, for content the dissolve primitives
// cannot serve — PERSISTENT panes whose instance must survive while another
// pane is active (draft stores holding unsaved editor state, canvases/WebGL
// stages too expensive to rebuild, sockets that must not unplug).
// `HkCrossfade` / `HkTransitionContainer` swap by KEYING, so the leaving
// generation unmounts when the dissolve completes — exactly wrong for a draft
// store. This holder keeps every pane in the tree and toggles reachability
// instead: `display: none` while inactive (out of layout, inert, unreadable by
// assistive tech, but alive), `display: block` plus the opacity reveal when it
// becomes active. No leave animation: the outgoing pane simply hides.
//
// State contract: `active` is a boolean, not a key — the holder IS one pane,
// and a tab surface renders one holder per persistent pane beside the ordinary
// panel slots it already has. The reveal is the sheet's own `data-active` rule,
// so the mirror owns NO state: no local signal, no thread-local registry, no
// DOM write (the tairitsu 0.5.22 `use_signal` / `use_state` limits — ledger
// L48). `pane_holder_is_reachable` states the invariant the CSS implements.
//
// Deltas vs Vue (documented, not accidental):
//   * `tag` is the closed [`PaneHolderTag`] enum instead of Vue's string cast:
//     `"div"` / `"section"` are the only tags Vue's own type allows, and the
//     mirror refuses to render an arbitrary element name.
//   * `class` is an explicit prop appended after `.hk-pane-holder` (Vue:
//     attribute fallthrough onto the root element).
//   * The global `data-css-animations="0"` opt-out and the reduced-motion
//     clamp live in the sheet (`html[data-css-animations="0"]
//     .hk-pane-holder[data-active]`), so they need no mirror code — unlike
//     `HkTransitionContainer`'s inline duration, a media query can reach them.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct PaneHolderComponent;

/// The host element Vue allows (`tag`: `"div" | "section"`, default `div`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum PaneHolderTag {
    #[default]
    Div,
    Section,
}

impl PaneHolderTag {
    /// The element name the holder renders.
    pub fn name(self) -> &'static str {
        match self {
            PaneHolderTag::Div => "div",
            PaneHolderTag::Section => "section",
        }
    }

    /// Vue's `tag` cast: only `div` / `section` are legal, so anything else is
    /// rejected instead of being rendered as an arbitrary element.
    pub fn from_name(name: &str) -> Option<Self> {
        match name {
            "div" => Some(PaneHolderTag::Div),
            "section" => Some(PaneHolderTag::Section),
            _ => None,
        }
    }
}

/// The root class list: `.hk-pane-holder` plus the host class appended last,
/// the way Vue's attribute fallthrough merges it.
pub fn pane_holder_classes(class: &str) -> String {
    let mut classes = String::from("hk-pane-holder");
    if !class.is_empty() {
        classes.push(' ');
        classes.push_str(class);
    }
    classes
}

/// Vue's `data-active={active || undefined}`: a PRESENCE attribute, so the
/// sheet's `[data-active]` rules match and an inactive pane emits nothing at
/// all (an `data-active="false"` would still match `[data-active]`).
pub fn pane_holder_active_marker(active: bool) -> Option<&'static str> {
    if active { Some("") } else { None }
}

/// The keep-mounted invariant: an inactive pane is out of the layout and inert
/// but its instances, state and watchers stay alive. The holder never unmounts
/// either branch — that is the entire point of the component.
pub fn pane_holder_is_reachable(active: bool) -> bool {
    active
}

#[define_props]
pub struct PaneHolderProps {
    /// Whether THIS pane is the active one (Vue: required `active`).
    #[default]
    pub active: bool,

    /// The host element (Vue default `div`).
    #[default]
    pub tag: PaneHolderTag,

    /// Vue attribute fallthrough onto the root element.
    #[default]
    pub class: String,

    /// The pane's content (Vue: the default slot).
    pub children: Element,
}

#[component]
pub fn PaneHolder(props: PaneHolderProps) -> Element {
    let mut root = VElement::new(props.tag.name()).class(pane_holder_classes(&props.class));
    if let Some(marker) = pane_holder_active_marker(props.active) {
        root = root.attr("data-active", marker);
    }
    VNode::Element(Box::new(root.child(props.children.clone())))
}

impl StyledComponent for PaneHolderComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkPaneHolder.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "pane-holder"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pane_holder_defaults_match_the_vue_props() {
        let props = PaneHolderProps::default();
        assert!(!props.active);
        assert_eq!(props.tag, PaneHolderTag::Div);
        assert_eq!(props.class, "");
    }

    #[test]
    fn pane_holder_tag_names_match_the_element_names() {
        assert_eq!(PaneHolderTag::default().name(), "div");
        assert_eq!(PaneHolderTag::Section.name(), "section");
        assert_eq!(PaneHolderTag::from_name("div"), Some(PaneHolderTag::Div));
        assert_eq!(
            PaneHolderTag::from_name("section"),
            Some(PaneHolderTag::Section)
        );
        // Every legal tag round-trips through its own element name.
        for tag in [PaneHolderTag::Div, PaneHolderTag::Section] {
            assert_eq!(PaneHolderTag::from_name(tag.name()), Some(tag));
        }
    }

    #[test]
    fn pane_holder_tag_cast_rejects_unknown_names() {
        // Vue's `tag` type is exactly `"div" | "section"`.
        assert_eq!(PaneHolderTag::from_name("article"), None);
        assert_eq!(PaneHolderTag::from_name("DIV"), None);
        assert_eq!(PaneHolderTag::from_name("div "), None);
        assert_eq!(PaneHolderTag::from_name(""), None);
    }

    #[test]
    fn pane_holder_classes_append_the_host_class() {
        assert_eq!(pane_holder_classes(""), "hk-pane-holder");
        assert_eq!(
            pane_holder_classes("draft-pane"),
            "hk-pane-holder draft-pane"
        );
    }

    #[test]
    fn pane_holder_active_marker_is_a_presence_attribute() {
        // Active → an empty `data-active` (the `[data-active]` hook the sheet
        // styles); inactive → no attribute at all.
        assert_eq!(pane_holder_active_marker(true), Some(""));
        assert_eq!(pane_holder_active_marker(false), None);
        // Both branches are MOUNTED: only reachability differs.
        assert!(pane_holder_is_reachable(true));
        assert!(!pane_holder_is_reachable(false));
    }

    #[test]
    fn pane_holder_renders_the_active_pane_contract() {
        let html = PaneHolder(PaneHolderProps {
            active: true,
            class: "draft".to_string(),
            children: rsx! {
                p { "data-el": "pane", "draft" }
            },
            ..Default::default()
        })
        .render_to_html();

        assert!(
            html.contains(r#"<div data-active="" class="hk-pane-holder draft">"#),
            "{html}"
        );
        assert!(html.contains(r#"data-el="pane""#), "{html}");
        assert!(html.contains(">draft<"), "{html}");
    }

    #[test]
    fn pane_holder_renders_the_inactive_pane_contract() {
        let html = PaneHolder(PaneHolderProps {
            children: rsx! {
                p { "data-el": "pane", "kept" }
            },
            ..Default::default()
        })
        .render_to_html();

        // No `data-active`: the sheet leaves it `display: none`, and the
        // element (with its content) is STILL in the tree.
        assert!(!html.contains("data-active"), "{html}");
        assert!(
            html.starts_with(r#"<div class="hk-pane-holder">"#),
            "{html}"
        );
        assert!(html.contains(">kept<"), "{html}");
    }

    #[test]
    fn pane_holder_renders_a_section_host() {
        let html = PaneHolder(PaneHolderProps {
            active: true,
            tag: PaneHolderTag::Section,
            ..Default::default()
        })
        .render_to_html();

        assert!(
            html.starts_with(r#"<section data-active="" class="hk-pane-holder">"#),
            "{html}"
        );
        assert!(html.ends_with("</section>"), "{html}");
    }

    #[test]
    fn pane_holder_styles_come_from_the_canonical_vue_sheet() {
        let css = PaneHolderComponent::styles();
        for needle in [
            ".hk-pane-holder",
            "data-active",
            "hk-pane-holder-in",
            "data-css-animations",
            "prefers-reduced-motion",
        ] {
            assert!(
                css.contains(needle),
                "pane-holder css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored pane-holder sheet"
        );
    }
}
