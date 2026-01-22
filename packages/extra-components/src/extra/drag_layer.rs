// hi-extra-components/src/drag_layer.rs
// Drag layer component with bounds constraints

use dioxus::prelude::*;
#[cfg(target_arch = "wasm32")]
use web_sys::{window, MouseEvent as WebMouseEvent};

/// Constraints for drag boundaries
#[derive(Clone, PartialEq, Debug, Default)]
pub struct DragConstraints {
    /// Minimum X position
    pub min_x: Option<f64>,
    /// Maximum X position
    pub max_x: Option<f64>,
    /// Minimum Y position
    pub min_y: Option<f64>,
    /// Maximum Y position
    pub max_y: Option<f64>,
}

#[derive(Clone, PartialEq, Props)]
pub struct DragLayerProps {
    /// Content to be rendered in the draggable layer
    #[props(default)]
    pub children: Element,

    /// Callback when drag starts (passes delta values)
    pub on_drag_start: Option<EventHandler<DragData>>,

    /// Callback during drag (passes delta values)
    pub on_drag: Option<EventHandler<DragData>>,

    /// Callback when drag ends (passes delta values)
    pub on_drag_end: Option<EventHandler<DragData>>,

    /// Boundary constraints for dragging
    #[props(default)]
    pub constraints: DragConstraints,

    /// Initial X position
    #[props(default = 0.0)]
    pub initial_x: f64,

    /// Initial Y position
    #[props(default = 0.0)]
    pub initial_y: f64,

    /// Z-index of the layer
    #[props(default = 1000)]
    pub z_index: i32,

    /// Whether the layer is currently draggable
    #[props(default)]
    pub draggable: bool,

    /// Custom class name
    #[props(default)]
    pub class: String,
}

impl Default for DragLayerProps {
    fn default() -> Self {
        Self {
            children: VNode::empty(),
            on_drag_start: None,
            on_drag: None,
            on_drag_end: None,
            constraints: Default::default(),
            initial_x: 0.0,
            initial_y: 0.0,
            z_index: 1000,
            draggable: true,
            class: String::default(),
        }
    }
}

/// Data passed to drag event handlers
#[derive(Clone, PartialEq, Debug)]
pub struct DragData {
    pub x: f64,
    pub y: f64,
    pub start_x: f64,
    pub start_y: f64,
}

/// Drag layer component with bounds constraints
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use extra_components::{DragLayer, DragConstraints};
///
/// fn app() -> Element {
///     rsx! {
///         DragLayer {
///             initial_x: 100.0,
///             initial_y: 100.0,
///             constraints: DragConstraints {
///                 min_x: Some(0.0),
///                 max_x: Some(500.0),
///                 ..Default::default()
///             },
///             div { "Drag me around!" }
///         }
///     }
/// }
/// ```
#[component]
pub fn DragLayer(props: DragLayerProps) -> Element {
    let mut position = use_signal(|| (props.initial_x, props.initial_y));
    let mut is_dragging = use_signal(|| false);
    let mut drag_start_pos = use_signal(|| (0.0, 0.0));
    let mut offset_start = use_signal(|| (0.0, 0.0));

    let constrain_x = move |x: f64| -> f64 {
        let mut constrained = x;
        if let Some(min) = props.constraints.min_x {
            constrained = constrained.max(min);
        }
        if let Some(max) = props.constraints.max_x {
            constrained = constrained.min(max);
        }
        constrained
    };

    let constrain_y = move |y: f64| -> f64 {
        let mut constrained = y;
        if let Some(min) = props.constraints.min_y {
            constrained = constrained.max(min);
        }
        if let Some(max) = props.constraints.max_y {
            constrained = constrained.min(max);
        }
        constrained
    };

    // Clone callbacks for use in inline handlers
    let on_drag_start = props.on_drag_start;
    let on_drag = props.on_drag;
    let on_drag_end = props.on_drag_end;

    // Track mouse start position
    #[cfg_attr(not(target_arch = "wasm32"), allow(unused_variables))]
    let mouse_start_x = use_signal(|| 0.0f64);
    #[cfg_attr(not(target_arch = "wasm32"), allow(unused_variables))]
    let mouse_start_y = use_signal(|| 0.0f64);

    rsx! {
        div {
            class: format!(
                "hi-drag-layer {} {}",
                if is_dragging() { "hi-dragging" } else { "" },
                props.class
            ),
            style: format!(
                "position: absolute; left: {}px; top: {}px; z-index: {}; cursor: {};",
                position().0, position().1, props.z_index,
                if props.draggable { "move" } else { "default" }
            ),

            onmousedown: move |e: MouseEvent| {
                if !props.draggable {
                    return;
                }

                e.stop_propagation();
                is_dragging.set(true);
                drag_start_pos.set((0.0, 0.0));
                offset_start.set(position());

                #[cfg(target_arch = "wasm32")]
                {
                    if let Ok(web_event) = e.downcast::<WebMouseEvent>() {
                        mouse_start_x.set(web_event.client_x() as f64);
                        mouse_start_y.set(web_event.client_y() as f64);
                    }
                }

                let data = DragData {
                    x: position().0,
                    y: position().1,
                    start_x: position().0,
                    start_y: position().1,
                };

                if let Some(handler) = on_drag_start.as_ref() {
                    handler.call(data);
                }
            },

            { props.children }
        }

        // Global event listeners for drag continuation
        if is_dragging() {
            div {
                style: "position: fixed; inset: 0; z-index: 9999;",
                onmousemove: move |e: MouseEvent| {
                    e.stop_propagation();

                    // Calculate delta from actual mouse movement
                    #[cfg(target_arch = "wasm32")]
                    let (delta_x, delta_y) = {
                        if let Ok(web_event) = e.downcast::<WebMouseEvent>() {
                            let dx = (web_event.client_x() as f64 - mouse_start_x()) as f64;
                            let dy = (web_event.client_y() as f64 - mouse_start_y()) as f64;
                            (dx, dy)
                        } else {
                            (0.0, 0.0)
                        }
                    };

                    #[cfg(not(target_arch = "wasm32"))]
                    let (delta_x, delta_y) = (0.0, 0.0);

                    let new_x = constrain_x(offset_start().0 + delta_x);
                    let new_y = constrain_y(offset_start().1 + delta_y);

                    position.set((new_x, new_y));

                    let data = DragData {
                        x: new_x,
                        y: new_y,
                        start_x: offset_start().0,
                        start_y: offset_start().1,
                    };

                    if let Some(handler) = on_drag.as_ref() {
                        handler.call(data);
                    }
                },
                onmouseup: move |e| {
                    e.stop_propagation();
                    is_dragging.set(false);

                    let data = DragData {
                        x: position().0,
                        y: position().1,
                        start_x: offset_start().0,
                        start_y: offset_start().1,
                    };

                    if let Some(handler) = on_drag_end.as_ref() {
                        handler.call(data);
                    }
                },
            }
        }
    }
}
