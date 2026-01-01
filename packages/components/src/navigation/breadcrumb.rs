// hikari-components/src/navigation/breadcrumb.rs
// Breadcrumb component with Arknights + FUI styling

use dioxus::prelude::*;

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

/// Breadcrumb component with Arknights + FUI styling
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Breadcrumb, BreadcrumbItem};
///
/// fn app() -> Element {
///     rsx! {
///         Breadcrumb {
///             separator: ">",
///             BreadcrumbItem { item_key: "home".to_string(), "Home" }
///             BreadcrumbItem { item_key: "library".to_string(), "Library" }
///             BreadcrumbItem { item_key: "book".to_string(), "Book" }
///         }
///     }
/// }
/// ```
#[component]
pub fn Breadcrumb(props: BreadcrumbProps) -> Element {
    rsx! {
        nav {
            class: format!("hikari-breadcrumb {}", props.class),
            "aria-label": "Breadcrumb",

            ol {
                class: "hikari-breadcrumb-list",

                { props.children }
            }
        }
    }
}

/// Breadcrumb item component
#[component]
pub fn BreadcrumbItem(props: BreadcrumbItemProps) -> Element {
    rsx! {
        li {
            class: format!("hikari-breadcrumb-item {}", props.class),

            if props.href.is_some() || props.onclick.is_some() {
                {
                    if let Some(href) = props.href {
                        rsx! {
                            a {
                                class: "hikari-breadcrumb-link",
                                href: "{href}",
                                onclick: move |e| {
                                    if let Some(handler) = props.onclick.as_ref() {
                                        handler.call(e);
                                    }
                                },
                                { props.children }
                            }
                        }
                    } else {
                        rsx! {
                            span {
                                class: "hikari-breadcrumb-link",
                                onclick: move |e| {
                                    if let Some(handler) = props.onclick.as_ref() {
                                        handler.call(e);
                                    }
                                },
                                { props.children }
                            }
                        }
                    }
                }
            } else {
                span {
                    class: "hikari-breadcrumb-separator",
                    {props.children}
                }
            }
        }
    }
}

/// Breadcrumb separator component
#[component]
pub fn BreadcrumbSeparator(#[props(default)] separator: String) -> Element {
    rsx! {
        li {
            class: "hikari-breadcrumb-separator",
            span {
                class: "hikari-breadcrumb-separator-icon",
                "{separator}"
            }
        }
    }
}
