//! Timer facilities for temporary callbacks and delayed actions
//!
//! Provides a simple timer system for managing temporary state changes
//! and delayed callbacks, useful for:
//! - Scrollbar hover-after-scroll effects
//! - Toast auto-dismissal
//! - Temporary visual feedback
//! - Debouncing and throttling
//! - requestAnimationFrame-based animations

use std::{cell::RefCell, rc::Rc, time::Duration};

use wasm_bindgen::{prelude::*, JsCast};

/// Timer ID for tracking scheduled timers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TimerId(u32);

impl TimerId {
    /// Create a new timer ID from raw value
    pub fn new(id: u32) -> Self {
        Self(id)
    }

    /// Get raw timer ID
    pub fn as_u32(&self) -> u32 {
        self.0
    }
}

/// Frame ID for tracking requestAnimationFrame callbacks
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct FrameId(u32);

impl FrameId {
    /// Create a new frame ID from raw value
    pub fn new(id: u32) -> Self {
        Self(id)
    }

    /// Get raw frame ID
    pub fn as_u32(&self) -> u32 {
        self.0
    }
}

/// Callback type for timer events
pub type TimerCallback = Rc<dyn Fn()>;

/// Frame callback type for requestAnimationFrame
pub type FrameCallback = Rc<RefCell<dyn FnMut(f64)>>;

/// Timer manager for scheduling and cancelling delayed callbacks
///
/// # Example
/// ```ignore
/// use animation::TimerManager;
///
/// let manager = TimerManager::new();
///
/// // Schedule a callback
/// let callback = Rc::new(|| {
///     web_sys::console::log_1(&"Timer fired!".into());
/// });
///
/// let id = manager.set_timeout(callback, Duration::from_millis(500));
///
/// // Cancel if needed
/// manager.clear_timeout(id);
/// ```
#[derive(Clone)]
pub struct TimerManager {
    next_id: Rc<RefCell<u32>>,
    timers: Rc<RefCell<std::collections::HashMap<TimerId, i32>>>,
    animation_frames: Rc<RefCell<std::collections::HashMap<FrameId, i32>>>,
}

impl TimerManager {
    /// Create a new timer manager
    pub fn new() -> Self {
        Self {
            next_id: Rc::new(RefCell::new(0)),
            timers: Rc::new(RefCell::new(std::collections::HashMap::new())),
            animation_frames: Rc::new(RefCell::new(std::collections::HashMap::new())),
        }
    }

    /// Schedule a one-shot callback
    ///
    /// # Arguments
    /// * `callback` - Function to call when timer fires
    /// * `delay` - Duration to wait before calling callback
    ///
    /// # Returns
    /// Timer ID that can be used to cancel the timer
    pub fn set_timeout(&self, callback: TimerCallback, delay: Duration) -> TimerId {
        let window = match web_sys::window() {
            Some(w) => w,
            None => return TimerId(0),
        };

        // Generate unique timer ID
        let id = {
            let mut next_id = self.next_id.borrow_mut();
            let id = TimerId(*next_id);
            *next_id = next_id.wrapping_add(1);
            id
        };

        // Schedule timeout
        let callback_clone = callback.clone();
        let callback_js = Closure::wrap(Box::new(move || {
            callback_clone();
        }) as Box<dyn FnMut()>);

        let handle = window.set_timeout_with_callback_and_timeout_and_arguments_0(
            callback_js.as_ref().unchecked_ref(),
            delay.as_millis() as i32,
        );

        match handle {
            Ok(handle) => {
                self.timers.borrow_mut().insert(id, handle);
                // Successfully scheduled, closure will be owned by browser
                callback_js.forget();
            }
            Err(_) => {
                // Failed to schedule, need to manually drop closure
                callback_js.forget();
            }
        }

        id
    }

    /// Cancel a scheduled timer
    ///
    /// # Arguments
    /// * `id` - Timer ID returned by `set_timeout`
    pub fn clear_timeout(&self, id: TimerId) {
        let window = match web_sys::window() {
            Some(w) => w,
            None => return,
        };

        if let Some(handle) = self.timers.borrow_mut().remove(&id) {
            window.clear_timeout_with_handle(handle);
        }
    }

    /// Schedule an interval callback
    ///
    /// # Arguments
    /// * `callback` - Function to call repeatedly
    /// * `interval` - Duration between calls
    ///
    /// # Returns
    /// Timer ID that can be used to cancel the interval
    pub fn set_interval(&self, callback: TimerCallback, interval: Duration) -> TimerId {
        let window = match web_sys::window() {
            Some(w) => w,
            None => return TimerId(0),
        };

        // Generate unique timer ID
        let id = {
            let mut next_id = self.next_id.borrow_mut();
            let id = TimerId(*next_id);
            *next_id = next_id.wrapping_add(1);
            id
        };

        // Schedule interval
        let callback_js = Closure::wrap(Box::new(move || {
            callback();
        }) as Box<dyn FnMut()>);

        let handle = window.set_interval_with_callback_and_timeout_and_arguments_0(
            callback_js.as_ref().unchecked_ref(),
            interval.as_millis() as i32,
        );

        match handle {
            Ok(handle) => {
                self.timers.borrow_mut().insert(id, handle);
                // Successfully scheduled, closure will be owned by browser
                callback_js.forget();
            }
            Err(_) => {
                // Failed to schedule, need to manually drop closure
                callback_js.forget();
            }
        }

        id
    }

    /// Cancel a scheduled interval
    ///
    /// # Arguments
    /// * `id` - Timer ID returned by `set_interval`
    pub fn clear_interval(&self, id: TimerId) {
        self.clear_timeout(id); // Same implementation
    }

    /// Clear all active timers
    pub fn clear_all(&self) {
        let window = match web_sys::window() {
            Some(w) => w,
            None => return,
        };

        let mut timers = self.timers.borrow_mut();
        for (_id, handle) in timers.iter() {
            window.clear_timeout_with_handle(*handle);
        }
        timers.clear();
    }

    /// Schedule a requestAnimationFrame callback
    ///
    /// # Arguments
    ///
    /// * `callback` - Function to call each frame with timestamp (ms since page load)
    ///
    /// # Returns
    ///
    /// Frame ID that can be used to cancel the animation
    ///
    /// # Example
    ///
    /// ```ignore
    /// use animation::TimerManager;
    ///
    /// let manager = TimerManager::new();
    ///
    /// let callback = Rc::new(RefCell::new(move |timestamp| {
    ///     let angle = (timestamp / 100.0) % 360.0;
    ///     // Update element with angle...
    /// }));
    ///
    /// let id = manager.request_animation_frame(callback);
    ///
    /// // Cancel if needed
    /// manager.cancel_animation_frame(id);
    /// ```
    pub fn request_animation_frame(&self, callback: FrameCallback) -> FrameId {
        let window = match web_sys::window() {
            Some(w) => w,
            None => return FrameId(0),
        };

        // Generate unique frame ID
        let id = {
            let mut next_id = self.next_id.borrow_mut();
            let id = FrameId(*next_id);
            *next_id = next_id.wrapping_add(1);
            id
        };

        // Schedule requestAnimationFrame
        let callback_clone = callback.clone();
        let callback_js = Closure::wrap(Box::new(move |timestamp: f64| {
            if let Ok(mut cb) = callback_clone.try_borrow_mut() {
                cb(timestamp);
            }
        }) as Box<dyn FnMut(f64)>);

        let handle = window.request_animation_frame(callback_js.as_ref().unchecked_ref());

        match handle {
            Ok(handle) => {
                let mut frames = self.animation_frames.borrow_mut();
                frames.insert(id, handle);
                callback_js.forget();
            }
            Err(_) => {
                callback_js.forget();
            }
        }

        id
    }

    /// Cancel a requestAnimationFrame callback
    ///
    /// # Arguments
    ///
    /// * `id` - Frame ID returned by `request_animation_frame`
    pub fn cancel_animation_frame(&self, id: FrameId) {
        let window = match web_sys::window() {
            Some(w) => w,
            None => return,
        };

        if let Some(handle) = self.animation_frames.borrow_mut().remove(&id) {
            let _ = window.cancel_animation_frame(handle);
        }
    }

    /// Clear all active animation frames
    pub fn clear_all_animation_frames(&self) {
        let window = match web_sys::window() {
            Some(w) => w,
            None => return,
        };

        let mut frames = self.animation_frames.borrow_mut();
        for (_id, handle) in frames.iter() {
            let _ = window.cancel_animation_frame(*handle);
        }
        frames.clear();
    }
}

impl Default for TimerManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Debounce utility - only call function after delay expires without new calls
///
/// # Example
/// ```ignore
/// use animation::{TimerManager, debounce};
///
/// let manager = TimerManager::new();
/// let debounced = debounce(manager.clone(), Duration::from_millis(300), || {
///     // This will only fire 300ms after the last call
/// });
///
/// debounced(); // Will fire in 300ms
/// debounced(); // Resets timer, will fire in 300ms from now
/// ```
pub fn debounce(
    manager: TimerManager,
    delay: Duration,
    callback: TimerCallback,
) -> Rc<RefCell<dyn Fn()>> {
    struct DebounceState {
        timer_id: Option<TimerId>,
    }

    let state = Rc::new(RefCell::new(DebounceState { timer_id: None }));
    let state_clone = state.clone();

    let debounced = Rc::new(RefCell::new(move || {
        // Cancel existing timer
        if let Some(timer_id) = state_clone.borrow_mut().timer_id.take() {
            manager.clear_timeout(timer_id);
        }

        // Schedule new timer
        let callback_clone = callback.clone();
        let state_for_timer = state.clone();
        let timer_id = manager.set_timeout(
            Rc::new(move || {
                callback_clone();
                state_for_timer.borrow_mut().timer_id = None;
            }),
            delay,
        );
        state_clone.borrow_mut().timer_id = Some(timer_id);
    }));

    debounced
}

/// Throttle utility - only call function once per delay period
///
/// # Example
/// ```ignore
/// use animation::{TimerManager, throttle};
///
/// let manager = TimerManager::new();
/// let throttled = throttle(manager, Duration::from_millis(100), || {
///     // This will fire at most once every 100ms
/// });
///
/// throttled(); // Fires immediately
/// throttled(); // Ignored (within throttle period)
/// ```
pub fn throttle(
    _manager: TimerManager,
    interval: Duration,
    callback: TimerCallback,
) -> Rc<RefCell<dyn Fn()>> {
    struct ThrottleState {
        last_call: Option<f64>,
    }

    let state = Rc::new(RefCell::new(ThrottleState { last_call: None }));

    let throttled = Rc::new(RefCell::new(move || {
        let now = js_sys::Date::now();
        let mut state_ref = state.borrow_mut();

        if let Some(last_time) = state_ref.last_call {
            if now - last_time < interval.as_millis() as f64 {
                return; // Throttled
            }
        }

        state_ref.last_call = Some(now);
        callback();
    }));

    throttled
}
