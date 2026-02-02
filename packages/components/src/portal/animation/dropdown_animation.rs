// hi-components/src/portal/animation/dropdown_animation.rs
// Dropdown animation state machine
//
// Provides a state machine for managing dropdown animations, including:
// - Fade in/out transitions
// - Slide in/out animations
// - Scale effects for smooth appearance
//
// This is based on the same pattern as ScrollbarAnimationState, but specifically
// designed for dropdown overlay animations.

use std::{cell::RefCell, rc::Rc};

use animation::style::{CssProperty, StyleBuilder};
use wasm_bindgen::prelude::*;

/// Dropdown animation state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DropdownAnimationState {
    /// Dropdown is hidden (not visible)
    Hidden,
    /// Dropdown is appearing (fade/scale in animation)
    Appearing,
    /// Dropdown is visible and stable
    Visible,
    /// Dropdown is disappearing (fade/scale out animation)
    Disappearing,
}

impl DropdownAnimationState {
    /// Returns true if dropdown should be visible in DOM
    pub fn should_display(&self) -> bool {
        matches!(self, Self::Appearing | Self::Visible | Self::Disappearing)
    }

    /// Returns the target opacity for this state
    pub fn target_opacity(&self) -> f64 {
        match self {
            Self::Hidden | Self::Disappearing => 0.0,
            Self::Appearing | Self::Visible => 1.0,
        }
    }

    /// Returns the target scale for this state
    pub fn target_scale(&self) -> f64 {
        match self {
            Self::Hidden | Self::Disappearing => 0.95,
            Self::Appearing | Self::Visible => 1.0,
        }
    }
}

/// Context for rendering dropdown animations
#[derive(Clone)]
pub struct DropdownRenderContext {
    /// Overlay element (mask)
    pub overlay: web_sys::Element,
    /// Dropdown content element
    pub content: web_sys::Element,
    /// Current animation state
    pub state: Rc<RefCell<DropdownAnimationState>>,
}

impl DropdownRenderContext {
    /// Create a new render context
    pub fn new(overlay: web_sys::Element, content: web_sys::Element) -> Self {
        Self {
            overlay,
            content,
            state: Rc::new(RefCell::new(DropdownAnimationState::Hidden)),
        }
    }

    /// Get current animation state
    pub fn state(&self) -> DropdownAnimationState {
        *self.state.borrow()
    }

    /// Set animation state
    pub fn set_state(&self, state: DropdownAnimationState) {
        *self.state.borrow_mut() = state;
    }
}

/// Dropdown animation events
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DropdownEvent {
    /// Dropdown should appear (fade/scale in)
    Show,
    /// Dropdown should disappear (fade/scale out)
    Hide,
    /// Animation completed
    AnimationComplete,
}

/// Transition dropdown animation state based on event
///
/// # Arguments
///
/// * `ctx` - Dropdown render context
/// * `event` - Animation event
///
/// # Returns
///
/// `true` if state changed, `false` otherwise
pub fn dropdown_transition(ctx: &DropdownRenderContext, event: DropdownEvent) -> bool {
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

/// Render dropdown styles based on current animation state
///
/// # Arguments
///
/// * `ctx` - Dropdown render context
///
/// # Returns
///
/// Render output indicating if element should be visible
pub fn dropdown_render(ctx: &DropdownRenderContext) -> bool {
    let state = ctx.state();
    let opacity = state.target_opacity();
    let scale = state.target_scale();
    let should_display = state.should_display();

    if !should_display {
        return false;
    }

    // Apply overlay opacity - always 0.5 for dimmed mode, 0 for transparent
    // The parent component handles mask mode display
    let overlay_opacity = match state {
        DropdownAnimationState::Appearing | DropdownAnimationState::Visible => 0.5,
        DropdownAnimationState::Disappearing | DropdownAnimationState::Hidden => 0.0,
    };

    if let Some(overlay_html) = ctx.overlay.dyn_ref::<web_sys::HtmlElement>() {
        StyleBuilder::new(overlay_html)
            .add(CssProperty::Opacity, &format!("{}", overlay_opacity))
            .apply();
    }

    // Apply content opacity and scale
    if let Some(content_html) = ctx.content.dyn_ref::<web_sys::HtmlElement>() {
        StyleBuilder::new(content_html)
            .add(CssProperty::Opacity, &format!("{}", opacity))
            .add(CssProperty::Transform, &format!("scale({})", scale))
            .add(CssProperty::TransformOrigin, "top center")
            .apply();
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_arch = "wasm32")]
    #[test]
    fn test_state_transitions() {
        let context = DropdownRenderContext::new(
            web_sys::window()
                .unwrap()
                .document()
                .unwrap()
                .create_element("div")
                .unwrap(),
            web_sys::window()
                .unwrap()
                .document()
                .unwrap()
                .create_element("div")
                .unwrap(),
        );

        // Hidden -> Show -> Appearing
        assert_eq!(context.state(), DropdownAnimationState::Hidden);
        assert!(dropdown_transition(&context, DropdownEvent::Show));
        assert_eq!(context.state(), DropdownAnimationState::Appearing);

        // Appearing -> AnimationComplete -> Visible
        assert!(dropdown_transition(
            &context,
            DropdownEvent::AnimationComplete
        ));
        assert_eq!(context.state(), DropdownAnimationState::Visible);

        // Visible -> Hide -> Disappearing
        assert!(dropdown_transition(&context, DropdownEvent::Hide));
        assert_eq!(context.state(), DropdownAnimationState::Disappearing);

        // Disappearing -> AnimationComplete -> Hidden
        assert!(dropdown_transition(
            &context,
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
}
