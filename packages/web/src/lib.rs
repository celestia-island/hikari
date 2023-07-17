pub mod app;
pub mod components;
pub mod pages;
pub mod utils;

#[cfg(target_arch = "wasm32")]
mod web_entry;

#[cfg(target_arch = "wasm32")]
pub use web_entry::*;
