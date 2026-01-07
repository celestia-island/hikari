# hikari-extra-components

Advanced components for building complex interfaces, including node graph systems, drag-drop utilities, and zoom controls.

## Overview

`hikari-extra-components` provides:

- **Node Graph System** - Visual node editors with canvas, connections, ports, and minimap
- **Drag Layer** - Advanced drag-drop functionality
- **Collapsible** - Animated collapsible panels
- **Zoom Controls** - Zoomable containers with smooth scaling
- **Perfect For** - Visual editors, workflow builders, data visualization, node-based tools

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
hikari-extra-components = "0.1.0"
hikari-components = "0.1.0"
hikari-theme = "0.1.0"
```

## Node Graph System

A comprehensive node graph system for building visual node-based editors.

### Basic Node Graph

```rust
use hikari_extra_components::{NodeGraph, Node, Port};

fn app() -> Element {
    let mut nodes = use_signal(|| vec![
        Node {
            id: "node1".to_string(),
            position: (100.0, 100.0),
            inputs: vec![Port { id: "in1".to_string(), label: "Input".to_string() }],
            outputs: vec![Port { id: "out1".to_string(), label: "Output".to_string() }],
            data: node_data,
        },
        // ... more nodes
    ]);

    rsx! {
        NodeGraph {
            nodes: nodes(),
            connections: connections(),
            onnodechange: move |n| nodes.set(n),
            onconnect: move |c| connections.write().push(c),
            ondisconnect: move |c| {
                connections.write().retain(|x| x != c);
            }
        }
    }
}
```

### Node Graph Features

#### Canvas
Infinite canvas with pan and zoom:

```rust
NodeGraph {
    nodes: nodes(),
    canvas: CanvasConfig {
        zoomable: true,
        pannable: true,
        min_zoom: 0.1,
        max_zoom: 5.0,
        initial_zoom: 1.0,
    }
}
```

#### Connections
Bezier curve connections between ports:

```rust
Connection {
    source_node: "node1".to_string(),
    source_port: "output".to_string(),
    target_node: "node2".to_string(),
    target_port: "input".to_string(),
    style: ConnectionStyle::Bezier {
        tension: 0.5,
        color: "#3B82F6".to_string()
    }
}
```

#### Minimap
Overview minimap for navigation:

```rust
NodeGraph {
    nodes: nodes(),
    minimap: Some(MinimapConfig {
        position: MinimapPosition::BottomRight,
        width: 200,
        height: 150,
        zoomable: true
    })
}
```

#### Context Menu
Custom context menu for nodes:

```rust
NodeGraph {
    nodes: nodes(),
    context_menu: vec![
        ContextMenuItem {
            label: "Delete".to_string(),
            action: ContextMenuAction::DeleteNode,
            icon: "trash"
        },
        ContextMenuItem {
            label: "Duplicate".to_string(),
            action: ContextMenuAction::DuplicateNode,
            icon: "copy"
        },
    ]
}
```

### Node Graph Example

```rust
use hikari_extra_components::prelude::*;

#[component]
fn NodeEditor() -> Element {
    let mut nodes = use_signal(|| initialize_nodes());
    let mut connections = use_signal(Vec::new);
    let mut selected = use_signal(HashSet::new);
    let mut transform = use_signal(|| Transform {
        x: 0.0,
        y: 0.0,
        scale: 1.0,
    });

    rsx! {
        NodeGraph {
            nodes: nodes(),
            connections: connections(),
            selected: selected().clone(),
            transform: transform(),

            onnodechange: move |updated| {
                nodes.set(updated);
            },

            onconnect: move |conn| {
                connections.write().push(conn);
            },

            ondisconnect: move |conn| {
                connections.write().retain(|c| c != &conn);
            },

            onselect: move |node_ids| {
                selected.set(node_ids);
            },

            ontransformchange: move |t| {
                transform.set(t);
            },

            // Optional features
            minimap: Some(MinimapConfig::default()),
            grid: Some(GridConfig {
                spacing: 20,
                color: "#333333".to_string(),
            }),
            snap_to_grid: true,
        }
    }
}
```

## Extra Utilities

### Collapsible

Animated collapsible panel with smooth transitions.

```rust
use hikari_extra_components::Collapsible;

fn app() -> Element {
    let mut is_open = use_signal(|| true);

    rsx! {
        Collapsible {
            is_open: is_open(),
            duration: 300,
            header: rsx! {
                div {
                    onclick: move |_| is_open.toggle(),
                    "Click to toggle"
                }
            },
            div { class: "content",
                p { "This content can be collapsed" }
                p { "Smooth animation when opening/closing" }
            }
        }
    }
}
```

**Props:**
- `is_open: bool` - Whether content is visible
- `duration: u64` - Animation duration in ms
- `header: Element` - Clickable header element
- `class: String` - Additional CSS classes
- `children: Element` - Collapsible content

### DragLayer

Advanced drag-drop layer with coordinate transformation.

```rust
use hikari_extra_components::DragLayer;

fn app() -> Element {
    let mut position = use_signal(|| (0.0, 0.0));
    let mut is_dragging = use_signal(|| false);

    rsx! {
        DragLayer {
            ondragstart: move |start| {
                is_dragging.set(true);
            },
            ondragmove: move |pos| {
                position.set(pos);
            },
            ondragend: move |end| {
                is_dragging.set(false);
            },
            div {
                class: "draggable",
                style: "position: absolute; left: {position.0}px; top: {position.1}px;",
                "Drag me around!"
            }
        }
    }
}
```

**Props:**
- `ondragstart: EventHandler<(f64, f64)>` - Drag start handler
- `ondragmove: EventHandler<(f64, f64)>` - Drag move handler
- `ondragend: EventHandler<(f64, f64)>` - Drag end handler
- `disabled: bool` - Disable dragging
- `class: String` - Additional CSS classes
- `children: Element` - Draggable content

### ZoomControls

Zoomable container with mouse wheel and button controls.

```rust
use hikari_extra_components::ZoomControls;

fn app() -> Element {
    let mut zoom = use_signal(|| 1.0);

    rsx! {
        ZoomControls {
            zoom: zoom(),
            min_zoom: 0.5,
            max_zoom: 3.0,
            onzoomchange: move |z| zoom.set(z),
            show_controls: true,
            controls_position: ControlsPosition::BottomRight,
            div {
                style: "transform: scale({zoom}); transform-origin: center;",
                div { class: "zoomable-content",
                    h1 { "Zoomable Content" }
                    p { "Use mouse wheel or buttons to zoom" }
                }
            }
        }
    }
}
```

**Props:**
- `zoom: f64` - Current zoom level
- `min_zoom: f64` - Minimum zoom level
- `max_zoom: f64` - Maximum zoom level
- `onzoomchange: EventHandler<f64>` - Zoom change handler
- `show_controls: bool` - Show zoom buttons
- `controls_position: ControlsPosition` - Control button position
- `wheel_enabled: bool` - Enable mouse wheel zoom
- `class: String` - Additional CSS classes
- `children: Element` - Zoomable content

## Advanced Features

### Custom Node Types

Define custom node types for different use cases:

```rust
#[derive(Clone, PartialEq)]
pub enum NodeType {
    Data,
    Operation,
    Condition,
    Loop,
}

impl NodeType {
    pub fn color(&self) -> &'static str {
        match self {
            NodeType::Data => "#3B82F6",
            NodeType::Operation => "#10B981",
            NodeType::Condition => "#F59E0B",
            NodeType::Loop => "#8B5CF6",
        }
    }
}

pub struct CustomNode {
    pub id: String,
    pub position: (f64, f64),
    pub node_type: NodeType,
    pub inputs: Vec<Port>,
    pub outputs: Vec<Port>,
    pub custom_data: serde_json::Value,
}
```

### Node Execution

Execute node graph logic:

```rust
pub struct NodeExecutor {
    nodes: HashMap<String, Node>,
    connections: Vec<Connection>,
}

impl NodeExecutor {
    pub fn execute(&self, entry_node: &str) -> Result<ExecutionResult, Error> {
        let mut context = ExecutionContext::new();
        let mut queue = VecDeque::new();
        queue.push_back(entry_node.to_string());

        while let Some(node_id) = queue.pop_front() {
            let node = self.nodes.get(&node_id)
                .ok_or(Error::NodeNotFound(node_id.clone()))?;

            // Execute node logic
            let result = self.execute_node(node, &mut context)?;

            // Find connected nodes
            let next_nodes = self.find_connected_nodes(&node_id);
            queue.extend(next_nodes);
        }

        Ok(context.result)
    }
}
```

### Serialization

Save and load node graphs:

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct NodeGraphData {
    pub nodes: Vec<NodeData>,
    pub connections: Vec<ConnectionData>,
    pub metadata: GraphMetadata,
}

impl NodeGraphData {
    pub fn to_json(&self) -> Result<String, Error> {
        serde_json::to_string_pretty(self)
            .map_err(Error::SerializationError)
    }

    pub fn from_json(json: &str) -> Result<Self, Error> {
        serde_json::from_str(json)
            .map_err(Error::DeserializationError)
    }
}
```

## Use Cases

### Visual Programming Language

Build a visual programming interface:

```rust
rsx! {
    NodeGraph {
        nodes: vec![
            create_input_node("input1", "Number Input"),
            create_operation_node("op1", "Add"),
            create_output_node("output1", "Result"),
        ],
        connections: vec![
            create_connection("input1", "output", "op1", "input_a"),
            create_connection("op1", "output", "output1", "input"),
        ],
        onexecute: move || execute_graph()
    }
}
```

### Workflow Builder

Build a workflow automation editor:

```rust
rsx! {
    NodeGraph {
        nodes: workflow_nodes(),
        onexecute: move || {
            execute_workflow(
                workflow_nodes(),
                workflow_connections()
            )
        }
    }
}
```

### Shader Editor

Create a visual shader editor:

```rust
rsx! {
    NodeGraph {
        nodes: shader_nodes(),
        shader_preview: shader_code(),
        ongraphchange: move |(nodes, connections)| {
            let code = generate_shader_code(nodes, connections);
            shader_code.set(code);
            update_preview(&code);
        }
    }
}
```

## Styling

### Node Graph Styles

Customize the node graph appearance:

```css
.hikari-node-graph {
    background-color: var(--hi-color-background);
    background-image:
        linear-gradient(var(--hi-color-border) 1px, transparent 1px),
        linear-gradient(90deg, var(--hi-color-border) 1px, transparent 1px);
    background-size: 20px 20px;
}

.hikari-node {
    background-color: var(--hi-color-surface);
    border: 2px solid var(--hi-color-border);
    border-radius: var(--hi-radius-lg);
    box-shadow: var(--hi-shadow-lg);
}

.hikari-node.selected {
    border-color: var(--hi-color-primary);
    box-shadow: 0 0 10px var(--hi-color-primary);
}

.hikari-port {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: var(--hi-color-border);
    transition: all var(--hi-transition-fast);
}

.hikari-port:hover {
    background-color: var(--hi-color-primary);
    transform: scale(1.2);
}

.hikari-connection {
    stroke: var(--hi-color-primary);
    stroke-width: 2;
    fill: none;
}
```

## Performance Tips

1. **Virtual Scrolling** - Enable for large node graphs
2. **Connection Caching** - Cache connection calculations
3. **Selective Rendering** - Only render visible nodes
4. **Web Workers** - Execute graph logic off main thread
5. **Incremental Updates** - Update only changed nodes

## API Reference

### NodeGraph

Main node graph component.

**Props:**
- `nodes: Vec<Node>` - Graph nodes
- `connections: Vec<Connection>` - Node connections
- `selected: HashSet<String>` - Selected node IDs
- `transform: Transform` - Canvas transform (x, y, scale)
- `onnodechange: EventHandler<Vec<Node>>` - Node change handler
- `onconnect: EventHandler<Connection>` - Connection handler
- `ondisconnect: EventHandler<Connection>` - Disconnect handler
- `onselect: EventHandler<HashSet<String>>` - Selection handler
- `ontransformchange: EventHandler<Transform>` - Transform handler
- `minimap: Option<MinimapConfig>` - Minimap configuration
- `grid: Option<GridConfig>` - Grid configuration
- `snap_to_grid: bool` - Enable snap to grid

## Examples

See the [examples](../../examples/) directory:
- `node-graph-demo/` - Full node graph editor demonstration

## License

MIT OR Apache-2.0
