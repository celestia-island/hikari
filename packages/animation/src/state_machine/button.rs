//! Button state machine module
//!
//! Provides a state machine for button interactions with states:
//! - Idle: Default state, no interaction
//! - Hover: Mouse is over the button
//! - Active: Mouse is pressed down on the button
//! - Focused: Button has keyboard focus
//! - Disabled: Button is disabled
//!
//! # State Transition Diagram
//!
//! ```text
//!       MouseEnter         MouseDown         MouseUp
//!   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
//!   ▼              │   ▼              │   ▼              │
//! ┌──────┐        │ ┌──────┐        │ ┌──────┐        │
//! │ Idle │───────────►│ Hover │───────────►│ Active │───────┘
//! └──────┘   ◄──────── └──────┘   ◄──────── └──────┘
//!    ▲                                    │
//!    │         MouseLeave                 │ MouseLeave
//!    │◄──────────────────────────────────┘
//!    │                                    ▲
//!    │         Blur                      │ Blur
//!    └───────────────────────────────────┘
//!
//!    Focus                     MouseEnter      MouseDown
//!   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
//!   ▼              │   ▼              │   ▼              │
//! ┌──────┐        │ ┌──────┐        │ ┌──────┐        │
//! │Focus │───────────►│ Hover │───────────►│ Active │
//! └──────┘   ◄──────── └──────┘   ◄──────── └──────┘
//!   ▲                                              │
//!   │              Blur                             │
//!   └──────────────────────────────────────────────┘
//!
//!    Disable                    Enable
//!   ┌──────────────┐   ┌──────────────┐
//!   ▼              │   ▼              │
//!  Any State ─────────►│ Disabled │───────────► Idle
//! ```
//!
//! # Usage Example
//!
//! ```ignore
//! use hikari_animation::state_machine::{ButtonStateMachine, ButtonEvent, ButtonState};
//!
//! let mut sm = ButtonStateMachine::new();
//!
//! // Handle mouse enter -> transitions to Hover
//! sm.handle_event(ButtonEvent::MouseEnter);
//! assert!(sm.is_in(ButtonState::Hover));
//!
//! // Handle mouse down -> transitions to Active
//! sm.handle_event(ButtonEvent::MouseDown);
//! assert!(sm.is_in(ButtonState::Active));
//!
//! // Handle mouse up -> transitions back to Hover
//! sm.handle_event(ButtonEvent::MouseUp);
//! assert!(sm.is_in(ButtonState::Hover));
//! ```

/// Button states representing the visual/interaction state of a button
///
/// Each state corresponds to a specific user interaction pattern:
/// - **Idle**: Default resting state, no mouse interaction
/// - **Hover**: Mouse pointer is over the button area
/// - **Active**: Mouse button is currently pressed down
/// - **Focused**: Button has keyboard focus (Tab navigation)
/// - **Disabled**: Button is non-interactive due to `disabled` prop
#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash, Default)]
pub enum ButtonState {
    #[default]
    Idle,
    Hover,
    Active,
    Focused,
    Disabled,
}

/// User interaction events that trigger state transitions
///
/// These events map to native DOM events:
/// - **MouseEnter/MouseLeave**: `mouseenter` / `mouseleave` (does not bubble)
/// - **MouseDown/MouseUp**: `mousedown` / `mouseup` (mouse button press)
/// - **Focus/Blur**: `focus` / `blur` (keyboard navigation)
/// - **Enable/Disable**: Programmatic state changes (button prop)
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

/// Represents a single state transition rule
///
/// Contains the source state, trigger event, and destination state.
/// Used internally by the state machine to determine valid transitions.
#[derive(Clone, Debug)]
pub struct ButtonTransition {
    pub from: ButtonState,
    pub event: ButtonEvent,
    pub to: ButtonState,
}

/// Finite State Machine (FSM) for button interaction states
///
/// Implements a deterministic state machine with predefined transitions.
/// The machine ensures predictable state changes based on user events.
///
/// # Design Principles
///
/// 1. **Deterministic**: Given the same state and event, always produces the same result
/// 2. **Valid Transitions Only**: Invalid event/state combinations are ignored
/// 3. **Disabled Override**: The Disabled state can be entered from any state
/// 4. **No Direct Jumps**: Users cannot skip intermediate states (e.g., Idle -> Active directly)
///
/// # Example
///
/// ```ignore
/// let mut sm = ButtonStateMachine::new();
///
/// // Normal interaction flow
/// assert_eq!(sm.current_state(), ButtonState::Idle);
///
/// sm.handle_event(ButtonEvent::MouseEnter);
/// assert_eq!(sm.current_state(), ButtonState::Hover);
///
/// sm.handle_event(ButtonEvent::MouseDown);
/// assert_eq!(sm.current_state(), ButtonState::Active);
/// ```
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
    /// Creates a new state machine with default transitions
    ///
    /// Initializes with all valid button state transitions pre-configured.
    /// The machine starts in the Idle state by default.
    pub fn new() -> Self {
        // Define all valid state transitions
        // Each tuple represents: (from_state, event, to_state)
        let transitions = vec![
            // From Idle
            ButtonTransition {
                from: ButtonState::Idle,
                event: ButtonEvent::MouseEnter,
                to: ButtonState::Hover,
            },
            ButtonTransition {
                from: ButtonState::Idle,
                event: ButtonEvent::Focus,
                to: ButtonState::Focused,
            },
            ButtonTransition {
                from: ButtonState::Idle,
                event: ButtonEvent::Disable,
                to: ButtonState::Disabled,
            },
            // From Hover (user moved mouse over button)
            ButtonTransition {
                from: ButtonState::Hover,
                event: ButtonEvent::MouseLeave,
                to: ButtonState::Idle,
            },
            ButtonTransition {
                from: ButtonState::Hover,
                event: ButtonEvent::MouseDown,
                to: ButtonState::Active,
            },
            ButtonTransition {
                from: ButtonState::Hover,
                event: ButtonEvent::Blur,
                to: ButtonState::Idle,
            },
            ButtonTransition {
                from: ButtonState::Hover,
                event: ButtonEvent::Disable,
                to: ButtonState::Disabled,
            },
            // From Active (user is pressing the button)
            ButtonTransition {
                from: ButtonState::Active,
                event: ButtonEvent::MouseUp,
                to: ButtonState::Hover,
            },
            ButtonTransition {
                from: ButtonState::Active,
                event: ButtonEvent::MouseLeave,
                to: ButtonState::Idle,
            },
            ButtonTransition {
                from: ButtonState::Active,
                event: ButtonEvent::Blur,
                to: ButtonState::Idle,
            },
            ButtonTransition {
                from: ButtonState::Active,
                event: ButtonEvent::Disable,
                to: ButtonState::Disabled,
            },
            // From Focused (keyboard navigation)
            ButtonTransition {
                from: ButtonState::Focused,
                event: ButtonEvent::Blur,
                to: ButtonState::Idle,
            },
            ButtonTransition {
                from: ButtonState::Focused,
                event: ButtonEvent::MouseEnter,
                to: ButtonState::Hover,
            },
            ButtonTransition {
                from: ButtonState::Focused,
                event: ButtonEvent::MouseDown,
                to: ButtonState::Active,
            },
            ButtonTransition {
                from: ButtonState::Focused,
                event: ButtonEvent::Disable,
                to: ButtonState::Disabled,
            },
            // From Disabled (can only exit via Enable)
            ButtonTransition {
                from: ButtonState::Disabled,
                event: ButtonEvent::Enable,
                to: ButtonState::Idle,
            },
        ];

        Self {
            transitions,
            current_state: ButtonState::Idle,
        }
    }

    /// Returns the current state of the state machine
    #[inline]
    pub fn current_state(&self) -> ButtonState {
        self.current_state
    }

    /// Processes an event and potentially transitions to a new state
    ///
    /// # Algorithm
    ///
    /// 1. First, check if there's a predefined transition for (current_state, event)
    /// 2. If found, transition to the new state and return it
    /// 3. Otherwise, handle special cases:
    ///    - `Disable` event: transitions to Disabled from any non-disabled state
    ///    - `Enable` event: transitions to Idle from Disabled state
    /// 4. If no valid transition exists, return None
    ///
    /// # Arguments
    ///
    /// * `event` - The user interaction event to process
    ///
    /// # Returns
    ///
    /// * `Some(new_state)` - If a valid transition occurred
    /// * `None` - If no valid transition exists for the current state/event combination
    pub fn handle_event(&mut self, event: ButtonEvent) -> Option<ButtonState> {
        // First, check predefined transitions
        for transition in &self.transitions {
            if transition.from == self.current_state && transition.event == event {
                self.current_state = transition.to;
                return Some(self.current_state);
            }
        }

        // Special case: Disable can be triggered from any state
        // This ensures buttons can be disabled regardless of current interaction
        match event {
            ButtonEvent::Disable => {
                if self.current_state != ButtonState::Disabled {
                    self.current_state = ButtonState::Disabled;
                    return Some(ButtonState::Disabled);
                }
            }
            // Special case: Enable can only exit from Disabled state
            ButtonEvent::Enable if self.current_state == ButtonState::Disabled => {
                self.current_state = ButtonState::Idle;
                return Some(ButtonState::Idle);
            }
            // All other event combinations that don't have predefined transitions are ignored
            _ => {}
        }

        None
    }

    /// Resets the state machine to Idle state
    ///
    /// Useful for programmatic reset or after form submission.
    #[inline]
    pub fn reset(&mut self) {
        self.current_state = ButtonState::Idle;
    }

    /// Checks if the machine is currently in a specific state
    ///
    /// # Arguments
    ///
    /// * `state` - The state to check against
    ///
    /// # Returns
    ///
    /// * `true` - If current state matches the given state
    /// * `false` - Otherwise
    #[inline]
    pub fn is_in(&self, state: ButtonState) -> bool {
        self.current_state == state
    }

    /// Determines if the button can respond to user interactions
    ///
    /// Returns false only when in the Disabled state.
    /// This is useful for early-exit checks before processing events.
    ///
    /// # Example
    ///
    /// ```ignore
    /// fn handle_click(sm: &ButtonStateMachine) {
    ///     if !sm.is_interactive() {
    ///         return; // Don't process clicks on disabled buttons
    ///     }
    ///     // Handle click...
    /// }
    /// ```
    #[inline]
    pub fn is_interactive(&self) -> bool {
        self.current_state != ButtonState::Disabled
    }

    /// Returns a CSS class suffix for the current state
    ///
    /// This enables CSS-based styling by applying state-specific classes.
    /// The returned suffix should be combined with a base class prefix.
    ///
    /// # Example
    ///
    /// ```ignore
    /// // For a button with base class "hk-button"
    /// let class_suffix = sm.css_class_suffix();
    /// // Returns: "", "hover", "active", "focus", or "disabled"
    /// // CSS: .hk-button, .hk-button:hover, .hk-button:active, etc.
    #[inline]
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

/// Properties of a button that can be animated during state transitions
///
/// These targets define which visual properties should be animated
/// when transitioning between button states. Each target corresponds
/// to a specific CSS property or visual effect.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub enum ButtonAnimationTarget {
    /// No animation should occur
    None,
    /// Scale transform (e.g., scale(0.98) for press effect)
    Scale,
    /// Glow opacity (controls the intensity of glow effect)
    GlowOpacity,
    /// Glow spread (controls the size of glow effect)
    GlowSpread,
    /// Background color transition
    BackgroundColor,
    /// Text/icon color transition
    TextColor,
}

/// Configuration for button state transition animations
///
/// Defines timing and target properties for animations that occur
/// during state transitions. This enables consistent animation behavior
/// across different button interactions.
pub struct ButtonAnimationConfig {
    /// Animation duration in milliseconds
    pub duration_ms: u32,
    /// CSS easing function name (e.g., "ease-out", "cubic-bezier(...)")
    pub easing: &'static str,
    /// List of properties to animate during this transition
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
    /// Configuration for press (Active state) animation
    ///
    /// Typically used when mouse button is pressed down.
    /// Creates a subtle "sinking" effect with reduced glow.
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

    /// Configuration for release (return to Hover/Idle) animation
    ///
    /// Used when mouse button is released.
    /// Returns visual properties to their normal state.
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

    /// Configuration for hover animation
    ///
    /// Used when mouse enters the button area.
    /// Creates a subtle "lifting" effect with enhanced glow.
    pub fn hover() -> Self {
        Self {
            duration_ms: 150,
            easing: "ease-out",
            targets: vec![ButtonAnimationTarget::GlowOpacity],
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
        assert_eq!(
            sm.handle_event(ButtonEvent::MouseEnter),
            Some(ButtonState::Hover)
        );
        assert!(sm.is_in(ButtonState::Hover));

        // Hover -> Active (mouse down)
        assert_eq!(
            sm.handle_event(ButtonEvent::MouseDown),
            Some(ButtonState::Active)
        );
        assert!(sm.is_in(ButtonState::Active));

        // Active -> Hover (mouse up)
        assert_eq!(
            sm.handle_event(ButtonEvent::MouseUp),
            Some(ButtonState::Hover)
        );
        assert!(sm.is_in(ButtonState::Hover));

        // Hover -> Idle (mouse leave)
        assert_eq!(
            sm.handle_event(ButtonEvent::MouseLeave),
            Some(ButtonState::Idle)
        );
        assert!(sm.is_in(ButtonState::Idle));
    }

    #[test]
    fn test_disabled_transition() {
        let mut sm = ButtonStateMachine::new();

        // Any state -> Disabled
        sm.handle_event(ButtonEvent::MouseEnter);
        assert_eq!(
            sm.handle_event(ButtonEvent::Disable),
            Some(ButtonState::Disabled)
        );
        assert!(!sm.is_interactive());

        // Disabled -> Idle (enable)
        assert_eq!(
            sm.handle_event(ButtonEvent::Enable),
            Some(ButtonState::Idle)
        );
        assert!(sm.is_interactive());
    }

    #[test]
    fn test_invalid_transition_ignored() {
        let mut sm = ButtonStateMachine::new();

        // Cannot go directly from Idle to Active without Hover
        assert_eq!(sm.handle_event(ButtonEvent::MouseDown), None);
        assert_eq!(sm.current_state(), ButtonState::Idle);

        // Cannot go from Hover to Focus
        sm.handle_event(ButtonEvent::MouseEnter);
        assert_eq!(sm.handle_event(ButtonEvent::Focus), None);
    }
}
