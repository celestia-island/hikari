// hikari-components/src/layout/aside.rs
//! Aside component - Modern sidebar navigation panel
//!
//! Inspired by Element Plus and Material Navigation Drawer designs.
//!
//! # Example
//!
//! ```rust
//! use hikari_components::layout::Aside;
//! use crate::prelude::*;
//!
//! rsx! {
//!     Aside {
//!         header: rsx! {
//!             h2 { "Menu" }
//!         },
//!         nav {
//!             a { "Link 1" }
//!             a { "Link 2" }
//!         },
//!         footer: rsx! {
//!             Footer { "Settings" }
//!         }
//!     }
//! }
//! ```

use crate::prelude::*;
use hikari_palette::{ClassesBuilder, UtilityClass, classes::components::*};

use crate::theme::use_layout_direction;

///
///
#[component]
pub fn Aside(
    children: Element,

    #[props(optional)]
    header: Option<Element>,

    #[props(optional)]
    footer: Option<Element>,

    #[props(default = "md".to_string())]
    width: String,

    #[props(default = "white".to_string())]
    variant: String,

    #[props(default = true)]
    collapsible: bool,

    #[props(default = false)]
    initial_open: bool,

    #[props(default)]
    rtl: Option<bool>,

    on_close: EventHandler,

    #[props(default)]
    class: String,
) -> Element {
    let is_open = use_signal(|| initial_open);
    let layout_direction = use_layout_direction();
    let is_rtl = rtl.unwrap_or_else(|| layout_direction.is_rtl());

    let width_class = match width.as_str() {
        "sm" => AsideClass::Sm,
        "lg" => AsideClass::Lg,
        _ => AsideClass::Md,
    };

    let variant_class = match variant.as_str() {
        "light" => AsideClass::Light,
        _ => AsideClass::Dark,
    };

    let mut builder = ClassesBuilder::new()
        .add(AsideClass::Aside)
        .add(AsideClass::Drawer)
        .add(width_class)
        .add(variant_class);

    if is_rtl {
        builder = builder.add_raw("hi-aside-rtl");
    }

    if *is_open.read() {
        builder = builder.add(AsideClass::DrawerOpen);
    }

    let classes = builder.add_raw(&class).build();
    let content_class = AsideClass::Content.as_class();
    let header_class = "hi-layout-aside-header".to_string();
    let footer_class = "hi-layout-aside-footer".to_string();

    rsx! {
        aside {
            class: "{classes}",

            if let Some(header_content) = header {
                div { class: "{header_class}", {header_content} }
            }

            div {
                class: "{content_class}",
                { children }
            }

            if let Some(footer_content) = footer {
                div { class: "{footer_class}", {footer_content} }
            }
        }
    }
}
