//! Timer facilities for temporary callbacks and delayed actions
//!
//! Provides a simple timer system for managing temporary state changes
//! and delayed callbacks, useful for:
//! - Scrollbar hover-after-scroll effects
//! - Toast auto-dismissal
//! - Temporary visual feedback
//! - Debouncing and throttling
//! - requestAnimationFrame-based animations
//!
//! This module uses the tairitsu-vdom Platform trait for cross-platform
//! timer support, working consistently in both WASM and server environments.

use std::{cell::RefCell, rc::Rc, time::Duration};

use tairitsu_vdom::Platform;

/// Timer ID for tracking scheduled timers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TimerId(i32);

impl TimerId {
    /// Create a new timer ID from raw value
    pub fn new(id: i32) -> Self {
        Self(id)
    }

    /// Get raw timer ID
    pub fn as_i32(&self) -> i32 {
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
/// Uses the Platform trait for cross-platform timer support.
///
/// # Example
/// ```ignore
/// use animation::TimerManager;
/// use tairitsu_vdom::Platform;
/// use std::rc::Rc;
/// use std::cell::RefCell;
///
/// let platform = Rc::new(RefCell::new(/* platform implementation */));
/// let manager = TimerManager::new(platform);
///
/// // Schedule a callback
/// let callback = Rc::new(|| {
///     println!("Timer fired!");
/// });
///
/// let id = manager.set_timeout(callback, Duration::from_millis(500));
///
/// // Cancel if needed
/// manager.clear_timeout(id);
/// ```
pub struct TimerManager<P: Platform> {
    platform: Rc<RefCell<P>>,
}

impl<P: Platform> TimerManager<P> {
    /// Create a new timer manager with the given platform
    pub fn new(platform: Rc<RefCell<P>>) -> Self {
        Self { platform }
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
        let callback_clone = callback.clone();
        let handle = self
            .platform
            .borrow_mut()
            .set_timeout(Box::new(move || callback_clone()), delay.as_millis() as i32);
        TimerId(handle)
    }

    /// Cancel a scheduled timer
    ///
    /// # Arguments
    /// * `id` - Timer ID returned by `set_timeout`
    pub fn clear_timeout(&self, id: TimerId) {
        self.platform.borrow_mut().clear_timeout(id.0);
    }

    /// Schedule an interval callback
    ///
    /// # Arguments
    /// * `callback` - Function to call repeatedly
    /// * `interval` - Duration between calls
    ///
    /// # Returns
    /// Timer ID that can be used to cancel the interval
    ///
    /// Note: This implementation re-schedules the callback after each execution.
    /// For true interval behavior, consider using platform-specific interval APIs.
    pub fn set_interval(&self, callback: TimerCallback, interval: Duration) -> TimerId {
        let callback_clone = callback.clone();
        let platform = Rc::clone(&self.platform);

        let id = self.set_timeout(
            Rc::new(move || {
                callback_clone();
                // Re-schedule
                let callback_clone2 = callback_clone.clone();
                let platform_clone = Rc::clone(&platform);
                let manager = TimerManager {
                    platform: platform_clone,
                };
                manager.set_timeout(callback_clone2, interval);
            }),
            interval,
        );

        id
    }

    /// Cancel a scheduled interval
    ///
    /// # Arguments
    /// * `id` - Timer ID returned by `set_interval`
    pub fn clear_interval(&self, id: TimerId) {
        self.clear_timeout(id);
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
    /// let manager = TimerManager::new(platform);
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
        let callback_clone = callback.clone();
        let handle = self
            .platform
            .borrow_mut()
            .request_animation_frame(Box::new(move |timestamp| {
                if let Ok(mut cb) = callback_clone.try_borrow_mut() {
                    cb(timestamp);
                }
            }));
        FrameId(handle)
    }

    /// Cancel a requestAnimationFrame callback
    ///
    /// # Arguments
    ///
    /// * `id` - Frame ID returned by `request_animation_frame`
    pub fn cancel_animation_frame(&self, id: FrameId) {
        self.platform.borrow_mut().cancel_animation_frame(id.0);
    }
}

impl<P: Platform> Clone for TimerManager<P> {
    fn clone(&self) -> Self {
        Self {
            platform: Rc::clone(&self.platform),
        }
    }
}

/// Debounce utility - only call function after delay expires without new calls
///
/// # Example
/// ```ignore
/// use animation::{TimerManager, debounce};
///
/// let manager = TimerManager::new(platform);
/// let debounced = debounce(manager.clone(), Duration::from_millis(300), || {
///     // This will only fire 300ms after the last call
/// });
///
/// debounced(); // Will fire in 300ms
/// debounced(); // Resets timer, will fire in 300ms from now
/// ```
pub fn debounce<P: Platform + 'static>(
    manager: TimerManager<P>,
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
/// let manager = TimerManager::new(platform);
/// let throttled = throttle(manager, Duration::from_millis(100), || {
///     // This will fire at most once every 100ms
/// });
///
/// throttled(); // Fires immediately
/// throttled(); // Ignored (within throttle period)
/// ```
pub fn throttle<P: Platform + 'static>(
    _manager: TimerManager<P>,
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
        drop(state_ref);
        callback();
    }));

    throttled
}
