// packages/components/src/display/empty.rs
// Empty state component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{
    AlignItems, ClassesBuilder, Display, FlexDirection, Gap, JustifyContent, Padding, TextAlign,
};

use crate::styled::StyledComponent;

/// Empty component type wrapper (for StyledComponent)
pub struct EmptyComponent;

/// Empty component with Arknights + FUI styling
///
/// A placeholder for empty states in lists, tables, or data displays.
/// Provides a visual representation when no data is available.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Empty;
///
/// fn app() -> Element {
///     rsx! {
///         Empty {
///             image: "placeholder.svg",
///             description: "No data available",
///         }
///     }
/// }
/// ```
#[derive(Clone, PartialEq, Props)]
#[derive(Default)]
pub struct EmptyProps {
    #[props(default)]
    pub image: Option<String>,

    #[props(default)]
    pub title: Option<String>,

    #[props(default)]
    pub description: String,

    #[props(default)]
    pub action: Option<Element>,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,
}


#[component]
pub fn Empty(props: EmptyProps) -> Element {
    let container_classes = ClassesBuilder::new()
        .add(Display::Flex)
        .add(FlexDirection::Column)
        .add(AlignItems::Center)
        .add(JustifyContent::Center)
        .add(Gap::Gap4)
        .add(Padding::P8)
        .add(TextAlign::Center)
        .add_raw("hi-empty-container")
        .add_raw(&props.class)
        .build();

    rsx! {
        div {
            class: "{container_classes}",
            style: "{props.style}",

            if let Some(ref image) = props.image {
                div {
                    class: "hi-empty-image",
                    img {
                        src: "{image}",
                        alt: "Empty state",
                        class: "hi-empty-img"
                    }
                }
            }

            if let Some(ref title) = props.title {
                h3 {
                    class: "hi-empty-title",
                    "{title}"
                }
            }

            p {
                class: "hi-empty-description",
                "{props.description}"
            }

            if let Some(action) = props.action {
                div {
                    class: "hi-empty-action",
                    { action }
                }
            }
        }
    }
}

impl StyledComponent for EmptyComponent {
    fn styles() -> &'static str {
        r#"
.hi-empty-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 2rem;
    text-align: center;
    min-height: 200px;
}

.hi-empty-image {
    width: 100%;
    max-width: 400px;
    margin-bottom: 0.5rem;
}

.hi-empty-img {
    width: 100%;
    height: auto;
    max-height: 200px;
    object-fit: contain;
    opacity: 0.8;
}

.hi-empty-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--hi-color-text-primary);
}

.hi-empty-description {
    margin: 0;
    font-size: 0.875rem;
    color: var(--hi-color-text-secondary);
    max-width: 400px;
    line-height: 1.5;
}

.hi-empty-action {
    margin-top: 0.5rem;
}
"#
    }

    fn name() -> &'static str {
        "empty"
    }
}
