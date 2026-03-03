//! Button state machine module
//!
//! Provides a state machine for button interactions with states:
//! - Idle: Default state, no interaction
//! - Hover: Mouse is over the button
//! - Active: Mouse is pressed down on the button
//! - Focused: Button has keyboard focus
//! - Disabled: Button is disabled

/// Button states
#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub enum ButtonState {
    Idle,
    Hover,
    Active,
    Focused,
    Disabled,
}

impl Default for ButtonState {
    fn default() -> Self {
        ButtonState::Idle
    }
}

/// Button events that trigger state transitions
#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub enum ButtonEvent {
    MouseEnter,
    MouseLeave,
    MouseDown,
    MouseUp,
    Focus,
    Blur,
    Enable,
    Disable,
}

/// Transition from one state to another based on an event
#[derive(Clone, Debug)]
pub struct ButtonTransition {
    pub from: ButtonState,
    pub event: ButtonEvent,
    pub to: ButtonState,
}

/// Button state machine
pub struct ButtonStateMachine {
    transitions: Vec<ButtonTransition>,
    current_state: ButtonState,
}

impl Default for ButtonStateMachine {
    fn default() -> Self {
        Self::new()
    }
}

impl ButtonStateMachine {
    /// Create a new button state machine with default transitions
    pub fn new() -> Self {
        let transitions = vec![
            // From Idle
            ButtonTransition { from: ButtonState::Idle, event: ButtonEvent::MouseEnter, to: ButtonState::Hover },
            ButtonTransition { from: ButtonState::Idle, event: ButtonEvent::Focus, to: ButtonState::Focused },
            ButtonTransition { from: ButtonState::Idle, event: ButtonEvent::Disable, to: ButtonState::Disabled },
            
            // From Hover
            ButtonTransition { from: ButtonState::Hover, event: ButtonEvent::MouseLeave, to: ButtonState::Idle },
            ButtonTransition { from: ButtonState::Hover, event: ButtonEvent::MouseDown, to: ButtonState::Active },
            ButtonTransition { from: ButtonState::Hover, event: ButtonEvent::Blur, to: ButtonState::Idle },
            ButtonTransition { from: ButtonState::Hover, event: ButtonEvent::Disable, to: ButtonState::Disabled },
            
            // From Active
            ButtonTransition { from: ButtonState::Active, event: ButtonEvent::MouseUp, to: ButtonState::Hover },
            ButtonTransition { from: ButtonState::Active, event: ButtonEvent::MouseLeave, to: ButtonState::Idle },
            ButtonTransition { from: ButtonState::Active, event: ButtonEvent::Blur, to: ButtonState::Idle },
            ButtonTransition { from: ButtonState::Active, event: ButtonEvent::Disable, to: ButtonState::Disabled },
            
            // From Focused
            ButtonTransition { from: ButtonState::Focused, event: ButtonEvent::Blur, to: ButtonState::Idle },
            ButtonTransition { from: ButtonState::Focused, event: ButtonEvent::MouseEnter, to: ButtonState::Hover },
            ButtonTransition { from: ButtonState::Focused, event: ButtonEvent::MouseDown, to: ButtonState::Active },
            ButtonTransition { from: ButtonState::Focused, event: ButtonEvent::Disable, to: ButtonState::Disabled },
            
            // From Disabled
            ButtonTransition { from: ButtonState::Disabled, event: ButtonEvent::Enable, to: ButtonState::Idle },
        ];

        Self {
            transitions,
            current_state: ButtonState::Idle,
        }
    }

    /// Get the current state
    pub fn current_state(&self) -> ButtonState {
        self.current_state
    }

    /// Handle an event and transition to a new state
    ///
    /// Returns the new state if a transition was made, or None if no valid transition
    pub fn handle_event(&mut self, event: ButtonEvent) -> Option<ButtonState> {
        // Find a matching transition
        for transition in &self.transitions {
            if transition.from == self.current_state && transition.event == event {
                self.current_state = transition.to;
                return Some(self.current_state);
            }
        }
        
        // Special case: any state can transition to Disabled via Disable event
        // and any state can transition to Idle via Blur when not disabled
        match event {
            ButtonEvent::Disable => {
                if self.current_state != ButtonState::Disabled {
                    self.current_state = ButtonState::Disabled;
                    return Some(ButtonState::Disabled);
                }
            }
            ButtonEvent::Enable => {
                if self.current_state == ButtonState::Disabled {
                    self.current_state = ButtonState::Idle;
                    return Some(ButtonState::Idle);
                }
            }
            _ => {}
        }
        
        None
    }

    /// Reset to idle state
    pub fn reset(&mut self) {
        self.current_state = ButtonState::Idle;
    }

    /// Check if currently in a specific state
    pub fn is_in(&self, state: ButtonState) -> bool {
        self.current_state == state
    }

    /// Check if button can respond to interactions (not disabled)
    pub fn is_interactive(&self) -> bool {
        self.current_state != ButtonState::Disabled
    }

    /// Get CSS class suffix for current state
    pub fn css_class_suffix(&self) -> &'static str {
        match self.current_state {
            ButtonState::Idle => "",
            ButtonState::Hover => "hover",
            ButtonState::Active => "active",
            ButtonState::Focused => "focus",
            ButtonState::Disabled => "disabled",
        }
    }
}

/// Animation targets for button states
#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub enum ButtonAnimationTarget {
    /// No animation
    None,
    /// Scale transform (e.g., 0.98 for press)
    Scale,
    /// Glow intensity (0.0 to 1.0)
    GlowOpacity,
    /// Glow spread
    GlowSpread,
    /// Background color
    BackgroundColor,
    /// Text color
    TextColor,
}

/// Animation configuration for button state transitions
pub struct ButtonAnimationConfig {
    /// Duration in milliseconds
    pub duration_ms: u32,
    /// Easing function name
    pub easing: &'static str,
    /// Target properties to animate
    pub targets: Vec<ButtonAnimationTarget>,
}

impl Default for ButtonAnimationConfig {
    fn default() -> Self {
        Self {
            duration_ms: 100,
            easing: "ease-out",
            targets: vec![
                ButtonAnimationTarget::GlowOpacity,
                ButtonAnimationTarget::Scale,
            ],
        }
    }
}

impl ButtonAnimationConfig {
    /// Create config for press animation (active state)
    pub fn press() -> Self {
        Self {
            duration_ms: 100,
            easing: "ease-out",
            targets: vec![
                ButtonAnimationTarget::GlowOpacity,
                ButtonAnimationTarget::Scale,
            ],
        }
    }

    /// Create config for release animation (return to hover/idle)
    pub fn release() -> Self {
        Self {
            duration_ms: 100,
            easing: "ease-out",
            targets: vec![
                ButtonAnimationTarget::GlowOpacity,
                ButtonAnimationTarget::Scale,
            ],
        }
    }

    /// Create config for hover animation
    pub fn hover() -> Self {
        Self {
            duration_ms: 150,
            easing: "ease-out",
            targets: vec![
                ButtonAnimationTarget::GlowOpacity,
            ],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_transitions() {
        let mut sm = ButtonStateMachine::new();
        
        // Idle -> Hover (mouse enter)
        assert_eq!(sm.handle_event(ButtonEvent::MouseEnter), Some(ButtonState::Hover));
        assert!(sm.is_in(ButtonState::Hover));
        
        // Hover -> Active (mouse down)
        assert_eq!(sm.handle_event(ButtonEvent::MouseDown), Some(ButtonState::Active));
        assert!(sm.is_in(ButtonState::Active));
        
        // Active -> Hover (mouse up)
        assert_eq!(sm.handle_event(ButtonEvent::MouseUp), Some(ButtonState::Hover));
        assert!(sm.is_in(ButtonState::Hover));
        
        // Hover -> Idle (mouse leave)
        assert_eq!(sm.handle_event(ButtonEvent::MouseLeave), Some(ButtonState::Idle));
        assert!(sm.is_in(ButtonState::Idle));
    }

    #[test]
    fn test_disabled_transition() {
        let mut sm = ButtonStateMachine::new();
        
        // Any state -> Disabled
        sm.handle_event(ButtonEvent::MouseEnter);
        assert_eq!(sm.handle_event(ButtonEvent::Disable), Some(ButtonState::Disabled));
        assert!(!sm.is_interactive());
        
        // Disabled -> Idle (enable)
        assert_eq!(sm.handle_event(ButtonEvent::Enable), Some(ButtonState::Idle));
        assert!(sm.is_interactive());
    }
}
