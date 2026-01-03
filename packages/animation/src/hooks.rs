//! Dioxus hooks for animation integration
//!
//! This module provides React-style hooks for using the animation system
//! within Dioxus components, including hooks for tweening,
//! animated values, and transitions.
//!
//! Adapted for Dioxus 0.7

use std::time::Duration;

use dioxus::prelude::*;

/// Hook for managing animated values
///
/// Provides a reactive value that can be animated from one value to another.
///
/// # Arguments
/// * `initial` - Initial value
///
/// # Returns
/// Reference to animated value hook
pub fn use_animated_value<T>(initial: T) -> UseAnimatedValue<T>
where
    T: Clone + Copy + 'static,
{
    let value = use_signal(|| initial);
    UseAnimatedValue { value }
}

/// Animated value hook for Dioxus
///
/// Manages a reactive value with animation support.
pub struct UseAnimatedValue<T>
where
    T: Clone + Copy + 'static,
{
    value: Signal<T>,
}

impl<T: Clone + Copy + 'static> UseAnimatedValue<T> {
    /// Get the current value
    ///
    /// # Returns
    /// Current value
    pub fn get(&self) -> T {
        *self.value.read()
    }

    /// Set a new value
    ///
    /// # Arguments
    /// * `value` - New value to set
    pub fn set(&mut self, value: T) {
        self.value.set(value);
    }

    /// Get the underlying signal
    ///
    /// # Returns
    /// Reference to the signal
    pub fn signal(&self) -> Signal<T> {
        self.value.clone()
    }
}

/// Hook for managing transition animations
///
/// Provides enter/exit animations with visibility and animating state tracking.
///
/// # Arguments
/// * `duration_ms` - Duration of transition in milliseconds
///
/// # Returns
/// Reference to transition hook
pub fn use_transition(duration_ms: u64) -> UseTransition {
    let is_visible = use_signal(|| true);
    let is_animating = use_signal(|| false);

    UseTransition {
        is_visible,
        is_animating,
        duration_ms,
    }
}

/// Transition hook for Dioxus
///
/// Manages visibility and animation state for transitions.
pub struct UseTransition {
    is_visible: Signal<bool>,
    is_animating: Signal<bool>,
    duration_ms: u64,
}

impl UseTransition {
    /// Check if element is visible
    ///
    /// # Returns
    /// true if visible, false otherwise
    pub fn is_visible(&self) -> bool {
        *self.is_visible.read()
    }

    /// Check if animation is in progress
    ///
    /// # Returns
    /// true if animating, false otherwise
    pub fn is_animating(&self) -> bool {
        *self.is_animating.read()
    }

    /// Start enter animation
    pub fn enter(&mut self) {
        self.is_visible.set(true);
        self.is_animating.set(true);

        let mut is_animating = self.is_animating.clone();
        let duration_ms = self.duration_ms;

        // Spawn async task for animation
        spawn(async move {
            tokio::time::sleep(Duration::from_millis(duration_ms)).await;
            is_animating.set(false);
        });
    }

    /// Start exit animation
    pub fn exit(&mut self) {
        self.is_animating.set(true);

        let mut is_visible = self.is_visible.clone();
        let mut is_animating = self.is_animating.clone();
        let duration_ms = self.duration_ms;

        spawn(async move {
            tokio::time::sleep(Duration::from_millis(duration_ms)).await;
            is_visible.set(false);
            is_animating.set(false);
        });
    }

    /// Toggle visibility (enter if hidden, exit if visible)
    pub fn toggle(&mut self) {
        if self.is_visible() {
            self.exit();
        } else {
            self.enter();
        }
    }
}
