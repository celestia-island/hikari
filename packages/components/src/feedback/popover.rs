// hi-components/src/feedback/popover.rs
// Popover component with smart positioning via Portal system

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, Display, Position};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

use crate::portal::{generate_portal_id, use_portal, PortalEntry};
use crate::styled::StyledComponent;

/// Popover placement direction
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum PopoverPlacement {
    #[default]
    Bottom,
    Top,
    Left,
    Right,
}

/// Absolute positioning options
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum PopoverAbsolutePosition {
    /// Center of screen
    Center,
    /// Fixed coordinates
    Fixed { x: f64, y: f64 },
}

/// Positioning mode for Popover
#[derive(Clone, PartialEq, Debug)]
pub enum PopoverPositioning {
    /// Relative positioning with automatic collision detection
    /// The popover will try preferred placements in order, falling back to other directions if collision occurs
    Relative {
        /// Preferred placement order (default: [Bottom, Top, Left, Right])
        /// Collision detection still applies - if preferred direction has collision, tries next
        preferred: Vec<PopoverPlacement>,
    },
    /// Absolute positioning - fixed position without collision detection
    Absolute(PopoverAbsolutePosition),
}

impl Default for PopoverPositioning {
    fn default() -> Self {
        PopoverPositioning::default_relative()
    }
}

impl PopoverPositioning {
    pub fn default_relative() -> Self {
        PopoverPositioning::Relative {
            preferred: vec![
                PopoverPlacement::Bottom,
                PopoverPlacement::Top,
                PopoverPlacement::Left,
                PopoverPlacement::Right,
            ],
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct PopoverProps {
    pub trigger: Element,
    pub children: Element,
    #[props(default)]
    pub open: bool,
    pub on_open_change: Option<Callback<bool>>,
    #[props(default)]
    pub positioning: PopoverPositioning,
    #[props(default = true)]
    pub close_on_click_outside: bool,
    #[props(default = true)]
    pub close_on_select: bool,
    #[props(default)]
    pub title: Option<String>,
    #[props(default)]
    pub width: Option<String>,
    #[props(default)]
    pub class: String,
    #[props(default)]
    pub offset: f64,
}

impl Default for PopoverProps {
    fn default() -> Self {
        Self {
            trigger: VNode::empty(),
            children: VNode::empty(),
            open: false,
            on_open_change: None,
            positioning: PopoverPositioning::default_relative(),
            close_on_click_outside: true,
            close_on_select: true,
            title: None,
            width: None,
            class: String::default(),
            offset: 8.0,
        }
    }
}

#[component]
pub fn Popover(props: PopoverProps) -> Element {
    let mut open = use_signal(|| props.open);
    let mut popover_id = use_signal(|| String::new());
    let mut trigger_rect = use_signal(|| None::<(f64, f64, f64, f64)>);
    let mut close_requested = use_signal(|| false);

    let portal = use_portal();
    let positioning = props.positioning.clone();

    let preferred_placements = match &positioning {
        PopoverPositioning::Relative { preferred } => preferred.clone(),
        PopoverPositioning::Absolute(_) => vec![PopoverPlacement::Bottom],
    };

    let on_open_change = props.on_open_change.clone();
    let on_open_change_for_close = props.on_open_change.clone();

    let on_close = Callback::new(move |_| {
        open.set(false);
        if let Some(handler) = on_open_change_for_close.as_ref() {
            handler.call(false);
        }
    });

    let handle_trigger_click = move |e: MouseEvent| {
        e.stop_propagation();

        let new_state = !open();
        open.set(new_state);

        if new_state {
            let id = generate_portal_id();
            popover_id.set(id.clone());
            close_requested.set(false);

            #[cfg(target_arch = "wasm32")]
            {
                if let Some(web_event) = e.downcast::<web_sys::MouseEvent>() {
                    if let Some(target) = web_event.target() {
                        if let Some(element) = target.dyn_ref::<web_sys::Element>() {
                            let button = element.closest("button").ok().flatten();
                            let trigger_element = button
                                .as_ref()
                                .map(|b| b as &web_sys::Element)
                                .unwrap_or(element);
                            if let Some(html_el) = trigger_element.dyn_ref::<web_sys::HtmlElement>()
                            {
                                let rect = html_el.get_bounding_client_rect();
                                trigger_rect.set(Some((
                                    rect.left(),
                                    rect.top(),
                                    rect.width(),
                                    rect.height(),
                                )));
                            }
                        }
                    }
                }
            }

            portal.add_entry.call(PortalEntry::Popover {
                id,
                trigger_rect: *trigger_rect.read(),
                preferred_placements: preferred_placements.clone(),
                offset: props.offset,
                width: props.width.clone(),
                title: props.title.clone(),
                close_on_click_outside: props.close_on_click_outside,
                close_on_select: props.close_on_select,
                on_close: Some(on_close.clone()),
                close_requested,
                children: props.children.clone(),
            });
        } else {
            close_requested.set(true);
        }

        if let Some(handler) = on_open_change.as_ref() {
            handler.call(new_state);
        }
    };

    let container_classes = ClassesBuilder::new()
        .add(Position::Relative)
        .add(Display::InlineBlock)
        .add_raw(&props.class)
        .build();

    rsx! {
        div {
            class: "{container_classes}",
            onclick: handle_trigger_click,
            { props.trigger }
        }
    }
}

pub struct PopoverComponent;

impl StyledComponent for PopoverComponent {
    fn styles() -> &'static str {
        r#"
.hi-popover {
  position: fixed;
  z-index: 1050;
  background: var(--hi-color-surface);
  border: 1px solid var(--hi-color-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.10), 0 1px 4px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(12px);
  padding: 4px 0;
  min-width: 120px;
  overflow: visible;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
}

.hi-popover::before {
  content: '';
  position: absolute;
  top: 0;
  left: 8px;
  right: 8px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--hi-color-primary), transparent);
  opacity: 0.35;
}

@keyframes hi-popover-enter {
  from {
    opacity: 0;
    transform: scaleY(0.95) translateX(-50%);
  }
  to {
    opacity: 1;
    transform: scaleY(1) translateX(-50%);
  }
}

[data-theme="dark"] .hi-popover {
  background: var(--hi-color-surface);
  border-color: var(--hi-color-border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.hi-popover-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--hi-color-text-primary);
  margin-bottom: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--hi-color-border);
}

.hi-popover-content {
  font-size: 14px;
  color: var(--hi-color-text-primary);
  line-height: 1.6;
  overflow: visible;
  display: block;
  width: 100%;
}

.hi-popover-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1049;
  background: transparent;
}
"#
    }

    fn name() -> &'static str {
        "popover"
    }
}
