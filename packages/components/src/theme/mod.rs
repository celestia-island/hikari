//! Theme provider module
//!
//! This module provides the [`ThemeProvider`] component which enables
//! hierarchical theme management across the application.

mod css;
mod provider;
mod registry;
mod traits;

pub use css::{ComponentOverrides, ComponentPalette, PaletteOverrides, ThemePalette};
pub use provider::{
    LayoutDirection, ThemeContext, ThemeProvider, ThemeProviderProps, use_layout_direction,
    use_theme,
};
pub use registry::{get_default_theme, get_registered_theme, prefers_dark_mode, register_theme};
pub use traits::IntoThemeName;
pub mod about_modal;
pub use about_modal::*;
pub mod action_bar;
pub use action_bar::*;
pub mod avatar_button;
pub use avatar_button::*;
pub mod color_scheme_dialog;
pub use color_scheme_dialog::*;
pub mod color_scheme_editor;
pub use color_scheme_editor::*;
pub mod connection_status;
pub use connection_status::*;
pub mod copy_badge;
pub use copy_badge::*;
pub mod corner_badge;
pub use corner_badge::*;
pub mod error_boundary;
pub use error_boundary::*;
pub mod error_landing;
pub use error_landing::*;
pub mod logo;
pub use logo::*;
pub mod secret_reveal_modal;
pub use secret_reveal_modal::*;
pub mod settings_dialog;
pub use settings_dialog::*;
pub mod splash;
pub use splash::*;
pub mod theme_decor;
pub use theme_decor::*;
pub mod theme_panel_content;
pub use theme_panel_content::*;
pub mod theme_toggle;
pub use theme_toggle::*;
pub mod wallpaper_backdrop;
pub use wallpaper_backdrop::*;
