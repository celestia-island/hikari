// packages/components/src/display/tag.rs
// Tag component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{AlignItems, ClassesBuilder, Display, Flex, Gap, TagClass, UtilityClass};

use crate::styled::StyledComponent;

/// Tag component type wrapper (for StyledComponent)
pub struct TagComponent;

/// Tag component with Arknights + FUI styling
///
/// A tag is similar to a badge but supports text content and an optional close button.
/// Useful for displaying labels, tags, or keywords that users can add/remove.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Tag, TagVariant};
///
/// fn app() -> Element {
///     rsx! {
///         Tag {
///             variant: TagVariant::Primary,
///             "Rust"
///         }
///         Tag {
///             variant: TagVariant::Success,
///             closable: true,
///             on_close: move |_| println!("Tag closed"),
///             "WebAssembly"
///         }
///     }
/// }
/// ```
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

#[derive(Clone, PartialEq, Props)]
pub struct TagProps {
    #[props(default)]
    pub variant: TagVariant,

    #[props(default)]
    pub closable: bool,

    #[props(default)]
    pub on_close: Option<EventHandler<MouseEvent>>,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,

    pub children: Element,
}

impl Default for TagProps {
    fn default() -> Self {
        Self {
            variant: Default::default(),
            closable: false,
            on_close: None,
            class: String::default(),
            style: String::default(),
            children: VNode::empty(),
        }
    }
}

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
        .add(Display::InlineFlex)
        .add(Flex::Flex1)
        .add(AlignItems::Center)
        .add(Gap::Gap2)
        .add(TagClass::Tag)
        .add(variant_class)
        .add_raw(&props.class)
        .build();

    rsx! {
        span {
            class: "{tag_classes}",
            style: "{props.style}",

            { props.children }

            if props.closable {
                button {
                    class: "{TagClass::Close.as_class()}",
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
    background-color: rgba(107, 114, 128, 0.1);
    color: var(--hi-color-text-primary);
    border-color: rgba(107, 114, 128, 0.2);
}

.hi-tag-default:hover {
    background-color: rgba(107, 114, 128, 0.2);
}

.hi-tag-primary {
    background-color: rgba(59, 130, 246, 0.1);
    color: var(--hi-color-primary);
    border-color: rgba(59, 130, 246, 0.3);
}

.hi-tag-primary:hover {
    background-color: rgba(59, 130, 246, 0.2);
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
}

.hi-tag-success {
    background-color: rgba(16, 185, 129, 0.1);
    color: #10b981;
    border-color: rgba(16, 185, 129, 0.3);
}

.hi-tag-success:hover {
    background-color: rgba(16, 185, 129, 0.2);
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.3);
}

.hi-tag-warning {
    background-color: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.3);
}

.hi-tag-warning:hover {
    background-color: rgba(245, 158, 11, 0.2);
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
}

.hi-tag-danger {
    background-color: rgba(255, 76, 0, 0.1);
    color: #ff4c00;
    border-color: rgba(255, 76, 0, 0.3);
}

.hi-tag-danger:hover {
    background-color: rgba(255, 76, 0, 0.2);
    box-shadow: 0 0 8px rgba(255, 76, 0, 0.3);
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
