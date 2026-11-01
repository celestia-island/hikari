// hi-components/src/display/load_more.rs
// LoadMore — mirror of the canonical Vue `HkLoadMore`: the unified bottom
// indicator for dynamically loaded lists, one look for every consumer
// (panels, tables, feeds) with three states.
//
// Sources mirrored: `packages/vue/src/components/HkLoadMore.tsx` and its
// sheet. The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkLoadMore.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the `.hk-load-more*`
// class names are literal and identical in both forms. DOM contract (mirrors
// Vue one-to-one):
//
//   div.hk-load-more data-state={idle|loading|end}
//     span.hk-load-more-rule aria-hidden="true"
//     span.hk-load-more-core
//       span.hk-load-more-end role="status" {end note}        (state = end)
//       Button {variant=ghost, size=sm, icon=ChevronDown,      (state != end)
//               loading=state=="loading"}  {label}
//       span.hk-load-more-count {shown} / {total}?             (both counts set)
//     span.hk-load-more-rule.hk-load-more-rule-end aria-hidden="true"
//
// The three states reuse the mirrored `HkButton` (ghost/sm + its own spinner)
// exactly like Vue: `loading` morphs the SAME affordance in place instead of
// swapping in a second spinner, so the row keeps a stable height.
//
// Deltas vs Vue (documented):
//   * Vue's `loadMore` emit is [`LoadMoreProps::on_load_more`] (no payload, as
//     in Vue).
//   * Vue's `shown` / `total` are `Number` props defaulting to `undefined`;
//     the mirror uses `Option<u32>` so the counter's "both given" rule
//     (`typeof props.shown === "number" && typeof props.total === "number"`)
//     is representable.
//   * Vue's `icon="ChevronDown"` name prop becomes a built `Icon` element
//     (16px, the same glyph size HkButton uses for every icon).
//   * New file: the family had no Rust counterpart.

use crate::basic::{Button, ButtonSize, ButtonVariant};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct LoadMoreComponent;

/// The three indicator states (Vue default `idle`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum LoadMoreState {
    /// A ghost load-more button; clicking fires `load_more`.
    #[default]
    Idle,
    /// The SAME button with its built-in spinner.
    Loading,
    /// A muted "reached the end" note replacing the button.
    End,
}

impl LoadMoreState {
    /// The `data-state` value exactly as Vue emits it.
    pub fn name(self) -> &'static str {
        match self {
            LoadMoreState::Idle => "idle",
            LoadMoreState::Loading => "loading",
            LoadMoreState::End => "end",
        }
    }

    /// Vue's `props.state === "loading"`.
    pub fn is_loading(self) -> bool {
        self == LoadMoreState::Loading
    }
}

/// Vue's counter rule: both numbers must be present.
pub fn load_more_has_count(shown: Option<u32>, total: Option<u32>) -> bool {
    shown.is_some() && total.is_some()
}

/// The counter text (`"3 / 19"`), or `None` when either number is missing.
pub fn load_more_count_text(shown: Option<u32>, total: Option<u32>) -> Option<String> {
    match (shown, total) {
        (Some(shown), Some(total)) => Some(format!("{shown} / {total}")),
        _ => None,
    }
}

/// The button label / end note for a state — the exact strings Vue passes to
/// `useI18n().t` (its own keys, same English fallbacks).
pub fn load_more_label(state: LoadMoreState) -> String {
    match state {
        LoadMoreState::Idle => hikari_i18n::t("components.hk.loadMore.more", "Load more"),
        LoadMoreState::Loading => hikari_i18n::t("components.hk.loadMore.loading", "Loading…"),
        LoadMoreState::End => {
            hikari_i18n::t("components.hk.loadMore.end", "You've reached the end")
        }
    }
}

#[define_props]
pub struct LoadMoreProps {
    /// The indicator state (Vue default `idle`).
    #[default]
    pub state: LoadMoreState,

    /// Delivered item count — with `total`, renders the progress counter.
    pub shown: Option<u32>,

    /// Full item count behind the windowed list.
    pub total: Option<u32>,

    /// Vue's `loadMore` emit.
    pub on_load_more: Option<EventHandler<()>>,
}

#[component]
pub fn LoadMore(props: LoadMoreProps) -> Element {
    let state = props.state;
    let label = load_more_label(state);
    let count_text = load_more_count_text(props.shown, props.total);

    let mut core = VElement::new("span").class("hk-load-more-core");
    if state == LoadMoreState::End {
        core = core.child(VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-load-more-end")
                .attr("role", "status")
                .child(VNode::Text(VText::new(&label))),
        )));
    } else {
        let on_load_more = props.on_load_more.clone();
        core = core.child(Button(ButtonProps {
            variant: ButtonVariant::Ghost,
            size: ButtonSize::Sm,
            loading: state.is_loading(),
            aria_label: Some(label.clone()),
            label: Some(label.clone()),
            icon: Some(rsx! {
                Icon { icon: MdiIcon::ChevronDown, size: 16 }
            }),
            onclick: Some(EventHandler::new(move |_event: MouseEvent| {
                if let Some(handler) = &on_load_more {
                    handler.call(());
                }
            })),
            ..Default::default()
        }));
    }
    if let Some(count_text) = count_text {
        core = core.child(VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-load-more-count")
                .child(VNode::Text(VText::new(&count_text))),
        )));
    }

    let root = VElement::new("div")
        .class("hk-load-more")
        .attr("data-state", state.name())
        .child(VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-load-more-rule")
                .attr("aria-hidden", "true"),
        )))
        .child(VNode::Element(Box::new(core)))
        .child(VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-load-more-rule hk-load-more-rule-end")
                .attr("aria-hidden", "true"),
        )));

    VNode::Element(Box::new(root))
}

impl StyledComponent for LoadMoreComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkLoadMore.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "load-more"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_more_state_names_match_vue() {
        assert_eq!(LoadMoreState::Idle.name(), "idle");
        assert_eq!(LoadMoreState::Loading.name(), "loading");
        assert_eq!(LoadMoreState::End.name(), "end");
        assert!(!LoadMoreState::Idle.is_loading());
        assert!(LoadMoreState::Loading.is_loading());
        assert!(!LoadMoreState::End.is_loading());
    }

    #[test]
    fn load_more_defaults_match_the_vue_props() {
        let props = LoadMoreProps::default();
        assert_eq!(props.state, LoadMoreState::Idle);
        assert_eq!(props.shown, None);
        assert_eq!(props.total, None);
        assert!(props.on_load_more.is_none());
    }

    #[test]
    fn load_more_counter_needs_both_numbers() {
        assert!(!load_more_has_count(None, None));
        assert!(!load_more_has_count(Some(3), None));
        assert!(!load_more_has_count(None, Some(19)));
        assert!(load_more_has_count(Some(3), Some(19)));
        assert_eq!(
            load_more_count_text(Some(3), Some(19)),
            Some("3 / 19".to_string())
        );
        assert_eq!(load_more_count_text(Some(0), None), None);
    }

    #[test]
    fn load_more_labels_match_the_vue_english_fallbacks() {
        // No locale is provided in unit tests, so these are the fallbacks Vue
        // ships with its own keys.
        assert_eq!(load_more_label(LoadMoreState::Idle), "Load more");
        assert_eq!(load_more_label(LoadMoreState::Loading), "Loading…");
        assert_eq!(
            load_more_label(LoadMoreState::End),
            "You've reached the end"
        );
    }

    #[test]
    fn load_more_idle_renders_the_ghost_button_and_counter() {
        let html = LoadMore(LoadMoreProps {
            shown: Some(3),
            total: Some(19),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-load-more",
            "data-state=\"idle\"",
            "hk-load-more-rule",
            "hk-load-more-core",
            "hk-btn-ghost",
            "hk-btn-sm",
            "Load more",
            "hk-load-more-count",
            "3 / 19",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(!html.contains("hk-load-more-end"), "{html}");
    }

    #[test]
    fn load_more_loading_morphs_the_same_button() {
        let html = LoadMore(LoadMoreProps {
            state: LoadMoreState::Loading,
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "data-state=\"loading\"",
            "hk-btn-loading",
            "aria-busy=\"true\"",
            "Loading…",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(!html.contains("hk-load-more-count"), "{html}");
    }

    #[test]
    fn load_more_end_renders_the_status_note_instead_of_the_button() {
        let html = LoadMore(LoadMoreProps {
            state: LoadMoreState::End,
            shown: Some(19),
            total: Some(19),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "data-state=\"end\"",
            "hk-load-more-end",
            "role=\"status\"",
            "You've reached the end",
            "hk-load-more-count",
            "19 / 19",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(!html.contains("hk-btn"), "{html}");
    }

    #[test]
    fn load_more_styles_come_from_the_canonical_vue_sheet() {
        let css = LoadMoreComponent::styles();
        for needle in [
            ".hk-load-more",
            ".hk-load-more-rule",
            ".hk-load-more-core",
            ".hk-load-more-count",
        ] {
            assert!(
                css.contains(needle),
                "load-more css must carry {needle}: {css}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored load-more sheet"
        );
    }
}
