//! Theme provider component
//!
//! This module provides the [`ThemeProvider`] component which enables
//! theme switching across the application using the [`ThemeContext`].
//!
//! # Supported Themes
//!
//! - `"hikari"` - Light theme (光)
//! - `"tairitsu"` - Dark theme (tairitsu)

use dioxus::prelude::*;
use palette::*;

/// Theme provider properties
///
/// Defines the props accepted by [`ThemeProvider`] component.
///
/// # Fields
///
/// - `palette` - Theme identifier string (default: "hikari")
/// - `children` - Child elements to render within the theme context
#[derive(Clone, Props, PartialEq)]
pub struct ThemeProviderProps {
    #[props(default = "hikari".to_string())]
    pub palette: String,

    children: Element,
}

/// Theme Provider component
///
/// Provides theme context to all child components.
///
/// # Props
///
/// - `palette` - Theme identifier ("hikari" or "tairitsu")
/// - `children` - Child elements that receive theme context
///
/// # Example
///
/// ```rust,no_run
/// use theme::ThemeProvider;
///
/// rsx! {
///     ThemeProvider { palette: "tairitsu" } {
///         // Children here
///     }
/// }
/// }
/// ```
#[component]
pub fn ThemeProvider(props: ThemeProviderProps) -> Element {
    let _colors = match props.palette.as_str() {
        "hikari" => themes::Hikari::palette(),
        "tairitsu" => themes::Tairitsu::palette(),
        _ => themes::Hikari::palette(),
    };

    rsx! {
        div {
            class: "hi-theme-provider",
            "data-theme": "{props.palette}",
            {props.children}
        }
    }
}
