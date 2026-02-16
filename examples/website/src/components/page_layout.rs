use dioxus::prelude::*;

use crate::components::Layout;
use _palette::classes::{ClassesBuilder, FontSize, FontWeight, MarginBottom, Padding, TextColor};

#[derive(Clone, PartialEq, Props)]
pub struct DemoSectionProps {
    pub title: String,
    #[props(default)]
    pub description: Option<String>,
    pub children: Element,
}

#[component]
pub fn DemoSection(props: DemoSectionProps) -> Element {
    rsx! {
        section {
            class: ClassesBuilder::new()
                .add(MarginBottom::Mb8)
                .add(Padding::P6)
                .build(),
            style: "
                border-radius: 0.75rem;
                border: 1px solid var(--hi-color-border);
                background: var(--hi-color-surface);
            ",

            h2 {
                class: ClassesBuilder::new()
                    .add(FontSize::Lg)
                    .add(FontWeight::Semibold)
                    .add(TextColor::Primary)
                    .add(MarginBottom::Mb4)
                    .build(),
                style: "padding-bottom: 0.75rem; border-bottom: 1px solid var(--hi-color-border);",
                "{props.title}"
            }

            if let Some(desc) = &props.description {
                p {
                    class: ClassesBuilder::new()
                        .add(TextColor::Secondary)
                        .add(MarginBottom::Mb4)
                        .build(),
                    "{desc}"
                }
            }

            {props.children}
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct PageContainerProps {
    #[props(default)]
    pub title: Option<String>,
    #[props(default)]
    pub description: Option<String>,
    pub children: Element,
    pub current_route: crate::app::Route,
}

#[component]
pub fn PageContainer(props: PageContainerProps) -> Element {
    rsx! {
        Layout {
            current_route: props.current_route,

            div {
                class: ClassesBuilder::new()
                    .add(Padding::P6)
                    .build(),
                style: "max-width: 1200px; margin: 0 auto; padding-left: 2rem; padding-right: 2rem;",

                if let Some(title) = &props.title {
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(TextColor::Primary)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "{title}"
                    }
                }

                if let Some(desc) = &props.description {
                    p {
                        class: ClassesBuilder::new()
                            .add(TextColor::Secondary)
                            .add(MarginBottom::Mb8)
                            .build(),
                        style: "max-width: 800px; line-height: 1.6;",
                        "{desc}"
                    }
                }

                {props.children}
            }
        }
    }
}
