//! Global animation manager (very simplified version)
//!
//! Provides a simple global animation loop for WASM only.

/// Global animation manager (no global state - just functions)
#[cfg(target_arch = "wasm32")]
pub struct GlobalAnimationManager;

#[cfg(target_arch = "wasm32")]
impl GlobalAnimationManager {
    /// Create a new global animation manager
    pub fn new() -> Self {
        Self
    }

    /// Start the global animation loop (no-op for now)
    pub fn start(&self) {
        web_sys::console::log_1(&"🎬 Global animation manager started (simplified)".into());
    }

    /// Stop the global animation loop (no-op for now)
    pub fn stop(&self) {
        web_sys::console::log_1(&"🛑 Global animation manager stopped".into());
    }

    /// Register an animation callback (just log for now)
    pub fn register(&self, _name: String, _callback: Box<dyn Fn()>) {
        web_sys::console::log_1(&"✅ Animation callback registered (simplified)".into());
    }

    /// Unregister an animation callback (just log for now)
    pub fn unregister(&self, _name: &str) {
        web_sys::console::log_1(&"🛑 Animation callback unregistered".into());
    }
}

#[cfg(target_arch = "wasm32")]
static GLOBAL_MANAGER: GlobalAnimationManager = GlobalAnimationManager;

/// Get the global animation manager
#[cfg(target_arch = "wasm32")]
pub fn global_animation_manager() -> &'static GlobalAnimationManager {
    &GLOBAL_MANAGER
}

/// Initialize the global animation manager
#[cfg(target_arch = "wasm32")]
pub fn init_global_animation_manager() {
    web_sys::console::log_1(&"🎬 Initializing global animation manager".into());
    global_animation_manager().start();
}

/// Create an animation callback (simplified)
#[cfg(target_arch = "wasm32")]
pub fn create_animation_callback(
    _element: web_sys::HtmlElement,
    _state: crate::state::AnimationState,
    _actions: Vec<crate::builder::AnimationAction>,
    _f: impl Fn(&crate::context::AnimationContext, &mut crate::state::AnimationState) + 'static,
) -> Box<dyn Fn()> {
    Box::new(|| {
        web_sys::console::log_1(&"Animation callback executed (simplified)".into());
    })
}
