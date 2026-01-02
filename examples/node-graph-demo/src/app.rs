// node-graph-demo/src/app.rs
// Main app component for node graph demo

use dioxus::prelude::*;

// Node data structure
#[derive(Clone, PartialEq, Debug)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub x: f64,
    pub y: f64,
    pub node_type: NodeType,
    pub inputs: Vec<Port>,
    pub outputs: Vec<Port>,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum NodeType {
    Input,
    Process,
    Output,
    #[allow(dead_code)]
    Conditional,
}

#[derive(Clone, PartialEq, Debug)]
pub struct Port {
    pub id: String,
    pub label: String,
    pub port_type: PortType,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum PortType {
    Data,
}

// Connection data structure
#[derive(Clone, PartialEq, Debug)]
pub struct Connection {
    pub id: String,
    pub from_node: String,
    pub from_port: String,
    pub to_node: String,
    pub to_port: String,
}

// Viewport state for zoom and pan
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Viewport {
    pub zoom: f64,
    pub pan_x: f64,
    pub pan_y: f64,
}

impl Default for Viewport {
    fn default() -> Self {
        Self {
            zoom: 1.0,
            pan_x: 0.0,
            pan_y: 0.0,
        }
    }
}

#[component]
pub fn App() -> Element {
    let mut nodes = use_signal(|| {
        vec![
            GraphNode {
                id: "node-1".to_string(),
                label: "Data Source".to_string(),
                x: 100.0,
                y: 200.0,
                node_type: NodeType::Input,
                inputs: vec![],
                outputs: vec![Port {
                    id: "port-1-out".to_string(),
                    label: "data".to_string(),
                    port_type: PortType::Data,
                }],
            },
            GraphNode {
                id: "node-2".to_string(),
                label: "Filter".to_string(),
                x: 400.0,
                y: 150.0,
                node_type: NodeType::Process,
                inputs: vec![Port {
                    id: "port-2-in".to_string(),
                    label: "input".to_string(),
                    port_type: PortType::Data,
                }],
                outputs: vec![Port {
                    id: "port-2-out".to_string(),
                    label: "filtered".to_string(),
                    port_type: PortType::Data,
                }],
            },
            GraphNode {
                id: "node-3".to_string(),
                label: "Transform".to_string(),
                x: 400.0,
                y: 350.0,
                node_type: NodeType::Process,
                inputs: vec![Port {
                    id: "port-3-in".to_string(),
                    label: "input".to_string(),
                    port_type: PortType::Data,
                }],
                outputs: vec![Port {
                    id: "port-3-out".to_string(),
                    label: "output".to_string(),
                    port_type: PortType::Data,
                }],
            },
            GraphNode {
                id: "node-4".to_string(),
                label: "Merge".to_string(),
                x: 700.0,
                y: 250.0,
                node_type: NodeType::Process,
                inputs: vec![
                    Port {
                        id: "port-4-in-1".to_string(),
                        label: "stream1".to_string(),
                        port_type: PortType::Data,
                    },
                    Port {
                        id: "port-4-in-2".to_string(),
                        label: "stream2".to_string(),
                        port_type: PortType::Data,
                    },
                ],
                outputs: vec![Port {
                    id: "port-4-out".to_string(),
                    label: "merged".to_string(),
                    port_type: PortType::Data,
                }],
            },
            GraphNode {
                id: "node-5".to_string(),
                label: "Output".to_string(),
                x: 1000.0,
                y: 250.0,
                node_type: NodeType::Output,
                inputs: vec![Port {
                    id: "port-5-in".to_string(),
                    label: "data".to_string(),
                    port_type: PortType::Data,
                }],
                outputs: vec![],
            },
        ]
    });

    let connections = use_signal(|| {
        vec![
            Connection {
                id: "conn-1".to_string(),
                from_node: "node-1".to_string(),
                from_port: "port-1-out".to_string(),
                to_node: "node-2".to_string(),
                to_port: "port-2-in".to_string(),
            },
            Connection {
                id: "conn-2".to_string(),
                from_node: "node-1".to_string(),
                from_port: "port-1-out".to_string(),
                to_node: "node-3".to_string(),
                to_port: "port-3-in".to_string(),
            },
            Connection {
                id: "conn-3".to_string(),
                from_node: "node-2".to_string(),
                from_port: "port-2-out".to_string(),
                to_node: "node-4".to_string(),
                to_port: "port-4-in-1".to_string(),
            },
            Connection {
                id: "conn-4".to_string(),
                from_node: "node-3".to_string(),
                from_port: "port-3-out".to_string(),
                to_node: "node-4".to_string(),
                to_port: "port-4-in-2".to_string(),
            },
            Connection {
                id: "conn-5".to_string(),
                from_node: "node-4".to_string(),
                from_port: "port-4-out".to_string(),
                to_node: "node-5".to_string(),
                to_port: "port-5-in".to_string(),
            },
        ]
    });

    let mut viewport = use_signal(Viewport::default);
    let mut selected_node = use_signal(|| Option::<String>::None);
    let mut is_dragging = use_signal(|| false);
    let mut drag_start = use_signal(|| (0.0, 0.0));

    rsx! {
        div { class: "node-graph-demo",
            style: "min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: system-ui, -apple-system, sans-serif;",

            // Header
            header {
                style: "background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); padding: 20px 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);",
                div {
                    style: "max-width: 100%; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;",
                    div {
                        h1 { style: "margin: 0; font-size: 28px; color: #1a1a2e;",
                            "Node Graph Demo"
                        }
                        p { style: "margin: 8px 0 0 0; color: #666; font-size: 14px;",
                            "Interactive node graph with connections, zoom, pan, and minimap"
                        }
                    }
                    div { style: "display: flex; gap: 12px;",
                        button {
                            onclick: move |_| {
                                viewport.set(Viewport::default());
                            },
                            style: "padding: 8px 16px; background: #4a9eff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;",
                            "Reset View"
                        }
                        button {
                            onclick: move |_| {
                                // Add a new node
                                let new_id = format!("node-{}", nodes().len() + 1);
                                let mut new_nodes = nodes().clone();
                                new_nodes.push(GraphNode {
                                    id: new_id.clone(),
                                    label: format!("Node {}", nodes().len() + 1),
                                    x: 500.0,
                                    y: 500.0,
                                    node_type: NodeType::Process,
                                    inputs: vec![Port {
                                        id: format!("{}-in", new_id),
                                        label: "input".to_string(),
                                        port_type: PortType::Data,
                                    }],
                                    outputs: vec![Port {
                                        id: format!("{}-out", new_id),
                                        label: "output".to_string(),
                                        port_type: PortType::Data,
                                    }],
                                });
                                nodes.set(new_nodes);
                            },
                            style: "padding: 8px 16px; background: #48bb78; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;",
                            "Add Node"
                        }
                    }
                }
            }

            // Toolbar
            div {
                style: "background: white; padding: 12px 40px; display: flex; gap: 16px; align-items: center; border-bottom: 1px solid #e0e0e0;",

                button {
                    onclick: move |_| {
                        let mut v = viewport();
                        v.zoom = (v.zoom * 1.2).min(3.0);
                        viewport.set(v);
                    },
                    style: "padding: 8px 12px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 14px;",
                    "Zoom In"
                }
                button {
                    onclick: move |_| {
                        let mut v = viewport();
                        v.zoom = (v.zoom / 1.2).max(0.3);
                        viewport.set(v);
                    },
                    style: "padding: 8px 12px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 14px;",
                    "Zoom Out"
                }
                div {
                    style: "margin-left: auto; display: flex; align-items: center; gap: 8px; font-size: 14px; color: #666;",
                    "Zoom: "
                    span { style: "font-weight: 500; color: #1a1a2e;",
                        {format!("{:.0}%", viewport().zoom * 100.0)}
                    }
                }
            }

            // Canvas area
            div {
                style: "position: relative; width: 100%; height: calc(100vh - 140px); background: #1a1a2e; overflow: hidden;",

                // Grid background
                div {
                    style: format!(
                        "position: absolute; width: 100%; height: 100%; background-image: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px); background-size: 20px 20px; transform: scale({}); transform-origin: 0 0;",
                        viewport().zoom
                    ),
                }

                // Node graph canvas
                svg {
                    style: format!(
                        "position: absolute; width: 100%; height: 100%; transform: translate({}, {}) scale({}); transform-origin: 0 0;",
                        viewport().pan_x,
                        viewport().pan_y,
                        viewport().zoom
                    ),
                    "width": "100%",
                    "height": "100%",

                    // Connections (Bezier curves)
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
                                fill: "#4a9eff",
                            }
                        }
                    }

                    {connections().iter().map(|conn| {
                        let nodes_vec = nodes();
                        let from_node = nodes_vec.iter().find(|n| n.id == conn.from_node);
                        let to_node = nodes_vec.iter().find(|n| n.id == conn.to_node);

                        if let (Some(from), Some(to)) = (from_node, to_node) {
                            let from_x = from.x + 200.0; // Right side of node
                            let from_y = from.y + 40.0;  // Center of port area
                            let to_x = to.x;             // Left side of node
                            let to_y = to.y + 40.0;      // Center of port area

                            // Bezier curve control points
                            let cp1_x = from_x + (to_x - from_x) * 0.5;
                            let cp1_y = from_y;
                            let cp2_x = to_x - (to_x - from_x) * 0.5;
                            let cp2_y = to_y;

                            rsx! {
                                path {
                                    key: "{conn.id}",
                                    d: format!(
                                        "M {} {} C {} {} {} {} {} {}",
                                        from_x, from_y,
                                        cp1_x, cp1_y,
                                        cp2_x, cp2_y,
                                        to_x, to_y
                                    ),
                                    stroke: "#4a9eff",
                                    "stroke-width": "2",
                                    fill: "none",
                                    "marker-end": "url(#arrowhead)",
                                    opacity: "0.8",
                                }
                            }
                        } else {
                            rsx! { "" }
                        }
                    })}

                    // Nodes
                    {nodes().iter().map(|node| {
                        let node_id = node.id.clone();
                        let is_selected = selected_node() == Some(node_id.clone());
                        let bg_color = match node.node_type {
                            NodeType::Input => "#48bb78",
                            NodeType::Output => "#f56565",
                            NodeType::Process => "#4a9eff",
                            NodeType::Conditional => "#ed8936",
                        };

                        rsx! {
                            g {
                                key: "{node.id}",
                                transform: format!("translate({}, {})", node.x, node.y),

                                // Node body
                                rect {
                                    x: "0",
                                    y: "0",
                                    width: "200",
                                    height: "80",
                                    fill: bg_color,
                                    rx: "8",
                                    stroke: if is_selected { "#fff" } else { "rgba(255,255,255,0.3)" },
                                    "stroke-width": if is_selected { "3" } else { "1" },
                                    style: "cursor: move; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));",
                                    onmousedown: move |e: MouseEvent| {
                                        selected_node.set(Some(node_id.clone()));
                                        is_dragging.set(true);
                                        let coords = e.coordinates().client();
                                        drag_start.set((coords.x, coords.y));
                                    },
                                }

                                // Node title
                                text {
                                    x: "100",
                                    y: "30",
                                    fill: "white",
                                    "text-anchor": "middle",
                                    "font-size": "14",
                                    "font-weight": "bold",
                                    style: "pointer-events: none;",
                                    {node.label.clone()}
                                }

                                // Input ports (left side)
                                {node.inputs.iter().enumerate().map(|(i, port)| {
                                    let port_y = 60.0 + i as f64 * 20.0;
                                    rsx! {
                                        circle {
                                            key: "in-{port.id}",
                                            cx: "0",
                                            cy: "{port_y}",
                                            r: "6",
                                            fill: "white",
                                            stroke: bg_color,
                                            "stroke-width": "2",
                                            style: "cursor: crosshair;",
                                        }
                                        text {
                                            x: "10",
                                            y: "{port_y + 4.0}",
                                            fill: "rgba(255,255,255,0.9)",
                                            "font-size": "10",
                                            style: "pointer-events: none;",
                                            {port.label.clone()}
                                        }
                                    }
                                })}

                                // Output ports (right side)
                                {node.outputs.iter().enumerate().map(|(i, port)| {
                                    let port_y = 60.0 + i as f64 * 20.0;
                                    rsx! {
                                        circle {
                                            key: "out-{port.id}",
                                            cx: "200",
                                            cy: "{port_y}",
                                            r: "6",
                                            fill: "white",
                                            stroke: bg_color,
                                            "stroke-width": "2",
                                            style: "cursor: crosshair;",
                                        }
                                    }
                                })}
                            }
                        }
                    })}
                }

                // Minimap
                div {
                    style: "position: absolute; bottom: 20px; right: 20px; width: 200px; height: 150px; background: rgba(26, 26, 46, 0.9); border: 2px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 8px;",
                    svg {
                        style: "width: 100%; height: 100%;",
                        "viewBox": "0 0 1200 800",
                        "preserveAspectRatio": "xMidYMid meet",

                        // Minimap nodes
                        {nodes().iter().map(|node| {
                            let color = match node.node_type {
                                NodeType::Input => "#48bb78",
                                NodeType::Output => "#f56565",
                                NodeType::Process => "#4a9eff",
                                NodeType::Conditional => "#ed8936",
                            };
                            rsx! {
                                rect {
                                    key: "mini-{node.id}",
                                    x: "{node.x / 5.0}",
                                    y: "{node.y / 5.0}",
                                    width: "40",
                                    height: "16",
                                    fill: color,
                                    rx: "2",
                                    opacity: "0.6",
                                }
                            }
                        })}

                        // Viewport indicator
                        rect {
                            x: "{(-viewport().pan_x / 5.0 / viewport().zoom).max(0.0)}",
                            y: "{(-viewport().pan_y / 5.0 / viewport().zoom).max(0.0)}",
                            width: "200", // Fixed size for minimap viewport indicator
                            height: "150",
                            fill: "none",
                            stroke: "white",
                            "stroke-width": "1",
                            "stroke-dasharray": "4 2",
                            opacity: "0.8",
                        }
                    }
                }

                // Info panel
                div {
                    style: "position: absolute; top: 20px; left: 20px; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); max-width: 300px;",
                    h3 { style: "margin: 0 0 12px 0; font-size: 16px; color: #1a1a2e;",
                        "Node Graph Controls"
                    }
                    ul { style: "margin: 0; padding-left: 20px; color: #666; font-size: 13px; line-height: 1.8;",
                        li { "Drag nodes to reposition" }
                        li { "Use toolbar to zoom in/out" }
                        li { "Click nodes to select" }
                        li { "Ports shown as circles" }
                        li { "Bezier curve connections" }
                        li { "Minimap for navigation" }
                    }

                    if let Some(node_id) = selected_node() {
                        div {
                            style: "margin-top: 16px; padding-top: 16px; border-top: 1px solid #e0e0e0;",
                            h4 { style: "margin: 0 0 8px 0; font-size: 14px; color: #1a1a2e;",
                                "Selected Node"
                            }
                            p { style: "margin: 0; color: #666; font-size: 13px;",
                                "{nodes().iter().find(|n| n.id == node_id).map(|n| n.label.clone()).unwrap_or_default()}"
                            }
                        }
                    }
                }

                // Stats
                div {
                    style: "position: absolute; bottom: 20px; left: 20px; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); padding: 12px 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);",
                    div { style: "display: flex; gap: 20px; font-size: 13px;",
                        div {
                            span { style: "color: #666;", "Nodes: " }
                            span { style: "color: #1a1a2e; font-weight: 500;", "{nodes().len()}" }
                        }
                        div {
                            span { style: "color: #666;", "Connections: " }
                            span { style: "color: #1a1a2e; font-weight: 500;", "{connections().len()}" }
                        }
                        div {
                            span { style: "color: #666;", "Zoom: " }
                            span { style: "color: #1a1a2e; font-weight: 500;",
                                {format!("{:.0}%", viewport().zoom * 100.0)}
                            }
                        }
                    }
                }
            }
        }
    }
}
