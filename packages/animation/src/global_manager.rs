use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;
#[cfg(target_arch = "wasm32")]
use std::rc::Rc;

use crate::builder::AnimationAction;
use crate::context::AnimationContext;
use crate::state::AnimationState;
use once_cell::sync::Lazy;

/// Animation update callback type
pub type AnimationUpdateCallback = Box<dyn Fn()>;

/// Global animation manager that coordinates all animations
#[cfg(target_arch = "wasm32")]
pub struct GlobalAnimationManager {
    callbacks: Arc<Mutex<HashMap<String, Vec<AnimationUpdateCallback>>>>,
    running: Arc<Mutex<bool>>,
    animation_closure: RefCell<Option<Closure<dyn Fn()>>>,
}

#[cfg(target_arch = "wasm32")]
impl GlobalAnimationManager {
    /// Create a new global animation manager
    pub fn new() -> Self {
        Self {
            callbacks: Arc::new(Mutex::new(HashMap::new())),
            running: Arc::new(Mutex::new(false)),
            animation_closure: RefCell::new(None),
        }
    }

    /// Start the global animation loop
    pub fn start(&self) {
        use wasm_bindgen::closure::Closure;
        use web_sys::window;

        let callbacks = self.callbacks.clone();
        let running = self.running.clone();

        *running.lock().unwrap() = true;
        web_sys::console::log_1(&"🚀 Starting global animation loop".into());

        let animation_closure = Closure::wrap(Box::new(move || {
            // Get all registered callbacks
            let callbacks_map = callbacks.lock().unwrap();

            // Execute all registered animation callbacks
            for (_animation_name, callback_list) in callbacks_map.iter() {
                for callback in callback_list.iter() {
                    callback(); // Execute the animation update
                }
            }
            drop(callbacks_map);

            // Request next frame if still running
            let is_running = *running.lock().unwrap();
            if is_running {
                web_sys::console::log_1(&"🔄 Requesting next frame (global loop)".into());
                if let Some(window) = window() {
                    // Schedule next frame
                    let running_clone = running.clone();
                    let callbacks_clone = callbacks.clone();

                    let next_closure = Closure::wrap(Box::new(move || {
                        let callbacks_map = callbacks_clone.lock().unwrap();
                        for (_, callback_list) in callbacks_map.iter() {
                            for callback in callback_list.iter() {
                                callback();
                            }
                        }
                        drop(callbacks_map);

                        // Request frame again if still running
                        if *running_clone.lock().unwrap() {
                            if let Some(window) = window() {
                                let _ = window
                                    .request_animation_frame(next_closure.as_ref().unchecked_ref());
                            }
                        }
                    }) as Box<dyn Fn()>);

                    let _ = window.request_animation_frame(next_closure.as_ref().unchecked_ref());
                }
            } else {
                web_sys::console::log_1(&"🛑 Animation loop stopped".into());
            }
        }) as Box<dyn Fn()>);

        // Store closure and request first frame
        self.animation_closure.replace(Some(animation_closure));

        if let Some(window) = window() {
            if let Some(ref callback) = self.animation_closure.borrow() {
                let _ = window.request_animation_frame(callback.as_ref().unchecked_ref());
                web_sys::console::log_1(&"✅ Global animation loop started".into());
            } else {
                web_sys::console::log_1(&"❌ Failed to create animation closure".into());
            }
        }
    }

    /// Stop the global animation loop
    pub fn stop(&self) {
        *self.running.lock().unwrap() = false;
        web_sys::console::log_1(&"🛑 Stopping global animation loop".into());
    }

    /// Register an animation callback
    pub fn register(&self, name: String, callback: AnimationUpdateCallback) {
        let mut callbacks = self.callbacks.lock().unwrap();
        callbacks
            .entry(name.clone())
            .or_insert_with(Vec::new)
            .push(callback);
        web_sys::console::log_2(
            &format!("✅ Registered animation: {}", name).into(),
            &name.into(),
        );
    }

    /// Unregister an animation callback
    pub fn unregister(&self, name: &str) {
        let mut callbacks = self.callbacks.lock().unwrap();
        callbacks.remove(name);
        web_sys::console::log_2(
            &format!("❌ Unregistered animation: {}", name).into(),
            &name.into(),
        );
    }
}

/// Create an animation callback that updates an element's style
#[cfg(target_arch = "wasm32")]
pub fn create_animation_callback<F>(
    element: web_sys::HtmlElement,
    _state: AnimationState,
    actions: Vec<AnimationAction>,
    _f: F,
) -> AnimationUpdateCallback
where
    F: Fn(&AnimationContext, &mut AnimationState) + 'static,
{
    use web_sys::window;

    let actions = actions;

    Box::new(move || {
        // Get current time
        let current_time = match window() {
            Some(w) => w.performance().map(|p| p.now()).unwrap_or(0.0),
            None => 0.0,
        };

        // Create a simplified animation context
        let ctx = AnimationContext::new(current_time);

        // For now, just log that we're updating
        web_sys::console::log_1(&"Animation callback executed".into());
    })
}

/// Get the global animation manager
#[cfg(target_arch = "wasm32")]
pub fn global_animation_manager() -> &'static GlobalAnimationManager {
    &GLOBAL_MANAGER
}

/// Global manager instance
#[cfg(target_arch = "wasm32")]
static GLOBAL_MANAGER: Lazy<GlobalAnimationManager> = Lazy::new(|| GlobalAnimationManager::new());
