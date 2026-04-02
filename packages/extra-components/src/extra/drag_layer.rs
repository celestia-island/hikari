//! Drag layer - Framework Agnostic State Model
//!
//! ## Migration Notice
//!
//! Previously a Dioxus component with mouse event handling.
//! Now provides a pure state model for drag and drop functionality.

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

impl DragConstraints {
    /// Create new constraints with all bounds
    pub fn new(
        min_x: Option<f64>,
        max_x: Option<f64>,
        min_y: Option<f64>,
        max_y: Option<f64>,
    ) -> Self {
        Self {
            min_x,
            max_x,
            min_y,
            max_y,
        }
    }

    /// Create horizontal-only constraints
    pub fn horizontal(min: f64, max: f64) -> Self {
        Self {
            min_x: Some(min),
            max_x: Some(max),
            min_y: None,
            max_y: None,
        }
    }

    /// Create vertical-only constraints
    pub fn vertical(min: f64, max: f64) -> Self {
        Self {
            min_x: None,
            max_x: None,
            min_y: Some(min),
            max_y: Some(max),
        }
    }

    /// Create bounded constraints (all directions)
    pub fn bounded(min_x: f64, max_x: f64, min_y: f64, max_y: f64) -> Self {
        Self {
            min_x: Some(min_x),
            max_x: Some(max_x),
            min_y: Some(min_y),
            max_y: Some(max_y),
        }
    }

    /// Constrain a value within the X bounds
    pub fn constrain_x(&self, x: f64) -> f64 {
        let mut constrained = x;
        if let Some(min) = self.min_x {
            constrained = constrained.max(min);
        }
        if let Some(max) = self.max_x {
            constrained = constrained.min(max);
        }
        constrained
    }

    /// Constrain a value within the Y bounds
    pub fn constrain_y(&self, y: f64) -> f64 {
        let mut constrained = y;
        if let Some(min) = self.min_y {
            constrained = constrained.max(min);
        }
        if let Some(max) = self.max_y {
            constrained = constrained.min(max);
        }
        constrained
    }

    /// Constrain both X and Y values
    pub fn constrain(&self, x: f64, y: f64) -> (f64, f64) {
        (self.constrain_x(x), self.constrain_y(y))
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

impl DragData {
    /// Calculate the delta from start position
    pub fn delta(&self) -> (f64, f64) {
        (self.x - self.start_x, self.y - self.start_y)
    }
}

/// State model for a drag layer
///
/// ## Example
///
/// ```rust
/// use hikari_extra_components::extra::{DragLayerState, DragConstraints};
///
/// let mut state = DragLayerState::new();
/// state.position = (100.0, 100.0);
/// state.constraints = DragConstraints::bounded(0.0, 500.0, 0.0, 500.0);
///
/// // Update position based on drag
/// let new_pos = state.constrain_position(150.0, 150.0);
/// state.position = new_pos;
/// ```
#[derive(Clone, PartialEq, Debug)]
pub struct DragLayerState {
    /// Current position (x, y)
    pub position: (f64, f64),

    /// Whether currently dragging
    pub is_dragging: bool,

    /// Drag start position
    pub drag_start: (f64, f64),

    /// Offset when drag started
    pub offset_start: (f64, f64),

    /// Boundary constraints for dragging
    pub constraints: DragConstraints,

    /// Z-index of the layer
    pub z_index: i32,

    /// Whether the layer is currently draggable
    pub draggable: bool,

    /// Additional CSS classes
    pub class: String,
}

impl DragLayerState {
    /// Create a new drag layer state with default values
    pub fn new() -> Self {
        Self {
            position: (0.0, 0.0),
            is_dragging: false,
            drag_start: (0.0, 0.0),
            offset_start: (0.0, 0.0),
            constraints: DragConstraints::default(),
            z_index: 1000,
            draggable: true,
            class: String::new(),
        }
    }

    /// Create with initial position
    pub fn with_position(mut self, x: f64, y: f64) -> Self {
        self.position = (x, y);
        self
    }

    /// Set the constraints
    pub fn with_constraints(mut self, constraints: DragConstraints) -> Self {
        self.constraints = constraints;
        self
    }

    /// Set the z-index
    pub fn with_z_index(mut self, z_index: i32) -> Self {
        self.z_index = z_index;
        self
    }

    /// Set whether draggable
    pub fn with_draggable(mut self, draggable: bool) -> Self {
        self.draggable = draggable;
        self
    }

    /// Add a CSS class
    pub fn with_class(mut self, class: impl Into<String>) -> Self {
        self.class = class.into();
        self
    }

    /// Start dragging at the given position
    pub fn start_drag(&mut self, x: f64, y: f64) {
        if self.draggable {
            self.is_dragging = true;
            self.drag_start = (x, y);
            self.offset_start = self.position;
        }
    }

    /// Update position during drag
    pub fn update_drag(&mut self, x: f64, y: f64) -> DragData {
        if self.is_dragging {
            let delta_x = x - self.drag_start.0;
            let delta_y = y - self.drag_start.1;

            let new_x = self.constraints.constrain_x(self.offset_start.0 + delta_x);
            let new_y = self.constraints.constrain_y(self.offset_start.1 + delta_y);

            self.position = (new_x, new_y);

            DragData {
                x: new_x,
                y: new_y,
                start_x: self.offset_start.0,
                start_y: self.offset_start.1,
            }
        } else {
            DragData {
                x: self.position.0,
                y: self.position.1,
                start_x: self.position.0,
                start_y: self.position.1,
            }
        }
    }

    /// End dragging
    pub fn end_drag(&mut self) -> DragData {
        self.is_dragging = false;
        DragData {
            x: self.position.0,
            y: self.position.1,
            start_x: self.offset_start.0,
            start_y: self.offset_start.1,
        }
    }

    /// Constrain a position with the current constraints
    pub fn constrain_position(&self, x: f64, y: f64) -> (f64, f64) {
        self.constraints.constrain(x, y)
    }

    /// Get the CSS style string for positioning
    pub fn position_style(&self) -> String {
        format!(
            "position: absolute; left: {}px; top: {}px; z-index: {}; cursor: {};",
            self.position.0,
            self.position.1,
            self.z_index,
            if self.draggable { "move" } else { "default" }
        )
    }

    /// Get the CSS class string including dragging state
    pub fn class_string(&self) -> String {
        let base = if self.class.is_empty() {
            "hi-drag-layer".to_string()
        } else {
            format!("hi-drag-layer {}", self.class)
        };

        if self.is_dragging {
            format!("{} hi-dragging", base)
        } else {
            base
        }
    }
}

impl Default for DragLayerState {
    fn default() -> Self {
        Self::new()
    }
}

/// Events emitted by the drag layer
#[derive(Clone, PartialEq, Debug)]
pub enum DragLayerEvent {
    /// Drag started
    DragStart(DragData),
    /// Drag moved
    DragMove(DragData),
    /// Drag ended
    DragEnd(DragData),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_drag_layer_state_new() {
        let state = DragLayerState::new();
        assert_eq!(state.position, (0.0, 0.0));
        assert!(!state.is_dragging);
        assert!(state.draggable);
        assert_eq!(state.z_index, 1000);
    }

    #[test]
    fn test_drag_constraints_constrain() {
        let constraints = DragConstraints::bounded(0.0, 100.0, 0.0, 100.0);

        assert_eq!(constraints.constrain(50.0, 50.0), (50.0, 50.0));
        assert_eq!(constraints.constrain(-10.0, 50.0), (0.0, 50.0));
        assert_eq!(constraints.constrain(150.0, 50.0), (100.0, 50.0));
    }

    #[test]
    fn test_drag_lifecycle() {
        let mut state = DragLayerState::new().with_position(100.0, 100.0);

        // Start drag
        state.start_drag(100.0, 100.0);
        assert!(state.is_dragging);

        // Update drag
        let data = state.update_drag(120.0, 120.0);
        assert_eq!(data.x, 120.0);
        assert_eq!(data.y, 120.0);
        assert_eq!(state.position, (120.0, 120.0));

        // End drag
        let data = state.end_drag();
        assert!(!state.is_dragging);
        assert_eq!(data.x, 120.0);
    }

    #[test]
    fn test_drag_with_constraints() {
        let constraints = DragConstraints::bounded(0.0, 200.0, 0.0, 200.0);
        let mut state = DragLayerState::new()
            .with_position(100.0, 100.0)
            .with_constraints(constraints);

        state.start_drag(100.0, 100.0);
        state.update_drag(-50.0, -50.0); // Try to go negative
        // delta = -150, new position = 100 - 150 = -50, constrained to 0
        assert_eq!(state.position, (0.0, 0.0)); // Should be constrained to 0

        state.update_drag(300.0, 300.0); // Try to go beyond bounds
        // delta = 200, new position = 0 + 200 = 200, constrained to 200
        assert_eq!(state.position, (200.0, 200.0)); // Should be constrained to 200
    }

    #[test]
    fn test_drag_data_delta() {
        let data = DragData {
            x: 150.0,
            y: 150.0,
            start_x: 100.0,
            start_y: 100.0,
        };

        assert_eq!(data.delta(), (50.0, 50.0));
    }

    #[test]
    fn test_builder_pattern() {
        let state = DragLayerState::new()
            .with_position(50.0, 50.0)
            .with_z_index(2000)
            .with_draggable(false)
            .with_class("my-drag-layer");

        assert_eq!(state.position, (50.0, 50.0));
        assert_eq!(state.z_index, 2000);
        assert!(!state.draggable);
        assert_eq!(state.class, "my-drag-layer");
    }

    #[test]
    fn test_position_style() {
        let state = DragLayerState::new().with_position(123.0, 456.0);
        let style = state.position_style();
        assert!(style.contains("left: 123px"));
        assert!(style.contains("top: 456px"));
    }
}
