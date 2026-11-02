// hi-components/src/theme/action_bar.rs
// ActionBar — mirror of the canonical Vue `HkActionBar`.
//
// Source mirrored (verified, the whole component is 15 lines):
// `packages/vue/src/components/HkActionBar.tsx` renders exactly ONE element —
// `div.hk-action-bar` carrying an inline `gap: {gap}` style (default
// `"0.5rem"`) and the default slot. There are no props beyond `gap`, no
// emits, no conditional branches.
//
// STYLES OWNERSHIP (verified, and why `styles()` returns `""`): the Vue
// component imports NO sheet and the Vue tree ships NO `HkActionBar.scss`
// anywhere (`packages/vue/src/components/` has no such file, and the vendored
// mirror under `src/styles/vue-mirror/components/` correctly lists none in
// its manifest). `hk-action-bar` is a class hook for HOST styles plus the
// inline gap; this component owns no CSS of its own and deliberately adds no
// stylesheet — a `scss!` call here would have nothing to compile.
//
// DOM contract (mirrors Vue one-to-one):
//
//   div.hk-action-bar        (style: gap:{gap})
//     {children}             (the default slot, unmodified)
//
// No deltas vs Vue: the whole surface is a slot orchestration container, and
// every part of it (one div, one inline style, one slot) has a direct
// tairitsu equivalent.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ActionBarComponent;

/// The modal's inline `style={{ gap: props.gap }}`, as built. The value is
/// passed through VERBATIM (Vue does no validation): an empty string emits
/// `gap:` which the browser drops, exactly like Vue.
pub fn action_bar_gap_style(gap: &str) -> String {
    format!("gap:{gap}")
}

#[define_props]
pub struct ActionBarProps {
    /// Row gutter between the slotted actions (Vue default `"0.5rem"`).
    #[default("0.5rem".to_string())]
    pub gap: String,

    /// The actions themselves (Vue: the default slot).
    pub children: Element,
}

#[component]
pub fn ActionBar(props: ActionBarProps) -> Element {
    let style = action_bar_gap_style(&props.gap);
    rsx! {
        div {
            class: "hk-action-bar",
            style: style,
            {props.children.clone()}
        }
    }
}

impl StyledComponent for ActionBarComponent {
    fn styles() -> &'static str {
        // Verified: `HkActionBar.tsx` ships no sheet and no `HkActionBar.scss`
        // exists in the Vue tree or the vendored mirror — the class is a host
        // layout hook and the gap is inline, so there is nothing to compile.
        ""
    }

    fn name() -> &'static str {
        "action-bar"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn action_bar_defaults_match_the_vue_props() {
        let props = ActionBarProps::default();
        assert_eq!(props.gap, "0.5rem");
    }

    #[test]
    fn action_bar_gap_style_matches_the_vue_inline_style() {
        // Vue: `style={{ gap: props.gap }}`.
        assert_eq!(action_bar_gap_style("0.5rem"), "gap:0.5rem");
        assert_eq!(action_bar_gap_style("1rem"), "gap:1rem");
        assert_eq!(action_bar_gap_style("var(--space-8)"), "gap:var(--space-8)");
        // Verbatim passthrough, no validation (an empty gap is dropped by the
        // browser, exactly like Vue's inline style).
        assert_eq!(action_bar_gap_style(""), "gap:");
    }

    #[test]
    fn action_bar_renders_the_vue_container_with_its_slot() {
        let html = ActionBar(ActionBarProps {
            children: rsx! {
                button { class: "demo", "Save" }
            },
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"class="hk-action-bar""#), "{html}");
        assert!(html.contains("gap:0.5rem"), "{html}");
        // The slot rides inside the bar, after the style.
        assert!(html.contains("Save"), "{html}");
        let bar = html.find("hk-action-bar").expect("bar");
        let slot = html.find("Save").expect("slot");
        assert!(bar < slot, "the slot must be inside the bar: {html}");
    }

    #[test]
    fn action_bar_custom_gap_reaches_the_dom() {
        let html = ActionBar(ActionBarProps {
            gap: "2rem".to_string(),
            children: empty_vnode(),
        })
        .render_to_html();
        assert!(html.contains("gap:2rem"), "{html}");
    }

    #[test]
    fn action_bar_owns_no_sheet() {
        // Verified conclusion (see the file header): the Vue component ships
        // no scss and the class is a host hook, so styles() is empty.
        assert_eq!(ActionBarComponent::styles(), "");
        assert_eq!(ActionBarComponent::name(), "action-bar");
    }
}
