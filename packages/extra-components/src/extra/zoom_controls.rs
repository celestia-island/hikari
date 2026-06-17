//! Zoom controls - Framework Agnostic State Model
//!
//! ## Migration Notice
//!
//! Previously a Dioxus component with keyboard event handling.
//! Now provides a pure state model for zoom functionality.

use tairitsu_vdom::{VElement, VNode, VText};

/// Position of the zoom controls
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ZoomPosition {
    #[default]
    TopRight,
    TopLeft,
    BottomRight,
    BottomLeft,
}

/// State model for zoom controls
///
/// ## Example
///
/// ```rust
/// use hikari_extra_components::extra::{ZoomControlsState, ZoomPosition};
///
/// let mut state = ZoomControlsState::new();
/// state.zoom = 1.5;
///
/// // Zoom in
/// state.zoom_in();
///
/// // Check if can zoom
/// if state.can_zoom_in() {
///     state.zoom_in();
/// }
/// ```
#[derive(Clone, PartialEq, Debug)]
pub struct ZoomControlsState {
    /// Current zoom level (0.0+)
    pub zoom: f64,

    /// Minimum zoom level
    pub min_zoom: f64,

    /// Maximum zoom level
    pub max_zoom: f64,

    /// Zoom step size
    pub zoom_step: f64,

    /// Position of the controls
    pub position: ZoomPosition,

    /// Whether to show fit to screen button
    pub show_fit: bool,

    /// Whether to show controls
    pub show_controls: bool,

    /// Additional CSS classes
    pub class: String,
}

impl ZoomControlsState {
    /// Create new zoom controls state with default values
    #[must_use]
    pub fn new() -> Self {
        Self {
            zoom: 1.0,
            min_zoom: 0.1,
            max_zoom: 2.0,
            zoom_step: 0.1,
            position: ZoomPosition::default(),
            show_fit: true,
            show_controls: true,
            class: String::new(),
        }
    }

    /// Set the zoom level
    #[must_use]
    pub const fn with_zoom(mut self, zoom: f64) -> Self {
        self.zoom = zoom.clamp(self.min_zoom, self.max_zoom);
        self
    }

    /// Set zoom bounds
    #[must_use]
    pub const fn with_bounds(mut self, min: f64, max: f64) -> Self {
        self.min_zoom = min;
        self.max_zoom = max;
        self.zoom = self.zoom.clamp(min, max);
        self
    }

    /// Set zoom step size
    #[must_use]
    pub const fn with_step(mut self, step: f64) -> Self {
        self.zoom_step = step;
        self
    }

    /// Set the position
    #[must_use]
    pub const fn with_position(mut self, position: ZoomPosition) -> Self {
        self.position = position;
        self
    }

    /// Add a CSS class
    pub fn with_class(mut self, class: impl Into<String>) -> Self {
        self.class = class.into();
        self
    }

    /// Get zoom as percentage
    #[must_use]
    pub fn zoom_percent(&self) -> i32 {
        (self.zoom * 100.0).round() as i32
    }

    /// Check if can zoom in
    #[must_use]
    pub fn can_zoom_in(&self) -> bool {
        self.zoom < self.max_zoom
    }

    /// Check if can zoom out
    #[must_use]
    pub fn can_zoom_out(&self) -> bool {
        self.zoom > self.min_zoom
    }

    /// Zoom in by one step
    pub fn zoom_in(&mut self) -> bool {
        let new_zoom = (self.zoom + self.zoom_step).min(self.max_zoom);
        let changed = new_zoom != self.zoom;
        self.zoom = new_zoom;
        changed
    }

    /// Zoom out by one step
    pub fn zoom_out(&mut self) -> bool {
        let new_zoom = (self.zoom - self.zoom_step).max(self.min_zoom);
        let changed = new_zoom != self.zoom;
        self.zoom = new_zoom;
        changed
    }

    /// Reset zoom to 1.0
    pub fn reset(&mut self) -> bool {
        let changed = self.zoom != 1.0;
        self.zoom = 1.0;
        changed
    }

    /// Set zoom to a specific value (clamped)
    pub fn set_zoom(&mut self, zoom: f64) -> bool {
        let new_zoom = zoom.clamp(self.min_zoom, self.max_zoom);
        let changed = new_zoom != self.zoom;
        self.zoom = new_zoom;
        changed
    }

    /// Handle keyboard shortcut
    /// Returns the new zoom level if changed, None otherwise
    pub fn handle_key(&mut self, key: &str, modifiers_has_control: bool) -> Option<f64> {
        match key {
            "+" | "=" if modifiers_has_control => {
                self.zoom_in();
                Some(self.zoom)
            }
            "-" | "_" if modifiers_has_control => {
                self.zoom_out();
                Some(self.zoom)
            }
            "0" if modifiers_has_control => {
                self.reset();
                Some(self.zoom)
            }
            _ => None,
        }
    }

    /// Get the CSS position class name
    #[must_use]
    pub const fn position_class(&self) -> &'static str {
        match self.position {
            ZoomPosition::TopRight => "hi-zoom-top-right",
            ZoomPosition::TopLeft => "hi-zoom-top-left",
            ZoomPosition::BottomRight => "hi-zoom-bottom-right",
            ZoomPosition::BottomLeft => "hi-zoom-bottom-left",
        }
    }

    /// Get the CSS class string
    #[must_use]
    pub fn class_string(&self) -> String {
        if self.class.is_empty() {
            format!("hi-zoom-controls {}", self.position_class())
        } else {
            format!("hi-zoom-controls {} {}", self.position_class(), self.class)
        }
    }
}

impl Default for ZoomControlsState {
    fn default() -> Self {
        Self::new()
    }
}

/// Render zoom controls as a [`VNode`] tree.
///
/// Produces a container with zoom-out, display, zoom-in, reset, and optional fit buttons.
/// Event listeners (onclick) are **not** attached — the caller must wire up interactions
/// through platform-specific APIs and then call the state mutation methods.
#[must_use]
pub fn render_zoom_controls(state: &ZoomControlsState) -> VNode {
    let mut children: Vec<VNode> = Vec::with_capacity(5);

    let zoom_out = VNode::Element(
        VElement::new("button")
            .class("hi-zoom-btn hi-zoom-out")
            .attr("aria-label", "Zoom out")
            .attr("title", "Zoom out (-)")
            .attr(
                "disabled",
                if state.can_zoom_out() {
                    "false"
                } else {
                    "true"
                },
            )
            .child(VNode::Text(VText::new("\u{25C0}"))),
    );
    children.push(zoom_out);

    let display = VNode::Element(
        VElement::new("div")
            .class("hi-zoom-level")
            .child(VNode::Text(VText::new(&format!(
                "{}%",
                state.zoom_percent()
            )))),
    );
    children.push(display);

    let zoom_in = VNode::Element(
        VElement::new("button")
            .class("hi-zoom-btn hi-zoom-in")
            .attr("aria-label", "Zoom in")
            .attr("title", "Zoom in (+)")
            .attr(
                "disabled",
                if state.can_zoom_in() { "false" } else { "true" },
            )
            .child(VNode::Text(VText::new("\u{25B6}"))),
    );
    children.push(zoom_in);

    let reset = VNode::Element(
        VElement::new("button")
            .class("hi-zoom-btn hi-zoom-reset")
            .attr("aria-label", "Reset zoom")
            .attr("title", "Reset to 100% (0)")
            .child(VNode::Text(VText::new("100%"))),
    );
    children.push(reset);

    if state.show_fit {
        let fit = VNode::Element(
            VElement::new("button")
                .class("hi-zoom-btn hi-zoom-fit")
                .attr("aria-label", "Fit to screen")
                .attr("title", "Fit to screen")
                .child(VNode::Text(VText::new("\u{25A1}"))),
        );
        children.push(fit);
    }

    VNode::Element(
        VElement::new("div")
            .class(state.class_string())
            .attr("tabindex", "0")
            .children(children),
    )
}

/// Event emitted when zoom changes
#[derive(Clone, PartialEq, Debug)]
pub struct ZoomChangeEvent {
    /// New zoom level
    pub zoom: f64,
    /// Previous zoom level
    pub previous: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zoom_state_new() {
        let state = ZoomControlsState::new();
        assert_eq!(state.zoom, 1.0);
        assert_eq!(state.min_zoom, 0.1);
        assert_eq!(state.max_zoom, 2.0);
        assert_eq!(state.zoom_step, 0.1);
    }

    #[test]
    fn test_zoom_in() {
        let mut state = ZoomControlsState::new();
        assert!(state.zoom_in());
        assert!((state.zoom - 1.1).abs() < 0.001);

        assert!(state.zoom_in());
        assert!((state.zoom - 1.2).abs() < 0.001);
    }

    #[test]
    fn test_zoom_out() {
        let mut state = ZoomControlsState::new();
        assert!(state.zoom_out());
        assert_eq!(state.zoom, 0.9);

        assert!(state.zoom_out());
        assert_eq!(state.zoom, 0.8);
    }

    #[test]
    fn test_zoom_bounds() {
        let mut state = ZoomControlsState::new().with_bounds(0.5, 1.5);

        // Should clamp to max
        state.set_zoom(2.0);
        assert_eq!(state.zoom, 1.5);

        // Should clamp to min
        state.set_zoom(0.1);
        assert_eq!(state.zoom, 0.5);
    }

    #[test]
    fn test_can_zoom() {
        let state = ZoomControlsState::new().with_bounds(0.5, 1.5);

        let state = state.with_zoom(1.0);
        assert!(state.can_zoom_in());
        assert!(state.can_zoom_out());

        let state = state.with_zoom(1.5);
        assert!(!state.can_zoom_in());
        assert!(state.can_zoom_out());

        let state = state.with_zoom(0.5);
        assert!(state.can_zoom_in());
        assert!(!state.can_zoom_out());
    }

    #[test]
    fn test_reset() {
        let mut state = ZoomControlsState::new();
        state.set_zoom(1.5);
        assert!(state.reset());
        assert_eq!(state.zoom, 1.0);

        // Reset when already at 1.0 returns false
        assert!(!state.reset());
    }

    #[test]
    fn test_zoom_percent() {
        let state = ZoomControlsState::new().with_zoom(1.5);
        assert_eq!(state.zoom_percent(), 150);

        let state = state.with_zoom(0.5);
        assert_eq!(state.zoom_percent(), 50);
    }

    #[test]
    fn test_keyboard_shortcuts() {
        let mut state = ZoomControlsState::new();

        let zoom = state.handle_key("+", true).unwrap();
        assert!((zoom - 1.1).abs() < 0.001);

        let zoom = state.handle_key("=", true).unwrap();
        assert!((zoom - 1.2).abs() < 0.001);

        let zoom = state.handle_key("-", true).unwrap();
        assert!((zoom - 1.1).abs() < 0.001);

        let zoom = state.handle_key("_", true).unwrap();
        assert!((zoom - 1.0).abs() < 0.001);

        state.set_zoom(1.5);
        let zoom = state.handle_key("0", true).unwrap();
        assert!((zoom - 1.0).abs() < 0.001);

        assert_eq!(state.handle_key("a", true), None);
        assert_eq!(state.handle_key("+", false), None);
    }

    #[test]
    fn test_position_class() {
        let state = ZoomControlsState::new();
        assert_eq!(state.position_class(), "hi-zoom-top-right");

        let state = state.with_position(ZoomPosition::BottomLeft);
        assert_eq!(state.position_class(), "hi-zoom-bottom-left");
    }

    #[test]
    fn test_builder_pattern() {
        let state = ZoomControlsState::new()
            .with_zoom(1.5)
            .with_bounds(0.5, 3.0)
            .with_step(0.2)
            .with_position(ZoomPosition::TopLeft)
            .with_class("custom-zoom");

        assert_eq!(state.zoom, 1.5);
        assert_eq!(state.min_zoom, 0.5);
        assert_eq!(state.max_zoom, 3.0);
        assert_eq!(state.zoom_step, 0.2);
        assert_eq!(state.position, ZoomPosition::TopLeft);
        assert_eq!(state.class, "custom-zoom");
    }
}
