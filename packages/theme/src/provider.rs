//! Theme provider component
//!
//! This module provides the [`ThemeProvider`] component which enables
//! theme switching across the application using the [`ThemeContext`].
//!
//! # Supported Themes
//!
//! - `"hikari"` - Light theme (光)
//! - `"tairitsu"` - Dark theme (tairitsu)

use crate::context::{LayoutDirection, ThemeContext};
use crate::prelude::*;

/// Theme Provider Props
#[derive(Debug, Clone)]
pub struct ThemeProviderProps {
    /// Initial theme identifier ("hikari" or "tairitsu")
    pub initial_palette: String,
    /// Language code ("en-US", "zh-Hans", etc.)
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
///         language: "zh-Hans",
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

    // Create theme context and publish it to descendants, so `use_theme` /
    // `try_use_theme` inside children resolve this provider's configuration.
    let context = ThemeContext {
        palette: props.initial_palette.clone(),
        colors,
        direction: if dir == "rtl" {
            LayoutDirection::Rtl
        } else {
            LayoutDirection::Ltr
        },
        set_theme: Callback::new(|_| {}),
    };
    provide_context(context);

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::context::try_use_theme;

    #[test]
    fn try_use_theme_returns_none_without_provider() {
        tairitsu_hooks::drop_context::<ThemeContext>();
        assert!(try_use_theme().is_none());
    }

    #[test]
    fn theme_provider_provides_context_to_descendants() {
        tairitsu_hooks::drop_context::<ThemeContext>();
        assert!(try_use_theme().is_none());

        let _vnode = ThemeProvider(ThemeProviderProps {
            initial_palette: "tairitsu".to_string(),
            language: "zh-Hans".to_string(),
            direction: "rtl".to_string(),
            children: Vec::new(),
        });

        let theme = try_use_theme().expect("ThemeProvider must provide ThemeContext");
        assert_eq!(theme.palette, "tairitsu");
        assert_eq!(theme.direction, LayoutDirection::Rtl);

        tairitsu_hooks::drop_context::<ThemeContext>();
    }
}
