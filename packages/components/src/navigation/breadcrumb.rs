// hi-components/src/navigation/breadcrumb.rs
// Breadcrumb component with Arknights + FUI styling

use dioxus::prelude::*;

use crate::styled::StyledComponent;
use palette::classes::{components::BreadcrumbClass, ClassesBuilder};

/// Breadcrumb 组件的类型包装器（用于实现 StyledComponent）
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

/// Breadcrumb component with modern, premium styling
///
/// A navigation breadcrumb component that shows the current page's location
/// in the site hierarchy. Inspired by Material UI and Element Plus.
///
/// # Features
/// - **Chevron Separators**: Default SVG chevron-right icons (refined, not text-based)
/// - **Hover Effects**: Subtle background and color transitions
/// - **Custom Separators**: Support for custom separator styles (slash, arrow, dot)
/// - **Style Variants**: Background and pill styles for different contexts
/// - **Responsive**: Size variants (sm, lg) for different screen sizes
/// - **Icons**: Support for icons alongside breadcrumb text
///
/// # Examples
///
/// ## Basic Breadcrumb
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Breadcrumb, BreadcrumbItem};
///
/// fn app() -> Element {
///     rsx! {
///         Breadcrumb {
///             BreadcrumbItem { item_key: "1".to_string(), "Home" }
///             BreadcrumbItem { item_key: "2".to_string(), "Library" }
///             BreadcrumbItem { item_key: "3".to_string(), "Book" }
///         }
///     }
/// }
/// ```
///
/// # Styling
/// The component uses CSS custom properties for theming:
/// - `--hi-text-primary`: Current page text color
/// - `--hi-text-secondary`: Clickable item color
/// - `--hi-primary-600`: Hover state color
///
/// # Size Variants
/// - **Default**: 14px font
/// - **Small** (`.hi-breadcrumb-sm`): 12px font
/// - **Large** (`.hi-breadcrumb-lg`): 16px font
#[component]
pub fn Breadcrumb(props: BreadcrumbProps) -> Element {
    let classes = ClassesBuilder::new()
        .add(BreadcrumbClass::Breadcrumb)
        .add_raw(&props.class)
        .build();

    rsx! {
        nav {
            class: "{classes}",
            "aria-label": "Breadcrumb",

            ol {
                class: "hi-breadcrumb-list",

                { props.children }
            }
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

/// Breadcrumb item component
#[component]
pub fn BreadcrumbItem(props: BreadcrumbItemProps) -> Element {
    let classes = ClassesBuilder::new()
        .add(BreadcrumbClass::BreadcrumbItem)
        .add_raw(&props.class)
        .build();

    rsx! {
        li {
            class: "{classes}",

            if props.href.is_some() || props.onclick.is_some() {
                {
                    if let Some(href) = props.href {
                        rsx! {
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
                        }
                    } else {
                        rsx! {
                            span {
                                class: "hi-breadcrumb-link",
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
                    class: "hi-breadcrumb-separator",
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
             class: "hi-breadcrumb-separator",
             if separator.is_empty() {
                 // Default chevron-right icon
                 svg {
                     xmlns: "http://www.w3.org/2000/svg",
                     view_box: "0 0 24 24",
                     fill: "none",
                     stroke: "currentColor",
                     "stroke-width": "0",
                     "stroke-linecap": "round",
                     "stroke-linejoin": "round",
                     path {
                         d: "M9 18l6-6-6-6"
                     }
                 }
             } else {
                 span {
                     class: "hi-breadcrumb-separator-icon",
                     "{separator}"
                 }
             }
         }
    }
}
