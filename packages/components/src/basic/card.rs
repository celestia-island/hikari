// hi-components/src/basic/card.rs
// Card component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{CardClass, ClassesBuilder, UtilityClass};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

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

    /// Enable glow effect (mouse-following spotlight)
    #[props(default = true)]
    pub glow: bool,
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
            glow: true,
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
    let card_classes = ClassesBuilder::new()
        .add(CardClass::Card)
        .add_if(CardClass::CardHoverable, || props.hoverable)
        .add_if(CardClass::CardBordered, || props.bordered)
        .add_raw(&props.class)
        .build();

    let content = rsx! {
        // Glow overlay (background layer)
        if props.glow {
            div {
                class: "hi-card-glow",
                style: "--glow-x: 50%; --glow-y: 50%; --hi-glow-color: var(--hi-glow-button-primary);",
            }
        }

        if props.title.is_some() || props.extra.is_some() {
            div { class: "{CardClass::CardHeader.as_class()}",

                if let Some(title) = props.title {
                    div { class: "{CardClass::CardTitle.as_class()}", "{title}" }
                }

                if let Some(extra) = props.extra {
                    div { class: "{CardClass::CardExtra.as_class()}", { extra } }
                }
            }
        }

        div { class: "{CardClass::CardBody.as_class()}",
            { props.children }
        }
    };

    #[cfg(target_arch = "wasm32")]
    {
        rsx! {
            div {
                class: "{card_classes}",
                onclick: move |e| {
                    if let Some(handler) = props.onclick.as_ref() {
                        handler.call(e);
                    }
                },
                onmousemove: move |event: Event<MouseData>| {
                    if let Some(web_event) = event.downcast::<web_sys::MouseEvent>() {
                        let client_x = web_event.client_x() as f64;
                        let client_y = web_event.client_y() as f64;

                        // Find the card by traversing up from the target
                        let mut target: Option<web_sys::EventTarget> = web_event.target();

                        while let Some(current) = target {
                            let current_el = current.dyn_ref::<web_sys::Element>();

                            if let Some(el) = current_el {
                                if el.class_list().contains("hi-card") {
                                    // Found the card
                                    if let Some(card_el) = el.dyn_ref::<web_sys::HtmlElement>() {
                                        let rect = card_el.get_bounding_client_rect();
                                        let relative_x = client_x - rect.left();
                                        let relative_y = client_y - rect.top();
                                        let width = rect.width();
                                        let height = rect.height();

                                        if width > 0.0 && height > 0.0 {
                                            let percent_x = ((relative_x / width) * 100.0).clamp(0.0, 100.0);
                                            let percent_y = ((relative_y / height) * 100.0).clamp(0.0, 100.0);

                                            let glow_el = card_el.query_selector(".hi-card-glow").ok().flatten();
                                            if let Some(glow_el) = glow_el {
                                                glow_el
                                                    .dyn_ref::<web_sys::HtmlElement>()
                                                    .and_then(|style_el| {
                                                        style_el
                                                            .style()
                                                            .set_property("--glow-x", &format!("{:.1}%", percent_x))
                                                            .ok()
                                                    });
                                                glow_el
                                                    .dyn_ref::<web_sys::HtmlElement>()
                                                    .and_then(|style_el| {
                                                        style_el
                                                            .style()
                                                            .set_property("--glow-y", &format!("{:.1}%", percent_y))
                                                            .ok()
                                                    });
                                            }
                                        }
                                    }
                                    break;
                                }
                            }

                            // Move up to parent
                            let node = current.dyn_ref::<web_sys::Node>();
                            target = node
                                .and_then(|n| n.parent_node())
                                .and_then(|n| n.dyn_into::<web_sys::EventTarget>().ok());
                        }
                    }
                },
                { content }
            }
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        rsx! {
            div {
                class: "{card_classes}",
                onclick: move |e| {
                    if let Some(handler) = props.onclick.as_ref() {
                        handler.call(e);
                    }
                },
                { content }
            }
        }
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
