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

use std::cell::RefCell;
use std::rc::Rc;
use std::sync::atomic::{AtomicI32, Ordering};
use std::time::Duration;

use tairitsu_vdom::Platform;

static NEXT_TIMER_ID: AtomicI32 = AtomicI32::new(1);

fn allocate_timer_id() -> i32 {
    NEXT_TIMER_ID.fetch_add(1, Ordering::Relaxed)
}

/// Timer ID for tracking scheduled timers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TimerId(i32);

impl TimerId {
    /// Create a new timer ID from raw value
    #[must_use]
    pub const fn new(id: i32) -> Self {
        Self(id)
    }

    /// Get raw timer ID
    #[must_use]
    pub const fn as_i32(&self) -> i32 {
        self.0
    }
}

/// Frame ID for tracking requestAnimationFrame callbacks
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct FrameId(u32);

impl FrameId {
    /// Create a new frame ID from raw value
    #[must_use]
    pub const fn new(id: u32) -> Self {
        Self(id)
    }

    /// Get raw frame ID
    #[must_use]
    pub const fn as_u32(&self) -> u32 {
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
    interval_registry: Rc<RefCell<std::collections::HashMap<i32, bool>>>,
}

impl<P: Platform> TimerManager<P> {
    /// Create a new timer manager with the given platform
    pub fn new(platform: Rc<RefCell<P>>) -> Self {
        Self {
            platform,
            interval_registry: Rc::new(RefCell::new(std::collections::HashMap::new())),
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
        let callback_clone = callback.clone();
        let handle = self.platform.borrow_mut().set_timeout(
            Box::new(move || callback_clone()),
            delay.as_millis().min(i32::MAX as u128) as i32,
        );
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
        let interval_id = allocate_timer_id();
        self.interval_registry
            .borrow_mut()
            .insert(interval_id, true);

        let registry = Rc::clone(&self.interval_registry);
        let platform = Rc::clone(&self.platform);
        let interval_ms = interval.as_millis().min(i32::MAX as u128) as i32;

        fn do_schedule<P: Platform>(
            platform: Rc<RefCell<P>>,
            registry: Rc<RefCell<std::collections::HashMap<i32, bool>>>,
            interval_id: i32,
            callback: TimerCallback,
            interval_ms: i32,
        ) {
            let reg = registry;
            let plat = platform.clone();
            let cb = callback.clone();

            platform.borrow_mut().set_timeout(
                Box::new(move || {
                    let active = reg.borrow().get(&interval_id).copied().unwrap_or(false);
                    if !active {
                        return;
                    }
                    cb();
                    do_schedule(
                        plat.clone(),
                        reg.clone(),
                        interval_id,
                        callback.clone(),
                        interval_ms,
                    );
                }),
                interval_ms,
            );
        }

        do_schedule(platform, registry, interval_id, callback, interval_ms);
        TimerId(interval_id)
    }

    /// Cancel a scheduled interval
    pub fn clear_interval(&self, id: TimerId) {
        self.interval_registry.borrow_mut().remove(&id.0);
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
        let handle =
            self.platform
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
            interval_registry: Rc::clone(&self.interval_registry),
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

    (Rc::new(RefCell::new(move || {
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
    }))) as _
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

    (Rc::new(RefCell::new(move || {
        use std::time::{SystemTime, UNIX_EPOCH};
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as f64;
        let mut state_ref = state.borrow_mut();

        if let Some(last_time) = state_ref.last_call
            && now - last_time < interval.as_millis() as f64
        {
            return; // Throttled
        }

        state_ref.last_call = Some(now);
        drop(state_ref);
        callback();
    }))) as _
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timer_id_new_and_as_i32() {
        let id = TimerId::new(42);
        assert_eq!(id.as_i32(), 42);
    }

    #[test]
    fn timer_id_equality() {
        assert_eq!(TimerId::new(1), TimerId::new(1));
        assert_ne!(TimerId::new(1), TimerId::new(2));
    }

    #[test]
    fn timer_id_copy() {
        let a = TimerId::new(10);
        let b = a;
        assert_eq!(a, b);
    }

    #[test]
    fn timer_id_hash_consistency() {
        use std::collections::HashSet;
        let mut set = HashSet::new();
        set.insert(TimerId::new(1));
        assert!(set.contains(&TimerId::new(1)));
        assert!(!set.contains(&TimerId::new(2)));
    }

    #[test]
    fn frame_id_new_and_as_u32() {
        let id = FrameId::new(99);
        assert_eq!(id.as_u32(), 99);
    }

    #[test]
    fn frame_id_equality() {
        assert_eq!(FrameId::new(5), FrameId::new(5));
        assert_ne!(FrameId::new(5), FrameId::new(6));
    }

    #[test]
    fn frame_id_copy() {
        let a = FrameId::new(7);
        let b = a;
        assert_eq!(a, b);
    }

    #[test]
    fn frame_id_hash_consistency() {
        use std::collections::HashSet;
        let mut set = HashSet::new();
        set.insert(FrameId::new(3));
        assert!(set.contains(&FrameId::new(3)));
        assert!(!set.contains(&FrameId::new(4)));
    }
}
