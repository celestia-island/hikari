//! Type-safe CSS style builders.
//!
//! Re-exports from `tairitsu_style` for CSS property enums and string builders.

// Re-export core CSS types from tairitsu_style (works on all platforms)
pub use tairitsu_style::{CssProperty, Property, StyleStringBuilder};

// StyleBuilder is now an alias to StyleStringBuilder for unified WASI support
pub type StyleBuilder = StyleStringBuilder;
