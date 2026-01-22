// packages/components/src/feedback/skeleton.rs
// Skeleton component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::ClassesBuilder;

use crate::styled::StyledComponent;

/// Skeleton component type wrapper (for StyledComponent)
pub struct SkeletonComponent;

/// Skeleton component with Arknights + FUI styling
///
/// A skeleton loading placeholder component with configurable shape and animation.
/// Used to show loading state before content is ready.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Skeleton;
///
/// fn app() -> Element {
///     rsx! {
///         Skeleton {
///             loading: true,
///             shape: SkeletonShape::Text,
///             rows: 3,
///         }
///     }
/// }
/// ```
#[derive(Clone, PartialEq, Props)]
pub struct SkeletonProps {
    /// Whether to show loading state
    #[props(default = true)]
    pub loading: bool,

    /// Skeleton shape
    #[props(default)]
    pub shape: SkeletonShape,

    /// Number of rows (for text/avatar shapes)
    #[props(default = 3)]
    pub rows: u32,

    /// Avatar size (for avatar shape)
    #[props(default)]
    pub avatar_size: Option<usize>,

    /// Image dimensions (for image shape)
    #[props(default)]
    pub image_dimensions: Option<(usize, usize)>,

    /// Animation active
    #[props(default = true)]
    pub active: bool,

    /// Additional CSS class
    #[props(default)]
    pub class: String,

    /// Additional inline style
    #[props(default)]
    pub style: String,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SkeletonShape {
    #[default]
    Text,
    Avatar,
    Image,
    Button,
    Input,
    Rect,
}

#[component]
pub fn Skeleton(props: SkeletonProps) -> Element {
    let wrapper_classes = ClassesBuilder::new()
        .add_raw("hi-skeleton-wrapper")
        .add_raw(&props.class)
        .build();

    let animation_class = if props.active {
        "hi-skeleton-active"
    } else {
        ""
    };

    let avatar_style = if props.shape == SkeletonShape::Avatar {
        let size = props.avatar_size.unwrap_or(40);
        format!("width: {size}px; height: {size}px;")
    } else {
        String::new()
    };

    let image_style = if props.shape == SkeletonShape::Image {
        let (width, height) = props.image_dimensions.unwrap_or((200, 150));
        format!("width: {width}px; height: {height}px;")
    } else {
        String::new()
    };

    rsx! {
        div {
            class: "{wrapper_classes}",
            style: "{props.style}",

            if props.loading {
                if props.shape == SkeletonShape::Text {
                    for _ in 0..props.rows {
                        div {
                            class: "hi-skeleton hi-skeleton-text",
                            class: "{animation_class}",
                        }
                    }
                } else if props.shape == SkeletonShape::Avatar {
                    div {
                        class: "hi-skeleton hi-skeleton-avatar",
                        class: "{animation_class}",
                        style: "{avatar_style}",
                    }
                } else if props.shape == SkeletonShape::Image {
                    div {
                        class: "hi-skeleton hi-skeleton-image",
                        class: "{animation_class}",
                        style: "{image_style}",
                    }
                } else if props.shape == SkeletonShape::Button {
                    div {
                        class: "hi-skeleton hi-skeleton-button",
                        class: "{animation_class}",
                    }
                } else if props.shape == SkeletonShape::Input {
                    div {
                        class: "hi-skeleton hi-skeleton-input",
                        class: "{animation_class}",
                    }
                } else if props.shape == SkeletonShape::Rect {
                    div {
                        class: "hi-skeleton hi-skeleton-rect",
                        class: "{animation_class}",
                    }
                }
            }
        }
    }
}

impl StyledComponent for SkeletonComponent {
    fn styles() -> &'static str {
        r#"
.hi-skeleton-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.hi-skeleton {
    background: linear-gradient(
        90deg,
        var(--hi-color-surface) 0%,
        var(--hi-color-background) 50%,
        var(--hi-color-surface) 100%
    );
    border-radius: 4px;
}

.hi-skeleton-active {
    animation: hi-skeleton-shimmer 1.5s infinite linear;
}

@keyframes hi-skeleton-shimmer {
    0% {
        background-position: -200% 0;
    }
    100% {
        background-position: 200% 0;
    }
}

.hi-skeleton-text {
    height: 16px;
    border-radius: 2px;
}

.hi-skeleton-avatar {
    border-radius: 50%;
}

.hi-skeleton-image {
    border-radius: 4px;
}

.hi-skeleton-button {
    height: 36px;
    border-radius: 8px;
}

.hi-skeleton-input {
    height: 36px;
    border-radius: 4px;
}

.hi-skeleton-rect {
    height: 100px;
    border-radius: 4px;
}
"#
    }

    fn name() -> &'static str {
        "skeleton"
    }
}
