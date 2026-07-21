//! Theme provider component
//!
//! This module provides the [`ThemeProvider`] component which enables
//! theme switching across the application using the [`ThemeContext`].
//!
//! # Supported Themes
//!
//! - `"hikari"` - Light theme (光)
//! - `"tairitsu"` - Dark theme (tairitsu)

use crate::{
    context::{LayoutDirection, ThemeContext},
    prelude::*,
};

/// Theme Provider Props
#[derive(Debug, Clone)]
pub struct ThemeProviderProps {
    /// Initial theme identifier ("hikari" or "tairitsu")
    pub initial_palette: String,
    /// Language code ("en-US", "zh-CHS", etc.)
    pub language: String,
    /// Layout direction ("ltr" or "rtl")
    pub direction: String,
    /// Child elements
    pub children: Vec<VNode>,
}

impl Default for ThemeProviderProps {
    fn default() -> Self {
        Self {
            initial_palette: "hikari".to_string(),
            language: "en-US".to_string(),
            direction: "ltr".to_string(),
            children: Vec::new(),
        }
    }
}

/// Theme Provider component
///
/// Provides theme context to all child components with dynamic theme switching support.
///
/// # Example
///
/// ```rust,no_run
/// use hikari_theme::ThemeProvider;
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
/// ```
#[allow(non_snake_case)]
pub fn ThemeProvider(props: ThemeProviderProps) -> VNode {
    // Get the theme palette
    let palette_name = props.initial_palette.as_str();
    let colors = match palette_name {
        "hikari" => themes::Hikari::palette(),
        "tairitsu" => themes::Tairitsu::palette(),
        _ => themes::Hikari::palette(),
    };

    let dir = match props.direction.as_str() {
        "rtl" => "rtl",
        _ => "ltr",
    };

    // Create theme context
    let _context = ThemeContext {
        palette: props.initial_palette.clone(),
        colors,
        direction: if dir == "rtl" {
            LayoutDirection::Rtl
        } else {
            LayoutDirection::Ltr
        },
        set_theme: Callback::new(|_| {}),
    };

    // Provide context to children (simplified - full implementation would use provide_context)
    // TODO: Implement proper context provider with tairitsu-hooks

    rsx! {
        div {
            class: "hk-theme-provider",
            "data-theme": palette_name,
            "data-language": props.language.as_str(),
            "dir": dir,
            ..props.children
        }
    }
}
