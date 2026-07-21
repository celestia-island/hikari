// hi-components/src/navigation/breadcrumb.rs
// Breadcrumb component with Arknights + FUI styling

use hikari_palette::classes::{
    ClassesBuilder, Display, FlexDirection, Gap, components::BreadcrumbClass,
};

use crate::{prelude::*, styled::StyledComponent};

pub struct BreadcrumbComponent;

#[define_props]
pub struct BreadcrumbItemProps {
    pub item_key: String,

    pub href: Option<String>,

    pub children: Element,

    pub class: String,

    pub onclick: Option<EventHandler<MouseEvent>>,
}

#[define_props]
pub struct BreadcrumbProps {
    #[default("/".to_string())]
    pub separator: String,

    pub class: String,

    pub children: Element,
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
            class: classes,
            "aria-label": "Breadcrumb",

            { props.children }
        }
    }
}

impl StyledComponent for BreadcrumbComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/components/breadcrumb.scss", no_hash }.0
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
            class: classes,

            if let Some(href) = props.href {
                a {
                    class: "hk-breadcrumb-link",
                    href: href,
                    onclick: move |e| {
                        if let Some(handler) = props.onclick.as_ref() {
                            handler.call(e);
                        }
                    },
                    { props.children }
                }
            } else if props.onclick.is_some() {
                span {
                    class: "hk-breadcrumb-link",
                    onclick: move |e| {
                        if let Some(handler) = props.onclick.as_ref() {
                            handler.call(e);
                        }
                    },
                    { props.children }
                }
            } else {
                span {
                    class: "hk-breadcrumb-current",
                    { props.children }
                }
            }

            span {
                class: "hk-breadcrumb-separator",
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
            class: "hk-breadcrumb-separator",
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
