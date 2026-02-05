// hi-components/src/feedback/drawer.rs
// Drawer component with Arknights + FUI styling

use animation::style::{CssProperty, StyleStringBuilder};
use dioxus::prelude::*;
use palette::classes::ClassesBuilder;

use crate::styled::StyledComponent;

/// Drawer placement
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DrawerPlacement {
    #[default]
    Right,
    Left,
    Top,
    Bottom,
}

/// Drawer size variants
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DrawerSize {
    #[default]
    Medium,
    Small,
    Large,
}

#[derive(Clone, PartialEq, Props)]
pub struct DrawerProps {
    /// Whether the drawer is open
    pub open: bool,

    /// Callback when open state changes
    #[props(default)]
    pub on_close: Option<EventHandler<MouseEvent>>,

    /// Drawer placement
    #[props(default)]
    pub placement: DrawerPlacement,

    /// Drawer size
    #[props(default)]
    pub size: DrawerSize,

    /// Whether clicking outside closes the drawer
    #[props(default)]
    pub mask_closable: bool,

    /// Drawer title (optional)
    #[props(default)]
    pub title: Option<String>,

    /// Drawer footer content (optional)
    #[props(default)]
    pub footer: Option<Element>,

    /// Additional CSS class
    #[props(default)]
    pub class: String,

    /// Drawer content
    pub children: Element,
}

impl Default for DrawerProps {
    fn default() -> Self {
        Self {
            open: false,
            on_close: None,
            placement: Default::default(),
            size: Default::default(),
            mask_closable: true,
            title: None,
            footer: None,
            class: String::default(),
            children: VNode::empty(),
        }
    }
}

/// Drawer component with slide-in animation
///
/// A drawer panel that slides in from the edge of the screen.
/// Commonly used for settings, forms, or detailed content.
///
/// # Examples
///
/// ## Basic Usage
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Drawer, Button};
///
/// fn app() -> Element {
///     let mut open = use_signal(|| false);
///
///     rsx! {
///         Button {
///             onclick: move |_| open.set(true),
///             "Open Drawer"
///         }
///         Drawer {
///             open: open(),
///             on_close: move |_| open.set(false),
///             title: Some("Settings".to_string()),
///             div { "Drawer content goes here" }
///         }
///     }
/// }
/// ```
#[component]
pub fn Drawer(props: DrawerProps) -> Element {
    let on_close = props.on_close;
    let mask_closable = props.mask_closable;

    let handle_mask_click = move |e: MouseEvent| {
        if mask_closable && let Some(handler) = on_close.as_ref() {
            handler.call(e);
        }
    };

    let (placement_class, _size_width, _size_height) = match (props.placement, props.size) {
        (DrawerPlacement::Right, DrawerSize::Small) => ("hi-drawer-right", "300px", "100%"),
        (DrawerPlacement::Right, DrawerSize::Medium) => ("hi-drawer-right", "500px", "100%"),
        (DrawerPlacement::Right, DrawerSize::Large) => ("hi-drawer-right", "700px", "100%"),
        (DrawerPlacement::Left, DrawerSize::Small) => ("hi-drawer-left", "300px", "100%"),
        (DrawerPlacement::Left, DrawerSize::Medium) => ("hi-drawer-left", "500px", "100%"),
        (DrawerPlacement::Left, DrawerSize::Large) => ("hi-drawer-left", "700px", "100%"),
        (DrawerPlacement::Top, DrawerSize::Small) => ("hi-drawer-top", "100%", "300px"),
        (DrawerPlacement::Top, DrawerSize::Medium) => ("hi-drawer-top", "100%", "500px"),
        (DrawerPlacement::Top, DrawerSize::Large) => ("hi-drawer-top", "100%", "700px"),
        (DrawerPlacement::Bottom, DrawerSize::Small) => ("hi-drawer-bottom", "100%", "300px"),
        (DrawerPlacement::Bottom, DrawerSize::Medium) => ("hi-drawer-bottom", "100%", "500px"),
        (DrawerPlacement::Bottom, DrawerSize::Large) => ("hi-drawer-bottom", "100%", "700px"),
    };

    let drawer_style = use_memo(move || {
        if props.open {
            StyleStringBuilder::new()
                .add(CssProperty::Display, "block")
                .add(CssProperty::Opacity, "1")
                .build_clean()
        } else {
            StyleStringBuilder::new()
                .add(CssProperty::Display, "none")
                .add(CssProperty::Opacity, "0")
                .build_clean()
        }
    });

    let mask_style = use_memo(move || {
        if props.open {
            StyleStringBuilder::new()
                .add(CssProperty::Opacity, "1")
                .build_clean()
        } else {
            StyleStringBuilder::new()
                .add(CssProperty::Opacity, "0")
                .build_clean()
        }
    });

    let drawer_classes = ClassesBuilder::new()
        .add_raw("hi-drawer")
        .add_raw(placement_class)
        .add_raw(&props.class)
        .build();

    rsx! {
        if props.open {
            // Mask overlay
            div {
                class: "hi-drawer-mask",
                style: "{mask_style}",
                onclick: handle_mask_click,
            }

            // Drawer panel
            div {
                class: "{drawer_classes}",
                style: "{drawer_style}",

                // Header
                if let Some(title) = props.title {
                    div { class: "hi-drawer-header",
                        div { class: "hi-drawer-title", "{title}" }
                        button {
                            class: "hi-drawer-close",
                            onclick: move |e| {
                                if let Some(handler) = on_close.as_ref() {
                                    handler.call(e);
                                }
                            },
                            svg {
                                view_box: "0 0 24 24",
                                fill: "none",
                                stroke: "currentColor",
                                stroke_width: "2",
                                line { x1: "18", y1: "6", x2: "6", y2: "18" }
                                line { x1: "6", y1: "6", x2: "18", y2: "18" }
                            }
                        }
                    }
                }

                // Body
                div { class: "hi-drawer-body",
                    { props.children }
                }

                // Footer
                if let Some(footer) = props.footer {
                    div { class: "hi-drawer-footer",
                        { footer }
                    }
                }
            }
        }
    }
}

/// Drawer component's type wrapper for StyledComponent
pub struct DrawerComponent;

impl StyledComponent for DrawerComponent {
    fn styles() -> &'static str {
        r#"
.hi-drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  animation: hi-drawer-mask-fade-in 0.2s ease-out;
}

@keyframes hi-drawer-mask-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.hi-drawer {
  position: fixed;
  z-index: 1001;
  background: var(--hi-background);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  animation: hi-drawer-slide-in 0.3s cubic-bezier(0.23, 1, 0.32, 1);
}

[data-theme="dark"] .hi-drawer {
  background: var(--hi-surface);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.hi-drawer-right {
  top: 0;
  right: 0;
  height: 100vh;
  border-left: 1px solid var(--hi-border);
}

.hi-drawer-left {
  top: 0;
  left: 0;
  height: 100vh;
  border-right: 1px solid var(--hi-border);
}

.hi-drawer-top {
  top: 0;
  left: 0;
  width: 100vw;
  border-bottom: 1px solid var(--hi-border);
}

.hi-drawer-bottom {
  bottom: 0;
  left: 0;
  width: 100vw;
  border-top: 1px solid var(--hi-border);
}

@keyframes hi-drawer-slide-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.hi-drawer-left {
  animation-name: hi-drawer-slide-in-left;
}

@keyframes hi-drawer-slide-in-left {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

.hi-drawer-top {
  animation-name: hi-drawer-slide-in-top;
}

@keyframes hi-drawer-slide-in-top {
  from {
    transform: translateY(-100%);
  }
  to {
    transform: translateY(0);
  }
}

.hi-drawer-bottom {
  animation-name: hi-drawer-slide-in-bottom;
}

@keyframes hi-drawer-slide-in-bottom {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.hi-drawer-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--hi-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hi-drawer-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--hi-text-primary);
}

.hi-drawer-close {
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--hi-text-secondary);
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hi-drawer-close:hover {
  background: var(--hi-color-hover);
  color: var(--hi-text-primary);
}

.hi-drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  color: var(--hi-text-primary);
}

.hi-drawer-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--hi-border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.hi-drawer-body::-webkit-scrollbar {
  width: 6px;
}

.hi-drawer-body::-webkit-scrollbar-track {
  background: transparent;
}

.hi-drawer-body::-webkit-scrollbar-thumb {
  background: var(--hi-border);
  border-radius: 3px;
}

.hi-drawer-body::-webkit-scrollbar-thumb:hover {
  background: var(--hi-color-border);
}
"#
    }

    fn name() -> &'static str {
        "drawer"
    }
}
