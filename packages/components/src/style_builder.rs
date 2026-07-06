//! Type-safe CSS style builders.
//!
//! Re-exports from `tairitsu_style` for CSS property enums and string builders.
//! For browser WASM builds, also provides `StyleBuilder` for direct DOM manipulation.

// Re-export core CSS types from tairitsu_style (works on all platforms)
pub use tairitsu_style::{CssProperty, Property, StyleStringBuilder};

// Browser WASM-specific: DOM manipulation utilities
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub use hikari_animation::style::{AttributeBuilder, StyleBuilder};

// Non-browser builds: StyleBuilder is just the string builder
#[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
pub type StyleBuilder = StyleStringBuilder;
