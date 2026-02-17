// hi-components/src/feedback/popover.rs
// Popover component with smart positioning and collision detection

use animation::style::{CssProperty, StyleStringBuilder};
use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, Display, PopoverClass, Position, UtilityClass};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

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
            title: None,
            width: None,
            class: String::default(),
            offset: 8.0,
        }
    }
}

/// Calculate the best placement based on collision detection
#[cfg(target_arch = "wasm32")]
fn find_best_placement(
    trigger_rect: web_sys::DomRect,
    popover_width: f64,
    popover_height: f64,
    viewport_width: f64,
    viewport_height: f64,
    preferred: &[PopoverPlacement],
    offset: f64,
) -> (PopoverPlacement, String) {
    const PADDING: f64 = 16.0;

    let trigger_left = trigger_rect.left();
    let trigger_top = trigger_rect.top();
    let trigger_right = trigger_rect.right();
    let trigger_bottom = trigger_rect.bottom();
    let trigger_width = trigger_rect.width();
    let trigger_height = trigger_rect.height();
    let trigger_center_x = trigger_left + trigger_width / 2.0;
    let trigger_center_y = trigger_top + trigger_height / 2.0;

    fn check_collision(
        placement: PopoverPlacement,
        trigger_left: f64,
        trigger_top: f64,
        trigger_right: f64,
        trigger_bottom: f64,
        trigger_center_x: f64,
        trigger_center_y: f64,
        trigger_width: f64,
        trigger_height: f64,
        popover_width: f64,
        popover_height: f64,
        viewport_width: f64,
        viewport_height: f64,
        offset: f64,
        padding: f64,
    ) -> Option<String> {
        match placement {
            PopoverPlacement::Bottom => {
                let popover_top = trigger_bottom + offset;
                let popover_left = trigger_center_x - popover_width / 2.0;
                if popover_top + popover_height <= viewport_height - padding
                    && popover_left >= padding
                    && popover_left + popover_width <= viewport_width - padding
                {
                    Some(format!(
                        "top: {}px; left: {}px;",
                        trigger_bottom + offset,
                        trigger_center_x
                    ))
                } else {
                    None
                }
            }
            PopoverPlacement::Top => {
                let popover_bottom = trigger_top - offset;
                let popover_left = trigger_center_x - popover_width / 2.0;
                if popover_bottom - popover_height >= padding
                    && popover_left >= padding
                    && popover_left + popover_width <= viewport_width - padding
                {
                    Some(format!(
                        "bottom: {}px; left: {}px;",
                        viewport_height - trigger_top + offset,
                        trigger_center_x
                    ))
                } else {
                    None
                }
            }
            PopoverPlacement::Left => {
                let popover_right = trigger_left - offset;
                let popover_top = trigger_center_y - popover_height / 2.0;
                if popover_right - popover_width >= padding
                    && popover_top >= padding
                    && popover_top + popover_height <= viewport_height - padding
                {
                    Some(format!(
                        "right: {}px; top: {}px;",
                        viewport_width - trigger_left + offset,
                        trigger_center_y
                    ))
                } else {
                    None
                }
            }
            PopoverPlacement::Right => {
                let popover_left = trigger_right + offset;
                let popover_top = trigger_center_y - popover_height / 2.0;
                if popover_left + popover_width <= viewport_width - padding
                    && popover_top >= padding
                    && popover_top + popover_height <= viewport_height - padding
                {
                    Some(format!(
                        "left: {}px; top: {}px;",
                        trigger_right + offset,
                        trigger_center_y
                    ))
                } else {
                    None
                }
            }
        }
    }

    for placement in preferred {
        if let Some(style) = check_collision(
            *placement,
            trigger_left,
            trigger_top,
            trigger_right,
            trigger_bottom,
            trigger_center_x,
            trigger_center_y,
            trigger_width,
            trigger_height,
            popover_width,
            popover_height,
            viewport_width,
            viewport_height,
            offset,
            PADDING,
        ) {
            return (*placement, style);
        }
    }

    let fallback_order = [
        PopoverPlacement::Bottom,
        PopoverPlacement::Top,
        PopoverPlacement::Right,
        PopoverPlacement::Left,
    ];

    for placement in fallback_order {
        if !preferred.contains(&placement) {
            if let Some(style) = check_collision(
                placement,
                trigger_left,
                trigger_top,
                trigger_right,
                trigger_bottom,
                trigger_center_x,
                trigger_center_y,
                trigger_width,
                trigger_height,
                popover_width,
                popover_height,
                viewport_width,
                viewport_height,
                offset,
                PADDING,
            ) {
                return (placement, style);
            }
        }
    }

    (
        PopoverPlacement::Bottom,
        format!("top: {}px; left: {}px;", trigger_bottom + offset, trigger_center_x),
    )
}

#[component]
pub fn Popover(props: PopoverProps) -> Element {
    let mut open = use_signal(|| props.open);
    let mut trigger_ref: Signal<Option<web_sys::Element>> = use_signal(|| None);
    let popover_ref: Signal<Option<web_sys::Element>> = use_signal(|| None);
    let mut placement_state = use_signal(|| (PopoverPlacement::Bottom, String::new()));

    let positioning = props.positioning.clone();

    #[cfg(target_arch = "wasm32")]
    {
        let open_for_effect = open;
        let positioning_for_effect = positioning.clone();
        let offset_for_effect = props.offset;
        let mut placement_state_clone = placement_state;

        use_effect(move || {
            if open_for_effect() {
                if let (Some(trigger), Some(popover)) =
                    (trigger_ref.read().as_ref(), popover_ref.read().as_ref())
                {
                    if let PopoverPositioning::Relative { preferred } = &positioning_for_effect {
                        let trigger_rect = trigger.get_bounding_client_rect();
                        let popover_rect = popover.get_bounding_client_rect();

                        let viewport_width =
                            web_sys::window().unwrap().inner_width().unwrap().as_f64().unwrap();
                        let viewport_height =
                            web_sys::window().unwrap().inner_height().unwrap().as_f64().unwrap();

                        let (placement, style) = find_best_placement(
                            trigger_rect,
                            popover_rect.width(),
                            popover_rect.height(),
                            viewport_width,
                            viewport_height,
                            preferred,
                            offset_for_effect,
                        );
                        placement_state_clone.set((placement, style));
                    }
                }
            }
        });
    }

    let positioning_for_memo = positioning.clone();
    let handle_trigger_click = move |e: MouseEvent| {
        e.stop_propagation();

        #[cfg(target_arch = "wasm32")]
        {
            if let Some(web_event) = e.downcast::<web_sys::MouseEvent>() {
                if let Some(target) = web_event.target() {
                    if let Some(element) = target.dyn_ref::<web_sys::Element>() {
                        let button = element.closest("button").ok().flatten();
                        let trigger_element = button.as_ref().map(|b| b as &web_sys::Element).unwrap_or(element);
                        if let Some(html_el) = trigger_element.dyn_ref::<web_sys::HtmlElement>() {
                            let rect = html_el.get_bounding_client_rect();
                            trigger_ref.set(Some(html_el.clone().into()));

                            if let PopoverPositioning::Relative { .. } = &positioning_for_memo {
                                let style = format!("top: {}px; left: {}px;", rect.bottom() + props.offset, rect.left() + rect.width() / 2.0);
                                placement_state.set((PopoverPlacement::Bottom, style));
                            }
                        }
                    }
                }
            }
        }

        let new_state = !open();
        open.set(new_state);
        if let Some(handler) = props.on_open_change.as_ref() {
            handler.call(new_state);
        }
    };

    let position_style = use_memo(move || {
        match &positioning {
            PopoverPositioning::Relative { .. } => {
                let (_, style) = placement_state();
                format!("position: fixed; {}; transform: translateX(-50%);", style)
            }
            PopoverPositioning::Absolute(abs_pos) => {
                match abs_pos {
                    PopoverAbsolutePosition::Center => {
                        "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);".to_string()
                    }
                    PopoverAbsolutePosition::Fixed { x, y } => {
                        format!("position: fixed; left: {}px; top: {}px;", x, y)
                    }
                }
            }
        }
    });

    let popover_style = use_memo(move || {
        let width = props.width.as_deref().unwrap_or("auto");
        if open() {
            StyleStringBuilder::new()
                .add(CssProperty::Display, "block")
                .add(CssProperty::Width, width)
                .add_raw(&position_style())
                .build_clean()
        } else {
            StyleStringBuilder::new()
                .add(CssProperty::Display, "none")
                .add(CssProperty::Width, width)
                .add_raw(&position_style())
                .build_clean()
        }
    });

    let container_classes = ClassesBuilder::new()
        .add(Position::Relative)
        .add(Display::InlineBlock)
        .add_raw(&props.class)
        .build();

    let popover_classes = ClassesBuilder::new().add(PopoverClass::Popover).build();

    #[cfg(target_arch = "wasm32")]
    let popover_mounted = {
        let mut popover_ref_clone = popover_ref;
        use_effect(move || {
            if open() {
                spawn(async move {
                    gloo::timers::future::TimeoutFuture::new(10).await;
                    if let Some(window) = web_sys::window() {
                        if let Some(document) = window.document() {
                            if let Ok(Some(el)) = document.query_selector(".hi-popover[data-open='true']") {
                                popover_ref_clone.set(Some(el));
                            }
                        }
                    }
                });
            }
        });
    };

    #[cfg(not(target_arch = "wasm32"))]
    let _ = (popover_ref, trigger_ref);

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
                    "data-open": "true",
                    onclick: |e: MouseEvent| {
                        e.stop_propagation();
                    },

                    if let Some(title) = &props.title {
                        div { class: "{PopoverClass::Title.as_class()}", "{title}" }
                    }

                    div { class: "{PopoverClass::Content.as_class()}",
                        { props.children }
                    }
                }

                if props.close_on_click_outside {
                    div {
                        class: "hi-popover-backdrop",
                        onclick: move |_| {
                            open.set(false);
                            if let Some(handler) = props.on_open_change.as_ref() {
                                handler.call(false);
                            }
                        },
                    }
                }
            }
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
  min-width: 160px;
  max-width: 320px;
  overflow: visible;
  animation: hi-popover-fade-in 0.15s ease-out;
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

@keyframes hi-popover-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px) translateX(-50%);
  }
  to {
    opacity: 1;
    transform: translateY(0) translateX(-50%);
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
}

.hi-popover-content .hi-menu {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
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
