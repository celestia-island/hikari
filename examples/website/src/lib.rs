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

// Import glow initialization
#[cfg(target_arch = "wasm32")]
use _animation::glow::auto_init_glow;

// Import scrollbar initialization
#[cfg(target_arch = "wasm32")]
use _components::scripts::scrollbar_container::init_all;

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

    // Initialize UI effects immediately after launch
    // Dioxus launch() is synchronous for initial render, so DOM should be ready
    #[cfg(target_arch = "wasm32")]
    {
        web_sys::console::log_1(&"[Website] Initializing UI effects...".into());

        // Initialize scrollbars (sets up MutationObserver for future updates)
        init_all();

        // Initialize glow effects
        auto_init_glow();

        web_sys::console::log_1(&"[Website] UI effects initialized".into());
    }
}
