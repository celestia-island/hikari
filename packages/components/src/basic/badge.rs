// hi-components/src/basic/badge.rs
// Badge component with Arknights + FUI styling

use hikari_palette::classes::{BadgeClass, ClassesBuilder, Display};

use crate::{prelude::*, styled::StyledComponent};

pub struct BadgeComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum BadgeVariant {
    #[default]
    Default,
    Primary,
    Secondary,
    Success,
    Warning,
    Danger,
    Info,
}

#[define_props]
pub struct BadgeProps {
    #[default]
    pub variant: BadgeVariant,

    #[default]
    pub dot: bool,

    #[default]
    pub count: Option<i32>,

    #[default]
    pub max: Option<i32>,

    #[default]
    pub show_zero: bool,

    #[default]
    pub class: String,

    pub children: Element,
}

#[component]
pub fn Badge(props: BadgeProps) -> Element {
    let display_count = if let Some(count) = props.count {
        if count == 0 && !props.show_zero {
            None
        } else if let Some(max) = props.max {
            if count > max {
                Some(format!("{max}+"))
            } else {
                Some(format!("{count}"))
            }
        } else {
            Some(format!("{count}"))
        }
    } else {
        None
    };

    let variant_class = match props.variant {
        BadgeVariant::Default => None,
        BadgeVariant::Primary => Some(BadgeClass::Primary),
        BadgeVariant::Secondary => Some(BadgeClass::Secondary),
        BadgeVariant::Success => Some(BadgeClass::Success),
        BadgeVariant::Warning => Some(BadgeClass::Warning),
        BadgeVariant::Danger => Some(BadgeClass::Danger),
        BadgeVariant::Info => Some(BadgeClass::Info),
    };

    let is_standalone = !props.dot && display_count.is_none();

    if is_standalone {
        let mut builder = ClassesBuilder::new()
            .add(BadgeClass::Badge)
            .add(Display::InlineFlex);

        if let Some(vc) = variant_class {
            builder = builder.add(vc);
        }

        let badge_classes = builder.add_raw(&props.class).build();

        rsx! {
            span { class: badge_classes,
                {props.children}
            }
        }
    } else {
        let mut builder = ClassesBuilder::new()
            .add(BadgeClass::Badge)
            .add(BadgeClass::Dot);

        if let Some(vc) = variant_class {
            builder = builder.add(vc);
        }

        let badge_classes = builder.build();

        rsx! {
            div { class: format!("hi-badge-wrapper {}", props.class),

                {props.children}

                span { class: badge_classes,

                    if props.dot {
                        span { class: "hi-badge-dot-inner" }
                    } else if let Some(count) = display_count.clone() {
                        "{count}"
                    }
                }
            }
        }
    }
}

impl StyledComponent for BadgeComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/badge.css"))
    }

    fn name() -> &'static str {
        "badge"
    }
}
