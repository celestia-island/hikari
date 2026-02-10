// extra-components/src/extra/draggable_card.rs
// DraggableCard - DragLayer + Card integration

use dioxus::prelude::*;

use crate::drag_layer::{DragLayer, DragConstraints};

/// Draggable card component that combines DragLayer with Card
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use extra_components::DraggableCard;
/// use hikari_components::{Card, CardHeader};
///
/// fn app() -> Element {
///     rsx! {
///         DraggableCard {
///             initial_x: 100.0,
///             initial_y: 100.0,
///             Card {
///                 CardHeader {
///                     title: Some("Draggable Card".to_string())
///                 }
///                 div { "Content" }
///             }
///         }
///     }
/// }
/// ```
#[derive(Clone, PartialEq, Props)]
pub struct DraggableCardProps {
    #[props(default)]
    pub children: Element,

    /// Initial X position
    #[props(default = 0.0)]
    pub initial_x: f64,

    /// Initial Y position
    #[props(default = 0.0)]
    pub initial_y: f64,

    /// Z-index of the card
    #[props(default = 1000)]
    pub z_index: i32,

    /// Whether the card is currently draggable
    #[props(default)]
    pub draggable: bool,

    /// Boundary constraints for dragging
    #[props(default)]
    pub constraints: DragConstraints,

    /// Callback when drag starts
    pub on_drag_start: Option<EventHandler<crate::drag_layer::DragData>>,

    /// Callback during drag
    pub on_drag: Option<EventHandler<crate::drag_layer::DragData>>,

    /// Callback when drag ends
    pub on_drag_end: Option<EventHandler<crate::drag_layer::DragData>>,

    /// Custom class name
    #[props(default)]
    pub class: String,
}

impl Default for DraggableCardProps {
    fn default() -> Self {
        Self {
            children: VNode::empty(),
            initial_x: 0.0,
            initial_y: 0.0,
            z_index: 1000,
            draggable: true,
            constraints: Default::default(),
            on_drag_start: None,
            on_drag: None,
            on_drag_end: None,
            class: String::default(),
        }
    }
}

#[component]
pub fn DraggableCard(props: DraggableCardProps) -> Element {
    rsx! {
        DragLayer {
            initial_x: props.initial_x,
            initial_y: props.initial_y,
            z_index: props.z_index,
            draggable: props.draggable,
            constraints: props.constraints,
            on_drag_start: props.on_drag_start,
            on_drag: props.on_drag,
            on_drag_end: props.on_drag_end,
            class: props.class,
            { props.children }
        }
    }
}
