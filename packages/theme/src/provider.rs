//! Theme provider component
//!
//! This module provides the [`ThemeProvider`] component which enables
//! theme switching across the application using the [`ThemeContext`].
//!
//! # Supported Themes
//!
//! - `"primary"` - Primary theme (四大传统色)
//! - `"fui-dark"` - FUI dark theme (科幻风格深色主题)
//! - `"arknights"` - Arknights theme (明日方舟风格)
//! - `"fresh"` - Fresh theme (清新雅致风格)

use dioxus::prelude::*;
use hikari_palette::*;

/// Theme provider properties
///
/// Defines the props accepted by [`ThemeProvider`] component.
///
/// # Fields
///
/// - `palette` - Theme identifier string (default: "primary")
/// - `children` - Child elements to render within the theme context
#[derive(Clone, Props, PartialEq)]
pub struct ThemeProviderProps {
    #[props(default = "primary".to_string())]
    pub palette: String,

    children: Element,
}

/// Theme Provider component
///
/// Provides theme context to all child components.
///
/// # Props
///
/// - `palette` - Theme identifier ("primary", "fui-dark", "arknights", or "fresh")
/// - `children` - Child elements that receive theme context
///
/// # Example
///
/// ```rust,no_run
/// use hikari_theme::ThemeProvider;
///
/// rsx! {
///     ThemeProvider { palette: "fui-dark" } {
///         // Children here
///     }
/// }
/// }
/// ```
#[component]
pub fn ThemeProvider(props: ThemeProviderProps) -> Element {
    let _colors = match props.palette.as_str() {
        "primary" => primary_palette(),
        "fui-dark" => fui_dark_palette(),
        "arknights" => arknights_palette(),
        "fresh" => fresh_palette(),
        _ => primary_palette(),
    };

    rsx! {
        div {
            class: "hi-theme-provider",
            "data-theme": "{props.palette}",
            {props.children}
        }
    }
}
