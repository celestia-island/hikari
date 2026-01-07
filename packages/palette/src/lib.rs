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
//! - [`utility`] - Utility class system (Tailwind-like CSS utilities)
//!
//! ## Usage
//!
//! ```rust,no_run
//! use hikari_palette::{朱红, primary_palette};
//!
//! // Use a specific color
//! let red = 朱红;
//! println!("{:?}", red.hex());
//!
//! // Use a predefined palette
//! let palette = primary_palette();
//! println!("{:?}", palette.primary.hex());
//! ```

pub mod colors;
pub mod palettes;
pub mod utility;

pub use colors::*;
pub use palettes::*;
pub use utility::*;
