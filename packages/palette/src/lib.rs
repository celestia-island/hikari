//! Hikari Palette
//!
//! Chinese traditional color palette library with 500+ predefined colors.
//!
//! This crate provides a comprehensive collection of traditional Chinese colors,
//! including their hex codes, RGB values, and color categories.
//!
//! ## Modules
//!
//! - [`colors`] - Individual color definitions (500+ traditional colors)
//! - [`palettes`] - Predefined color schemes and themes
//!
//! ## Usage
//!
//! ```rust,no_run
//! use hikari_palette::{ChineseColor, primary_palette};
//!
//! // Use a specific color
//! let red = ChineseColor::朱砂;
//! println!("{} - {}", red.name, red.hex);
//!
//! // Use a predefined palette
//! let palette = primary_palette();
//! println!("Primary: {}", palette.primary.name);
//! ```

pub mod colors;
pub mod palettes;

pub use colors::*;
pub use palettes::*;
