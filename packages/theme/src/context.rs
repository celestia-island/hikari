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
//! # fn main() {
//! #     let context = ThemeContext {
//! #         palette: "hikari".to_string(),
//! #         colors: Hikari::palette(),
//! #         direction: LayoutDirection::Ltr,
//! #         set_theme: Callback::new(|_| {}),
//! #     };
//! # }
//! ```

use dioxus::prelude::*;
use palette::*;

/// Layout direction for RTL/LTR support
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum LayoutDirection {
    #[default]
    Ltr,
    Rtl,
}

impl LayoutDirection {
    pub fn as_str(&self) -> &'static str {
        match self {
            LayoutDirection::Ltr => "ltr",
            LayoutDirection::Rtl => "rtl",
        }
    }

    pub fn is_rtl(&self) -> bool {
        matches!(self, LayoutDirection::Rtl)
    }

    pub fn start(&self) -> &'static str {
        match self {
            LayoutDirection::Ltr => "left",
            LayoutDirection::Rtl => "right",
        }
    }

    pub fn end(&self) -> &'static str {
        match self {
            LayoutDirection::Ltr => "right",
            LayoutDirection::Rtl => "left",
        }
    }
}

/// Theme context state
///
/// Represents the current theme configuration with palette identifier
/// and color scheme.
///
/// # Fields
///
/// - `palette` - Identifier string for the current theme (e.g., "hikari", "tairitsu")
/// - `colors` - The active [`Palette`] with color definitions
/// - `direction` - Layout direction (LTR or RTL) for internationalization support
/// - `set_theme` - Callback to switch to a different theme
#[derive(Clone)]
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
    pub direction: LayoutDirection,
    pub set_theme: Callback<String>,
}

impl Default for ThemeContext {
    fn default() -> Self {
        ThemeContext {
            palette: "hikari".to_string(),
            colors: themes::Hikari::palette(),
            direction: LayoutDirection::Ltr,
            set_theme: Callback::new(|_| {}),
        }
    }
}

/// Hook to access theme context
///
/// # Panics
///
/// Panics if called outside of a ThemeProvider.
pub fn use_theme() -> ThemeContext {
    use_context()
}

/// Hook to try to access theme context
///
/// Returns None if called outside of a ThemeProvider.
pub fn try_use_theme() -> Option<ThemeContext> {
    try_consume_context()
}
