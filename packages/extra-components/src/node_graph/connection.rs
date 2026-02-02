// node_graph/connection.rs
// Connection between node ports with Bezier curves

use dioxus::prelude::*;

pub type ConnectionId = String;

/// Connection between two ports
#[derive(Clone, Debug, PartialEq)]
pub struct Connection {
    pub id: ConnectionId,
    pub from_node: String,
    pub from_port: String,
    pub to_node: String,
    pub to_port: String,
    pub path: Vec<(f64, f64)>,
}

impl Connection {
    pub fn new(from_node: &str, from_port: &str, to_node: &str, to_port: &str) -> Self {
        Self {
            id: format!("{}_{}_{}_{}", from_node, from_port, to_node, to_port),
            from_node: from_node.to_string(),
            from_port: from_port.to_string(),
            to_node: to_node.to_string(),
            to_port: to_port.to_string(),
            path: Vec::new(),
        }
    }

    /// Calculate Bezier curve path
    pub fn calculate_bezier_path(
        from_pos: (f64, f64),
        to_pos: (f64, f64),
        from_side: &str,
        to_side: &str,
    ) -> Vec<(f64, f64)> {
        let (x1, y1) = from_pos;
        let (x2, y2) = to_pos;

        // Control points for smooth Bezier curve
        let control_offset = 50.0;
        let cp1 = match from_side {
            "right" => (x1 + control_offset, y1),
            "bottom" => (x1, y1 + control_offset),
            "left" => (x1 - control_offset, y1),
            "top" => (x1, y1 - control_offset),
            _ => (x1 + control_offset, y1),
        };

        let cp2 = match to_side {
            "left" => (x2 - control_offset, y2),
            "top" => (x2, y2 - control_offset),
            "right" => (x2 + control_offset, y2),
            "bottom" => (x2, y2 + control_offset),
            _ => (x2 - control_offset, y2),
        };

        // Generate Bezier curve points
        (0..=50)
            .map(|t| {
                let t = t as f64 / 50.0;
                let x = (1.0 - t).powi(3) * x1
                    + 3.0 * (1.0 - t).powi(2) * t * cp1.0
                    + 3.0 * (1.0 - t) * t.powi(2) * cp2.0
                    + t.powi(3) * x2;
                let y = (1.0 - t).powi(3) * y1
                    + 3.0 * (1.0 - t).powi(2) * t * cp1.1
                    + 3.0 * (1.0 - t) * t.powi(2) * cp2.1
                    + t.powi(3) * y2;
                (x, y)
            })
            .collect()
    }
}

/// Connection rendering component
#[component]
pub fn ConnectionLine(
    from_pos: (f64, f64),
    to_pos: (f64, f64),
    from_side: String,
    to_side: String,
    #[props(default)] selected: bool,
    #[props(default)] on_click: EventHandler<ConnectionId>,
    id: ConnectionId,
) -> Element {
    let path = Connection::calculate_bezier_path(from_pos, to_pos, &from_side, &to_side);

    let path_d = format!(
        "M {} {} C {} {} {} {} {} {} {} {}",
        from_pos.0,
        from_pos.1,
        path.get(12).map(|p| p.0).unwrap_or(from_pos.0),
        path.get(12).map(|p| p.1).unwrap_or(from_pos.1),
        path.get(25).map(|p| p.0).unwrap_or(from_pos.0),
        path.get(25).map(|p| p.1).unwrap_or(from_pos.1),
        path.get(37).map(|p| p.0).unwrap_or(to_pos.0),
        path.get(37).map(|p| p.1).unwrap_or(to_pos.1),
        to_pos.0,
        to_pos.1
    );

    rsx! {
        svg {
            class: "hi-node-graph-connections",
            "data-connection-id": "{id}",

            path {
                class: if selected { "hi-connection-selected" },
                d: "{path_d}",
                fill: "none",
                stroke: "var(--hi-color-primary)",
                "stroke-width": "2",
                "pointer-events": "stroke",
                onclick: move |_| on_click.call(id.clone()),
            }

            // Arrow head
            defs {
                marker {
                    id: "arrowhead",
                    "markerWidth": "10",
                    "markerHeight": "7",
                    "refX": "9",
                    "refY": "3.5",
                    "orient": "auto",
                    polygon {
                        points: "0 0, 10 3.5, 0 7",
                        fill: "var(--hi-color-primary)",
                    }
                }
            }
        }
    }
}
