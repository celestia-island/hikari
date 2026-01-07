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
//! use theme::{ThemeContext, ThemeProvider};
//! use palette::themes::Hikari;
//!
//! fn main() {
//!     let context = ThemeContext {
//!         palette: "hikari".to_string(),
//!         colors: Hikari::palette(),
//!     };
//! }
//! ```

use palette::*;

/// Theme context state
///
/// Represents the current theme configuration with palette identifier
/// and color scheme.
///
/// # Fields
///
/// - `palette` - Identifier string for the current theme (e.g., "hikari", "tairitsu")
/// - `colors` - The active [`Palette`] with color definitions
#[derive(Clone)]
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
}

impl Default for ThemeContext {
    fn default() -> Self {
        ThemeContext {
            palette: "hikari".to_string(),
            colors: themes::Hikari::palette(),
        }
    }
}
