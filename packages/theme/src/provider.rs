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

use crate::context::ThemeContext;

/// Theme provider properties
///
/// Defines the props accepted by [`ThemeProvider`] component.
///
/// # Fields
///
/// - `initial_palette` - Initial theme identifier string (default: "hikari")
/// - `language` - Language code string (default: "en-US")
/// - `children` - Child elements to render within the theme context
#[derive(Clone, Props, PartialEq)]
pub struct ThemeProviderProps {
    #[props(default = "hikari".to_string())]
    pub initial_palette: String,

    #[props(default = "en-US".to_string())]
    pub language: String,

    children: Element,
}

/// Theme Provider component
///
/// Provides theme context to all child components with dynamic theme switching support.
///
/// # Props
///
/// - `initial_palette` - Initial theme identifier ("hikari" or "tairitsu")
/// - `language` - Language code ("en-US", "zh-CN", or "zh-TW")
/// - `children` - Child elements that receive theme context
///
/// # Example
///
/// ```rust,no_run
/// use theme::ThemeProvider;
///
/// rsx! {
///     ThemeProvider {
///         initial_palette: "tairitsu",
///         language: "zh-CN",
///     } {
///         // Children here
///     }
/// }
/// }
/// ```
#[component]
pub fn ThemeProvider(props: ThemeProviderProps) -> Element {
    // Internal state for current theme
    let current_palette = use_signal(|| props.initial_palette.clone());
    let current_colors = use_signal(|| match props.initial_palette.as_str() {
        "hikari" => themes::Hikari::palette(),
        "tairitsu" => themes::Tairitsu::palette(),
        _ => themes::Hikari::palette(),
    });

    // Callback to change theme
    let mut palette_for_callback = current_palette;
    let mut colors_for_callback = current_colors;
    let set_theme = Callback::new(move |new_palette: String| {
        let new_colors = match new_palette.as_str() {
            "hikari" => themes::Hikari::palette(),
            "tairitsu" => themes::Tairitsu::palette(),
            _ => themes::Hikari::palette(),
        };
        palette_for_callback.set(new_palette);
        colors_for_callback.set(new_colors);
    });

    // Provide theme context
    use_context_provider(move || ThemeContext {
        palette: (*current_palette.read()).clone(),
        colors: (*current_colors.read()).clone(),
        set_theme,
    });

    rsx! {
        div {
            class: "hi-theme-provider",
            "data-theme": "{current_palette.read()}",
            "data-language": "{props.language}",
            {props.children}
        }
    }
}
