// hikari-extra-components/src/node_graph/minimap.rs
// Minimap component for node graph overview

use dioxus::prelude::*;

/// Node type for color coding
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum NodeType {
    Operation,
    Data,
    Function,
    Condition,
    Loop,
    Comment,
    Custom,
}

impl NodeType {
    /// Get color for node type
    pub fn color(&self) -> &'static str {
        match self {
            NodeType::Operation => "#FF6B6B",      // Red
            NodeType::Data => "#4ECDC4",           // Teal
            NodeType::Function => "#45B7D1",        // Blue
            NodeType::Condition => "#FFA07A",       // Orange
            NodeType::Loop => "#98D8C8",           // Green
            NodeType::Comment => "#F7DC6F",        // Yellow
            NodeType::Custom => "#BB8FCE",         // Purple
        }
    }
}

/// Node rectangle for minimap
#[derive(Clone, PartialEq, Debug)]
pub struct MinimapNode {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub node_type: NodeType,
}

impl MinimapNode {
    pub fn new(
        id: impl Into<String>,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        node_type: NodeType,
    ) -> Self {
        Self {
            id: id.into(),
            x,
            y,
            width,
            height,
            node_type,
        }
    }
}

/// Viewport rectangle
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct ViewportRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl ViewportRect {
    pub fn new(x: f64, y: f64, width: f64, height: f64) -> Self {
        Self { x, y, width, height }
    }
}

/// Minimap position
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MinimapPosition {
    #[default]
    TopRight,
    TopLeft,
    BottomRight,
    BottomLeft,
}

impl MinimapPosition {
    /// Get CSS positioning
    pub fn css_position(&self) -> &'static str {
        match self {
            MinimapPosition::TopRight => "top: 16px; right: 16px;",
            MinimapPosition::TopLeft => "top: 16px; left: 16px;",
            MinimapPosition::BottomRight => "bottom: 16px; right: 16px;",
            MinimapPosition::BottomLeft => "bottom: 16px; left: 16px;",
        }
    }
}

/// Minimap component props
#[derive(Props, Clone, PartialEq)]
pub struct MinimapProps {
    /// Nodes to display on minimap
    pub nodes: Vec<MinimapNode>,

    /// Current viewport rectangle
    pub viewport_rect: ViewportRect,

    /// World bounds (total size of the node graph)
    pub world_bounds: ViewportRect,

    /// Minimap position (default: TopRight)
    #[props(default = MinimapPosition::TopRight)]
    pub position: MinimapPosition,

    /// Minimap width in pixels (default: 200)
    #[props(default = 200.0)]
    pub width: f64,

    /// Minimap height in pixels (default: 150)
    #[props(default = 150.0)]
    pub height: f64,
}

/// Minimap component
///
/// Features:
/// - Scaled-down representation of node graph
/// - Viewport indicator showing current visible area
/// - Color-coded node rectangles by type
/// - FUI-style glow effect
#[component]
pub fn Minimap(props: MinimapProps) -> Element {
    // Calculate scale factor to fit world into minimap
    let scale_x = props.width / props.world_bounds.width.max(1.0);
    let scale_y = props.height / props.world_bounds.height.max(1.0);
    let scale = scale_x.min(scale_y);

    // Calculate world to minimap transformation
    let world_to_minimap = |world_x: f64, world_y: f64| -> (f64, f64) {
        let minimap_x = (world_x - props.world_bounds.x) * scale;
        let minimap_y = (world_y - props.world_bounds.y) * scale;
        (minimap_x, minimap_y)
    };

    // Generate SVG content
    let mut svg_elements = String::from(r#"<rect width="100%" height="100%" fill="rgba(20, 20, 30, 0.9)" rx="4"/>"#);

    // Draw background grid (futuristic UI style)
    svg_elements.push_str(
        r#"<defs>
            <pattern id="minimap-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.05)" stroke-width="0.5"/>
            </pattern>
            <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#minimap-grid)"/>"#
    );

    // Draw nodes
    for node in &props.nodes {
        let (x, y) = world_to_minimap(node.x, node.y);
        let width = node.width * scale;
        let height = node.height * scale;
        let color = node.node_type.color();

        svg_elements.push_str(&format!(
            r#"<rect x="{}" y="{}" width="{}" height="{}" fill="{}" fill-opacity="0.6" stroke="{}" stroke-width="0.5" stroke-opacity="0.8" rx="1"/>"#,
            x, y, width, height, color, color
        ));
    }

    // Draw viewport indicator
    let (vp_x, vp_y) = world_to_minimap(props.viewport_rect.x, props.viewport_rect.y);
    let vp_width = props.viewport_rect.width * scale;
    let vp_height = props.viewport_rect.height * scale;

    svg_elements.push_str(&format!(
        r#"<rect x="{}" y="{}" width="{}" height="{}"
              fill="rgba(69, 183, 209, 0.2)"
              stroke="#45B7D1"
              stroke-width="1"
              stroke-opacity="0.8"
              rx="2"
              filter="url(#glow)"
              class="hikari-minimap-viewport"
              style="cursor: move;"/>"#,
        vp_x, vp_y, vp_width, vp_height
    ));

    rsx! {
        div {
            class: "hikari-minimap",
            style: format!(
                "position: absolute; {}; width: {}px; height: {}px; \
                 border: 1px solid rgba(69, 183, 209, 0.3); \
                 border-radius: 4px; \
                 box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5), \
                             inset 0 0 20px rgba(69, 183, 209, 0.1); \
                 overflow: hidden; \
                 cursor: crosshair; \
                 backdrop-filter: blur(4px); \
                 z-index: 1000; \
                 pointer-events: auto;",
                props.position.css_position(),
                props.width,
                props.height
            ),

            // SVG minimap content
            svg {
                "xmlns": "http://www.w3.org/2000/svg",
                width: "100%",
                height: "100%",
                style: "display: block;",
                dangerous_inner_html: svg_elements,
            }
        }
    }
}

/// Helper to calculate world bounds from a list of nodes
pub fn calculate_world_bounds(nodes: &[MinimapNode], padding: f64) -> ViewportRect {
    if nodes.is_empty() {
        return ViewportRect::new(0.0, 0.0, 1000.0, 1000.0);
    }

    let min_x = nodes.iter().map(|n| n.x).fold(f64::INFINITY, f64::min);
    let min_y = nodes.iter().map(|n| n.y).fold(f64::INFINITY, f64::min);
    let max_x = nodes.iter().map(|n| n.x + n.width).fold(f64::NEG_INFINITY, f64::max);
    let max_y = nodes.iter().map(|n| n.y + n.height).fold(f64::NEG_INFINITY, f64::max);

    ViewportRect {
        x: min_x - padding,
        y: min_y - padding,
        width: (max_x - min_x) + padding * 2.0,
        height: (max_y - min_y) + padding * 2.0,
    }
}
