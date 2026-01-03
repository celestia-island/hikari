//! Theme context for global theme state
//!
//! This module provides the [`ThemeContext`] struct which
//! holds the current theme configuration and color palette.
//! It works with the [`ThemeProvider`] component to enable
//! theme switching across the application.
//!
//! # Example
//!
//! ```rust,no_run
//! use hikari_theme::{ThemeContext, ThemeProvider};
//! use hikari_palette::primary_palette;
//!
//! fn main() {
//!     let context = ThemeContext {
//!         palette: "primary".to_string(),
//!         colors: primary_palette(),
//!     };
//! }
//! ```

use hikari_palette::*;

/// Theme context state
///
/// Represents the current theme configuration with palette identifier
/// and color scheme.
///
/// # Fields
///
/// - `palette` - Identifier string for the current palette (e.g., "primary", "fui-dark", "arknights")
/// - `colors` - The active [`Palette`] with color definitions
#[derive(Clone)]
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
}

impl Default for ThemeContext {
    fn default() -> Self {
        ThemeContext {
            palette: "primary".to_string(),
            colors: primary_palette(),
        }
    }
}
