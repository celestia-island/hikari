// hi-components/src/feedback/popover.rs
// Popover component with Arknights + FUI styling

use animation::style::{CssProperty, StyleStringBuilder};
use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, Display, PopoverClass, Position, UtilityClass};

use crate::styled::StyledComponent;

/// Popover position types
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum PopoverPosition {
    #[default]
    Top,
    TopLeft,
    TopRight,
    Bottom,
    BottomLeft,
    BottomRight,
    Left,
    LeftTop,
    LeftBottom,
    Right,
    RightTop,
    RightBottom,
}

#[derive(Clone, PartialEq, Props)]
pub struct PopoverProps {
    /// The trigger element (button, text, etc.)
    pub trigger: Element,

    /// Popover content
    pub children: Element,

    /// Whether the popover is open
    #[props(default)]
    pub open: bool,

    /// Callback when open state changes
    pub on_open_change: Option<Callback<bool>>,

    /// Position of the popover
    #[props(default)]
    pub position: PopoverPosition,

    /// Whether clicking outside closes the popover
    #[props(default)]
    pub close_on_click_outside: bool,

    /// Popover title (optional)
    #[props(default)]
    pub title: Option<String>,

    /// Popover width (default: auto)
    #[props(default)]
    pub width: Option<String>,

    /// Additional CSS class for popover
    #[props(default)]
    pub class: String,
}

impl Default for PopoverProps {
    fn default() -> Self {
        Self {
            trigger: VNode::empty(),
            children: VNode::empty(),
            open: false,
            on_open_change: None,
            position: Default::default(),
            close_on_click_outside: true,
            title: None,
            width: None,
            class: String::default(),
        }
    }
}

/// Popover component with flexible positioning and content
///
/// A flexible popover that can display any content with proper positioning.
/// Similar to Dropdown but more flexible for displaying rich content.
///
/// # Examples
///
/// ## Basic Usage
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Popover, Button, Card};
///
/// fn app() -> Element {
///     rsx! {
///         Popover {
///             trigger: rsx! {
///                 Button { "Hover me" }
///             },
///             position: PopoverPosition::Top,
///             Card {
///                 div { "This is popover content" }
///             }
///         }
///     }
/// }
/// ```
#[component]
pub fn Popover(props: PopoverProps) -> Element {
    let mut open = use_signal(|| props.open);

    let handle_trigger_click = move |_e: MouseEvent| {
        let new_state = !open();
        open.set(new_state);
        if let Some(handler) = props.on_open_change.as_ref() {
            handler.call(new_state);
        }
    };

    let position_style = match props.position {
        PopoverPosition::Top => StyleStringBuilder::new()
            .add(CssProperty::Bottom, "100%")
            .add(CssProperty::Left, "50%")
            .add(CssProperty::Transform, "translateX(-50%)")
            .build_clean(),
        PopoverPosition::TopLeft => StyleStringBuilder::new()
            .add(CssProperty::Bottom, "100%")
            .add(CssProperty::Left, "0")
            .build_clean(),
        PopoverPosition::TopRight => StyleStringBuilder::new()
            .add(CssProperty::Bottom, "100%")
            .add(CssProperty::Right, "0")
            .build_clean(),
        PopoverPosition::Bottom => StyleStringBuilder::new()
            .add(CssProperty::Top, "100%")
            .add(CssProperty::Left, "50%")
            .add(CssProperty::Transform, "translateX(-50%)")
            .build_clean(),
        PopoverPosition::BottomLeft => StyleStringBuilder::new()
            .add(CssProperty::Top, "100%")
            .add(CssProperty::Left, "0")
            .build_clean(),
        PopoverPosition::BottomRight => StyleStringBuilder::new()
            .add(CssProperty::Top, "100%")
            .add(CssProperty::Right, "0")
            .build_clean(),
        PopoverPosition::Left => StyleStringBuilder::new()
            .add(CssProperty::Right, "100%")
            .add(CssProperty::Top, "50%")
            .add(CssProperty::Transform, "translateY(-50%)")
            .build_clean(),
        PopoverPosition::LeftTop => StyleStringBuilder::new()
            .add(CssProperty::Right, "100%")
            .add(CssProperty::Top, "0")
            .build_clean(),
        PopoverPosition::LeftBottom => StyleStringBuilder::new()
            .add(CssProperty::Right, "100%")
            .add(CssProperty::Bottom, "0")
            .build_clean(),
        PopoverPosition::Right => StyleStringBuilder::new()
            .add(CssProperty::Left, "100%")
            .add(CssProperty::Top, "50%")
            .add(CssProperty::Transform, "translateY(-50%)")
            .build_clean(),
        PopoverPosition::RightTop => StyleStringBuilder::new()
            .add(CssProperty::Left, "100%")
            .add(CssProperty::Top, "0")
            .build_clean(),
        PopoverPosition::RightBottom => StyleStringBuilder::new()
            .add(CssProperty::Left, "100%")
            .add(CssProperty::Bottom, "0")
            .build_clean(),
    };

    let popover_style = use_memo(move || {
        let width = props.width.as_deref().unwrap_or("auto");
        if open() {
            StyleStringBuilder::new()
                .add(CssProperty::Display, "block")
                .add(CssProperty::Width, width)
                .add_raw(&position_style)
                .build_clean()
        } else {
            StyleStringBuilder::new()
                .add(CssProperty::Display, "none")
                .add(CssProperty::Width, width)
                .add_raw(&position_style)
                .build_clean()
        }
    });

    let container_classes = ClassesBuilder::new()
        .add(Position::Relative)
        .add(Display::InlineBlock)
        .add_raw(&props.class)
        .build();

    let popover_classes = ClassesBuilder::new().add(PopoverClass::Popover).build();

    rsx! {
        div {
            class: "{container_classes}",

            div {
                onclick: handle_trigger_click,
                { props.trigger }
            }

            if open() {
                div {
                    class: "{popover_classes}",
                    style: "{popover_style}",
                    onclick: |e: MouseEvent| {
                        e.stop_propagation();
                    },

                    if let Some(title) = props.title {
                        div { class: "{PopoverClass::Title.as_class()}", "{title}" }
                    }

                    div { class: "{PopoverClass::Content.as_class()}",
                        { props.children }
                    }
                }
            }
        }
    }
}

/// Popover component's type wrapper for StyledComponent
pub struct PopoverComponent;

impl StyledComponent for PopoverComponent {
    fn styles() -> &'static str {
        r#"
.hi-popover {
  position: absolute;
  z-index: 1050;
  background: var(--hi-background);
  border: 1px solid var(--hi-border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  padding: 16px;
  min-width: 200px;
  max-width: 500px;
  animation: hi-popover-fade-in 0.2s ease-out;
}

@keyframes hi-popover-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

[data-theme="dark"] .hi-popover {
  background: var(--hi-surface);
  border-color: var(--hi-border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.hi-popover-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--hi-text-primary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--hi-border);
}

.hi-popover-content {
  font-size: 14px;
  color: var(--hi-text-primary);
  line-height: 1.6;
}
"#
    }

    fn name() -> &'static str {
        "popover"
    }
}
