//! Platform abstraction layer for components
//!
//! This module provides platform-agnostic APIs for DOM operations,
//! abstracting over web_sys and future Platform implementations.

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub mod web;

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub use web::*;

#[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
pub mod stub;

#[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
pub use stub::*;
