// hi-components/src/basic/card.rs
// Card component with Arknights + FUI styling

use dioxus::prelude::*;

use crate::styled::StyledComponent;

/// Card 组件的类型包装器（用于实现 StyledComponent）
pub struct CardComponent;

#[derive(Clone, PartialEq, Props)]
pub struct CardProps {
    #[props(default)]
    pub hoverable: bool,

    #[props(default)]
    pub bordered: bool,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub title: Option<String>,

    #[props(default)]
    pub extra: Option<Element>,

    #[props(default)]
    pub children: Element,

    pub onclick: Option<EventHandler<MouseEvent>>,

    #[props(default)]
    pub spotlight: bool,
}

impl Default for CardProps {
    fn default() -> Self {
        Self {
            hoverable: false,
            bordered: false,
            class: String::default(),
            title: None,
            extra: None,
            children: VNode::empty(),
            onclick: None,
            spotlight: false,
        }
    }
}

/// Card component with Arknights + FUI styling
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Card;
///
/// fn app() -> Element {
///     rsx! {
///         Card {
///             title: "Card Title",
///             hoverable: true,
///             div { "Card content" }
///         }
///     }
/// }
/// ```
#[component]
pub fn Card(props: CardProps) -> Element {
    let hoverable_class = if props.hoverable {
        "hi-card-hoverable"
    } else {
        ""
    };
    let bordered_class = if props.bordered {
        "hi-card-bordered"
    } else {
        ""
    };
    let _clickable = props.onclick.is_some();

    let card_content = rsx! {
        div {
            class: format!("hi-card {hoverable_class} {bordered_class} {}", props.class),
            onclick: move |e| {
                if let Some(handler) = props.onclick.as_ref() {
                    handler.call(e);
                }
            },

            if props.title.is_some() || props.extra.is_some() {
                div { class: "hi-card-header",

                    if let Some(title) = props.title {
                        div { class: "hi-card-title", "{title}" }
                    }

                    if let Some(extra) = props.extra {
                        div { class: "hi-card-extra", { extra } }
                    }
                }
            }

            div { class: "hi-card-body",
                { props.children }
            }
        }
    };

    // Wrap with spotlight if enabled
    if props.spotlight {
        rsx! {
            div {
                class: "hi-card-spotlight-wrapper",
                "data-spotlight": "true",
                { card_content }
            }
        }
    } else {
        card_content
    }
}

impl StyledComponent for CardComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/card.css"))
    }

    fn name() -> &'static str {
        "card"
    }
}
