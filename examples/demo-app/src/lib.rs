// demo-app/src/lib.rs
// WASM library entry point

#![allow(clippy::too_many_arguments)]
#![allow(clippy::type_complexity)]

// Use console_error_panic_hook for better error messages in WASM
#[cfg(target_arch = "wasm32")]
use console_error_panic_hook::set_once;

// Re-export the app
pub use app::App;

mod app;
mod components;
mod pages;

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
    // Launch Dioxus application and mount to #main element
    dioxus::launch(App);
}
