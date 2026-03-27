// hi-components/src/portal/animation/dropdown_animation.rs
// Dropdown animation state machine
//
// Provides a state machine for managing dropdown animations, including:
// - Fade in/out transitions
// - Slide in/out animations
// - Scale effects for smooth appearance
//
// This is a pure state machine without direct DOM manipulation.
// The actual rendering is handled by the component through CSS variables.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DropdownAnimationState {
    Hidden,
    Appearing,
    Visible,
    Disappearing,
}

impl DropdownAnimationState {
    pub fn should_display(&self) -> bool {
        matches!(self, Self::Appearing | Self::Visible | Self::Disappearing)
    }

    pub fn target_opacity(&self) -> f64 {
        match self {
            Self::Hidden | Self::Disappearing => 0.0,
            Self::Appearing | Self::Visible => 1.0,
        }
    }

    pub fn target_scale(&self) -> f64 {
        match self {
            Self::Hidden | Self::Disappearing => 0.95,
            Self::Appearing | Self::Visible => 1.0,
        }
    }

    pub fn overlay_opacity(&self) -> f64 {
        match self {
            Self::Appearing | Self::Visible => 0.5,
            Self::Disappearing | Self::Hidden => 0.0,
        }
    }
}

/// Simple context for dropdown animation state
#[derive(Clone)]
pub struct DropdownRenderContext {
    pub state: DropdownAnimationState,
    // Note: DomRect doesn't implement Clone, so we use a simpler representation
    pub has_overlay: bool,
    pub has_content: bool,
}

impl DropdownRenderContext {
    pub fn new() -> Self {
        Self {
            state: DropdownAnimationState::Hidden,
            has_overlay: false,
            has_content: false,
        }
    }

    pub fn with_elements() -> Self {
        Self {
            state: DropdownAnimationState::Hidden,
            has_overlay: true,
            has_content: true,
        }
    }

    pub fn state(&self) -> DropdownAnimationState {
        self.state
    }

    pub fn set_state(&mut self, state: DropdownAnimationState) {
        self.state = state;
    }
}

impl Default for DropdownRenderContext {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DropdownEvent {
    Show,
    Hide,
    AnimationComplete,
}

/// Transition the dropdown animation state based on an event
/// Returns true if the state changed
pub fn dropdown_transition(ctx: &mut DropdownRenderContext, event: DropdownEvent) -> bool {
    let current_state = ctx.state();
    let new_state = match (current_state, event) {
        // From Hidden: only Show is valid
        (DropdownAnimationState::Hidden, DropdownEvent::Show) => DropdownAnimationState::Appearing,
        (DropdownAnimationState::Hidden, _) => current_state,

        // From Appearing: allow AnimationComplete
        (DropdownAnimationState::Appearing, DropdownEvent::AnimationComplete) => {
            DropdownAnimationState::Visible
        }
        (DropdownAnimationState::Appearing, DropdownEvent::Hide) => {
            DropdownAnimationState::Disappearing
        }
        (DropdownAnimationState::Appearing, DropdownEvent::Show) => current_state,

        // From Visible: only Hide is valid
        (DropdownAnimationState::Visible, DropdownEvent::Hide) => {
            DropdownAnimationState::Disappearing
        }
        (DropdownAnimationState::Visible, _) => current_state,

        // From Disappearing: allow AnimationComplete or Show
        (DropdownAnimationState::Disappearing, DropdownEvent::AnimationComplete) => {
            DropdownAnimationState::Hidden
        }
        (DropdownAnimationState::Disappearing, DropdownEvent::Show) => {
            DropdownAnimationState::Appearing
        }
        (DropdownAnimationState::Disappearing, DropdownEvent::Hide) => current_state,
    };

    let changed = new_state != current_state;
    if changed {
        ctx.set_state(new_state);
    }

    changed
}

/// Get the CSS style string for the current dropdown state
/// This returns CSS variables that can be applied to the overlay and content elements
pub fn dropdown_get_styles(ctx: &DropdownRenderContext) -> (String, String) {
    let state = ctx.state();
    let opacity = state.target_opacity();
    let scale = state.target_scale();
    let overlay_opacity = state.overlay_opacity();

    let overlay_style = format!("--dropdown-overlay-opacity: {};", overlay_opacity);

    let content_style = format!(
        "--dropdown-opacity: {}; --dropdown-scale: {};",
        opacity, scale
    );

    (overlay_style, content_style)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_transitions() {
        let mut context = DropdownRenderContext::new();

        // Hidden -> Show -> Appearing
        assert_eq!(context.state(), DropdownAnimationState::Hidden);
        assert!(dropdown_transition(&mut context, DropdownEvent::Show));
        assert_eq!(context.state(), DropdownAnimationState::Appearing);

        // Appearing -> AnimationComplete -> Visible
        assert!(dropdown_transition(
            &mut context,
            DropdownEvent::AnimationComplete
        ));
        assert_eq!(context.state(), DropdownAnimationState::Visible);

        // Visible -> Hide -> Disappearing
        assert!(dropdown_transition(&mut context, DropdownEvent::Hide));
        assert_eq!(context.state(), DropdownAnimationState::Disappearing);

        // Disappearing -> AnimationComplete -> Hidden
        assert!(dropdown_transition(
            &mut context,
            DropdownEvent::AnimationComplete
        ));
        assert_eq!(context.state(), DropdownAnimationState::Hidden);
    }

    #[test]
    fn test_state_properties() {
        assert!(!DropdownAnimationState::Hidden.should_display());
        assert!(DropdownAnimationState::Appearing.should_display());
        assert!(DropdownAnimationState::Visible.should_display());
        assert!(DropdownAnimationState::Disappearing.should_display());

        assert_eq!(DropdownAnimationState::Hidden.target_opacity(), 0.0);
        assert_eq!(DropdownAnimationState::Visible.target_opacity(), 1.0);
        assert_eq!(DropdownAnimationState::Hidden.target_scale(), 0.95);
        assert_eq!(DropdownAnimationState::Visible.target_scale(), 1.0);
    }

    #[test]
    fn test_dropdown_get_styles() {
        let context = DropdownRenderContext::new();
        let (overlay_style, content_style) = dropdown_get_styles(&context);

        assert!(overlay_style.contains("--dropdown-overlay-opacity: 0"));
        assert!(content_style.contains("--dropdown-opacity: 0"));
        assert!(content_style.contains("--dropdown-scale: 0.95"));
    }
}
