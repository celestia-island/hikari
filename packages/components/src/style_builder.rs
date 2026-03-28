//! Type-safe CSS style builders.
//!
//! Re-exports from `tairitsu_style` for CSS property enums and string builders.

// Re-export core CSS types from tairitsu_style (works on all platforms)
pub use tairitsu_style::{CssProperty, Property, StyleStringBuilder, StyleBuilder};

// TODO: Re-export type-safe CSS value types when tairitsu_css_values is available
// pub use tairitsu_css_values::{CssLength, CssExpression, CssBinOp, LengthUnit};
