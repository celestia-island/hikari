// demo-app/src/pages/node_graph_demo.rs
// Node graph demo page

use dioxus::prelude::*;
use dioxus_router::components::Link;

use crate::app::Route;

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

#[derive(Clone, PartialEq, Debug)]
pub struct Connection {
    pub id: String,
    pub from_node: String,
    pub from_port: String,
    pub to_node: String,
    pub to_port: String,
}

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
pub fn NodeGraphDemo() -> Element {
    let nodes = use_signal(|| {
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

    rsx! {
        // Node graph page is special - it takes over the full screen
        div { class: "node-graph-demo min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] font-sans",

            // Header
            header {
                class: "bg-white/95 backdrop-blur-sm p-5 lg:p-10 shadow-md",
                div { class: "max-w-full mx-auto flex justify-between items-center",
                    div {
                        h1 { class: "m-0 text-2xl lg:text-3xl text-[#1a1a2e]",
                            "Node Graph Demo"
                        }
                        p { class: "mt-2 text-gray-600 text-sm",
                            "Interactive node graph with connections, zoom, pan, and minimap"
                        }
                    }
                    div { class: "flex gap-3",
                        Link {
                            to: Route::Home {},
                            class: "px-4 py-2 bg-gray-500 text-white border-none rounded-md cursor-pointer font-medium hover:bg-gray-600",
                            "Back to Demo"
                        }
                        button {
                            onclick: move |_| {
                                viewport.set(Viewport::default());
                            },
                            class: "px-4 py-2 bg-[#4a9eff] text-white border-none rounded-md cursor-pointer font-medium hover:bg-blue-600",
                            "Reset View"
                        }
                    }
                }
            }

            // Toolbar
            div {
                class: "bg-white px-10 py-3 flex gap-4 items-center border-b border-gray-200",

                button {
                    onclick: move |_| {
                        let mut v = viewport();
                        v.zoom = (v.zoom * 1.2).min(3.0);
                        viewport.set(v);
                    },
                    class: "px-3 py-2 border border-gray-300 bg-white rounded cursor-pointer text-sm hover:bg-gray-50",
                    "Zoom In"
                }
                button {
                    onclick: move |_| {
                        let mut v = viewport();
                        v.zoom = (v.zoom / 1.2).max(0.3);
                        viewport.set(v);
                    },
                    class: "px-3 py-2 border border-gray-300 bg-white rounded cursor-pointer text-sm hover:bg-gray-50",
                    "Zoom Out"
                }
                div {
                    class: "ml-auto flex items-center gap-2 text-sm text-gray-600",
                    "Zoom: "
                    span { class: "font-medium text-[#1a1a2e]",
                        {format!("{:.0}%", viewport().zoom * 100.0)}
                    }
                }
            }

            // Canvas area
            div {
                class: "relative w-full h-[calc(100vh-180px)] bg-[#1a1a2e] overflow-hidden",

                // Grid background
                div {
                    class: "absolute w-full h-full bg-[radial-gradient(circle,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:20px_20px]",
                    style: format!("transform: scale({}); transform-origin: 0 0;", viewport().zoom),
                }

                // Node graph canvas
                svg {
                    class: "absolute w-full h-full",
                    style: format!("transform: translate({}, {}) scale({}); transform-origin: 0 0;", viewport().pan_x, viewport().pan_y, viewport().zoom),
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
                            let from_x = from.x + 200.0;
                            let from_y = from.y + 40.0;
                            let to_x = to.x;
                            let to_y = to.y + 40.0;

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
                                    class: "cursor-move drop-shadow-md hover:drop-shadow-lg",
                                    onclick: move |_| {
                                        selected_node.set(Some(node_id.clone()));
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
                                    class: "pointer-events-none",
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
                                            class: "cursor-crosshair",
                                        }
                                        text {
                                            x: "10",
                                            y: "{port_y + 4.0}",
                                            fill: "rgba(255,255,255,0.9)",
                                            "font-size": "10",
                                            class: "pointer-events-none",
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
                                            class: "cursor-crosshair",
                                        }
                                    }
                                })}
                            }
                        }
                    })}
                }

                // Minimap
                div {
                    class: "absolute bottom-5 right-5 w-[200px] h-[150px] bg-[#1a1a2e]/90 border-2 border-white/20 rounded-lg p-2",
                    svg {
                        class: "w-full h-full",
                        "viewBox": "0 0 1200 800",
                        "preserveAspectRatio": "xMidYMid meet",

                        // Minimap nodes
                        {nodes().iter().map(|node| {
                            let color = match node.node_type {
                                NodeType::Input => "#48bb78",
                                NodeType::Output => "#f56565",
                                NodeType::Process => "#4a9eff",
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
                            width: "200",
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
                    class: "absolute top-5 left-5 bg-white/95 backdrop-blur-sm p-5 rounded-lg shadow-xl max-w-[300px]",
                    h3 { class: "m-0 mb-3 text-base text-[#1a1a2e]",
                        "Node Graph Controls"
                    }
                    ul { class: "m-0 pl-5 text-gray-600 text-sm leading-relaxed",
                        li { "Click nodes to select" }
                        li { "Use toolbar to zoom in/out" }
                        li { "Ports shown as circles" }
                        li { "Bezier curve connections" }
                        li { "Minimap for navigation" }
                    }

                    if let Some(node_id) = selected_node() {
                        div {
                            class: "mt-4 pt-4 border-t border-gray-200",
                            h4 { class: "m-0 mb-2 text-sm text-[#1a1a2e]",
                                "Selected Node"
                            }
                            p { class: "m-0 text-gray-600 text-sm",
                                "{nodes().iter().find(|n| n.id == node_id).map(|n| n.label.clone()).unwrap_or_default()}"
                            }
                        }
                    }
                }

                // Stats
                div {
                    class: "absolute bottom-5 left-5 bg-white/95 backdrop-blur-sm p-3 px-4 rounded-lg shadow-xl",
                    div { class: "flex gap-5 text-sm",
                        div {
                            span { class: "text-gray-600", "Nodes: " }
                            span { class: "text-[#1a1a2e] font-medium", "{nodes().len()}" }
                        }
                        div {
                            span { class: "text-gray-600", "Connections: " }
                            span { class: "text-[#1a1a2e] font-medium", "{connections().len()}" }
                        }
                        div {
                            span { class: "text-gray-600", "Zoom: " }
                            span { class: "text-[#1a1a2e] font-medium",
                                {format!("{:.0}%", viewport().zoom * 100.0)}
                            }
                        }
                    }
                }
            }
        }
    }
}
