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

// Re-export the app
#[cfg(target_arch = "wasm32")]
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
    launch(App);
}
