//! Global animation manager (very simplified version)
//!
//! Provides a simple global animation loop for WASI environments.

use tairitsu_vdom::Platform;

/// Global animation manager (no global state - just functions)
pub struct GlobalAnimationManager;

impl Default for GlobalAnimationManager {
    fn default() -> Self {
        Self::new()
    }
}

impl GlobalAnimationManager {
    /// Create a new global animation manager
    pub fn new() -> Self {
        Self
    }

    /// Start the global animation loop (no-op for now)
    pub fn start(&self) {
        eprintln!("🎬 Global animation manager started (simplified)");
    }

    /// Stop the global animation loop (no-op for now)
    pub fn stop(&self) {
        eprintln!("🛑 Global animation manager stopped");
    }

    /// Register an animation callback (just log for now)
    pub fn register(&self, _name: String, _callback: Box<dyn Fn()>) {
        eprintln!("✅ Animation callback registered (simplified)");
    }

    /// Unregister an animation callback (just log for now)
    pub fn unregister(&self, _name: &str) {
        eprintln!("🛑 Animation callback unregistered");
    }
}

static GLOBAL_MANAGER: GlobalAnimationManager = GlobalAnimationManager;

/// Get the global animation manager
pub fn global_animation_manager() -> &'static GlobalAnimationManager {
    &GLOBAL_MANAGER
}

/// Initialize the global animation manager
pub fn init_global_animation_manager() {
    eprintln!("🎬 Initializing global animation manager");
    global_animation_manager().start();
}

/// Create an animation callback (simplified)
pub fn create_animation_callback<P: Platform>(
    _element: P::Element,
    _state: crate::state::AnimationDataStore,
    _actions: Vec<crate::builder::AnimationAction<P>>,
    _f: impl Fn(&crate::context::AnimationContext<P>, &mut crate::state::AnimationDataStore) + 'static,
) -> Box<dyn Fn()> {
    Box::new(|| {
        eprintln!("Animation callback executed (simplified)");
    })
}
