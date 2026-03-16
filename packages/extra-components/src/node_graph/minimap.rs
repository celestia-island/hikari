// node_graph/minimap.rs
// Minimap state model - Framework Agnostic

/// Data model for node graph minimap
///
/// Previously a Dioxus component. Now a pure state model
/// that can be rendered with any framework.
#[derive(Clone, Debug, PartialEq)]
pub struct NodeGraphMinimap {
    /// Minimap width in pixels
    pub width: f64,

    /// Minimap height in pixels
    pub height: f64,

    /// Current zoom level of main canvas
    pub zoom: f64,

    /// Current pan of main canvas
    pub pan: (f64, f64),

    /// Nodes to display (positions are in canvas coordinates)
    pub nodes: Vec<MinimapNode>,

    /// Connections to display
    pub connections: Vec<MinimapConnection>,

    /// Whether the minimap is visible
    pub visible: bool,
}

/// A node as displayed in the minimap
#[derive(Clone, Debug, PartialEq)]
pub struct MinimapNode {
    pub id: String,
    pub position: (f64, f64),
    pub size: (f64, f64),
}

/// A connection as displayed in the minimap
#[derive(Clone, Debug, PartialEq)]
pub struct MinimapConnection {
    pub id: String,
    pub from: (f64, f64),
    pub to: (f64, f64),
}

impl NodeGraphMinimap {
    /// Create a new minimap state
    pub fn new(width: f64, height: f64) -> Self {
        Self {
            width,
            height,
            zoom: 1.0,
            pan: (0.0, 0.0),
            nodes: Vec::new(),
            connections: Vec::new(),
            visible: true,
        }
    }

    /// Update the view state (zoom and pan from main canvas)
    pub fn update_view(&mut self, zoom: f64, pan: (f64, f64)) {
        self.zoom = zoom;
        self.pan = pan;
    }

    /// Set the nodes to display
    pub fn set_nodes(&mut self, nodes: Vec<MinimapNode>) {
        self.nodes = nodes;
    }

    /// Set the connections to display
    pub fn set_connections(&mut self, connections: Vec<MinimapConnection>) {
        self.connections = connections;
    }

    /// Calculate the viewport rectangle in minimap coordinates
    pub fn viewport_rect(&self, canvas_width: f64, canvas_height: f64) -> (f64, f64, f64, f64) {
        // The viewport represents what's visible in the main canvas
        // Map canvas coordinates to minimap coordinates
        let scale_x = self.width / (canvas_width * self.zoom);
        let scale_y = self.height / (canvas_height * self.zoom);

        let vp_width = canvas_width * scale_x;
        let vp_height = canvas_height * scale_y;

        // Calculate viewport position based on pan
        let vp_x = -self.pan.0 * scale_x;
        let vp_y = -self.pan.1 * scale_y;

        (vp_x, vp_y, vp_width, vp_height)
    }

    /// Convert a click position in minimap to canvas pan coordinates
    pub fn click_to_pan(&self, click_x: f64, click_y: f64, canvas_width: f64, canvas_height: f64) -> (f64, f64) {
        // Reverse the viewport calculation
        let total_width = canvas_width * self.zoom;
        let total_height = canvas_height * self.zoom;

        let new_pan_x = (click_x / self.width) * total_width - total_width / 2.0;
        let new_pan_y = (click_y / self.height) * total_height - total_height / 2.0;

        (new_pan_x, new_pan_y)
    }

    /// Get the CSS style string for the minimap container
    pub fn container_style(&self) -> String {
        format!(
            "position: absolute; bottom: 10px; right: 10px; width: {}px; height: {}px;",
            self.width, self.height
        )
    }

    /// Get the CSS style string for the viewport indicator
    pub fn viewport_style(&self, canvas_width: f64, canvas_height: f64) -> String {
        let (x, y, w, h) = self.viewport_rect(canvas_width, canvas_height);
        format!(
            "position: absolute; left: {}px; top: {}px; width: {}px; height: {}px; border: 1px solid var(--hi-color-primary);",
            x, y, w, h
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_minimap_new() {
        let minimap = NodeGraphMinimap::new(200.0, 150.0);
        assert_eq!(minimap.width, 200.0);
        assert_eq!(minimap.height, 150.0);
        assert_eq!(minimap.zoom, 1.0);
        assert!(minimap.visible);
    }

    #[test]
    fn test_update_view() {
        let mut minimap = NodeGraphMinimap::new(200.0, 150.0);
        minimap.update_view(1.5, (10.0, 20.0));
        assert_eq!(minimap.zoom, 1.5);
        assert_eq!(minimap.pan, (10.0, 20.0));
    }

    #[test]
    fn test_viewport_rect() {
        let minimap = NodeGraphMinimap::new(200.0, 150.0);
        minimap.update_view(1.0, (0.0, 0.0));

        let (x, y, w, h) = minimap.viewport_rect(1200.0, 800.0);
        assert_eq!(x, 0.0);
        assert_eq!(y, 0.0);
        // Width and height should be scaled down
        assert!(w < 200.0);
        assert!(h < 150.0);
    }

    #[test]
    fn test_click_to_pan() {
        let minimap = NodeGraphMinimap::new(200.0, 150.0);
        let pan = minimap.click_to_pan(100.0, 75.0, 1200.0, 800.0);
        // Center click should result in centered pan
        assert_eq!(pan, (0.0, 0.0));
    }

    #[test]
    fn test_set_nodes() {
        let mut minimap = NodeGraphMinimap::new(200.0, 150.0);
        let nodes = vec![
            MinimapNode {
                id: "node1".to_string(),
                position: (100.0, 100.0),
                size: (200.0, 150.0),
            },
        ];

        minimap.set_nodes(nodes);
        assert_eq!(minimap.nodes.len(), 1);
    }
}
