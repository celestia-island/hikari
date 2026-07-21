//! Collapsible panel - Framework Agnostic State Model
//!
//! ## Migration Notice
//!
//! Previously a component. Now provides a pure state model (migrated from legacy Dioxus)
//! that can be used with any framework.

/// Position of the collapsible panel
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum CollapsiblePosition {
    #[default]
    Left,
    Right,
}

/// State model for a collapsible panel
///
/// ## Example
///
/// ```rust
/// use hikari_extra_components::extra::{CollapsibleState, CollapsiblePosition};
///
/// let mut state = CollapsibleState::new("Settings Panel".to_string());
/// state.position = CollapsiblePosition::Right;
/// state.expanded = true;
///
/// // Toggle state
/// state.expanded = !state.expanded;
/// ```
#[derive(Clone, PartialEq, Debug)]
pub struct CollapsibleState {
    /// Title displayed in the header
    pub title: String,

    /// Whether the panel is expanded
    pub expanded: bool,

    /// Whether the panel can be collapsed
    pub collapsible: bool,

    /// Position of the panel
    pub position: CollapsiblePosition,

    /// Width of the panel in pixels
    pub width: u32,

    /// Additional CSS classes
    pub class: String,
}

impl CollapsibleState {
    /// Create a new collapsible state with default values
    pub fn new(title: String) -> Self {
        Self {
            title,
            expanded: false,
            collapsible: true,
            position: CollapsiblePosition::default(),
            width: 300,
            class: String::new(),
        }
    }

    /// Set the expanded state
    pub fn with_expanded(mut self, expanded: bool) -> Self {
        self.expanded = expanded;
        self
    }

    /// Set the collapsible flag
    pub fn with_collapsible(mut self, collapsible: bool) -> Self {
        self.collapsible = collapsible;
        self
    }

    /// Set the position
    pub fn with_position(mut self, position: CollapsiblePosition) -> Self {
        self.position = position;
        self
    }

    /// Set the width
    pub fn with_width(mut self, width: u32) -> Self {
        self.width = width;
        self
    }

    /// Add a CSS class
    pub fn with_class(mut self, class: impl Into<String>) -> Self {
        self.class = class.into();
        self
    }

    /// Toggle the expanded state
    pub fn toggle(&mut self) {
        if self.collapsible {
            self.expanded = !self.expanded;
        }
    }

    /// Get the CSS position class name
    pub fn position_class(&self) -> &'static str {
        match self.position {
            CollapsiblePosition::Left => "hk-collapsible-left",
            CollapsiblePosition::Right => "hk-collapsible-right",
        }
    }

    /// Get the state class name
    pub fn state_class(&self) -> &'static str {
        if self.expanded {
            "hk-collapsible-expanded"
        } else {
            "hk-collapsible-collapsed"
        }
    }
}

impl Default for CollapsibleState {
    fn default() -> Self {
        Self::new(String::new())
    }
}

/// Event emitted when the collapse state changes
#[derive(Clone, PartialEq, Debug)]
pub struct CollapsibleChangeEvent {
    /// Whether the panel is now expanded
    pub expanded: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_collapsible_state_new() {
        let state = CollapsibleState::new("Test".to_string());
        assert_eq!(state.title, "Test");
        assert!(!state.expanded);
        assert!(state.collapsible);
        assert_eq!(state.width, 300);
    }

    #[test]
    fn test_collapsible_toggle() {
        let mut state = CollapsibleState::new("Test".to_string());
        assert!(!state.expanded);

        state.toggle();
        assert!(state.expanded);

        state.toggle();
        assert!(!state.expanded);
    }

    #[test]
    fn test_collapsible_toggle_when_not_collapsible() {
        let mut state = CollapsibleState::new("Test".to_string());
        state.collapsible = false;
        state.expanded = false;

        state.toggle();
        assert!(!state.expanded); // Should not toggle
    }

    #[test]
    fn test_position_class() {
        let state = CollapsibleState::new("Test".to_string());
        assert_eq!(state.position_class(), "hk-collapsible-left");

        let state = state.with_position(CollapsiblePosition::Right);
        assert_eq!(state.position_class(), "hk-collapsible-right");
    }

    #[test]
    fn test_builder_pattern() {
        let state = CollapsibleState::new("Settings".to_string())
            .with_expanded(true)
            .with_width(400)
            .with_position(CollapsiblePosition::Right)
            .with_class("custom-class");

        assert_eq!(state.title, "Settings");
        assert!(state.expanded);
        assert_eq!(state.width, 400);
        assert_eq!(state.position, CollapsiblePosition::Right);
        assert_eq!(state.class, "custom-class");
    }
}
