// website/src/components/page_layout.rs
// Reusable page layout component with i18n support

use dioxus::prelude::*;

use crate::components::Layout;
use _palette::classes::ClassesBuilder;

/// Demo section component with title
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
            class: "demo-section",
            h2 {
                class: "section-title",
                "{props.title}"
            }
            if let Some(desc) = &props.description {
                p {
                    class: "section-description",
                    "{desc}"
                }
            }
            {props.children}
        }
    }
}

/// Page header component
#[derive(Clone, PartialEq, Props)]
pub struct PageHeaderProps {
    pub title: String,
    #[props(default)]
    pub description: Option<String>,
}

#[component]
pub fn PageHeader(props: PageHeaderProps) -> Element {
    rsx! {
        div {
            class: "page-header",
            h1 {
                class: "page-title",
                "{props.title}"
            }
            if let Some(desc) = &props.description {
                p {
                    class: "page-description",
                    "{desc}"
                }
            }
        }
    }
}

/// Page container component that wraps content with standard layout
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
                class: "page-container",
                if let Some(title) = &props.title {
                    h1 {
                        class: "page-title",
                        "{title}"
                    }
                }
                if let Some(desc) = &props.description {
                    p {
                        class: "page-description",
                        "{desc}"
                    }
                }
                {props.children}
            }
        }
    }
}
