// website/src/lib.rs
// WASM library entry point

#![allow(clippy::too_many_arguments)]
#![allow(clippy::type_complexity)]

// Import Dioxus (only needed for WASM target)
#[cfg(target_arch = "wasm32")]
use dioxus::prelude::*;

// Use console_error_panic_hook for better error messages in WASM
#[cfg(target_arch = "wasm32")]
use console_error_panic_hook::set_once;

// Import spotlight initialization
#[cfg(target_arch = "wasm32")]
use _animation::spotlight::init_spotlights;

// Re-export the app
pub use app::App;

mod app;
mod components;
mod pages;

// Shared configuration (used by main.rs)
#[cfg(not(target_arch = "wasm32"))]
pub mod paths;

// Initialize panic hook for WASM (auto-called on WASM startup)
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn init_panic_hook() {
    set_once();
}

// WASM entry point - called from JavaScript after init()
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn hydrate() {
    // Use dioxus::launch first to render the app
    launch(App);

    // Initialize spotlight effects after app is mounted
    // Use web_sys window.setTimeout to delay initialization
    #[cfg(target_arch = "wasm32")]
    {
        use wasm_bindgen::JsCast;
        use wasm_bindgen::prelude::*;

        if let Some(window) = web_sys::window() {
            let init_closure = wasm_bindgen::closure::Closure::once(|| {
                init_spotlights();
            });

            let _ = window.set_timeout_with_callback_and_timeout_and_arguments_0(
                init_closure.as_ref().unchecked_ref(),
                100,
            );
            init_closure.forget();
        }
    }
}
