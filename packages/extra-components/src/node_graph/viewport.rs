// node_graph/viewport.rs
// Viewport state model - Framework Agnostic

/// Viewport state for pan and zoom
///
/// Previously a component. Now a pure state model.
#[derive(Clone, Debug, PartialEq)]
pub struct Viewport {
    /// Current zoom level
    pub zoom: f64,

    /// Current pan offset (x, y)
    pub pan: (f64, f64),

    /// Minimum zoom level
    pub min_zoom: f64,

    /// Maximum zoom level
    pub max_zoom: f64,
}

impl Default for Viewport {
    fn default() -> Self {
        Self::new()
    }
}

impl Viewport {
    /// Create a new viewport with default values
    pub fn new() -> Self {
        Self {
            zoom: 1.0,
            pan: (0.0, 0.0),
            min_zoom: 0.1,
            max_zoom: 3.0,
        }
    }

    /// Create with custom bounds
    pub fn with_bounds(min_zoom: f64, max_zoom: f64) -> Self {
        Self {
            zoom: 1.0,
            pan: (0.0, 0.0),
            min_zoom,
            max_zoom,
        }
    }

    /// Set zoom level (clamped)
    pub fn set_zoom(&mut self, zoom: f64) -> bool {
        let new_zoom = zoom.clamp(self.min_zoom, self.max_zoom);
        let changed = new_zoom != self.zoom;
        self.zoom = new_zoom;
        changed
    }

    /// Set pan offset
    pub fn set_pan(&mut self, x: f64, y: f64) {
        self.pan = (x, y);
    }

    /// Zoom in by a factor
    pub fn zoom_in(&mut self, factor: f64) -> bool {
        self.set_zoom(self.zoom * factor)
    }

    /// Zoom out by a factor
    pub fn zoom_out(&mut self, factor: f64) -> bool {
        self.set_zoom(self.zoom / factor)
    }

    /// Reset to default view
    pub fn reset(&mut self) {
        self.zoom = 1.0;
        self.pan = (0.0, 0.0);
    }

    /// Pan by a delta
    pub fn pan_by(&mut self, dx: f64, dy: f64) {
        self.pan.0 += dx;
        self.pan.1 += dy;
    }

    /// Check if can zoom in
    pub fn can_zoom_in(&self) -> bool {
        self.zoom < self.max_zoom
    }

    /// Check if can zoom out
    pub fn can_zoom_out(&self) -> bool {
        self.zoom > self.min_zoom
    }

    /// Get zoom as formatted string (e.g., "1.5x")
    pub fn zoom_text(&self) -> String {
        format!("{:.0}x", self.zoom)
    }

    /// Get the transform CSS string
    pub fn transform_style(&self) -> String {
        format!(
            "transform: scale({}) translate({}px, {}px);",
            self.zoom, self.pan.0, self.pan.1
        )
    }
}

/// Viewport configuration
#[derive(Clone, Debug, PartialEq)]
pub struct ViewportConfig {
    /// Whether to show zoom controls
    pub show_zoom: bool,

    /// Whether to show reset button
    pub show_reset: bool,

    /// Whether to show coordinates
    pub show_coords: bool,

    /// Additional CSS classes
    pub class: String,
}

impl Default for ViewportConfig {
    fn default() -> Self {
        Self {
            show_zoom: true,
            show_reset: true,
            show_coords: false,
            class: String::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_viewport_new() {
        let viewport = Viewport::new();
        assert_eq!(viewport.zoom, 1.0);
        assert_eq!(viewport.pan, (0.0, 0.0));
        assert_eq!(viewport.min_zoom, 0.1);
        assert_eq!(viewport.max_zoom, 3.0);
    }

    #[test]
    fn test_set_zoom() {
        let mut viewport = Viewport::new();
        assert!(viewport.set_zoom(2.0));
        assert_eq!(viewport.zoom, 2.0);

        // Should clamp to max
        assert!(!viewport.set_zoom(5.0));
        assert_eq!(viewport.zoom, 3.0);
    }

    #[test]
    fn test_zoom_in_out() {
        let mut viewport = Viewport::new();

        assert!(viewport.zoom_in(1.5));
        assert_eq!(viewport.zoom, 1.5);

        assert!(viewport.zoom_out(1.5));
        assert_eq!(viewport.zoom, 1.0);
    }

    #[test]
    fn test_reset() {
        let mut viewport = Viewport::new();
        viewport.zoom = 2.0;
        viewport.pan = (100.0, 200.0);

        viewport.reset();
        assert_eq!(viewport.zoom, 1.0);
        assert_eq!(viewport.pan, (0.0, 0.0));
    }

    #[test]
    fn test_pan_by() {
        let mut viewport = Viewport::new();
        viewport.pan_by(10.0, 20.0);
        assert_eq!(viewport.pan, (10.0, 20.0));

        viewport.pan_by(-5.0, -10.0);
        assert_eq!(viewport.pan, (5.0, 10.0));
    }

    #[test]
    fn test_can_zoom() {
        let viewport = Viewport::new();
        assert!(viewport.can_zoom_in());
        assert!(viewport.can_zoom_out());

        let mut viewport = Viewport::new();
        viewport.zoom = 3.0;
        assert!(!viewport.can_zoom_in());

        viewport.zoom = 0.1;
        assert!(!viewport.can_zoom_out());
    }

    #[test]
    fn test_zoom_text() {
        let viewport = Viewport {
            zoom: 1.5,
            ..Default::default()
        };
        assert_eq!(viewport.zoom_text(), "1x");

        let viewport = Viewport {
            zoom: 2.7,
            ..Default::default()
        };
        assert_eq!(viewport.zoom_text(), "3x");
    }
}
