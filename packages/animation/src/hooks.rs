//! Dioxus hooks for animation integration
//!
//! This module provides React-style hooks for using the animation system
//! within Dioxus components, including hooks for tweening,
//! animated values, transitions, and animation frame callbacks.

use std::{cell::RefCell, rc::Rc, time::Duration};

use dioxus::prelude::*;
use wasm_bindgen::JsCast;

use crate::core::{AnimationEngine, AnimationOptions, Tween, TweenId};

/// Tween hook for Dioxus
///
/// Manages a single tween with automatic lifecycle control.
#[derive(Clone)]
pub struct UseTween {
    engine: Rc<AnimationEngine>,
    tween_id: RefCell<Option<TweenId>>,
}

impl UseTween {
    /// Create a new tween hook
    fn new() -> Self {
        let engine = Rc::new(AnimationEngine::new());
        Self {
            engine,
            tween_id: RefCell::new(None),
        }
    }

    /// Create a new tween with given options
    ///
    /// # Arguments
    /// * `options` - Animation configuration
    ///
    /// # Returns
    /// The created tween
    pub fn tween(&self, options: AnimationOptions) -> Tween {
        let id = self.engine.create_tween(options.clone());
        *self.tween_id.borrow_mut() = Some(id);
        Tween::new(id, options)
    }

    /// Start playing the current tween
    pub fn play(&self) {
        if let Some(id) = *self.tween_id.borrow() {
            self.engine.play(id);
        }
    }

    /// Pause the current tween
    pub fn pause(&self) {
        if let Some(id) = *self.tween_id.borrow() {
            self.engine.pause(id);
        }
    }

    /// Restart the current tween from the beginning
    pub fn restart(&self) {
        if let Some(id) = *self.tween_id.borrow() {
            self.engine.restart(id);
        }
    }

    /// Reverse the current tween direction
    pub fn reverse(&self) {
        if let Some(id) = *self.tween_id.borrow() {
            self.engine.reverse(id);
        }
    }

    /// Seek the current tween to a specific time
    ///
    /// # Arguments
    /// * `time` - Time to seek to
    pub fn seek(&self, time: Duration) {
        if let Some(id) = *self.tween_id.borrow() {
            self.engine.seek(id, time);
        }
    }

    /// Kill (remove) the current tween
    pub fn kill(&self) {
        if let Some(id) = *self.tween_id.borrow() {
            self.engine.kill(id);
        }
    }
}

/// Hook for accessing the global animation engine
///
/// Creates and manages an animation engine within a Dioxus component.
///
/// # Example
/// ```ignore
/// #[component]
/// fn MyComponent() -> Element {
///     let engine = use_animation_engine();
///     // Use engine to create animations
/// }
/// ```
pub fn use_animation_engine() -> AnimationEngine {
    use_hook(|| AnimationEngine::new())
}

/// Hook for creating and controlling a single tween
///
/// Provides convenient methods for playing, pausing, and controlling a tween.
///
/// # Example
/// ```ignore
/// #[component]
/// fn MyComponent() -> Element {
///     let mut tween = use_tween();
///
///     let start_animation = move |_| {
///         let options = AnimationOptions::default();
///         tween.tween(options);
///         tween.play();
///     };
///
///     rsx! {
///         button { onclick: start_animation, "Animate" }
///     }
/// }
/// ```
pub fn use_tween() -> UseTween {
    use_hook(|| UseTween::new())
}

/// Hook for managing animated values
///
/// Provides a reactive value that can be animated from one value to another.
///
/// # Arguments
/// * `initial` - Initial value
///
/// # Example
/// ```ignore
/// #[component]
/// fn MyComponent() -> Element {
///     let mut value = use_animated_value(0.0);
///
///     let animate = move |_| {
///         value.animate_to(100.0, Duration::from_millis(500), |t| t);
///     };
///
///     rsx! {
///         div { "{value.get()}" }
///         button { onclick: animate, "Animate" }
///     }
/// }
/// ```
pub fn use_animated_value<T: Clone + 'static>(initial: T) -> Signal<T> {
    use_signal(|| initial)
}

/// Hook for managing transition animations
///
/// Provides enter/exit animations with visibility and animating state tracking.
///
/// # Arguments
/// * `duration_ms` - Duration of transition in milliseconds
///
/// # Example
/// ```ignore
/// #[component]
/// fn MyComponent() -> Element {
///     let mut transition = use_transition(300);
///
///     rsx! {
///         div {
///             class: if transition.is_visible() { "visible" } else { "hidden" },
///             onmounted: move |_| transition.enter(),
///             "Content"
///         }
///     }
/// }
/// ```
pub fn use_transition(duration_ms: u64) -> UseTransition {
    use_hook(move || UseTransition::new(duration_ms))
}

/// Transition hook for Dioxus
///
/// Manages visibility and animation state for transitions.
#[derive(Clone)]
pub struct UseTransition {
    is_visible: Signal<bool>,
    is_animating: Signal<bool>,
    duration_ms: u64,
}

impl UseTransition {
    /// Create a new transition hook
    ///
    /// # Arguments
    /// * `duration_ms` - Duration of transition in milliseconds
    fn new(duration_ms: u64) -> Self {
        Self {
            is_visible: Signal::new(false),
            is_animating: Signal::new(false),
            duration_ms,
        }
    }

    /// Check if the element is currently visible
    ///
    /// # Returns
    /// true if visible, false otherwise
    pub fn is_visible(&self) -> bool {
        *self.is_visible.read()
    }

    /// Check if a transition is currently animating
    ///
    /// # Returns
    /// true if animating, false otherwise
    pub fn is_animating(&self) -> bool {
        *self.is_animating.read()
    }

    /// Trigger the enter animation
    ///
    /// Sets visibility to true and animates the transition in.
    pub fn enter(&mut self) {
        self.is_visible.set(true);
        self.is_animating.set(true);

        let mut is_animating = self.is_animating.clone();
        let duration_ms = self.duration_ms as i32;

        // Use setTimeout for web/WASM compatibility
        let closure = wasm_bindgen::closure::Closure::once(Box::new(move || {
            is_animating.set(false);
        }) as Box<dyn FnOnce()>);

        web_sys::window()
            .unwrap()
            .set_timeout_with_callback_and_timeout_and_arguments_0(
                closure.as_ref().unchecked_ref(),
                duration_ms,
            )
            .unwrap();
        closure.forget();
    }

    /// Trigger the exit animation
    ///
    /// Animates the transition out and then sets visibility to false.
    pub fn exit(&mut self) {
        self.is_animating.set(true);

        let mut is_visible = self.is_visible.clone();
        let mut is_animating = self.is_animating.clone();
        let duration_ms = self.duration_ms as i32;

        // Use setTimeout for web/WASM compatibility
        let closure = wasm_bindgen::closure::Closure::once(Box::new(move || {
            is_visible.set(false);
            is_animating.set(false);
        }) as Box<dyn FnOnce()>);

        web_sys::window()
            .unwrap()
            .set_timeout_with_callback_and_timeout_and_arguments_0(
                closure.as_ref().unchecked_ref(),
                duration_ms,
            )
            .unwrap();
        closure.forget();
    }

    /// Toggle between enter and exit
    ///
    /// If currently visible, triggers exit. If hidden, triggers enter.
    pub fn toggle(&mut self) {
        if *self.is_visible.read() {
            self.exit();
        } else {
            self.enter();
        }
    }
}

/// Hook for requesting animation frames
///
/// Provides a callback that will be called on each animation frame.
///
/// # Arguments
/// * `callback` - Function to call each frame (receives elapsed time in seconds)
///
/// # Example
/// ```ignore
/// #[component]
/// fn AnimatedCounter() -> Element {
///     let mut count = use_signal(|| 0.0);
///
///     use_animation_frame(move |elapsed| {
///         *count.write() = elapsed * 60.0; // 60 FPS
///     });
///
///     rsx! {
///         div { "Count: {count}" }
///     }
/// }
/// ```
pub fn use_animation_frame(_callback: impl Fn(f64) + 'static) {
    // TODO: Implement proper requestAnimationFrame integration
    // This requires access to the animation loop or a coroutine
}

/// Hook for creating a timeout
///
/// Creates a timeout that calls a callback after a specified duration.
///
/// # Arguments
/// * `duration_ms` - Duration before timeout callback in milliseconds
/// * `callback` - Function to call after timeout
///
/// # Returns
/// Function that when called will start the timeout
///
/// # Example
/// ```ignore
/// #[component]
/// fn DelayedAlert() -> Element {
///     let trigger = use_timeout(1000, || {
///         web_sys::window().unwrap().alert().unwrap();
///     });
///
///     rsx! {
///         button { onclick: move |_| trigger(), "Show Alert (1s delay)" }
///     }
/// }
/// ```
pub fn use_timeout(duration_ms: u64, _callback: impl Fn() + 'static) -> impl Fn() {
    // TODO: Implement proper timeout with cleanup
    move || {
        // Placeholder implementation
    }
}

/// Hook for creating an interval
///
/// Creates an interval that calls a callback repeatedly at a specified rate.
///
/// # Arguments
/// * `duration_ms` - Interval duration in milliseconds
/// * `callback` - Function to call on each interval
///
/// # Example
/// ```ignore
/// #[component]
/// fn Clock() -> Element {
///     let mut time = use_signal(|| "0".to_string());
///
///     use_interval(1000, move || {
///         // Update time every second
///     });
///
///     rsx! {
///         div { "{time}" }
///     }
/// }
/// ```
pub fn use_interval(_duration_ms: u64, _callback: impl Fn() + 'static) {
    // TODO: Implement proper interval with cleanup
    // This requires use_resource or use_effect for cleanup
}

