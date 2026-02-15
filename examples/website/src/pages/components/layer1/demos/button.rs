use _components::basic::button::Button;
use _components::{ButtonVariant, IconButton, IconButtonSize};
use _icons::MdiIcon;
use _palette::classes::{ClassesBuilder, Display, FlexDirection, FlexWrap, Gap, Padding};
use dioxus::prelude::*;

#[derive(Clone, PartialEq, Props)]
pub struct ButtonDemoProps {
    #[props(default)]
    pub demo_id: Option<String>,
}

#[allow(non_snake_case)]
pub fn ButtonDemos(props: ButtonDemoProps) -> Element {
    match props.demo_id.as_deref() {
        Some("variants") | None => rsx! { ButtonVariants {} },
        Some("disabled") => rsx! { ButtonDisabled {} },
        Some("icon") => rsx! { ButtonIcon {} },
        _ => rsx! { ButtonVariants {} ButtonDisabled {} ButtonIcon {} },
    }
}

#[allow(non_snake_case)]
fn ButtonVariants() -> Element {
    rsx! {
        div {
            class: ClassesBuilder::new()
                .add(Display::Flex)
                .add(FlexDirection::Row)
                .add(Gap::Gap4)
                .add(FlexWrap::Wrap)
                .add(Padding::P4)
                .build(),

            Button { variant: ButtonVariant::Primary, "Primary" }
            Button { variant: ButtonVariant::Secondary, "Secondary" }
            Button { variant: ButtonVariant::Ghost, "Ghost" }
            Button { variant: ButtonVariant::Danger, "Danger" }
        }
    }
}

#[allow(non_snake_case)]
fn ButtonDisabled() -> Element {
    rsx! {
        div {
            class: ClassesBuilder::new()
                .add(Display::Flex)
                .add(FlexDirection::Row)
                .add(Gap::Gap4)
                .add(FlexWrap::Wrap)
                .add(Padding::P4)
                .build(),

            Button { variant: ButtonVariant::Primary, disabled: true, "Primary" }
            Button { variant: ButtonVariant::Secondary, disabled: true, "Secondary" }
            Button { variant: ButtonVariant::Ghost, disabled: true, "Ghost" }
            Button { variant: ButtonVariant::Danger, disabled: true, "Danger" }
        }
    }
}

#[allow(non_snake_case)]
fn ButtonIcon() -> Element {
    rsx! {
        div {
            class: ClassesBuilder::new()
                .add(Display::Flex)
                .add(FlexDirection::Row)
                .add(Gap::Gap4)
                .add(FlexWrap::Wrap)
                .add(Padding::P4)
                .build(),

            IconButton {
                icon: MdiIcon::Check,
                size: IconButtonSize::Small,
                onclick: move |_| {},
            }
            IconButton {
                icon: MdiIcon::Pencil,
                size: IconButtonSize::Medium,
                onclick: move |_| {},
            }
            IconButton {
                icon: MdiIcon::Close,
                size: IconButtonSize::Large,
                onclick: move |_| {},
            }
        }
    }
}
