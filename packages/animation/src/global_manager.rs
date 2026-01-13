use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;
#[cfg(target_arch = "wasm32")]
use std::rc::Rc;

use crate::builder::AnimationAction;
use crate::context::AnimationContext;
use crate::style::CssProperty;
use crate::AnimationState;

/// Animation update callback type
pub type AnimationUpdateCallback = Box<dyn Fn()>;

/// Global animation manager that coordinates all animations
#[cfg(target_arch = "wasm32")]
pub struct GlobalAnimationManager {
    callbacks: Arc<Mutex<HashMap<String, Vec<AnimationUpdateCallback>>>>,
    running: Arc<Mutex<bool>>,
}

#[cfg(target_arch = "wasm32")]
impl GlobalAnimationManager {
    /// Create a new global animation manager
    pub fn new() -> Self {
        Self {
            callbacks: Arc::new(Mutex::new(HashMap::new())),
            running: Arc::new(Mutex::new(false)),
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
            for (animation_name, callback_list) in callbacks_map.iter() {
                for (i, callback) in callback_list.iter().enumerate() {
                    callback(); // Execute the animation update
                }
            }
            drop(callbacks_map);

            // Request next frame if still running
            let is_running = *running.lock().unwrap();
            if is_running {
                web_sys::console::log_1(&"🔄 Requesting next frame (global loop)".into());
                if let Some(window) = window() {
                    let _ =
                        window.request_animation_frame(animation_closure.as_ref().unchecked_ref());
                }
            } else {
                web_sys::console::log_1(&"🛑 Animation loop stopped".into());
            }
        }));

        // Store closure and request first frame
        let callback_ref: &js_sys::Function = animation_closure.as_ref().unchecked_ref();
        let closure_arc = Rc::new(RefCell::new(None::<js_sys::Function>));
        *closure_arc.borrow_mut() = Some(callback_ref.clone());

        if let Some(window) = window() {
            if let Err(e) = window.request_animation_frame(callback_ref) {
                web_sys::console::log_2(
                    &"❌ Failed to start global animation loop".into(),
                    &format!("{:?}", e).into(),
                );
            } else {
                web_sys::console::log_1(&"✅ Global animation loop started".into());
            }
        }

        // Keep closure alive
        animation_closure.forget();
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
            .entry(name)
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

#[cfg(target_arch = "wasm32")]
static GLOBAL_MANAGER: once_cell::sync::Lazy<GlobalAnimationManager> =
    once_cell::sync::Lazy::new(|| GlobalAnimationManager::new());

/// Get the global animation manager
#[cfg(target_arch = "wasm32")]
pub fn global_animation_manager() -> &'static GlobalAnimationManager {
    &GLOBAL_MANAGER
}

/// Initialize the global animation manager (call once at app startup)
#[cfg(target_arch = "wasm32")]
pub fn init_global_animation_manager() {
    web_sys::console::log_1(&"🎬 Initializing global animation manager".into());
    global_animation_manager().start();
}

/// Helper to create an animation update callback from an AnimationBuilder state
#[cfg(target_arch = "wasm32")]
pub fn create_animation_callback<F>(
    element: web_sys::HtmlElement,
    state: AnimationState,
    actions: Vec<AnimationAction>,
    f: F,
) -> AnimationUpdateCallback
where
    F: Fn(&AnimationContext, &mut AnimationState) + 'static,
{
    use std::time::Instant;
    use web_sys::window;

    let mut state = state;
    let actions = actions;

    Box::new(move || {
        // Get current time
        let current_time = match window() {
            Some(w) => w.performance().map(|p| p.now()).unwrap_or(0.0),
            None => 0.0,
        };

        // Use a simple frame counter instead of delta time for now
        // TODO: Implement proper delta time calculation with previous time tracking
        let ctx = AnimationContext::new(&element);

        // Execute all actions
        for action in &actions {
            if let AnimationAction::Style(prop, value) = action {
                if matches!(
                    value,
                    crate::builder::DynamicValue::Dynamic(_)
                        | crate::builder::DynamicValue::StatefulDynamic(_)
                ) {
                    let value_str = value.evaluate(&ctx, &mut state);
                    crate::style::StyleBuilder::new(&element)
                        .add(*prop, &value_str)
                        .apply();
                }
            }
        }
    })
}
