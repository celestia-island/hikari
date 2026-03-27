// hi-components/src/feedback/popover.rs
// Popover component with smart positioning via Portal system

use hikari_palette::classes::{ClassesBuilder, Display, Position};

use crate::{
    portal::{PortalEntry, generate_portal_id, use_portal},
    prelude::*,
    styled::StyledComponent,
};

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum PopoverPlacement {
    #[default]
    Bottom,
    Top,
    Left,
    Right,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum PopoverAbsolutePosition {
    Center,
    Fixed { x: f64, y: f64 },
}

#[derive(Clone, PartialEq, Debug)]
pub enum PopoverPositioning {
    Relative { preferred: Vec<PopoverPlacement> },
    Absolute(PopoverAbsolutePosition),
}

impl Default for PopoverPositioning {
    fn default() -> Self {
        PopoverPositioning::default_relative()
    }
}

impl IntoAttrValue for PopoverPositioning {
    fn into_attr_value(self) -> Option<String> {
        Some(match self {
            PopoverPositioning::Relative { .. } => "relative".to_string(),
            PopoverPositioning::Absolute(_) => "absolute".to_string(),
        })
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

#[define_props]
pub struct PopoverProps {
    pub trigger: Element,
    pub children: Element,
    #[default(false)]
    pub open: bool,
    pub on_open_change: Option<Callback<bool>>,
    pub positioning: PopoverPositioning,
    #[default(true)]
    pub close_on_click_outside: bool,
    #[default(true)]
    pub close_on_select: bool,
    pub title: Option<String>,
    pub width: Option<String>,
    pub class: String,
    #[default(8.0)]
    pub offset: f64,
}

#[component]
pub fn Popover(props: PopoverProps) -> Element {
    let open = use_signal(|| props.open);
    let popover_id = use_signal(String::new);

    let close_requested = use_signal(|| false);

    let trigger_rect = use_signal(|| None::<(f64, f64, f64, f64)>);

    let portal = use_portal();
    let positioning = props.positioning.clone();

    let preferred_placements = match &positioning {
        PopoverPositioning::Relative { preferred } => preferred.clone(),
        PopoverPositioning::Absolute(_) => vec![PopoverPlacement::Bottom],
    };

    let on_open_change = props.on_open_change.clone();
    let on_open_change_for_close = props.on_open_change.clone();

    let open_for_close = open.clone();
    let close_requested_for_close = close_requested.clone();
    let on_close = Callback::new(move |_| {
        open_for_close.set(false);
        close_requested_for_close.set(true);
        if let Some(handler) = on_open_change_for_close.as_ref() {
            handler.call(false);
        }
    });

    // Sync external open prop with internal state
    let props_open = props.open;
    let open_for_effect = open.clone();
    let close_requested_for_effect = close_requested.clone();
    use_effect(move || {
        if props_open != open_for_effect.get() {
            open_for_effect.set(props_open);
            if props_open {
                close_requested_for_effect.set(false);
            } else {
                close_requested_for_effect.set(true);
            }
        }
    });

    let handle_trigger_click = {
        let open = open.clone();
        let popover_id = popover_id.clone();
        let close_requested = close_requested.clone();
        let trigger_rect = trigger_rect.clone();
        let portal = portal.clone();
        let preferred_placements = preferred_placements.clone();
        let on_open_change = on_open_change;
        let on_close = on_close.clone();

        move |e: MouseEvent| {
            e.stop_propagation();

            let new_state = !open.get();
            open.set(new_state);

            if new_state {
                let id = generate_portal_id();
                popover_id.set(id.clone());
                close_requested.set(false);

                if let Some(drag_event) = e.as_any().downcast_ref::<MouseEvent>() {
                    // Use client coordinates for approximate positioning
                    trigger_rect.set(Some((
                        drag_event.client_x as f64,
                        drag_event.client_y as f64,
                        100.0,
                        30.0,
                    )));
                }

                portal.add_entry.call(PortalEntry::Popover {
                    id,
                    trigger_rect: trigger_rect.read(),
                    preferred_placements: preferred_placements.clone(),
                    offset: props.offset,
                    width: props.width.clone(),
                    title: props.title.clone(),
                    close_on_click_outside: props.close_on_click_outside,
                    close_on_select: props.close_on_select,
                    on_close: Some(on_close.clone()),
                    close_requested: close_requested.clone(),
                    children: props.children.clone(),
                });
            } else {
                close_requested.set(true);
            }

            if let Some(handler) = on_open_change.as_ref() {
                handler.call(new_state);
            }
        }
    };

    let container_classes = ClassesBuilder::new()
        .add(Position::Relative)
        .add(Display::InlineBlock)
        .add_raw(&props.class)
        .build();

    rsx! {
        div { class: container_classes, onclick: handle_trigger_click, {props.trigger} }
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
