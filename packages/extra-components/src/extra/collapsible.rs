//! Collapsible panel - Framework Agnostic State Model
//!
//! ## Migration Notice
//!
//! Previously a Dioxus component. Now provides a pure state model
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
            CollapsiblePosition::Left => "hi-collapsible-left",
            CollapsiblePosition::Right => "hi-collapsible-right",
        }
    }

    /// Get the state class name
    pub fn state_class(&self) -> &'static str {
        if self.expanded {
            "hi-collapsible-expanded"
        } else {
            "hi-collapsible-collapsed"
        }
    }
}

impl Default for CollapsibleState {
    fn default() -> Self {
        Self::new(String::new())
    }
}

pub fn render_collapsible(state: &CollapsibleState) -> tairitsu_vdom::VNode {
    use tairitsu_vdom::{VElement, VNode, VText};

    let mut header_children: Vec<VNode> = Vec::new();

    header_children.push(VNode::Element(
        VElement::new("h3")
            .class("hi-collapsible-title")
            .child(VNode::Text(VText::new(&state.title))),
    ));

    if state.collapsible {
        let toggle_icon = if state.expanded { "▾" } else { "▸" };
        header_children.push(VNode::Element(
            VElement::new("button")
                .class("hi-collapsible-toggle")
                .attr(
                    "aria-label",
                    if state.expanded { "Collapse" } else { "Expand" },
                )
                .attr(
                    "aria-expanded",
                    if state.expanded { "true" } else { "false" },
                )
                .child(VNode::Text(VText::new(toggle_icon))),
        ));
    }

    let mut container_children: Vec<VNode> = Vec::new();

    container_children.push(VNode::Element(
        VElement::new("div")
            .class("hi-collapsible-header")
            .children(header_children),
    ));

    if state.expanded {
        container_children.push(VNode::Element(
            VElement::new("div")
                .class("hi-collapsible-content")
                .child(VNode::Element(
                    VElement::new("div").class("hi-collapsible-body"),
                )),
        ));
    }

    let position_class = state.position_class();
    let state_class = state.state_class();

    let container_class = if state.class.is_empty() {
        format!("hi-collapsible {} {}", position_class, state_class)
    } else {
        format!(
            "hi-collapsible {} {} {}",
            position_class, state_class, state.class
        )
    };

    VNode::Element(
        VElement::new("div")
            .class(container_class)
            .children(container_children),
    )
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
        assert_eq!(state.position_class(), "hi-collapsible-left");

        let state = state.with_position(CollapsiblePosition::Right);
        assert_eq!(state.position_class(), "hi-collapsible-right");
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
