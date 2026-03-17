// hi-components/src/basic/card.rs
// Card component with Arknights + FUI styling

use crate::prelude::*;
use hikari_palette::classes::{CardClass, ClassesBuilder, UtilityClass};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

use crate::styled::StyledComponent;

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

///
///
///
#[component]
pub fn Card(props: CardProps) -> Element {
    let card_classes = ClassesBuilder::new()
        .add(CardClass::Card)
        .add_if(CardClass::CardHoverable, || props.hoverable)
        .add_if(CardClass::CardBordered, || props.bordered)
        .add_raw(&props.class)
        .build();

    let has_title = props.title.is_some();
    let has_extra = props.extra.is_some();

    // Build the card content as a fragment
    let glow_overlay = if props.glow {
        Some(rsx! {
            div {
                class: "hi-card-glow hi-glow-dim",
                style: "--glow-x: 50%; --glow-y: 50%; --hi-glow-color: var(--hi-glow-button-primary);",
            }
        })
    } else {
        None
    };

    // Build title element
    let title_el = if let Some(title) = &props.title {
        Some(rsx! { div { class: CardClass::CardTitle.as_class(), "{title}" } })
    } else {
        None
    };

    // Build extra element
    let extra_el = if let Some(extra) = &props.extra {
        Some(rsx! { div { class: CardClass::CardExtra.as_class(), {extra.clone()} } })
    } else {
        None
    };

    let header = if has_title || has_extra {
        Some(rsx! {
            div { class: CardClass::CardHeader.as_class(),
                {title_el.unwrap_or_else(VNode::empty)}
                {extra_el.unwrap_or_else(VNode::empty)}
            }
        })
    } else {
        None
    };

    let body = rsx! {
        div { class: CardClass::CardBody.as_class(), {props.children} }
    };

    let content = VNode::Fragment(vec![
        glow_overlay.unwrap_or_else(VNode::empty),
        header.unwrap_or_else(VNode::empty),
        body,
    ]);

    #[cfg(target_arch = "wasm32")]
    {
        rsx! {
            div {
                class: card_classes,
                onclick: move |e| {
                    if let Some(handler) = props.onclick.as_ref() {
                        handler.call(e);
                    }
                },
                onmousemove: move |event: Event<MouseData>| {
                    if let Some(web_event) = event.downcast::<web_sys::MouseEvent>() {
                        let client_x = web_event.client_x() as f64;
                        let client_y = web_event.client_y() as f64;

                        // Find the card by traversing up from target
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
                                            let percent_x = ((relative_x / width) * 100.0)
                                                .clamp(0.0, 100.0);
                                            let percent_y = ((relative_y / height) * 100.0)
                                                .clamp(0.0, 100.0);
                                            let glow_el = card_el
                                                .query_selector(".hi-card-glow")
                                                .ok()
                                                .flatten();
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
                            let node = current.dyn_ref::<web_sys::Node>();
                            target = node
                                .and_then(|n| n.parent_node())
                                .and_then(|n| n.dyn_into::<web_sys::EventTarget>().ok());
                        }
                    }
                },
                {content}
            }
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        rsx! {
            div {
                class: card_classes,
                onclick: move |e| {
                    if let Some(handler) = props.onclick.as_ref() {
                        handler.call(e);
                    }
                },
                {content}
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

// ============================================
// CardHeader - Optional header with title, subtitle, and actions
// ============================================

#[derive(Clone, PartialEq, Props)]
pub struct CardHeaderProps {
    #[props(default)]
    pub title: Option<String>,

    #[props(default)]
    pub subtitle: Option<String>,

    #[props(default)]
    pub avatar: Option<Element>,

    #[props(default)]
    pub action: Option<Element>,

    #[props(default)]
    pub class: String,
}

///
///
///
#[component]
pub fn CardHeader(props: CardHeaderProps) -> Element {
    let classes = ClassesBuilder::new()
        .add(CardClass::CardHeader)
        .add_raw(&props.class)
        .build();

    let has_avatar = props.avatar.is_some();
    let has_title = props.title.is_some();
    let has_subtitle = props.subtitle.is_some();
    let has_action = props.action.is_some();

    // Build conditional sections
    let avatar_el = if has_avatar {
        let avatar = props.avatar.clone().unwrap();
        Some(rsx! { div { class: "hi-card-header-avatar", {avatar} } })
    } else {
        None
    };

    let title_el = if has_title {
        let title = props.title.clone().unwrap();
        Some(rsx! { div { class: CardClass::CardTitle.as_class(), "{title}" } })
    } else {
        None
    };

    let subtitle_el = if has_subtitle {
        let subtitle = props.subtitle.clone().unwrap();
        Some(rsx! { div { class: CardClass::CardSubtitle.as_class(), "{subtitle}" } })
    } else {
        None
    };

    let action_el = if has_action {
        let action = props.action.clone().unwrap();
        Some(rsx! { div { class: "hi-card-header-action", {action} } })
    } else {
        None
    };

    rsx! {
        div { class: classes,
            // Left section: avatar + title/subtitle
            div { class: "hi-card-header-left",
                {avatar_el.unwrap_or_else(VNode::empty)}
                div {
                    {title_el.unwrap_or_else(VNode::empty)}
                    {subtitle_el.unwrap_or_else(VNode::empty)}
                }
            }
            // Right section: action buttons
            {action_el.unwrap_or_else(VNode::empty)}
        }
    }
}

// ============================================
// CardContent - Main content area
// ============================================

#[derive(Clone, PartialEq, Props)]
pub struct CardContentProps {
    #[props(default)]
    pub children: Element,

    #[props(default)]
    pub class: String,
}

///
///
///
#[component]
pub fn CardContent(props: CardContentProps) -> Element {
    let classes = ClassesBuilder::new()
        .add(CardClass::CardBody)
        .add_raw(&props.class)
        .build();

    rsx! {
        div { class: classes, {props.children} }
    }
}

// ============================================
// CardActions - Footer with action buttons
// ============================================

#[derive(Clone, PartialEq, Props)]
pub struct CardActionsProps {
    #[props(default)]
    pub children: Element,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub disable_spacing: bool,
}

///
///
///
#[component]
pub fn CardActions(props: CardActionsProps) -> Element {
    let classes = ClassesBuilder::new()
        .add(CardClass::CardActions)
        .add_if(CardClass::CardActionsNoSpacing, || props.disable_spacing)
        .add_raw(&props.class)
        .build();

    rsx! {
        div { class: classes, {props.children} }
    }
}

// ============================================
// CardMedia - Optional media container (images/videos)
// ============================================

#[derive(Clone, PartialEq, Props)]
pub struct CardMediaProps {
    pub src: String,

    #[props(default)]
    pub alt: String,

    #[props(default)]
    pub height: Option<String>,

    #[props(default)]
    pub class: String,
}

///
///
///
#[component]
pub fn CardMedia(props: CardMediaProps) -> Element {
    let style = if let Some(height) = props.height {
        format!("height: {}", height)
    } else {
        String::new()
    };

    let classes = ClassesBuilder::new()
        .add(CardClass::CardMedia)
        .add_raw(&props.class)
        .build();

    rsx! {
        img {
            class: classes,
            src: props.src,
            alt: props.alt,
            style,
        }
    }
}
