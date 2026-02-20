//! Theme provider module
//!
//! This module provides the [`ThemeProvider`] component which enables
//! hierarchical theme management across the application.

mod css;
mod provider;
mod registry;
mod traits;

pub use css::{ComponentOverrides, ComponentPalette, PaletteOverrides, ThemePalette};
pub use provider::{LayoutDirection, ThemeContext, ThemeProvider, ThemeProviderProps, use_layout_direction, use_theme};
pub use registry::{get_default_theme, get_registered_theme, prefers_dark_mode, register_theme};
pub use traits::IntoThemeName;
