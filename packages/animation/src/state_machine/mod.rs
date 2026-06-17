//! State machine module for animation state management
//!
//! Provides state machine implementations for various components including:
//! - Button state machine (hover, active, focused, disabled)
//! - Generic state machine trait
//!
//! # Example
//!
//! ```ignore
//! use hikari_animation::state_machine::ButtonStateMachine;
//!
//! let mut sm = ButtonStateMachine::new();
//! sm.handle_event(ButtonEvent::MouseEnter);
//! assert!(sm.is_in(ButtonState::Hover));
//! ```

pub mod button;

pub use button::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_starts_in_idle_state() {
        let sm = ButtonStateMachine::new();
        assert_eq!(sm.current_state(), ButtonState::Idle);
        assert!(sm.is_in(ButtonState::Idle));
    }

    #[test]
    fn full_interaction_cycle_idle_hover_active_hover_idle() {
        let mut sm = ButtonStateMachine::new();

        assert_eq!(
            sm.handle_event(ButtonEvent::MouseEnter),
            Some(ButtonState::Hover)
        );
        assert_eq!(
            sm.handle_event(ButtonEvent::MouseDown),
            Some(ButtonState::Active)
        );
        assert_eq!(
            sm.handle_event(ButtonEvent::MouseUp),
            Some(ButtonState::Hover)
        );
        assert_eq!(
            sm.handle_event(ButtonEvent::MouseLeave),
            Some(ButtonState::Idle)
        );
        assert!(sm.is_in(ButtonState::Idle));
    }

    #[test]
    fn invalid_transitions_are_no_ops() {
        let mut sm = ButtonStateMachine::new();

        assert_eq!(sm.handle_event(ButtonEvent::MouseDown), None);
        assert_eq!(sm.handle_event(ButtonEvent::MouseUp), None);
        assert_eq!(sm.handle_event(ButtonEvent::MouseLeave), None);
        assert_eq!(sm.handle_event(ButtonEvent::Blur), None);
        assert_eq!(sm.current_state(), ButtonState::Idle);
    }

    #[test]
    fn reset_returns_to_idle_from_any_state() {
        let states_to_test: Vec<(ButtonEvent, ButtonState)> =
            vec![(ButtonEvent::MouseEnter, ButtonState::Hover)];

        for (event, expected) in states_to_test {
            let mut sm = ButtonStateMachine::new();
            sm.handle_event(event);
            assert_eq!(sm.current_state(), expected);
            sm.reset();
            assert_eq!(sm.current_state(), ButtonState::Idle);
        }

        let mut sm = ButtonStateMachine::new();
        sm.handle_event(ButtonEvent::Disable);
        assert_eq!(sm.current_state(), ButtonState::Disabled);
        sm.reset();
        assert_eq!(sm.current_state(), ButtonState::Idle);
    }

    #[test]
    fn css_class_suffix_for_all_states() {
        let mut sm = ButtonStateMachine::new();
        assert_eq!(sm.css_class_suffix(), "");

        sm.handle_event(ButtonEvent::MouseEnter);
        assert_eq!(sm.css_class_suffix(), "hover");

        sm.handle_event(ButtonEvent::MouseDown);
        assert_eq!(sm.css_class_suffix(), "active");

        sm.reset();
        sm.handle_event(ButtonEvent::Focus);
        assert_eq!(sm.css_class_suffix(), "focus");

        sm.reset();
        sm.handle_event(ButtonEvent::Disable);
        assert_eq!(sm.css_class_suffix(), "disabled");
    }

    #[test]
    fn focus_flow_via_module_reexports() {
        let mut sm = ButtonStateMachine::new();
        sm.handle_event(ButtonEvent::Focus);
        assert!(sm.is_in(ButtonState::Focused));

        sm.handle_event(ButtonEvent::Blur);
        assert!(sm.is_in(ButtonState::Idle));
    }

    #[test]
    fn button_state_default_is_idle() {
        assert_eq!(ButtonState::default(), ButtonState::Idle);
    }

    #[test]
    fn button_state_machine_default_matches_new() {
        let new_sm = ButtonStateMachine::new();
        let default_sm = ButtonStateMachine::default();
        assert_eq!(new_sm.current_state(), default_sm.current_state());
    }
}
