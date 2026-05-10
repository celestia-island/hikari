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

use hikari_palette::{classes::components::*, ClassesBuilder, TypedClass};

use crate::{prelude::*, theme::use_layout_direction};

///
///
#[component]
pub fn Aside(
    children: Element,

    #[props(optional)] header: Option<Element>,

    #[props(optional)] footer: Option<Element>,

    #[props(default = "md".to_string())] width: String,

    #[props(default = "white".to_string())] variant: String,

    #[props(default = true)] collapsible: bool,

    #[props(default = false)] initial_open: bool,

    #[props(default)] rtl: Option<bool>,

    #[props(default)] on_close: Option<EventHandler<MouseEvent>>,

    #[props(default)] class: String,
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
        .add_typed(AsideClass::Aside)
        .add_typed(AsideClass::Drawer)
        .add_typed(width_class)
        .add_typed(variant_class);

    if is_rtl {
        builder = builder.add_typed(AsideClass::Rtl);
    }

    if is_open.read() {
        builder = builder.add_typed(AsideClass::DrawerOpen);
    }

    let classes = builder.add(&class).build();
    let content_class = AsideClass::Content.class_name();
    let header_class = "hi-layout-aside-header".to_string();
    let footer_class = "hi-layout-aside-footer".to_string();

    rsx! {
        aside { class: classes,

            if let Some(header_content) = header {
                div { class: header_class, {header_content} }
            }

            div { class: content_class, {children} }

            if let Some(footer_content) = footer {
                div { class: footer_class, {footer_content} }
            }
        }
    }
}

pub struct AsideComponent;

impl crate::styled::StyledComponent for AsideComponent {
    fn styles() -> &'static str {
        r#"
.hi-aside {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: transparent;
  border-right: 1px solid var(--hi-color-border);
  overflow: hidden;
  position: relative;
  padding: 0;
}

.hi-aside-sm {
  width: 200px;
}

.hi-aside-md {
  width: 260px;
}

.hi-aside-lg {
  width: 320px;
}

.hi-aside-light {
  background: var(--hi-surface);
}

.hi-aside-dark {
  background: var(--hi-card-bg);
}

.hi-aside-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 0 0 0.5rem;
  scroll-behavior: smooth;
  position: relative;
}

.hi-aside-rtl {
  direction: rtl;
}

@media print {
  .hi-aside {
    display: none;
  }
}
"#
    }

    fn name() -> &'static str {
        "aside"
    }
}
