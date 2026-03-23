// hikari-components/src/layout/header.rs
//! Header component - Modern application header bar
//!
//! Inspired by Element Plus and Material App Bar designs.
//!
//! # Example
//!
//! ```rust
//! use hikari_components::layout::Header;
//! use crate::prelude::*;
//!
//! rsx! {
//!     Header {
//!         h1 { "My Application" }
//!     }
//! }
//! ```

use crate::prelude::*;
use hikari_palette::{ClassesBuilder, classes::*};

use crate::theme::use_layout_direction;

///
///
#[component]
pub fn Header(
    children: Element,

    #[props(default = true)]
    bordered: bool,

    #[props(default = false)]
    show_menu_toggle: bool,

    on_menu_toggle: Option<EventHandler<MouseEvent>>,

    #[props(default)]
    rtl: Option<bool>,

    #[props(default)]
    class: String,

    #[props(default)]
    right_content: Option<Element>,
) -> Element {
    let layout_direction = use_layout_direction();
    let is_rtl = rtl.unwrap_or_else(|| layout_direction.is_rtl());

    let content_classes = ClassesBuilder::new()
        .add(Display::Flex)
        .add(AlignItems::Center)
        .add(Gap::Gap3)
        .add(MinWidth::MinW0)
        .add(Flex::Shrink0)
        .build();

    let mut header_builder = ClassesBuilder::new()
        .add(components::Header::Header)
        .add(components::Header::Sticky)
        .add(components::Header::Md)
        .add_if(components::Header::Transparent, || !bordered)
        .add_raw(&class);

    if is_rtl {
        header_builder = header_builder.add_raw("hi-header-rtl");
    }

    let header_classes = header_builder.build();

    let (left_class, right_class) = if is_rtl {
        ("hi-header-right", "hi-header-left")
    } else {
        ("hi-header-left", "hi-header-right")
    };

    rsx! {
        header {
            class: header_classes,

            div {
                class: left_class,

                if show_menu_toggle {
                    button {
                        class: "hi-header-toggle",
                        onclick: move |e| {
                            if let Some(handler) = &on_menu_toggle {
                                handler.call(e);
                            }
                        },
                        "aria-label": "Toggle menu",

                        svg {
                            xmlns: "http://www.w3.org/2000/svg",
                            fill: "none",
                            view_box: "0 0 24 24",
                            stroke: "currentColor",
                            stroke_width: "2",
                            stroke_linecap: "round",
                            stroke_linejoin: "round",
                            path { d: "M4 6h16M4 12h16M4 18h16" }
                        }
                    }
                }

                div {
                    class: content_classes,
                    { children }
                }
            }

            if let Some(right) = right_content {
                div {
                    class: right_class,
                    { right }
                }
            }
        }
    }
}

pub struct HeaderComponent;

impl crate::styled::StyledComponent for HeaderComponent {
    fn styles() -> &'static str {
        r#"
.hi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  height: 64px;
  min-height: 64px;
  padding: 0 1rem;
  margin: 0;
  border-radius: 0;
  background: var(--hi-surface);
  backdrop-filter: blur(4px);
  border-bottom: 1px solid var(--hi-border);
  box-shadow: 0 1px 3px var(--hi-black-10, rgba(0, 0, 0, 0.05));
  position: relative;
}

.hi-header-sticky {
  position: sticky;
  top: 0;
  z-index: 100;
}

.hi-header-transparent {
  background: transparent;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  box-shadow: none;
  border-bottom: 1px solid transparent;
}

.hi-header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 0 1 auto;
  min-width: 0;
}

.hi-header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  justify-content: flex-end;
}

.hi-header-toggle {
  display: none;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .hi-header-toggle {
    display: inline-flex;
  }

  .hi-header {
    padding: 0 0.75rem;
  }
}

@media (min-width: 768px) {
  .hi-header {
    padding: 0 1rem;
  }
}

@media (min-width: 1024px) {
  .hi-header {
    padding: 0 1rem;
  }
}
"#
    }

    fn name() -> &'static str {
        "header"
    }
}
