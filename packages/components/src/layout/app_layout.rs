// hikari-components/src/layout/app_layout.rs
//! Layout component - Modern application layout wrapper
//!
//! Inspired by Material UI and Element Plus design systems.
//!
//! # Example
//!
//! ```rust
//! use hikari_components::layout::{Layout, Header, Aside};
//! use crate::prelude::*;
//!
//! rsx! {
//!     Layout {
//!         header: rsx! {
//!             Header {
//!                 h1 { "My App" }
//!             }
//!         },
//!         aside: rsx! {
//!             Aside {
//!                 nav {
//!                     a { "Link 1" }
//!                     a { "Link 2" }
//!                 }
//!             }
//!         },
//!         footer: rsx! {
//!             Footer {
//!                 "© 2026 Hikari UI"
//!             }
//!         },
//!         h1 { "Main content" }
//!     }
//! }
//! ```

use hikari_palette::classes::{TypedClass, 
    AppLayoutClass, ClassesBuilder, components::Layout as LayoutClass,
};

use crate::{basic::Background, prelude::*};

///
///
#[component]
pub fn Layout(
    #[props(optional)] header: Option<Element>,

    #[props(optional)] aside: Option<Element>,

    #[props(optional)] footer: Option<Element>,

    children: Element,

    #[props(default = true)] glassmorphism: bool,

    #[props(default = "var(--hi-background, #f8fafc)".to_string())] background_color: String,

    #[props(default)] class: String,
) -> Element {
    let mut is_drawer_open = use_signal(|| false);

    let layout_classes = ClassesBuilder::new()
        .add_typed(LayoutClass::Layout)
        .add_typed(LayoutClass::Light)
        .add_typed_if(LayoutClass::HasSidebar, aside.is_some())
        .add(&class)
        .build();

    let overlay_classes = ClassesBuilder::new()
        .add_typed_if(LayoutClass::OverlayOpen, is_drawer_open.read())
        .build();

    rsx! {
        // Global gradient background (fixed, behind everything)
        Background {}

        div { class: layout_classes,

            // Header (if provided) - full width at top
            if let Some(header_content) = header {
                {header_content}
            }

            // Body container with Aside and Main
            div { class: AppLayoutClass::Body.class_name(),

                // Mobile overlay (backdrop) with blur effect
                if aside.is_some() {
                    div {
                        class: overlay_classes,
                        onclick: move |_| is_drawer_open.set(false),
                    }
                }

                // Sidebar (if provided)
                if let Some(ref aside_content) = aside {
                    {aside_content.clone()}
                }

                // Main content area
                div { class: AppLayoutClass::Main.class_name(),

                    // Main content with refined scroll
                    main { class: AppLayoutClass::Content.class_name(), {children} }
                }
            }

            // Footer (if provided) - full width at bottom
            if let Some(footer_content) = footer {
                {footer_content}
            }
        }
    }
}

pub struct LayoutComponent;

impl crate::styled::StyledComponent for LayoutComponent {
    fn styles() -> &'static str {
        r#"
.hi-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  background: transparent;
  overflow: hidden;
}

.hi-layout-body {
  flex: 1;
  display: flex;
  flex-direction: row;
  height: calc(100vh - 60px);
  overflow: hidden;
  position: relative;
}

.hi-layout-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.hi-layout-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
  background: transparent;
}

.hi-layout-light {
  background-color: transparent;
}

.hi-layout-has-sidebar {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.hi-layout-has-sidebar .hi-layout-body > aside,
.hi-layout-has-sidebar .hi-layout-body > .hi-aside {
  width: 260px;
  flex-shrink: 0;
  height: 100%;
}

.hi-layout-has-sidebar .hi-layout-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.hi-layout-overlay-open {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(23, 89, 168, 0.3);
  backdrop-filter: blur(4px);
  z-index: 199;
  opacity: 1;
  pointer-events: auto;
}

@media print {
  .hi-layout {
    background: white;
  }

  .hi-layout-header,
  .hi-layout-footer,
  .hi-layout-aside {
    display: none;
  }

  .hi-layout-content {
    background: white;
    box-shadow: none;
  }
}
"#
    }

    fn name() -> &'static str {
        "app_layout"
    }
}
