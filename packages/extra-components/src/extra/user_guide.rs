//! User guide component - Framework Agnostic State Model
//!
//! ## Migration Notice
//!
//! Previously a Dioxus component with modal overlay.
//! Now provides a pure state model for user onboarding guides.

/// Guide position on screen
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum GuidePosition {
    #[default]
    Center,
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

/// A single step in the user guide
#[derive(Clone, PartialEq, Debug)]
pub struct GuideStep {
    /// Step ID
    pub id: String,

    /// Step title
    pub title: String,

    /// Step description
    pub description: String,

    /// Step icon (optional emoji or SVG)
    pub icon: String,

    /// Whether step is completed
    pub completed: bool,

    /// Step content to highlight (CSS selector)
    pub target_selector: String,
}

impl GuideStep {
    /// Create a new guide step
    pub fn new(id: impl Into<String>, title: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            title: title.into(),
            description: String::new(),
            icon: String::new(),
            completed: false,
            target_selector: String::new(),
        }
    }

    /// Set the description
    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = description.into();
        self
    }

    /// Set the icon
    pub fn with_icon(mut self, icon: impl Into<String>) -> Self {
        self.icon = icon.into();
        self
    }

    /// Set the target selector
    pub fn with_target(mut self, selector: impl Into<String>) -> Self {
        self.target_selector = selector.into();
        self
    }

    /// Set completed status
    pub fn with_completed(mut self, completed: bool) -> Self {
        self.completed = completed;
        self
    }
}

/// State model for a user guide
///
/// ## Example
///
/// ```rust
/// use hikari_extra_components::extra::{UserGuideState, GuideStep, GuidePosition};
///
/// let mut state = UserGuideState::new("Welcome".to_string(), "Let's get started".to_string());
/// state.position = GuidePosition::Center;
/// state.steps.push(
///     GuideStep::new("1", "First Step")
///         .with_description("Learn the basics")
///         .with_icon("🎯")
/// );
/// state.visible = true;
/// ```
#[derive(Clone, PartialEq, Debug)]
pub struct UserGuideState {
    /// Guide title
    pub title: String,

    /// Guide description
    pub description: String,

    /// Guide steps
    pub steps: Vec<GuideStep>,

    /// Whether to show guide
    pub visible: bool,

    /// Current step index
    pub current_step: usize,

    /// Guide position
    pub position: GuidePosition,

    /// Whether to allow skip
    pub allow_skip: bool,

    /// Whether to allow close
    pub allow_close: bool,

    /// Additional CSS classes
    pub class: String,
}

impl UserGuideState {
    /// Create a new user guide state
    pub fn new(title: String, description: String) -> Self {
        Self {
            title,
            description,
            steps: Vec::new(),
            visible: false,
            current_step: 0,
            position: GuidePosition::default(),
            allow_skip: true,
            allow_close: true,
            class: String::new(),
        }
    }

    /// Set the position
    pub fn with_position(mut self, position: GuidePosition) -> Self {
        self.position = position;
        self
    }

    /// Set whether to allow skip
    pub fn with_allow_skip(mut self, allow: bool) -> Self {
        self.allow_skip = allow;
        self
    }

    /// Set whether to allow close
    pub fn with_allow_close(mut self, allow: bool) -> Self {
        self.allow_close = allow;
        self
    }

    /// Add a step
    pub fn add_step(&mut self, step: GuideStep) {
        self.steps.push(step);
    }

    /// Show the guide
    pub fn show(&mut self) {
        self.visible = true;
        self.current_step = 0;
    }

    /// Hide the guide
    pub fn hide(&mut self) {
        self.visible = false;
    }

    /// Get the current step
    pub fn current_step(&self) -> Option<&GuideStep> {
        self.steps.get(self.current_step)
    }

    /// Check if can go to previous step
    pub fn can_previous(&self) -> bool {
        self.current_step > 0
    }

    /// Check if can go to next step (or finish)
    pub fn can_next(&self) -> bool {
        self.current_step < self.steps.len().saturating_sub(1) || self.is_last_step()
    }

    /// Check if on last step
    pub fn is_last_step(&self) -> bool {
        self.current_step >= self.steps.len().saturating_sub(1)
    }

    /// Check if on first step
    pub fn is_first_step(&self) -> bool {
        self.current_step == 0
    }

    /// Go to previous step
    pub fn previous(&mut self) -> bool {
        if self.can_previous() {
            self.current_step -= 1;
            true
        } else {
            false
        }
    }

    /// Go to next step, or hide if on last step
    pub fn next(&mut self) -> bool {
        if self.is_last_step() {
            self.hide();
            false
        } else if self.current_step + 1 < self.steps.len() {
            self.current_step += 1;
            true
        } else {
            false
        }
    }

    /// Get progress count (current step number)
    pub fn progress_count(&self) -> usize {
        self.current_step + 1
    }

    /// Get total steps count
    pub fn total_steps(&self) -> usize {
        self.steps.len()
    }

    /// Get progress as percentage
    pub fn progress_percent(&self) -> f64 {
        if self.steps.is_empty() {
            0.0
        } else {
            (self.current_step + 1) as f64 / self.steps.len() as f64 * 100.0
        }
    }

    /// Get the position class name
    pub fn position_class(&self) -> &'static str {
        match self.position {
            GuidePosition::Center => "hi-user-guide-position-center",
            GuidePosition::TopLeft => "hi-user-guide-position-top-left",
            GuidePosition::TopRight => "hi-user-guide-position-top-right",
            GuidePosition::BottomLeft => "hi-user-guide-position-bottom-left",
            GuidePosition::BottomRight => "hi-user-guide-position-bottom-right",
        }
    }
}

/// Events emitted by the user guide
#[derive(Clone, PartialEq, Debug)]
pub enum UserGuideEvent {
    /// Guide was dismissed
    Dismissed,
    /// Guide was completed (went through all steps)
    Completed,
    /// Step changed
    StepChanged { from: usize, to: usize },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_guide_step_new() {
        let step = GuideStep::new("1", "First Step");
        assert_eq!(step.id, "1");
        assert_eq!(step.title, "First Step");
        assert!(!step.completed);
    }

    #[test]
    fn test_guide_step_builder() {
        let step = GuideStep::new("1", "First")
            .with_description("Description")
            .with_icon("🎯")
            .with_target(".my-element")
            .with_completed(true);

        assert_eq!(step.description, "Description");
        assert_eq!(step.icon, "🎯");
        assert_eq!(step.target_selector, ".my-element");
        assert!(step.completed);
    }

    #[test]
    fn test_user_guide_new() {
        let state = UserGuideState::new("Welcome".to_string(), "Description".to_string());
        assert_eq!(state.title, "Welcome");
        assert!(!state.visible);
        assert_eq!(state.current_step, 0);
        assert!(state.allow_skip);
        assert!(state.allow_close);
    }

    #[test]
    fn test_user_guide_show_hide() {
        let mut state = UserGuideState::new("Title".to_string(), "Desc".to_string());
        assert!(!state.visible);

        state.show();
        assert!(state.visible);
        assert_eq!(state.current_step, 0);

        state.hide();
        assert!(!state.visible);
    }

    #[test]
    fn test_user_guide_navigation() {
        let mut state = UserGuideState::new("Title".to_string(), "Desc".to_string());
        state.add_step(GuideStep::new("1", "Step 1"));
        state.add_step(GuideStep::new("2", "Step 2"));
        state.add_step(GuideStep::new("3", "Step 3"));

        assert_eq!(state.current_step, 0);
        assert!(state.is_first_step());
        assert!(!state.is_last_step());

        assert!(state.next());
        assert_eq!(state.current_step, 1);

        assert!(state.next());
        assert_eq!(state.current_step, 2);
        assert!(state.is_last_step());

        assert!(state.previous());
        assert_eq!(state.current_step, 1);

        assert!(!state.previous()); // Can't go before 0
        assert_eq!(state.current_step, 0);
    }

    #[test]
    fn test_progress() {
        let mut state = UserGuideState::new("Title".to_string(), "Desc".to_string());
        state.add_step(GuideStep::new("1", "Step 1"));
        state.add_step(GuideStep::new("2", "Step 2"));
        state.add_step(GuideStep::new("3", "Step 3"));
        state.add_step(GuideStep::new("4", "Step 4"));

        assert_eq!(state.total_steps(), 4);
        assert_eq!(state.progress_count(), 1);
        assert_eq!(state.progress_percent(), 25.0);

        state.next();
        assert_eq!(state.progress_count(), 2);
        assert_eq!(state.progress_percent(), 50.0);
    }

    #[test]
    fn test_position_classes() {
        let state = UserGuideState::new("Title".to_string(), "Desc".to_string());
        assert_eq!(state.position_class(), "hi-user-guide-position-center");

        let state = state.with_position(GuidePosition::TopLeft);
        assert_eq!(state.position_class(), "hi-user-guide-position-top-left");
    }

    #[test]
    fn test_builder_pattern() {
        let state = UserGuideState::new("Title".to_string(), "Desc".to_string())
            .with_position(GuidePosition::BottomRight)
            .with_allow_skip(false)
            .with_allow_close(false)
            .with_class("custom-guide");

        assert_eq!(state.position, GuidePosition::BottomRight);
        assert!(!state.allow_skip);
        assert!(!state.allow_close);
        assert_eq!(state.class, "custom-guide");
    }
}
