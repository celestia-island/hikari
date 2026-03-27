//! Type-safe CSS style builders.
//!
//! Re-exports from `tairitsu_style` for CSS property enums and string builders.
//! Re-exports from `tairitsu_css_values` for type-safe CSS value types.

// Re-export core CSS types from tairitsu_style (works on all platforms)
pub use tairitsu_style::{CssProperty, Property, StyleStringBuilder, StyleBuilder};

// Re-export type-safe CSS value types from tairitsu_css-values
pub use tairitsu_css_values::{CssLength, CssExpression, CssBinOp, LengthUnit};
