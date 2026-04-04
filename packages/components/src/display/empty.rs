// packages/components/src/display/empty.rs
// Empty state component with Arknights + FUI styling

use hikari_palette::classes::{TypedClass, 
    AlignItems, ClassesBuilder, Display, EmptyClass, FlexDirection, Gap, JustifyContent, Padding,
    TextAlign,
};

use crate::{prelude::*, styled::StyledComponent};

pub struct EmptyComponent;

/// Props for the Empty component
#[define_props]
pub struct EmptyProps {
    #[default]
    pub image: Option<String>,

    #[default]
    pub title: Option<String>,

    #[default]
    pub description: String,

    #[default]
    pub action: Option<Element>,

    #[default]
    pub class: String,

    #[default]
    pub style: String,
}

#[component]
pub fn Empty(props: EmptyProps) -> Element {
    let container_classes = ClassesBuilder::new()
        .add_typed(Display::Flex)
        .add_typed(FlexDirection::Column)
        .add_typed(AlignItems::Center)
        .add_typed(JustifyContent::Center)
        .add_typed(Gap::Gap4)
        .add_typed(Padding::P8)
        .add_typed(TextAlign::Center)
        .add_typed(EmptyClass::Container)
        .add(&props.class)
        .build();

    rsx! {
        div { class: container_classes, style: props.style,

            if let Some(ref image) = props.image {
                div { class: EmptyClass::Image.class_name(),
                    img {
                        src: image,
                        alt: "Empty state",
                        class: "{EmptyClass::Img.class_name()}",
                    }
                }
            }

            if let Some(ref title) = props.title {
                h3 { class: EmptyClass::Title.class_name(), "{title}" }
            }

            p { class: EmptyClass::Description.class_name(), "{props.description}" }

            if let Some(action) = props.action {
                div { class: EmptyClass::Action.class_name(), {action} }
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
