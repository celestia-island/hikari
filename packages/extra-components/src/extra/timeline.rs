//! Timeline component - Framework Agnostic State Model
//!
//! ## Migration Notice
//!
//! Previously a Dioxus component. Now provides a pure state model
//! for timeline/event display.

/// Timeline position
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum TimelinePosition {
    #[default]
    Left,
    Center,
    Right,
}

/// Timeline item status
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum TimelineStatus {
    #[default]
    Pending,
    InProgress,
    Completed,
    Cancelled,
}

/// A single item in the timeline
#[derive(Clone, PartialEq, Debug)]
pub struct TimelineItem {
    /// Item ID
    pub id: String,

    /// Item title
    pub title: String,

    /// Item description
    pub description: String,

    /// Item time/date
    pub time: String,

    /// Item icon (optional emoji)
    pub icon: String,

    /// Item status
    pub status: TimelineStatus,

    /// Whether item is expanded
    pub expanded: bool,

    /// Whether to show connecting line
    pub show_line: bool,
}

impl TimelineItem {
    /// Create a new timeline item
    pub fn new(id: impl Into<String>, title: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            title: title.into(),
            description: String::new(),
            time: String::new(),
            icon: String::new(),
            status: TimelineStatus::default(),
            expanded: false,
            show_line: true,
        }
    }

    /// Set the description
    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = description.into();
        self
    }

    /// Set the time
    pub fn with_time(mut self, time: impl Into<String>) -> Self {
        self.time = time.into();
        self
    }

    /// Set the icon
    pub fn with_icon(mut self, icon: impl Into<String>) -> Self {
        self.icon = icon.into();
        self
    }

    /// Set the status
    pub fn with_status(mut self, status: TimelineStatus) -> Self {
        self.status = status;
        self
    }

    /// Set whether expanded
    pub fn with_expanded(mut self, expanded: bool) -> Self {
        self.expanded = expanded;
        self
    }

    /// Get the status class name
    pub fn status_class(&self) -> &'static str {
        match self.status {
            TimelineStatus::Pending => "hi-timeline-pending",
            TimelineStatus::InProgress => "hi-timeline-in-progress",
            TimelineStatus::Completed => "hi-timeline-completed",
            TimelineStatus::Cancelled => "hi-timeline-cancelled",
        }
    }

    /// Get the dot status class name
    pub fn dot_status_class(&self) -> &'static str {
        match self.status {
            TimelineStatus::Pending => "hi-timeline-dot-pending",
            TimelineStatus::InProgress => "hi-timeline-dot-in-progress",
            TimelineStatus::Completed => "hi-timeline-dot-completed",
            TimelineStatus::Cancelled => "hi-timeline-dot-cancelled",
        }
    }
}

/// State model for a timeline
///
/// ## Example
///
/// ```rust
/// use hikari_extra_components::extra::{TimelineState, TimelineItem, TimelineStatus, TimelinePosition};
///
/// let mut state = TimelineState::new();
/// state.position = TimelinePosition::Left;
/// state.items.push(
///     TimelineItem::new("1", "Project Started")
///         .with_status(TimelineStatus::Completed)
///         .with_time("2024-01-01")
///         .with_icon("🚀")
/// );
/// ```
#[derive(Clone, PartialEq, Debug)]
pub struct TimelineState {
    /// Timeline items
    pub items: Vec<TimelineItem>,

    /// Timeline position
    pub position: TimelinePosition,

    /// Whether to show connecting line
    pub show_line: bool,

    /// Additional CSS classes
    pub class: String,
}

impl TimelineState {
    /// Create a new timeline state
    pub fn new() -> Self {
        Self {
            items: Vec::new(),
            position: TimelinePosition::default(),
            show_line: true,
            class: String::new(),
        }
    }

    /// Set the position
    pub fn with_position(mut self, position: TimelinePosition) -> Self {
        self.position = position;
        self
    }

    /// Set whether to show line
    pub fn with_show_line(mut self, show: bool) -> Self {
        self.show_line = show;
        self
    }

    /// Set custom CSS class
    pub fn with_class(mut self, class: impl Into<String>) -> Self {
        self.class = class.into();
        self
    }

    /// Add an item
    pub fn add_item(&mut self, item: TimelineItem) {
        self.items.push(item);
    }

    /// Toggle item expansion
    pub fn toggle_item(&mut self, id: &str) -> bool {
        if let Some(item) = self.items.iter_mut().find(|i| i.id == id) {
            item.expanded = !item.expanded;
            true
        } else {
            false
        }
    }

    /// Update item status
    pub fn update_status(&mut self, id: &str, status: TimelineStatus) -> bool {
        if let Some(item) = self.items.iter_mut().find(|i| i.id == id) {
            item.status = status;
            true
        } else {
            false
        }
    }

    /// Get the position class name
    pub fn position_class(&self) -> &'static str {
        match self.position {
            TimelinePosition::Left => "hi-timeline-left",
            TimelinePosition::Center => "hi-timeline-center",
            TimelinePosition::Right => "hi-timeline-right",
        }
    }

    /// Get the CSS class string
    pub fn class_string(&self) -> String {
        let base = if self.class.is_empty() {
            self.position_class().to_string()
        } else {
            format!("{} {}", self.position_class(), self.class)
        };

        if self.show_line {
            format!("{} hi-timeline-line", base)
        } else {
            base
        }
    }
}

impl Default for TimelineState {
    fn default() -> Self {
        Self::new()
    }
}

pub fn render_timeline(state: &TimelineState) -> tairitsu_vdom::VNode {
    use tairitsu_vdom::{VElement, VNode, VText};

    let mut item_nodes: Vec<VNode> = Vec::with_capacity(state.items.len());

    for item in &state.items {
        let mut dot_children: Vec<VNode> = Vec::new();
        if !item.icon.is_empty() {
            dot_children.push(VNode::Element(
                VElement::new("span")
                    .class("hi-timeline-icon")
                    .child(VNode::Text(VText::new(&item.icon))),
            ));
        }

        let mut content_children: Vec<VNode> = Vec::new();

        let mut header_children: Vec<VNode> = Vec::new();
        header_children.push(VNode::Element(
            VElement::new("h4")
                .class("hi-timeline-title")
                .child(VNode::Text(VText::new(&item.title))),
        ));
        if !item.time.is_empty() {
            header_children.push(VNode::Element(
                VElement::new("span")
                    .class("hi-timeline-time")
                    .child(VNode::Text(VText::new(&item.time))),
            ));
        }

        content_children.push(VNode::Element(
            VElement::new("div")
                .class("hi-timeline-header")
                .children(header_children),
        ));

        if item.expanded && !item.description.is_empty() {
            content_children.push(VNode::Element(
                VElement::new("div")
                    .class("hi-timeline-description hi-timeline-description-expanded")
                    .child(VNode::Element(
                        VElement::new("p").child(VNode::Text(VText::new(&item.description))),
                    )),
            ));
        }

        let item_class = format!("hi-timeline-item {}", item.status_class());
        let dot_class = format!("hi-timeline-dot {}", item.dot_status_class());

        let item_node = VNode::Element(
            VElement::new("div")
                .class(item_class)
                .child(VNode::Element(
                    VElement::new("div").class(dot_class).children(dot_children),
                ))
                .child(VNode::Element(
                    VElement::new("div")
                        .class("hi-timeline-content")
                        .children(content_children),
                )),
        );

        item_nodes.push(item_node);
    }

    let container_class = format!("hi-timeline {}", state.class_string());

    VNode::Element(
        VElement::new("div")
            .class(container_class)
            .children(item_nodes),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timeline_item_new() {
        let item = TimelineItem::new("1", "Test Item");
        assert_eq!(item.id, "1");
        assert_eq!(item.title, "Test Item");
        assert_eq!(item.status, TimelineStatus::Pending);
    }

    #[test]
    fn test_timeline_item_builder() {
        let item = TimelineItem::new("1", "Test")
            .with_description("Description")
            .with_time("2024-01-01")
            .with_icon("🎯")
            .with_status(TimelineStatus::Completed)
            .with_expanded(true);

        assert_eq!(item.description, "Description");
        assert_eq!(item.time, "2024-01-01");
        assert_eq!(item.icon, "🎯");
        assert_eq!(item.status, TimelineStatus::Completed);
        assert!(item.expanded);
    }

    #[test]
    fn test_timeline_state_new() {
        let state = TimelineState::new();
        assert!(state.items.is_empty());
        assert_eq!(state.position, TimelinePosition::Left);
        assert!(state.show_line);
    }

    #[test]
    fn test_add_item() {
        let mut state = TimelineState::new();
        state.add_item(TimelineItem::new("1", "First"));
        state.add_item(TimelineItem::new("2", "Second"));

        assert_eq!(state.items.len(), 2);
        assert_eq!(state.items[0].title, "First");
        assert_eq!(state.items[1].title, "Second");
    }

    #[test]
    fn test_toggle_item() {
        let mut state = TimelineState::new();
        state.add_item(TimelineItem::new("1", "First"));

        assert!(!state.items[0].expanded);
        assert!(state.toggle_item("1"));
        assert!(state.items[0].expanded);
        assert!(state.toggle_item("1"));
        assert!(!state.items[0].expanded);
    }

    #[test]
    fn test_update_status() {
        let mut state = TimelineState::new();
        state.add_item(TimelineItem::new("1", "First"));

        assert!(state.update_status("1", TimelineStatus::Completed));
        assert_eq!(state.items[0].status, TimelineStatus::Completed);

        assert!(!state.update_status("2", TimelineStatus::Completed));
    }

    #[test]
    fn test_status_classes() {
        let item = TimelineItem::new("1", "Test");

        assert_eq!(item.status_class(), "hi-timeline-pending");
        assert_eq!(item.dot_status_class(), "hi-timeline-dot-pending");
    }

    #[test]
    fn test_position_classes() {
        let state = TimelineState::new();
        assert_eq!(state.position_class(), "hi-timeline-left");

        let state = state.with_position(TimelinePosition::Center);
        assert_eq!(state.position_class(), "hi-timeline-center");
    }

    #[test]
    fn test_class_string() {
        let state = TimelineState::new()
            .with_show_line(true)
            .with_class("custom");
        let class = state.class_string();
        assert!(class.contains("hi-timeline-left"));
        assert!(class.contains("hi-timeline-line"));
        assert!(class.contains("custom"));
    }
}
