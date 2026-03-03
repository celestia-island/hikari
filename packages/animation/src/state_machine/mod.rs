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
