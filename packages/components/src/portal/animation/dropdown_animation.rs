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

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use std::{cell::RefCell, rc::Rc};

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use crate::style_builder::{CssProperty, StyleBuilder};
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use wasm_bindgen::prelude::*;
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use web_sys;

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
}

#[derive(Clone)]
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub struct DropdownRenderContext {
    pub overlay: web_sys::Element,
    pub content: web_sys::Element,
    pub state: Rc<RefCell<DropdownAnimationState>>,
}

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
impl DropdownRenderContext {
    pub fn new(overlay: web_sys::Element, content: web_sys::Element) -> Self {
        Self {
            overlay,
            content,
            state: Rc::new(RefCell::new(DropdownAnimationState::Hidden)),
        }
    }

    pub fn state(&self) -> DropdownAnimationState {
        *self.state.borrow()
    }

    pub fn set_state(&self, state: DropdownAnimationState) {
        *self.state.borrow_mut() = state;
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DropdownEvent {
    Show,
    Hide,
    AnimationComplete,
}

///
///
///
///
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
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

///
///
///
///
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
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

    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
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
