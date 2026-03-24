// packages/components/src/display/empty.rs
// Empty state component with Arknights + FUI styling

use hikari_palette::classes::{
    AlignItems, ClassesBuilder, Display, EmptyClass, FlexDirection, Gap, JustifyContent, Padding,
    TextAlign, UtilityClass,
};

use crate::{prelude::*, styled::StyledComponent};

pub struct EmptyComponent;

///
///
///
///
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
        .add(Display::Flex)
        .add(FlexDirection::Column)
        .add(AlignItems::Center)
        .add(JustifyContent::Center)
        .add(Gap::Gap4)
        .add(Padding::P8)
        .add(TextAlign::Center)
        .add(EmptyClass::Container)
        .add_raw(&props.class)
        .build();

    rsx! {
        div { class: container_classes, style: props.style,

            if let Some(ref image) = props.image {
                div { class: EmptyClass::Image.as_class(),
                    img {
                        src: image,
                        alt: "Empty state",
                        class: "{EmptyClass::Img.as_class()}",
                    }
                }
            }

            if let Some(ref title) = props.title {
                h3 { class: EmptyClass::Title.as_class(), "{title}" }
            }

            p { class: EmptyClass::Description.as_class(), "{props.description}" }

            if let Some(action) = props.action {
                div { class: EmptyClass::Action.as_class(), {action} }
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
