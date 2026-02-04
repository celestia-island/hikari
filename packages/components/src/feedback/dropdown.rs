// hi-components/src/feedback/dropdown.rs
// Dropdown component using Portal system with three positioning strategies

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, Display, Position};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

use crate::{
    portal::{
        PortalEntry, PortalMaskMode, PortalPositionStrategy, TriggerPlacement, generate_portal_id,
        use_portal,
    },
    styled::StyledComponent,
};

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DropdownPositioning {
    #[default]
    MouseBased,
    TriggerBased,
    Fixed,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DropdownPosition {
    #[default]
    Bottom,
    BottomLeft,
    BottomRight,
    Top,
    TopLeft,
    TopRight,
    Left,
    LeftTop,
    LeftBottom,
    Right,
    RightTop,
    RightBottom,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DropdownMask {
    Dimmed,
    #[default]
    Transparent,
}

#[derive(Clone, PartialEq, Props)]
pub struct DropdownProps {
    pub trigger: Element,
    pub children: Element,
    #[props(default)]
    pub open: bool,
    pub on_open_change: Option<Callback<bool>>,
    #[props(default)]
    pub positioning: DropdownPositioning,
    #[props(default)]
    pub position: DropdownPosition,
    #[props(default)]
    pub mask: DropdownMask,
    #[props(default)]
    pub close_on_click_outside: bool,
    #[props(default)]
    pub close_on_select: bool,
    #[props(default)]
    pub class: String,
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
            positioning: Default::default(),
            position: Default::default(),
            mask: Default::default(),
            close_on_click_outside: true,
            close_on_select: true,
            class: String::default(),
            menu_class: String::default(),
        }
    }
}

#[component]
pub fn Dropdown(props: DropdownProps) -> Element {
    let portal = use_portal();
    let open = use_signal(|| false);
    let mut dropdown_id = use_signal(String::new);
    let mut prev_open = use_signal(|| false);

    // Sync open state with portal entries and trigger on_open_change
    let entries = portal.entries;
    let dropdown_id_sync = dropdown_id;
    let open_sync = open;
    let on_open_change_sync = props.on_open_change;
    use_effect(move || {
        let current_id = dropdown_id_sync.read();
        if !current_id.is_empty() {
            let is_in_entries = entries.read().iter().any(|entry| {
                if let PortalEntry::Dropdown { id, .. } = entry {
                    id == &*current_id
                } else {
                    false
                }
            });
            let mut open_ref = open_sync;
            open_ref.set(is_in_entries);

            // Trigger on_open_change when state changes
            let current_open = is_in_entries;
            let prev_open_val = *prev_open.read();
            if current_open != prev_open_val {
                prev_open.set(current_open);
                if let Some(handler) = &on_open_change_sync {
                    handler.call(current_open);
                }
            }
        }
    });

    let handle_trigger_click = move |e: MouseEvent| {
        e.stop_propagation();

        let current_open = open();
        let new_state = !current_open;

        if new_state {
            let id = generate_portal_id();
            dropdown_id.set(id.clone());

            let mask_mode = match props.mask {
                DropdownMask::Dimmed => PortalMaskMode::Dimmed,
                DropdownMask::Transparent => PortalMaskMode::Transparent,
            };

            let placement = match props.position {
                DropdownPosition::Bottom => TriggerPlacement::Bottom,
                DropdownPosition::BottomLeft => TriggerPlacement::BottomLeft,
                DropdownPosition::BottomRight => TriggerPlacement::BottomRight,
                DropdownPosition::Top => TriggerPlacement::Top,
                DropdownPosition::TopLeft => TriggerPlacement::TopLeft,
                DropdownPosition::TopRight => TriggerPlacement::TopRight,
                DropdownPosition::Left => TriggerPlacement::Left,
                DropdownPosition::LeftTop => TriggerPlacement::LeftTop,
                DropdownPosition::LeftBottom => TriggerPlacement::LeftBottom,
                DropdownPosition::Right => TriggerPlacement::Right,
                DropdownPosition::RightTop => TriggerPlacement::RightTop,
                DropdownPosition::RightBottom => TriggerPlacement::RightBottom,
            };

            let (strategy, trigger_rect_opt) = match props.positioning {
                DropdownPositioning::MouseBased => {
                    let coords = e.client_coordinates();
                    (PortalPositionStrategy::Fixed(coords.x, coords.y), None)
                }
                DropdownPositioning::TriggerBased => {
                    #[cfg(target_arch = "wasm32")]
                    {
                        // Get trigger button element using closest()
                        web_sys::console::log_1(&"=== Dropdown: Finding button element ===".into());

                        let trigger_rect = if let Some(web_event) =
                            e.downcast::<web_sys::MouseEvent>()
                        {
                            if let Some(target) = web_event.target() {
                                // Try to get Element from EventTarget
                                if let Some(element) = target.dyn_ref::<web_sys::Element>() {
                                    // Find closest button element from the clicked element
                                    let button_result = element.closest("button");
                                    web_sys::console::log_1(
                                        &format!(
                                            "button closest: {:?}",
                                            button_result.as_ref().map(|_| true).unwrap_or(false)
                                        )
                                        .into(),
                                    );

                                    if let Ok(Some(button)) = button_result {
                                        if let Some(html_button) =
                                            button.dyn_ref::<web_sys::HtmlElement>()
                                        {
                                            let rect = html_button.get_bounding_client_rect();
                                            // Get button classes
                                            let num_classes =
                                                html_button.class_list().length() as usize;
                                            let mut button_classes = Vec::new();
                                            for i in 0..num_classes {
                                                if let Some(class_name) =
                                                    html_button.class_list().item(i as u32)
                                                {
                                                    button_classes.push(class_name);
                                                }
                                            }
                                            // Debug logging
                                            web_sys::console::log_1(
                                                &format!(
                                                 "✓ Button found! rect: ({:.1}, {:.1}, {:.1}, {:.1})",
                                                 rect.x(), rect.y(), rect.width(), rect.height()
                                             )
                                                    .into(),
                                            );
                                            web_sys::console::log_1(
                                                &format!("✓ Button class: {:?}", button_classes)
                                                    .into(),
                                            );
                                            web_sys::console::log_1(
                                                &format!("Dropdown placement: {:?}", placement)
                                                    .into(),
                                            );
                                            web_sys::console::log_1(
                                                &format!(
                                                    "Expected menu position: x={:.1}, y={:.1}",
                                                    rect.x() + rect.width(),
                                                    rect.y() - 8.0
                                                )
                                                .into(),
                                            );
                                            Some((rect.x(), rect.y(), rect.width(), rect.height()))
                                        } else {
                                            web_sys::console::log_1(
                                                &"✗ Failed to dyn_ref button as HtmlElement".into(),
                                            );
                                            None
                                        }
                                    } else {
                                        web_sys::console::log_1(
                                            &"✗ No button found with closest()".into(),
                                        );
                                        None
                                    }
                                } else {
                                    web_sys::console::log_1(
                                        &"✗ Failed to dyn_ref target as Element".into(),
                                    );
                                    None
                                }
                            } else {
                                web_sys::console::log_1(&"✗ Event target is None".into());
                                None
                            }
                        } else {
                            web_sys::console::log_1(&"✗ Event is not MouseEvent".into());
                            None
                        };

                        web_sys::console::log_1(
                            &format!("Final trigger_rect: {:?}", trigger_rect).into(),
                        );

                        (
                            PortalPositionStrategy::TriggerBased { placement },
                            trigger_rect,
                        )
                    }

                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        (PortalPositionStrategy::TriggerBased { placement }, None)
                    }
                }
                DropdownPositioning::Fixed => (PortalPositionStrategy::Fixed(50.0, 50.0), None),
            };

            let entry = PortalEntry::Dropdown {
                id: id.clone(),
                strategy,
                mask_mode,
                children: props.children.clone(),
                trigger_rect: trigger_rect_opt,
                close_on_select: props.close_on_select,
            };

            #[cfg(target_arch = "wasm32")]
            {
                web_sys::console::log_1(
                    &format!(
                        "Dropdown adding entry: id={}, strategy={:?}, trigger_rect={:?}",
                        id, strategy, trigger_rect_opt
                    )
                    .into(),
                );
            }

            portal.add_entry.call(entry);
        } else {
            let id = dropdown_id();
            if !id.is_empty() {
                portal.remove_entry.call(id);
            }
        }
        // Note: on_open_change is handled by use_effect to ensure consistency
        // when dropdown is closed by menu item click or overlay click
    };

    let wrapper_classes = ClassesBuilder::new()
        .add(Position::Relative)
        .add(Display::InlineBlock)
        .add_raw(&props.class)
        .build();

    rsx! {
        div {
            class: "{wrapper_classes}",

            div {
                onclick: handle_trigger_click,
                { props.trigger }
            }
        }
    }
}

pub struct DropdownComponent;

impl StyledComponent for DropdownComponent {
    fn styles() -> &'static str {
        r#"
/* Dropdown Overlay - Completely transparent for non-blocking mode */
.hi-dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  transition: opacity 0.2s ease;
  pointer-events: auto;
}

/* Dimmed overlay - semi-transparent black */
.hi-dropdown-overlay-dimmed {
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(8px);
}

/* Transparent overlay - fully invisible */
.hi-dropdown-overlay-transparent {
  background: transparent;
  backdrop-filter: none;
}

/* Dropdown content - card-style appearance */
.hi-dropdown {
  z-index: 1000;
  min-width: 160px;
  max-width: 100%;
  background: var(--hi-background);
  border: 1px solid var(--hi-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 4px 0;
  pointer-events: auto;
  animation: hi-dropdown-fade-in 0.15s ease-out;
}

/* Fade in animation */
@keyframes hi-dropdown-fade-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-2px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Dark mode styling */
[data-theme="dark"] .hi-dropdown {
  background: var(--hi-surface);
  border-color: var(--hi-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

/* Menu styling within dropdown */
.hi-dropdown .hi-menu {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

/* Menu item styling */
.hi-dropdown .hi-menu-item {
  padding: 8px 12px;
  margin: 0;
  border-radius: 4px;
  cursor: pointer;
}

/* Menu item hover */
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
