// hi-components/src/feedback/dropdown.rs
// Dropdown component with Arknights + FUI styling

use animation::style::{CssProperty, StyleStringBuilder};
use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, Display, Position};

use crate::styled::StyledComponent;

/// Dropdown component types
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DropdownPosition {
    #[default]
    BottomLeft,
    BottomRight,
    TopLeft,
    TopRight,
}

#[derive(Clone, PartialEq, Props)]
pub struct DropdownProps {
    /// The trigger element (button, etc.)
    pub trigger: Element,

    /// Dropdown content (typically Menu with MenuItems)
    pub children: Element,

    /// Whether the dropdown is open
    #[props(default)]
    pub open: bool,

    /// Callback when open state changes
    pub on_open_change: Option<Callback<bool>>,

    /// Position of the dropdown menu
    #[props(default)]
    pub position: DropdownPosition,

    /// Whether clicking outside closes the dropdown
    #[props(default)]
    pub close_on_click_outside: bool,

    /// Whether clicking an item closes the dropdown
    #[props(default)]
    pub close_on_select: bool,

    /// Additional CSS class
    #[props(default)]
    pub class: String,

    /// Additional CSS class for the dropdown menu
    #[props(default)]
    pub menu_class: String,
}

impl Default for DropdownProps {
    fn default() -> Self {
        Self {
            trigger: VNode::empty(),
            children: VNode::empty(),
            open: false,
            on_open_change: None,
            position: Default::default(),
            close_on_click_outside: true,
            close_on_select: true,
            class: String::default(),
            menu_class: String::default(),
        }
    }
}

/// Dropdown component with keyboard navigation and positioning
///
/// A flexible dropdown that works with any trigger element and supports
/// Menu/MenuItem components for content.
///
/// # Examples
///
/// ## Basic Usage
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Dropdown, Menu, MenuItem, Button};
///
/// fn app() -> Element {
///     rsx! {
///         Dropdown {
///             trigger: rsx! {
///                 Button { "Click me" }
///             },
///             Menu {
///                 MenuItem { item_key: "1".to_string(), "Option 1" }
///                 MenuItem { item_key: "2".to_string(), "Option 2" }
///                 MenuItem { item_key: "3".to_string(), "Option 3" }
///             }
///         }
///     }
/// }
/// ```
#[component]
pub fn Dropdown(props: DropdownProps) -> Element {
    let mut open = use_signal(|| props.open);

    let _handle_click_outside = move |_e: MouseEvent| {
        if props.close_on_click_outside {
            open.set(false);
            if let Some(handler) = props.on_open_change.as_ref() {
                handler.call(false);
            }
        }
    };

    let handle_trigger_click = move |_e: MouseEvent| {
        let new_state = !open();
        open.set(new_state);
        if let Some(handler) = props.on_open_change.as_ref() {
            handler.call(new_state);
        }
    };

    let _handle_select = move |_key: String| {
        if props.close_on_select {
            open.set(false);
            if let Some(handler) = props.on_open_change.as_ref() {
                handler.call(false);
            }
        }
    };

    let position_style = match props.position {
        DropdownPosition::BottomLeft => StyleStringBuilder::new()
            .add(CssProperty::Top, "100%")
            .add(CssProperty::Left, "0")
            .build_clean(),
        DropdownPosition::BottomRight => StyleStringBuilder::new()
            .add(CssProperty::Top, "100%")
            .add(CssProperty::Right, "0")
            .build_clean(),
        DropdownPosition::TopLeft => StyleStringBuilder::new()
            .add(CssProperty::Bottom, "100%")
            .add(CssProperty::Left, "0")
            .build_clean(),
        DropdownPosition::TopRight => StyleStringBuilder::new()
            .add(CssProperty::Bottom, "100%")
            .add(CssProperty::Right, "0")
            .build_clean(),
    };

    let container_classes = ClassesBuilder::new()
        .add(Position::Relative)
        .add(Display::InlineBlock)
        .add_raw(&props.class)
        .build();

    let dropdown_classes = ClassesBuilder::new()
        .add_raw("hi-dropdown")
        .add_raw(&props.menu_class)
        .build();

    let dropdown_style = use_memo(move || {
        if open() {
            StyleStringBuilder::new()
                .add(CssProperty::Display, "block")
                .add_raw(&position_style)
                .build_clean()
        } else {
            StyleStringBuilder::new()
                .add(CssProperty::Display, "none")
                .add_raw(&position_style)
                .build_clean()
        }
    });

    rsx! {
        div {
            class: "{container_classes}",

            div {
                onclick: handle_trigger_click,
                { props.trigger }
            }

            if open() {
                div {
                    class: "{dropdown_classes}",
                    style: "{dropdown_style}",
                    onclick: |e: MouseEvent| {
                        e.stop_propagation();
                    },
                    onmousedown: |e: MouseEvent| {
                        e.stop_propagation();
                    },

                    { props.children }
                }
            }
        }
    }
}

/// Dropdown component's type wrapper for StyledComponent
pub struct DropdownComponent;

impl StyledComponent for DropdownComponent {
    fn styles() -> &'static str {
        r#"
.hi-dropdown {
  position: absolute;
  z-index: 1000;
  min-width: 160px;
  background: var(--hi-background);
  border: 1px solid var(--hi-border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  padding: 4px 0;
  animation: hi-dropdown-fade-in 0.2s ease-out;
}

@keyframes hi-dropdown-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

[data-theme="dark"] .hi-dropdown {
  background: var(--hi-surface);
  border-color: var(--hi-border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.hi-dropdown .hi-menu {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.hi-dropdown .hi-menu-item {
  padding: 8px 12px;
  margin: 0;
  border-radius: 4px;
}

.hi-dropdown .hi-menu-item:hover {
  background: var(--hi-primary-50);
}

[data-theme="dark"] .hi-dropdown .hi-menu-item:hover {
  background: var(--hi-primary-900);
}
"#
    }

    fn name() -> &'static str {
        "dropdown"
    }
}
