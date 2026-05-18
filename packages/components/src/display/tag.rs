// packages/components/src/display/tag.rs
// Tag component

use hikari_palette::classes::{
    AlignItems, ClassesBuilder, Display, Flex, Gap, TagClass, TypedClass,
};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TagComponent;

/// Tag variant determining visual style
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TagVariant {
    #[default]
    Default,
    Primary,
    Success,
    Warning,
    Danger,
    Info,
}

/// Props for the Tag component.
#[define_props]
pub struct TagProps {
    pub variant: TagVariant,
    pub closable: bool,
    pub on_close: Option<EventHandler<MouseEvent>>,
    pub class: String,
    pub style: String,
    pub children: Element,
}

/// A tag component for labeling and categorizing content with variant styles.
#[component]
pub fn Tag(props: TagProps) -> Element {
    let variant_class = match props.variant {
        TagVariant::Default => TagClass::Default,
        TagVariant::Primary => TagClass::Primary,
        TagVariant::Success => TagClass::Success,
        TagVariant::Warning => TagClass::Warning,
        TagVariant::Danger => TagClass::Danger,
        TagVariant::Info => TagClass::Info,
    };

    let tag_classes = ClassesBuilder::new()
        .add_typed(Display::InlineFlex)
        .add_typed(Flex::Flex1)
        .add_typed(AlignItems::Center)
        .add_typed(Gap::Gap2)
        .add_typed(TagClass::Tag)
        .add_typed(variant_class)
        .add(&props.class)
        .build();

    rsx! {
        span { class: tag_classes, style: props.style,

            {props.children}

            if props.closable {
                button {
                    class: TagClass::Close.class_name(),
                    onclick: move |e| {
                        if let Some(ref on_close) = props.on_close {
                            on_close.call(e);
                        }
                    },
                    "×"
                }
            }
        }
    }
}

impl StyledComponent for TagComponent {
    fn styles() -> &'static str {
        r#"
.hi-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1;
    border-radius: 4px;
    border: 1px solid transparent;
    transition: all 0.2s ease;
}

.hi-tag-default {
    background-color: rgba(var(--hi-color-text-secondary-rgb), 0.1);
    color: var(--hi-color-text-secondary);
    border-color: rgba(var(--hi-color-text-secondary-rgb), 0.2);
}

.hi-tag-default:hover {
    background-color: rgba(var(--hi-color-text-secondary-rgb), 0.2);
}

.hi-tag-primary {
    background-color: rgba(var(--hi-color-primary-rgb), 0.1);
    color: var(--hi-color-primary);
    border-color: rgba(var(--hi-color-primary-rgb), 0.3);
}

.hi-tag-primary:hover {
    background-color: rgba(var(--hi-color-primary-rgb), 0.2);
    box-shadow: 0 0 8px rgba(var(--hi-color-primary-rgb), 0.3);
}

.hi-tag-success {
    background-color: rgba(var(--hi-color-success-rgb), 0.1);
    color: var(--hi-color-success);
    border-color: rgba(var(--hi-color-success-rgb), 0.3);
}

.hi-tag-success:hover {
    background-color: rgba(var(--hi-color-success-rgb), 0.2);
    box-shadow: 0 0 8px rgba(var(--hi-color-success-rgb), 0.3);
}

.hi-tag-warning {
    background-color: rgba(var(--hi-color-warning-rgb), 0.1);
    color: var(--hi-color-warning);
    border-color: rgba(var(--hi-color-warning-rgb), 0.3);
}

.hi-tag-warning:hover {
    background-color: rgba(var(--hi-color-warning-rgb), 0.2);
    box-shadow: 0 0 8px rgba(var(--hi-color-warning-rgb), 0.3);
}

.hi-tag-danger {
    background-color: rgba(var(--hi-color-danger-rgb), 0.1);
    color: var(--hi-color-danger);
    border-color: rgba(var(--hi-color-danger-rgb), 0.3);
}

.hi-tag-danger:hover {
    background-color: rgba(var(--hi-color-danger-rgb), 0.2);
    box-shadow: 0 0 8px rgba(var(--hi-color-danger-rgb), 0.3);
}

.hi-tag-info {
    background-color: rgba(6, 182, 212, 0.1);
    color: #06b6d4;
    border-color: rgba(6, 182, 212, 0.3);
}

.hi-tag-info:hover {
    background-color: rgba(6, 182, 212, 0.2);
    box-shadow: 0 0 8px rgba(6, 182, 212, 0.3);
}

.hi-tag-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-left: 4px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: inherit;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s ease;
}

.hi-tag-close:hover {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.1);
}
"#
    }

    fn name() -> &'static str {
        "tag"
    }
}
