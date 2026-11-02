// hi-components/src/basic/card.rs
// Card — mirror of the canonical Vue `HkCard`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkCard.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash`. DOM contract:
//
//   div.hk-card [.hk-card-scrollable] [.hk-card-hoverable] [+class]
//       (style: --hk-pad override)  onclick
//     div.hk-card-header?                 (title or header slot)
//       h3.hk-card-title                  (title text)
//     div.hk-card-body [.hk-card-body-unpadded]
//       ── scrollable: true ──
//       div.hk-card-body-scroll           (the scroll region)
//         div.hk-card-body-pad?           (padded wrapper)
//           {children}
//       ── else ──
//       {children}
//     div.hk-card-footer?                 (footer slot)
//
// Delta vs Vue (documented): Vue's scrollable body wraps `HkScrollContainer`
// (overlay scrollbar chrome). That component's mirror lands with the display
// wave; until then the mirror renders the same `hk-card-body-scroll` wrapper
// with a plain `overflow:auto` inline style, so the scroll contract (the card
// becomes a column whose body fills and scrolls) holds without the custom
// scrollbar finish.

use crate::prelude::*;
use crate::styled::StyledComponent;
use crate::utils::{HkPad, hk_pad_style};

pub struct CardComponent;

#[define_props]
pub struct CardProps {
    /// Header title (`h3.hk-card-title`).
    pub title: Option<String>,

    /// Hover lift (`hk-card-hoverable`).
    #[default]
    pub hoverable: bool,

    /// Body padding (Vue default true; false emits `hk-card-body-unpadded`).
    #[default(true)]
    pub padded: bool,

    /// Shared container-padding override (`--hk-pad`; see `utils::pad`).
    pub padding: Option<HkPad>,

    /// Turn the body into a scroll region (`hk-card-scrollable`).
    #[default]
    pub scrollable: bool,

    #[default]
    pub class: String,

    /// Header slot content (wins over `title`).
    pub header: Option<Element>,

    /// Footer slot content.
    pub footer: Option<Element>,

    pub children: Element,

    /// Fired on a click anywhere on the card.
    pub onclick: Option<EventHandler<MouseEvent>>,
}

#[component]
pub fn Card(props: CardProps) -> Element {
    let mut classes = String::from("hk-card");
    if props.scrollable {
        classes.push_str(" hk-card-scrollable");
    }
    if props.hoverable {
        classes.push_str(" hk-card-hoverable");
    }
    if !props.class.is_empty() {
        classes.push(' ');
        classes.push_str(&props.class);
    }

    let mut body_classes = String::from("hk-card-body");
    if !props.padded {
        body_classes.push_str(" hk-card-body-unpadded");
    }

    let children = props.children.clone();

    rsx! {
        div {
            class: classes,
            style: hk_pad_style(props.padding),
            onclick: move |e: MouseEvent| {
                if let Some(handler) = &props.onclick {
                    handler.call(e);
                }
            },
            if props.title.is_some() || props.header.is_some() {
                div { class: "hk-card-header",
                    if let Some(header) = &props.header {
                        {header.clone()}
                    } else if let Some(title) = &props.title {
                        h3 { class: "hk-card-title", "{title}" }
                    }
                }
            }
            div {
                class: body_classes,
                if props.scrollable {
                    div {
                        class: "hk-card-body-scroll",
                        style: "overflow:auto",
                        if props.padded {
                            div { class: "hk-card-body-pad",
                                {children}
                            }
                        } else {
                            {children}
                        }
                    }
                } else {
                    {children}
                }
            }
            if let Some(footer) = &props.footer {
                div { class: "hk-card-footer", {footer.clone()} }
            }
        }
    }
}

impl StyledComponent for CardComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkCard.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "card"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn card_defaults_match_the_vue_props() {
        let props = CardProps::default();
        assert!(props.title.is_none());
        assert!(!props.hoverable);
        assert!(props.padded);
        assert!(props.padding.is_none());
        assert!(!props.scrollable);
        assert_eq!(props.class, "");
        assert!(props.header.is_none());
        assert!(props.footer.is_none());
        assert!(props.onclick.is_none());
    }

    #[test]
    fn card_styles_come_from_the_canonical_vue_sheet() {
        let css = CardComponent::styles();
        assert!(
            css.contains(".hk-card") && css.contains(".hk-card-body"),
            "card css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored card sheet"
        );
    }
}
