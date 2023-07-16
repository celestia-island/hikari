pub(crate) mod app;
pub(crate) mod components;
pub(crate) mod pages;
pub(crate) mod utils;

#[cfg(target_arch = "wasm32")]
mod web_entry;

#[cfg(target_arch = "wasm32")]
pub use web_entry::*;
