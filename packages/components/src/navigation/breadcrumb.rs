// hi-components/src/navigation/breadcrumb.rs
// Breadcrumb component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{components::BreadcrumbClass, ClassesBuilder, Display, FlexDirection, Gap};

use crate::styled::StyledComponent;

pub struct BreadcrumbComponent;

#[derive(Clone, PartialEq, Props)]
pub struct BreadcrumbItemProps {
    #[props(default)]
    pub item_key: String,

    #[props(default)]
    pub href: Option<String>,

    #[props(default)]
    pub children: Element,

    #[props(default)]
    pub class: String,

    pub onclick: Option<EventHandler<MouseEvent>>,
}

impl Default for BreadcrumbItemProps {
    fn default() -> Self {
        Self {
            item_key: String::default(),
            href: None,
            children: VNode::empty(),
            class: String::default(),
            onclick: None,
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct BreadcrumbProps {
    #[props(default)]
    pub separator: String,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub children: Element,
}

impl Default for BreadcrumbProps {
    fn default() -> Self {
        Self {
            separator: "/".to_string(),
            class: String::default(),
            children: VNode::empty(),
        }
    }
}

#[component]
pub fn Breadcrumb(props: BreadcrumbProps) -> Element {
    let classes = ClassesBuilder::new()
        .add(BreadcrumbClass::Breadcrumb)
        .add(Display::Flex)
        .add(FlexDirection::Row)
        .add(Gap::Gap2)
        .add_raw(&props.class)
        .build();

    rsx! {
        nav {
            class: "{classes}",
            "aria-label": "Breadcrumb",

            { props.children }
        }
    }
}

impl StyledComponent for BreadcrumbComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/breadcrumb.css"))
    }

    fn name() -> &'static str {
        "breadcrumb"
    }
}

#[component]
pub fn BreadcrumbItem(props: BreadcrumbItemProps) -> Element {
    let classes = ClassesBuilder::new()
        .add(BreadcrumbClass::BreadcrumbItem)
        .add(Display::Flex)
        .add(FlexDirection::Row)
        .add(Gap::Gap2)
        .add_raw(&props.class)
        .build();

    rsx! {
        div {
            class: "{classes}",

            if let Some(href) = props.href {
                a {
                    class: "hi-breadcrumb-link",
                    href: "{href}",
                    onclick: move |e| {
                        if let Some(handler) = props.onclick.as_ref() {
                            handler.call(e);
                        }
                    },
                    { props.children }
                }
            } else if props.onclick.is_some() {
                span {
                    class: "hi-breadcrumb-link",
                    onclick: move |e| {
                        if let Some(handler) = props.onclick.as_ref() {
                            handler.call(e);
                        }
                    },
                    { props.children }
                }
            } else {
                span {
                    class: "hi-breadcrumb-current",
                    { props.children }
                }
            }

            span {
                class: "hi-breadcrumb-separator",
                svg {
                    xmlns: "http://www.w3.org/2000/svg",
                    width: "16",
                    height: "16",
                    view_box: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    stroke_width: "2",
                    stroke_linecap: "round",
                    stroke_linejoin: "round",
                    path { d: "M9 18l6-6-6-6" }
                }
            }
        }
    }
}

#[component]
pub fn BreadcrumbSeparator(#[props(default)] separator: String) -> Element {
    rsx! {
        span {
            class: "hi-breadcrumb-separator",
            if separator.is_empty() {
                svg {
                    xmlns: "http://www.w3.org/2000/svg",
                    width: "16",
                    height: "16",
                    view_box: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    stroke_width: "2",
                    stroke_linecap: "round",
                    stroke_linejoin: "round",
                    path { d: "M9 18l6-6-6-6" }
                }
            } else {
                "{separator}"
            }
        }
    }
}
