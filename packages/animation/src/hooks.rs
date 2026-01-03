//! Dioxus hooks for animation integration
//!
//! This module provides React-style hooks for using the animation system
//! within Dioxus components, including hooks for tweening,
//! animated values, transitions, and animation frame callbacks.

use std::{cell::RefCell, rc::Rc, time::Duration};

use dioxus::prelude::*;

use crate::core::{AnimationEngine, Tween, TweenId};

/// Hook for accessing the global animation engine
///
/// Creates and manages an animation engine within a Dioxus component.
///
/// # Arguments
/// * `cx` - Dioxus scope state
///
/// # Returns
/// /// Reference to the animation engine hook
pub fn use_animation_engine(cx: &ScopeState) -> &UseAnimationEngine {
    cx.use_hook(|| UseAnimationEngine::new(cx))
}

/// Animation engine hook for Dioxus
///
/// Manages an animation engine with automatic ticking.
pub struct UseAnimationEngine {
    engine: AnimationEngine,
    _tick: Coroutine<Duration>,
}

impl UseAnimationEngine {
    /// Create a new animation engine hook
    ///
    /// # Arguments
    /// * `cx` - Dioxus scope state
    fn new(cx: &ScopeState) -> Self {
        let engine = AnimationEngine::new();

        let _tick = cx.coroutine(move |mut rx: UnboundedReceiver<Duration>| async move {
            while let Some(delta) = rx.next().await {
                engine.tick(delta);
            }
        });

        Self { engine, _tick }
    }

    /// Get reference to the animation engine
    ///
    /// # Returns
    /// Reference to the managed animation engine
    pub fn engine(&self) -> &AnimationEngine {
        &self.engine
    }

    /// Create a new tween with given options
    ///
    /// # Arguments
    /// * `options` - Animation configuration
    ///
    /// # Returns
    /// The created tween
    pub fn create_tween(&self, options: crate::core::AnimationOptions) -> Tween {
        let id = self.engine.create_tween(options);
        Tween::new(id, options)
    }
}

/// Hook for creating and controlling a single tween
///
/// Provides convenient methods for playing, pausing, and controlling a tween.
///
/// # Arguments
/// * `cx` - Dioxus scope state
///
/// # Returns
/// /// Reference to tween hook
pub fn use_tween(cx: &ScopeState) -> UseTween {
    cx.use_hook(|| UseTween::new(cx))
}

/// Tween hook for Dioxus
///
/// Manages a single tween with automatic lifecycle control.
pub struct UseTween {
    engine: Rc<AnimationEngine>,
    tween_id: RefCell<Option<TweenId>>,
}

impl UseTween {
    /// Create a new tween hook
    ///
    /// # Arguments
    /// * `cx` - Dioxus scope state
    fn new(cx: &ScopeState) -> Self {
        let engine = Rc::new(AnimationEngine::new());

        cx.coroutine(move |mut rx: UnboundedReceiver<Duration>| async move {
            while let Some(delta) = rx.next().await {
                engine.tick(delta);
            }
        });

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
    pub fn tween(&self, options: crate::core::AnimationOptions) -> Tween {
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

/// Hook for managing animated values
///
/// Provides a reactive value that can be animated from one value to another.
///
/// # Arguments
/// * `cx` - Dioxus scope state
/// * `initial` - Initial value
///
/// # Returns
/// /// Reference to animated value hook
pub fn use_animated_value<T>(cx: &ScopeState, initial: T) -> UseAnimatedValue<T> {
    cx.use_hook(|| UseAnimatedValue::new(cx, initial))
}

/// Animated value hook for Dioxus
///
/// Manages a reactive value with animation support.
pub struct UseAnimatedValue<T> {
    value: Signal<T>,
}

impl<T: Clone + 'static> UseAnimatedValue<T> {
    /// Create a new animated value hook
    ///
    /// # Arguments
    /// * `cx` - Dioxus scope state
    /// * `initial` - Initial value
    fn new(cx: &ScopeState, initial: T) -> Self {
        Self {
            value: cx.use_signal(|| initial),
        }
    }

    /// Get the current value
    ///
    /// # Returns
    /// Current value
    pub fn get(&self) -> T {
        self.value.get()
    }

    /// Set a new value
    ///
    /// # Arguments
    /// * `value` - New value to set
    pub fn set(&self, value: T) {
        self.value.set(value);
    }

    /// Create a function to animate to a target value
    ///
    /// # Arguments
    /// * `target` - Target value
    /// * `duration` - Animation duration
    /// * `easing` - Easing function to use
    ///
    /// # Returns
    /// Function that when called will animate the value
    pub fn animate_to<F>(&self, target: T, duration: Duration, easing: F) -> impl Fn()
    where
        T: Copy
            + std::ops::Sub<Output = T>
            + std::ops::Add<Output = T>
            + std::ops::Mul<f64, Output = T>,
        F: Fn(f64) -> f64 + 'static,
    {
        let start = self.get();
        let callback = move |progress: f64| {
            let eased = easing(progress);
            let diff = target - start;
            let current = start + (diff * eased);
            self.set(current);
        };

        callback
    }
}

/// Hook for managing transition animations
///
/// Provides enter/exit animations with visibility and animating state tracking.
///
/// # Arguments
/// * `cx` - Dioxus scope state
/// * `duration_ms` - Duration of transition in milliseconds
///
/// # Returns
/// /// Reference to transition hook
pub fn use_transition(cx: &ScopeState, duration_ms: u64) -> UseTransition {
    cx.use_hook(|| UseTransition::new(cx, duration_ms))
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
    /// Create a new transition hook
    ///
    /// # Arguments
    /// * `cx` - Dioxus scope state
    /// * `duration_ms` - Duration of transition in milliseconds
    fn new(cx: &ScopeState, duration_ms: u64) -> Self {
        Self {
            is_visible: cx.use_signal(|| false),
            is_animating: cx.use_signal(|| false),
            duration_ms,
        }
    }

    /// Check if the element is currently visible
    ///
    /// # Returns
    /// true if visible, false otherwise
    pub fn is_visible(&self) -> bool {
        self.is_visible.get()
    }

    /// Check if a transition is currently animating
    ///
    /// # Returns
    /// true if animating, false otherwise
    pub fn is_animating(&self) -> bool {
        self.is_animating.get()
    }

    /// Trigger the enter animation
    ///
    /// Sets visibility to true and animates the transition in.
    pub fn enter(&self) {
        self.is_visible.set(true);
        self.is_animating.set(true);

        let is_animating = self.is_animating.clone();
        let duration_ms = self.duration_ms;
        async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(duration_ms)).await;
            is_animating.set(false);
        }
        .spawn();
    }

    /// Trigger the exit animation
    ///
    /// Animates the transition out and then sets visibility to false.
    pub fn exit(&self) {
        self.is_animating.set(true);

        let is_visible = self.is_visible.clone();
        let is_animating = self.is_animating.clone();
        let duration_ms = self.duration_ms;
        async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(duration_ms)).await;
            is_visible.set(false);
            is_animating.set(false);
        }
        .spawn();
    }

    /// Toggle between enter and exit
    ///
    /// If currently visible, triggers exit. If hidden, triggers enter.
    pub fn toggle(&self) {
        if self.is_visible.get() {
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
/// * `cx` - Dioxus scope state
/// * `callback` - Function to call each frame (receives elapsed time in seconds)
pub fn use_animation_frame(cx: &ScopeState, callback: impl Fn(f64) + 'static) {
    cx.use_hook(|| {
        let callback = Rc::new(callback);
        let start_time = web_sys::window().unwrap().performance().unwrap().now();

        let request_id = cx.use_hook(|| {
            let callback = callback.clone();
            let mut start = start_time;

            let frame: Box<dyn FnMut() -> bool> = Box::new(move || {
                let now = web_sys::window().unwrap().performance().unwrap().now();
                let elapsed = (now - start) / 1000.0;
                callback(elapsed);
                true
            });

            let id = web_sys::window()
                .unwrap()
                .request_animation_frame(frame.as_ref().unchecked_ref())
                .unwrap();

            id
        });

        cx.on_cleanup(move || {
            web_sys::window()
                .unwrap()
                .cancel_animation_frame(*request_id);
        });
    });
}

/// Hook for creating a timeout
///
/// Creates a timeout that calls a callback after a specified duration.
///
/// # Arguments
/// * `cx` - Dioxus scope state
/// * `duration_ms` - Duration before timeout callback in milliseconds
///
/// # Returns
/// /// Function that when called will start the timeout
pub fn use_timeout(cx: &ScopeState, duration_ms: u64) -> impl Fn() {
    cx.use_hook(|| {
        let timeout_handle = cx.use_hook::<Option<i32>>(|| None);

        let timeout_handle = timeout_handle.clone();
        move || {
            if let Some(id) = *timeout_handle.borrow() {
                web_sys::window().unwrap().clear_timeout(id);
            }

            let closure = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
                // Timeout callback
            }) as Box<dyn Fn()>);

            let id = web_sys::window()
                .unwrap()
                .set_timeout_with_callback_and_timeout_and_arguments_0(
                    closure.as_ref().unchecked_ref(),
                    duration_ms,
                )
                .unwrap();

            *timeout_handle.borrow_mut() = Some(id);
            closure.forget();
        }
    })
}

/// Hook for creating an interval
///
/// Creates an interval that calls a callback repeatedly at a specified rate.
///
/// # Arguments
/// * `cx` - Dioxus scope state
/// * `duration_ms` - Interval duration in milliseconds
/// * `callback` - Function to call on each interval
pub fn use_interval(cx: &ScopeState, duration_ms: u64, callback: impl Fn() + 'static) {
    cx.use_hook(|| {
        let interval_handle = cx.use_hook::<Option<i32>>(|| None);
        let callback = Rc::new(callback);

        let interval_handle = interval_handle.clone();
        let closure = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
            callback();
        }) as Box<dyn Fn()>);

        let id = web_sys::window()
            .unwrap()
            .set_interval_with_callback_and_timeout_and_arguments_0(
                closure.as_ref().unchecked_ref(),
                duration_ms,
            )
            .unwrap();

        *interval_handle.borrow_mut() = Some(id);
        closure.forget();

        cx.on_cleanup(move || {
            if let Some(id) = *interval_handle.borrow() {
                web_sys::window().unwrap().clear_interval(id);
            }
        });
    });
}

/// Tween hook for Dioxus
///
/// Manages a single tween with automatic lifecycle control.
pub struct UseTween {
    engine: Rc<AnimationEngine>,
    tween_id: RefCell<Option<TweenId>>,
}

impl UseTween {
    /// Create a new tween hook
    ///
    /// # Arguments
    /// * `cx` - Dioxus scope state
    fn new(cx: &ScopeState) -> Self {
        let engine = Rc::new(AnimationEngine::new());

        cx.coroutine(move |mut rx: UnboundedReceiver<Duration>| async move {
            while let Some(delta) = rx.next().await {
                engine.tick(delta);
            }
        });

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
    pub fn tween(&self, options: crate::core::AnimationOptions) -> Tween {
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

pub fn use_animated_value<T>(cx: &ScopeState, initial: T) -> UseAnimatedValue<T> {
    cx.use_hook(|| UseAnimatedValue::new(cx, initial))
}

pub struct UseAnimatedValue<T> {
    value: Signal<T>,
}

impl<T: Clone + 'static> UseAnimatedValue<T> {
    fn new(cx: &ScopeState, initial: T) -> Self {
        Self {
            value: cx.use_signal(|| initial),
        }
    }

    pub fn get(&self) -> T {
        self.value.get()
    }

    pub fn set(&self, value: T) {
        self.value.set(value);
    }

    pub fn animate_to<F>(&self, target: T, duration: Duration, easing: F) -> impl Fn()
    where
        T: Copy
            + std::ops::Sub<Output = T>
            + std::ops::Add<Output = T>
            + std::ops::Mul<f64, Output = T>,
        F: Fn(f64) -> f64 + 'static,
    {
        let start = self.get();
        let callback = move |progress: f64| {
            let eased = easing(progress);
            let diff = target - start;
            let current = start + (diff * eased);
            self.set(current);
        };

        callback
    }
}

pub fn use_transition(cx: &ScopeState, duration_ms: u64) -> UseTransition {
    cx.use_hook(|| UseTransition::new(cx, duration_ms))
}

pub struct UseTransition {
    is_visible: Signal<bool>,
    is_animating: Signal<bool>,
    duration_ms: u64,
}

impl UseTransition {
    fn new(cx: &ScopeState, duration_ms: u64) -> Self {
        Self {
            is_visible: cx.use_signal(|| false),
            is_animating: cx.use_signal(|| false),
            duration_ms,
        }
    }

    pub fn is_visible(&self) -> bool {
        self.is_visible.get()
    }

    pub fn is_animating(&self) -> bool {
        self.is_animating.get()
    }

    pub fn enter(&self) {
        self.is_visible.set(true);
        self.is_animating.set(true);

        let is_animating = self.is_animating.clone();
        let duration_ms = self.duration_ms;
        async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(duration_ms)).await;
            is_animating.set(false);
        }
        .spawn();
    }

    pub fn exit(&self) {
        self.is_animating.set(true);

        let is_visible = self.is_visible.clone();
        let is_animating = self.is_animating.clone();
        let duration_ms = self.duration_ms;
        async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(duration_ms)).await;
            is_visible.set(false);
            is_animating.set(false);
        }
        .spawn();
    }

    pub fn toggle(&self) {
        if self.is_visible.get() {
            self.exit();
        } else {
            self.enter();
        }
    }
}

pub fn use_animation_frame(cx: &ScopeState, callback: impl Fn(f64) + 'static) {
    cx.use_hook(|| {
        let callback = Rc::new(callback);
        let start_time = web_sys::window().unwrap().performance().unwrap().now();

        let request_id = cx.use_hook(|| {
            let callback = callback.clone();
            let mut start = start_time;

            let frame: Box<dyn FnMut() -> bool> = Box::new(move || {
                let now = web_sys::window().unwrap().performance().unwrap().now();
                let elapsed = (now - start) / 1000.0;
                callback(elapsed);
                true
            });

            let id = web_sys::window()
                .unwrap()
                .request_animation_frame(frame.as_ref().unchecked_ref())
                .unwrap();

            id
        });

        cx.on_cleanup(move || {
            web_sys::window()
                .unwrap()
                .cancel_animation_frame(*request_id);
        });
    });
}

pub fn use_timeout(cx: &ScopeState, duration_ms: u64) -> impl Fn() {
    cx.use_hook(|| {
        let timeout_handle = cx.use_hook::<Option<i32>>(|| None);

        let timeout_handle = timeout_handle.clone();
        move || {
            if let Some(id) = *timeout_handle.borrow() {
                web_sys::window().unwrap().clear_timeout(id);
            }

            let closure = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
                // Timeout callback
            }) as Box<dyn Fn()>);

            let id = web_sys::window()
                .unwrap()
                .set_timeout_with_callback_and_timeout_and_arguments_0(
                    closure.as_ref().unchecked_ref(),
                    duration_ms,
                )
                .unwrap();

            *timeout_handle.borrow_mut() = Some(id);
            closure.forget();
        }
    })
}

pub fn use_interval(cx: &ScopeState, duration_ms: u64, callback: impl Fn() + 'static) {
    cx.use_hook(|| {
        let interval_handle = cx.use_hook::<Option<i32>>(|| None);
        let callback = Rc::new(callback);

        let interval_handle = interval_handle.clone();
        let closure = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
            callback();
        }) as Box<dyn Fn()>);

        let id = web_sys::window()
            .unwrap()
            .set_interval_with_callback_and_timeout_and_arguments_0(
                closure.as_ref().unchecked_ref(),
                duration_ms,
            )
            .unwrap();

        *interval_handle.borrow_mut() = Some(id);
        closure.forget();

        cx.on_cleanup(move || {
            if let Some(id) = *interval_handle.borrow() {
                web_sys::window().unwrap().clear_interval(id);
            }
        });
    });
}
