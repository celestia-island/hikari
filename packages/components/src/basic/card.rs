// hi-components/src/basic/card.rs
// Card component 

use hikari_palette::classes::{CardClass, ClassesBuilder, TypedClass};
use tairitsu_vdom::{DomHandle, get_bounding_client_rect};

use crate::{prelude::*, style_builder::StyleStringBuilder, styled::StyledComponent};

pub struct CardComponent;

#[define_props]
pub struct CardProps {
    pub hoverable: bool,

    pub bordered: bool,

    pub class: String,

    pub title: Option<String>,

    pub extra: Option<Element>,

    pub children: Element,

    pub onclick: Option<EventHandler<MouseEvent>>,

    pub glow: bool,
}

///
///
///
#[component]
pub fn Card(props: CardProps) -> Element {
    let card_classes = ClassesBuilder::new()
        .add_typed(CardClass::Card)
        .add_typed_if(CardClass::CardHoverable, props.hoverable)
        .add_typed_if(CardClass::CardBordered, props.bordered)
        .add(&props.class)
        .build();

    let has_title = props.title.is_some();
    let has_extra = props.extra.is_some();

    // Glow effect state
    let glow_style = use_signal(|| {
        StyleStringBuilder::new()
            .add_var("glow-x", "50%")
            .add_var("glow-y", "50%")
            .add_var("hi-glow-color", "var(--hi-glow-button-primary)")
            .build()
    });

    // Mouse tracking handler for glow effect
    let glow_style_clone = glow_style.clone();
    let mousemove_handler = move |event: MouseEvent| {
        if props.glow
            && let Some(target) = event.target
        {
            let rect = get_bounding_client_rect(DomHandle::from_raw(target));
            let pct_x = if rect.width > 0.0 {
                (event.offset_x as f64 / rect.width * 100.0).clamp(0.0, 100.0)
            } else {
                50.0
            };
            let pct_y = if rect.height > 0.0 {
                (event.offset_y as f64 / rect.height * 100.0).clamp(0.0, 100.0)
            } else {
                50.0
            };
            let new_style = StyleStringBuilder::new()
                .add_var("glow-x", &format!("{}%", pct_x))
                .add_var("glow-y", &format!("{}%", pct_y))
                .add_var("hi-glow-color", "var(--hi-glow-button-primary)")
                .build();
            glow_style_clone.set(new_style);
        }
    };

    // Build the card content as a fragment
    let glow_overlay = if props.glow {
        Some(rsx! {
            div {
                class: "hi-card-glow hi-glow-dim",
                style: "{glow_style}",
            }
        })
    } else {
        None
    };

    // Build title element
    let title_el = props.title.as_ref().map(|title| {
        rsx! {
            div { class: CardClass::CardTitle.class_name(), "{title}" }
        }
    });

    // Build extra element
    let extra_el = props.extra.as_ref().map(|extra| {
        rsx! {
            div { class: CardClass::CardExtra.class_name(), {extra.clone()} }
        }
    });

    let header = if has_title || has_extra {
        Some(rsx! {
            div { class: CardClass::CardHeader.class_name(),
                {title_el.unwrap_or_else(VNode::empty)}
                {extra_el.unwrap_or_else(VNode::empty)}
            }
        })
    } else {
        None
    };

    let body = rsx! {
        div { class: CardClass::CardBody.class_name(), {props.children} }
    };

    let content = VNode::Fragment(vec![
        glow_overlay.unwrap_or_else(VNode::empty),
        header.unwrap_or_else(VNode::empty),
        body,
    ]);

    rsx! {
        div {
            class: card_classes,
            onmousemove: mousemove_handler,
            onclick: move |e| {
                if let Some(handler) = props.onclick.as_ref() {
                    handler.call(e);
                }
            },
            {content}
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

#[define_props]
pub struct CardHeaderProps {
    pub title: Option<String>,

    pub subtitle: Option<String>,

    pub avatar: Option<Element>,

    pub action: Option<Element>,

    pub class: String,
}

///
///
///
#[component]
pub fn CardHeader(props: CardHeaderProps) -> Element {
    let classes = ClassesBuilder::new()
        .add_typed(CardClass::CardHeader)
        .add(&props.class)
        .build();

    let has_avatar = props.avatar.is_some();
    let has_title = props.title.is_some();
    let has_subtitle = props.subtitle.is_some();
    let has_action = props.action.is_some();

    // Build conditional sections
    let avatar_el = if has_avatar {
        let avatar = props.avatar.clone().unwrap();
        Some(rsx! {
            div { class: "hi-card-header-avatar", {avatar} }
        })
    } else {
        None
    };

    let title_el = if has_title {
        let title = props.title.clone().unwrap();
        Some(rsx! {
            div { class: CardClass::CardTitle.class_name(), "{title}" }
        })
    } else {
        None
    };

    let subtitle_el = if has_subtitle {
        let subtitle = props.subtitle.clone().unwrap();
        Some(rsx! {
            div { class: CardClass::CardSubtitle.class_name(), "{subtitle}" }
        })
    } else {
        None
    };

    let action_el = if has_action {
        let action = props.action.clone().unwrap();
        Some(rsx! {
            div { class: "hi-card-header-action", {action} }
        })
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

#[define_props]
pub struct CardContentProps {
    pub children: Element,

    pub class: String,
}

///
///
///
#[component]
pub fn CardContent(props: CardContentProps) -> Element {
    let classes = ClassesBuilder::new()
        .add_typed(CardClass::CardBody)
        .add(&props.class)
        .build();

    rsx! {
        div { class: classes, {props.children} }
    }
}

// ============================================
// CardActions - Footer with action buttons
// ============================================

#[define_props]
pub struct CardActionsProps {
    pub children: Element,

    pub class: String,

    pub disable_spacing: bool,
}

///
///
///
#[component]
pub fn CardActions(props: CardActionsProps) -> Element {
    let classes = ClassesBuilder::new()
        .add_typed(CardClass::CardActions)
        .add_typed_if(CardClass::CardActionsNoSpacing, props.disable_spacing)
        .add(&props.class)
        .build();

    rsx! {
        div { class: classes, {props.children} }
    }
}

// ============================================
// CardMedia - Optional media container (images/videos)
// ============================================

#[define_props]
pub struct CardMediaProps {
    pub src: String,

    pub alt: String,

    pub height: Option<String>,

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
        .add_typed(CardClass::CardMedia)
        .add(&props.class)
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
