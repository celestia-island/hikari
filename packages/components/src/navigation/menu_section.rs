// hi-components/src/navigation/menu_section.rs
// MenuSection — mirror of the canonical Vue `HkMenuSection`: a captioned run
// of menu rows. The small caption ABOVE a run of rows is part of the
// menu-item grammar (`_menu-item.scss`, `@mixin section` /
// `@mixin section-label`), but it used to be hand-rolled at call sites with
// vertical insets from 0 to 6px and no shared token; this component is the
// ONE markup for it.
//
// ── HkMenuSectionSheet: NOT A FILE (verified against the Vue tree) ──
// `HkMenuSection.tsx` deliberately imports NO scss of its own (its header:
// metrics come from the global adopter rules in `styles/admin-tokens`,
// `@include mi.section` / `@mixin mi.section-label`, loaded by the canonical
// styles entry — the `HkAvatarButton` precedent). Those rules are declared
// GLOBALLY because host apps render these classes by hand and cannot import
// the partial: in the crate the vendored
// `src/styles/vue-mirror/styles/admin-tokens.scss` binds `.hk-menu-section`
// and `.hk-menu-section-label` to the `_menu-item.scss` grammar, and that
// sheet is registered ONCE as the `vue-admin-tokens` chrome by
// `StyleRegistry::register_vue_chrome` (`styled.rs`).
// [`MenuSectionComponent::styles`] therefore returns `""` (the sheet-less
// rule, `basic/kbd.rs` / `overlay/select_panel.rs` / `theme/avatar_button.rs`):
// a second `scss!` of the same sheet would emit its rules twice (the drift
// suite forbids that), and an empty registration adds no second copy.
//
// Accessibility follows the HkTemplateField precedent: grouping is a
// `role="group"` wrapper carrying the group's name in `aria-label`, and the
// visible caption band inside is `aria-hidden="true"` — the wrapper already
// announces the name, so leaving the visible band in the a11y tree would
// double-announce it. DOM contract (mirrors the Vue render output):
//
//   div.hk-menu-section [role=group] [aria-label={label}]
//     div.hk-menu-section-label aria-hidden=true
//       {caption}                    (label slot, when it carries content)
//       | {label}                    (the prop text otherwise)
//     {children}                     (the default slot's rows)
//
// `label` is BOTH the accessible group name and the default visible caption
// text; the `#label` slot (→ [`MenuSectionProps::caption`]) supplies richer
// visible content (a badge, a count) while `aria-label` keeps the prop's
// plain string. The slot must be NON-INTERACTIVE content: it renders inside
// the aria-hidden band, so a focusable node there would be an axe
// `aria-hidden-focus` violation, and its visible text must not contradict
// the accessible name. The default slot is the rows.
//
// The slot-visibility port ([`menu_section_caption_visible`]): Vue resolves
// the caption INSIDE the render function (a computed caches stale vnodes)
// and falls back to the prop text when the slot's nodes carry nothing
// visible — a compiled `v-if` root is a COMMENT vnode, a text slot child may
// be a normalized TEXT vnode, a fragment may wrap only comments/blank text,
// and none of them may leave a padded, empty aria-hidden band.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * NO COMMENT-VNODE analogue: tairitsu vdom has no comment node, so the
//     "compiled `v-if` root is a comment" case cannot occur; the remaining
//     cases (blank text, empty/nested fragments, any element) port verbatim.
//   * a DYNAMIC text node is judged by its rendered seed (`initial`) — the
//     lazy `compute` closure runs at bind time, not during this render pass.
//   * NO INTERACTION: Vue binds no listeners (the band is aria-hidden); the
//     mirror binds none.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct MenuSectionComponent;

/// Vue's `hasVisibleContent`, ported onto the tairitsu vdom: does the slot
/// carry something visible? Blank text (and text nodes of only whitespace)
/// is not a caption, an empty fragment is not, and ANY element is — none of
/// them may leave a padded, empty aria-hidden band. See the header deltas
/// for the comment-vnode and dynamic-text cases.
pub fn menu_section_caption_visible(node: &VNode) -> bool {
    match node {
        VNode::Text(text) => !text.text.trim().is_empty(),
        VNode::DynamicText(text) => !text.initial.trim().is_empty(),
        VNode::Fragment(children) => children.iter().any(menu_section_caption_visible),
        VNode::Element(_) => true,
    }
}

#[define_props]
pub struct MenuSectionProps {
    /// Accessible group name AND the default visible caption text (Vue:
    /// `label`, REQUIRED — a Rust props struct is `Default`-constructible,
    /// so the required-ness is documented rather than enforced).
    pub label: String,

    /// Richer visible caption content — a badge, a count (Vue: the `#label`
    /// slot). Content-less captions fall back to [`MenuSectionProps::label`]
    /// instead of leaving an empty aria-hidden band.
    pub caption: Option<Element>,

    /// The captioned rows (Vue: the default slot).
    pub children: Element,
}

#[component]
pub fn MenuSection(props: MenuSectionProps) -> Element {
    // Vue: `caption && hasVisibleContent(caption) ? caption : props.label`
    // — resolved per render, never cached.
    let band: Element = match props.caption.as_ref() {
        Some(caption) if menu_section_caption_visible(caption) => caption.clone(),
        _ => rsx! { {props.label.clone()} },
    };

    rsx! {
        div {
            class: "hk-menu-section",
            "role": "group",
            "aria-label": props.label.clone(),
            div {
                class: "hk-menu-section-label",
                "aria-hidden": "true",
                {band}
            }
            {props.children.clone()}
        }
    }
}

impl StyledComponent for MenuSectionComponent {
    fn styles() -> &'static str {
        // NO sheet of its own — verified, not assumed. `HkMenuSection.tsx`
        // ships no scss import; its metrics live in the vendored
        // admin-tokens sheet (binding `.hk-menu-section` /
        // `.hk-menu-section-label` to the `_menu-item.scss` grammar),
        // registered ONCE as the `vue-admin-tokens` chrome by
        // `StyleRegistry::register_vue_chrome` — the AvatarButton
        // precedent. The table stays empty (a second copy would double the
        // rules). 画布来自已 vendored 的 admin-tokens.scss（registry chrome
        // 已有）；本组件不新增表.
        ""
    }

    fn name() -> &'static str {
        "menu-section"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn menu_section_caption_visibility_ports_the_vue_walk() {
        // Any element is visible content.
        assert!(menu_section_caption_visible(&rsx! {
            span { "Temp spaces" }
        }));
        // Non-blank text is; blank text and whitespace-only are not.
        assert!(menu_section_caption_visible(&VNode::Text(VText::new(
            "Spaces"
        ))));
        assert!(!menu_section_caption_visible(&VNode::Text(VText::new(""))));
        assert!(!menu_section_caption_visible(&VNode::Text(VText::new(
            "   "
        ))));
        // Fragments recurse: mixed content shows, an empty one never does.
        assert!(menu_section_caption_visible(&VNode::Fragment(vec![
            VNode::Text(VText::new(" ")),
            VNode::Text(VText::new("Temp")),
        ])));
        assert!(!menu_section_caption_visible(&VNode::Fragment(vec![])));
        // A dynamic text node is judged by its rendered seed.
        let dynamic =
            VNode::DynamicText(tairitsu_vdom::DynamicText::new(String::new(), String::new));
        assert!(!menu_section_caption_visible(&dynamic));
    }

    #[test]
    fn menu_section_defaults_match_the_vue_props() {
        let props = MenuSectionProps::default();
        // Vue marks `label` required; the Rust default is the empty string
        // (documented on the field).
        assert_eq!(props.label, "");
        assert!(props.caption.is_none());
        assert!(matches!(
            props.children,
            VNode::Fragment(ref nodes) if nodes.is_empty()
        ));
    }

    #[test]
    fn menu_section_renders_the_vue_group_contract() {
        let html = MenuSection(MenuSectionProps {
            label: "Temp spaces".to_string(),
            children: rsx! {
                div { class: "hk-menu-item", "row" }
            },
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-menu-section""#,
            r#"role="group""#,
            r#"aria-label="Temp spaces""#,
            r#"class="hk-menu-section-label""#,
            r#"aria-hidden="true""#,
            ">Temp spaces<",
            ">row<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
    }

    #[test]
    fn menu_section_caption_slot_wins_only_with_content() {
        let rich = rsx! {
            span {
                "Spaces "
                span { class: "hk-badge", "3" }
            }
        };
        // A carrying slot renders instead of the prop text.
        let html = MenuSection(MenuSectionProps {
            label: "Temp spaces".to_string(),
            caption: Some(rich),
            children: empty_vnode(),
        })
        .render_to_html();
        assert!(html.contains("hk-badge"), "{html}");
        assert!(html.contains(">3<"), "{html}");
        // The accessible name stays the prop's plain string either way.
        assert!(html.contains(r#"aria-label="Temp spaces""#), "{html}");

        // A blank slot falls back to the prop text — no padded empty band.
        let blank = MenuSection(MenuSectionProps {
            label: "Temp spaces".to_string(),
            caption: Some(VNode::Text(VText::new("   "))),
            children: empty_vnode(),
        })
        .render_to_html();
        assert!(html_contains_once(&blank, ">Temp spaces<"), "{blank}");
    }

    /// `html.matches(needle).count()` helper — the caption text may appear
    /// once (the band) or twice (slot text echoing the label); the fallback
    /// path renders it exactly once.
    fn html_contains_once(html: &str, needle: &str) -> bool {
        html.matches(needle).count() == 1
    }

    #[test]
    fn menu_section_ships_no_sheet_of_its_own() {
        // Verified ownership: Vue ships no HkMenuSection.scss — the canvas
        // is the vendored admin-tokens sheet (the `vue-admin-tokens` chrome
        // `StyleRegistry::register_vue_chrome` registers once).
        assert_eq!(MenuSectionComponent::styles(), "");
        assert_eq!(MenuSectionComponent::name(), "menu-section");
        let canvas = std::fs::read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/src/styles/vue-mirror/styles/admin-tokens.scss"
        ))
        .expect("the vendored admin-tokens canvas exists");
        for class in [".hk-menu-section {", ".hk-menu-section-label {"] {
            assert!(canvas.contains(class), "canvas is missing {class}");
        }
    }
}
