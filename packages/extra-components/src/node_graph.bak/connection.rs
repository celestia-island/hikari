// hikari-extra-components/src/node_graph/connection.rs
// Connection (Bezier curve) component for node graph

use dioxus::prelude::*;

/// Connection point in 2D space
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct ConnectionPoint {
    pub x: f64,
    pub y: f64,
}

impl ConnectionPoint {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }
}

/// Connection path style
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ConnectionStyle {
    #[default]
    Bezier,
    Step,
    Straight,
}

#[derive(Clone, PartialEq, Props)]
pub struct ConnectionProps {
    /// Unique identifier for the connection
    pub id: String,

    /// Source port position
    pub source_port: ConnectionPoint,

    /// Target port position
    pub target_port: ConnectionPoint,

    /// Bezier curve curvature (0.0 - 1.0)
    #[props(default = 0.5)]
    pub curvature: f64,

    /// Connection style
    #[props(default)]
    pub style: ConnectionStyle,

    /// Whether the connection is selected
    #[props(default)]
    pub selected: bool,

    /// Whether to show animated flow effect
    #[props(default)]
    pub animated: bool,

    /// Connection color (CSS color)
    #[props(default)]
    pub color: String,

    /// Stroke width
    #[props(default = 2.0)]
    pub stroke_width: f64,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Click handler
    #[props(default)]
    pub onclick: Option<EventHandler<MouseEvent>>,

    /// Double click handler (often used for deleting)
    #[props(default)]
    pub ondblclick: Option<EventHandler<MouseEvent>>,

    /// Hover state change handler
    #[props(default)]
    pub onhover: Option<EventHandler<bool>>,
}

impl Default for ConnectionProps {
    fn default() -> Self {
        Self {
            id: String::default(),
            source_port: Default::default(),
            target_port: Default::default(),
            curvature: 0.5,
            style: Default::default(),
            selected: false,
            animated: false,
            color: String::default(),
            stroke_width: 2.0,
            class: String::default(),
            onclick: None,
            ondblclick: None,
            onhover: None,
        }
    }
}

/// Calculate Bezier control points for smooth curves
fn calculate_bezier_control_points(
    source: ConnectionPoint,
    target: ConnectionPoint,
    curvature: f64,
) -> (ConnectionPoint, ConnectionPoint) {
    let dx = (target.x - source.x).abs();
    let control_offset = dx * curvature;

    // Control point 1 (from source, curving right)
    let cp1 = ConnectionPoint {
        x: source.x + control_offset,
        y: source.y,
    };

    // Control point 2 (from target, curving left)
    let cp2 = ConnectionPoint {
        x: target.x - control_offset,
        y: target.y,
    };

    (cp1, cp2)
}

/// Generate SVG path data for Bezier curve
fn generate_bezier_path(
    source: ConnectionPoint,
    target: ConnectionPoint,
    curvature: f64,
) -> String {
    let (cp1, cp2) = calculate_bezier_control_points(source, target, curvature);

    format!(
        "M {} {} C {} {} {} {} {} {}",
        source.x, source.y,
        cp1.x, cp1.y,
        cp2.x, cp2.y,
        target.x, target.y
    )
}

/// Generate SVG path data for stepped connection
fn generate_step_path(
    source: ConnectionPoint,
    target: ConnectionPoint,
) -> String {
    let mid_x = (source.x + target.x) / 2.0;

    format!(
        "M {} {} L {} {} L {} {} L {} {}",
        source.x, source.y,
        mid_x, source.y,
        mid_x, target.y,
        target.x, target.y
    )
}

/// Generate SVG path data for straight line
fn generate_straight_path(
    source: ConnectionPoint,
    target: ConnectionPoint,
) -> String {
    format!(
        "M {} {} L {} {}",
        source.x, source.y,
        target.x, target.y
    )
}

/// Connection (Bezier curve) component for node graph
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_extra_components::node_graph::{Connection, ConnectionPoint};
///
/// fn app() -> Element {
///     rsx! {
///         Connection {
///             id: "conn-1",
///             source_port: ConnectionPoint { x: 200.0, y: 150.0 },
///             target_port: ConnectionPoint { x: 400.0, y: 200.0 },
///             curvature: 0.5,
///             animated: true,
///         }
///     }
/// }
/// ```
#[component]
pub fn Connection(props: ConnectionProps) -> Element {
    let selected_class = if props.selected {
        "hikari-connection-selected"
    } else {
        ""
    };

    let animated_class = if props.animated {
        "hikari-connection-animated"
    } else {
        ""
    };

    let mut is_hovered = use_signal(|| false);

    // Generate path data based on style
    let path_data = match props.style {
        ConnectionStyle::Bezier => {
            generate_bezier_path(props.source_port, props.target_port, props.curvature)
        }
        ConnectionStyle::Step => {
            generate_step_path(props.source_port, props.target_port)
        }
        ConnectionStyle::Straight => {
            generate_straight_path(props.source_port, props.target_port)
        }
    };

    // Generate stroke color (use default if not specified)
    let stroke_color = if props.color.is_empty() {
        "var(--hikari-color-primary)"
    } else {
        &props.color
    };

    rsx! {
        svg {
            class: format!(
                "hikari-connection {selected_class} {animated_class} {}",
                props.class
            ),
            style: "overflow: visible; pointer-events: stroke;",
            "data-connection-id": props.id.clone(),

            onclick: move |e| {
                e.stop_propagation();
                if let Some(handler) = props.onclick.as_ref() {
                    handler.call(e);
                }
            },

            ondblclick: move |e| {
                e.stop_propagation();
                if let Some(handler) = props.ondblclick.as_ref() {
                    handler.call(e);
                }
            },

            onmouseenter: move |_| {
                is_hovered.set(true);
                if let Some(handler) = props.onhover.as_ref() {
                    handler.call(true);
                }
            },

            onmouseleave: move |_| {
                is_hovered.set(false);
                if let Some(handler) = props.onhover.as_ref() {
                    handler.call(false);
                }
            },

            // Connection path (invisible wider path for easier clicking)
            path {
                d: "{path_data}",
                fill: "none",
                stroke: "transparent",
                "stroke-width": "{props.stroke_width + 10.0}",
                style: "cursor: pointer;",
            }

            // Actual visible connection path
            path {
                class: "hikari-connection-path",
                d: "{path_data}",
                fill: "none",
                stroke: "{stroke_color}",
                "stroke-width": "{props.stroke_width}",
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
            }

            // Animated flow effect (dots moving along the path)
            if props.animated {
                circle {
                    class: "hikari-connection-flow-dot",
                    r: "3",
                    fill: "{stroke_color}",
                }
            }

            // Hover effect indicator
            if *is_hovered.read() || props.selected {
                path {
                    class: "hikari-connection-hover-path",
                    d: "{path_data}",
                    fill: "none",
                    stroke: "{stroke_color}",
                    "stroke-width": "{props.stroke_width + 2.0}",
                    "stroke-opacity": "0.3",
                    "stroke-linecap": "round",
                }
            }
        }
    }
}

/// Connection manager component that renders multiple connections
#[derive(Clone, PartialEq, Props)]
pub struct ConnectionManagerProps {
    /// List of connection configurations to render
    pub connections: Vec<ConnectionProps>,

    /// Connection click handler
    #[props(default)]
    pub onconnectionclick: Option<EventHandler<String>>,

    /// Connection double click handler
    #[props(default)]
    pub onconnectiondblclick: Option<EventHandler<String>>,
}

impl Default for ConnectionManagerProps {
    fn default() -> Self {
        Self {
            connections: Vec::default(),
            onconnectionclick: None,
            onconnectiondblclick: None,
        }
    }
}

/// Renders multiple connections in an SVG container
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_extra_components::node_graph::{ConnectionManager, ConnectionProps, ConnectionPoint};
///
/// fn app() -> Element {
///     rsx! {
///         ConnectionManager {
///             connections: vec![
///                 ConnectionProps {
///                     id: "conn-1".to_string(),
///                     source_port: ConnectionPoint { x: 200.0, y: 150.0 },
///                     target_port: ConnectionPoint { x: 400.0, y: 200.0 },
///                     ..Default::default()
///                 }
///             ]
///         }
///     }
/// }
/// ```
#[component]
pub fn ConnectionManager(props: ConnectionManagerProps) -> Element {
    rsx! {
        svg {
            class: "hikari-connection-manager",
            style: "width: 100%; height: 100%; overflow: visible;",

            for mut conn in props.connections.clone() {
                Connection {
                    ..conn
                }
            }
        }
    }
}
