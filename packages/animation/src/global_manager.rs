//! Global animation manager
//!
//! Provides a global animation loop for WASM: registered callbacks are ticked
//! once per `requestAnimationFrame` frame, and the loop keeps running while at
//! least one callback is registered. The loop is started automatically by
//! [`GlobalAnimationManager::register`] (and by
//! [`init_global_animation_manager`]) and stops itself when the last callback
//! is unregistered.

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use std::cell::{Cell, RefCell};
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use std::collections::HashMap;
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use std::rc::Rc;

// The plumbing below only exists on wasm: it drives `requestAnimationFrame`,
// and everything referencing it is cfg'd out on other targets.
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use wasm_bindgen::JsCast;
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use wasm_bindgen::closure::Closure;

/// A single animation step: invoked once per frame. Steps are stateful (they
/// advance their own clock and animation state), hence `FnMut`.
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
type FrameStep = Rc<RefCell<dyn FnMut()>>;

thread_local! {
    /// Callbacks registered on the global manager, keyed by name.
    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    static REGISTERED_CALLBACKS: RefCell<HashMap<String, FrameStep>> =
        RefCell::new(HashMap::new());
    /// Whether the global rAF loop is currently meant to keep ticking.
    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    static RUNNING: Cell<bool> = const { Cell::new(false) };
    /// Handle of the pending `requestAnimationFrame` call, or `-1` if none.
    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    static ACTIVE_FRAME: Cell<i32> = const { Cell::new(-1) };
    /// The self-rescheduling frame closure. Created once and kept alive for
    /// the lifetime of the page (same ownership model as `TimerManager`).
    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    static FRAME_CLOSURE: RefCell<Option<Rc<Closure<dyn FnMut(f64)>>>> =
        RefCell::new(None);
}

/// Global animation manager backed by a real `requestAnimationFrame` loop.
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub struct GlobalAnimationManager;

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
impl GlobalAnimationManager {
    /// Create a new global animation manager
    pub fn new() -> Self {
        Self
    }

    /// Start the global animation loop.
    ///
    /// Idempotent: calling `start` while the loop is already running does
    /// nothing. The loop keeps re-scheduling itself until [`Self::stop`] is
    /// called or the last callback is unregistered.
    pub fn start(&self) {
        if RUNNING.get() {
            return;
        }
        RUNNING.set(true);
        schedule_frame();
    }

    /// Stop the global animation loop and cancel any pending frame.
    ///
    /// Registered callbacks are kept; calling [`Self::start`] resumes ticking
    /// them.
    pub fn stop(&self) {
        RUNNING.set(false);
        cancel_pending_frame();
    }

    /// Register an animation callback under `name`.
    ///
    /// The callback is invoked once per frame starting with the next frame.
    /// If the global loop is not running yet, this starts it, so registering
    /// alone is enough to bring an animation to life.
    pub fn register(&self, name: String, callback: Box<dyn FnMut()>) {
        REGISTERED_CALLBACKS.with(|r| {
            r.borrow_mut().insert(name, Rc::new(RefCell::new(callback)));
        });
        if !RUNNING.get() {
            self.start();
        }
    }

    /// Unregister the animation callback registered under `name`.
    ///
    /// Unregistering the last callback stops the loop instead of spinning
    /// empty frames.
    pub fn unregister(&self, name: &str) {
        REGISTERED_CALLBACKS.with(|r| {
            r.borrow_mut().remove(name);
        });
        let empty = REGISTERED_CALLBACKS.with(|r| r.borrow().is_empty());
        if empty && RUNNING.get() {
            self.stop();
        }
    }
}

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
impl Default for GlobalAnimationManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Run one animation frame: tick every registered callback, then re-schedule
/// while the loop is running and at least one callback remains.
///
/// Callbacks are snapshotted before invocation, so a callback may freely
/// `register`/`unregister` (including itself) without re-entrant borrows.
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
fn tick(timestamp: f64) {
    let _ = timestamp; // per-callback clocks live in their AnimationContext
    let callbacks: Vec<FrameStep> =
        REGISTERED_CALLBACKS.with(|r| r.borrow().values().cloned().collect());
    for callback in callbacks {
        // A step that is already running (re-entrant tick) is skipped rather
        // than panicking — same policy as `TimerManager::request_animation_frame`.
        if let Ok(mut step) = callback.try_borrow_mut() {
            step();
        }
    }

    let keep_running = RUNNING.get() && REGISTERED_CALLBACKS.with(|r| !r.borrow().is_empty());
    if keep_running {
        schedule_frame();
    } else {
        RUNNING.set(false);
    }
}

/// Request the next animation frame, creating the frame closure on first use.
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
fn schedule_frame() {
    let Some(window) = web_sys::window() else {
        return;
    };

    let closure = FRAME_CLOSURE.with(|slot| {
        let mut slot = slot.borrow_mut();
        if slot.is_none() {
            *slot = Some(Rc::new(
                Closure::wrap(Box::new(tick) as Box<dyn FnMut(f64)>),
            ));
        }
        slot.as_ref().expect("frame closure just created").clone()
    });

    if let Ok(handle) = window.request_animation_frame(closure.as_js_value().unchecked_ref()) {
        ACTIVE_FRAME.set(handle);
    }
}

/// Cancel the pending animation frame, if any.
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
fn cancel_pending_frame() {
    let handle = ACTIVE_FRAME.get();
    if handle < 0 {
        return;
    }
    ACTIVE_FRAME.set(-1);
    if let Some(window) = web_sys::window() {
        let _ = window.cancel_animation_frame(handle);
    }
}

/// Get the global animation manager
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub fn global_animation_manager() -> &'static GlobalAnimationManager {
    &GLOBAL_MANAGER
}

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
static GLOBAL_MANAGER: GlobalAnimationManager = GlobalAnimationManager;

/// Initialize the global animation manager and start its frame loop.
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub fn init_global_animation_manager() {
    web_sys::console::log_1(&"Initializing global animation manager".into());
    global_animation_manager().start();
}

/// Create an animation callback from an animation definition.
///
/// The returned closure is one stateful animation step, intended to be passed
/// to [`GlobalAnimationManager::register`] (see also
/// `crate::builder::start_animation_with_global_manager`). Each invocation:
///
/// 1. advances the animation clock from `performance.now()`, so
///    [`AnimationContext::delta_seconds`] reflects the real frame delta;
/// 2. runs the user step `f` (typically updating `state`);
/// 3. applies `actions` (dynamic styles / utility classes) to `element`,
///    evaluating dynamic values against the updated context and state.
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub fn create_animation_callback(
    element: web_sys::HtmlElement,
    mut state: crate::state::AnimationDataStore,
    actions: Vec<crate::builder::AnimationAction>,
    f: impl Fn(&crate::context::AnimationContext, &mut crate::state::AnimationDataStore) + 'static,
) -> Box<dyn FnMut()> {
    let mut context = crate::context::AnimationContext::new(&element);

    Box::new(move || {
        let now = web_sys::window()
            .map(|w| w.performance().map(|p| p.now()).unwrap_or(0.0))
            .unwrap_or(0.0);
        context.update_timing(now);

        f(&context, &mut state);
        crate::builder::apply_actions(&element, &actions, &context, &mut state);
    })
}
