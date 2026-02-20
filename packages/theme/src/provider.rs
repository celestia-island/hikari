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

use crate::context::{LayoutDirection, ThemeContext};

/// Theme provider properties
///
/// Defines the props accepted by [`ThemeProvider`] component.
///
/// # Fields
///
/// - `initial_palette` - Initial theme identifier string (default: "hikari")
/// - `language` - Language code string (default: "en-US")
/// - `direction` - Layout direction for RTL support (default: "ltr")
/// - `children` - Child elements to render within the theme context
#[derive(Clone, Props, PartialEq)]
pub struct ThemeProviderProps {
    #[props(default = "hikari".to_string())]
    pub initial_palette: String,

    #[props(default = "en-US".to_string())]
    pub language: String,

    #[props(default = "ltr".to_string())]
    pub direction: String,

    children: Element,
}

/// Theme Provider component
///
/// Provides theme context to all child components with dynamic theme switching support.
///
/// # Props
///
/// - `initial_palette` - Initial theme identifier ("hikari" or "tairitsu")
/// - `language` - Language code ("en-US", "zh-CHS", etc.)
/// - `direction` - Layout direction ("ltr" or "rtl")
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
///         language: "zh-CHS",
///         direction: "ltr",
///     } {
///         // Children here
///     }
/// }
/// }
/// ```
#[component]
pub fn ThemeProvider(props: ThemeProviderProps) -> Element {
    let current_palette = use_signal(|| props.initial_palette.clone());
    let current_colors = use_signal(|| match props.initial_palette.as_str() {
        "hikari" => themes::Hikari::palette(),
        "tairitsu" => themes::Tairitsu::palette(),
        _ => themes::Hikari::palette(),
    });
    let current_direction = use_signal(|| match props.direction.as_str() {
        "rtl" => LayoutDirection::Rtl,
        _ => LayoutDirection::Ltr,
    });

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

    use_context_provider(move || ThemeContext {
        palette: (*current_palette.read()).clone(),
        colors: (*current_colors.read()).clone(),
        direction: *current_direction.read(),
        set_theme,
    });

    let dir = current_direction.read().as_str();

    rsx! {
        div {
            class: "hi-theme-provider",
            "data-theme": "{current_palette.read()}",
            "data-language": "{props.language}",
            "dir": "{dir}",
            {props.children}
        }
    }
}
