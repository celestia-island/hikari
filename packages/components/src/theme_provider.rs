//! Theme provider component
//!
//! This module provides the [`ThemeProvider`] component which enables
//! hierarchical theme management across the application.
//!
//! # Supported Themes
//!
//! - `"hikari"` - Light theme (光) - **default**
//! - `"tairitsu"` - Dark theme (tairitsu)
//!
//! # Hierarchical Theme System
//!
//! The ThemeProvider supports nested/hierarchical theme configuration:
//! - Child providers can override parent theme settings
//! - Components automatically use the nearest provider's theme
//! - CSS variables cascade naturally through the DOM
//!
//! # Usage
//!
//! ## Basic Usage
//!
//! ```rust,no_run
//! use hikari_components::ThemeProvider;
//!
//! rsx! {
//!     ThemeProvider { palette: "hikari" } {
//!         // Your app here - all children use Hikari theme
//!     }
//! }
//! ```
//!
//! ## Nested Providers (Local Theme Override)
//!
//! ```rust,no_run
//! use hikari_components::ThemeProvider;
//!
//! rsx! {
//!     ThemeProvider { palette: "hikari" } {
//!         // Most of the app uses Hikari (light) theme
//!
//!         Sidebar { }
//!
//!         div {
//!             ThemeProvider { palette: "tairitsu" } {
//!                 // This section uses Tairitsu (dark) theme
//!                 DarkWidget { }
//!             }
//!         }
//!     }
//! }
//! ```
//!
//! ## Custom Color Overrides
//!
//! ```rust,no_run
//! use hikari_components::ThemeProvider;
//!
//! rsx! {
//!     ThemeProvider {
//!         palette: "hikari",
//!         primary: Some("#FF6B6B"),  // Override primary color
//!     } {
//!         // Uses Hikari theme with custom primary color
//!     }
//! }
//! ```

use std::rc::Rc;

use dioxus::prelude::*;
use palette::*;

/// Theme palette with CSS variable values
#[derive(Clone, PartialEq)]
pub struct ThemePalette {
    /// Primary color (e.g., 石青 for Hikari)
    pub primary: String,
    /// Secondary color (e.g., 朱红 for Hikari)
    pub secondary: String,
    /// Accent color (e.g., 姜黄 for Hikari)
    pub accent: String,
    /// Success color (e.g., 葱倩 for Hikari)
    pub success: String,
    /// Warning color (e.g., 鹅黄 for Hikari)
    pub warning: String,
    /// Danger color (e.g., 朱红 for Hikari)
    pub danger: String,
    /// Background color
    pub background: String,
    /// Surface color (cards, inputs, etc.)
    pub surface: String,
    /// Border color
    pub border: String,
    /// Primary text color
    pub text_primary: String,
    /// Secondary text color
    pub text_secondary: String,

    // Button specific colors (rgba format for gradients and shadows)
    /// Button primary background (rgba)
    pub button_primary: String,
    /// Button primary dark (rgba for gradient)
    pub button_primary_dark: String,
    /// Button primary light (rgba for hover)
    pub button_primary_light: String,
    /// Button secondary background
    pub button_secondary: String,
    /// Button secondary dark
    pub button_secondary_dark: String,
    /// Button secondary light
    pub button_secondary_light: String,
    /// Button danger background
    pub button_danger: String,
    /// Button danger dark
    pub button_danger_dark: String,
    /// Button danger light
    pub button_danger_light: String,
    /// Button success background
    pub button_success: String,
    /// Button success dark
    pub button_success_dark: String,
    /// Button success light
    pub button_success_light: String,

    // Button icon colors
    /// Icon color for primary/secondary/danger/success buttons (high contrast, usually white)
    pub button_icon_on_dark: String,
    /// Icon color for ghost buttons (uses theme color)
    pub button_icon_on_light: String,

    // Button text colors (based on background color)
    /// Text color on primary button background
    pub text_color_on_primary: String,
    /// Text color on secondary button background
    pub text_color_on_secondary: String,
    /// Text color on danger button background
    pub text_color_on_danger: String,
    /// Text color on success button background
    pub text_color_on_success: String,
    /// Text color on ghost button (transparent background)
    pub text_color_on_ghost: String,

    // Button border colors
    /// Border color for solid buttons (light gray)
    pub border_light: String,
    /// Border color for ghost button (uses primary color)
    pub border_ghost: String,
}

impl ThemePalette {
    /// Create ThemePalette from a Palette
    fn from_palette(palette: &Palette) -> Self {
        ThemePalette {
            primary: palette.primary.hex(),
            secondary: palette.secondary.hex(),
            accent: palette.accent.hex(),
            success: palette.success.hex(),
            warning: palette.warning.hex(),
            danger: palette.danger.hex(),
            background: palette.background.hex(),
            surface: palette.surface.rgba(0.7),
            border: palette.border.hex(),
            text_primary: palette.text_primary.hex(),
            text_secondary: palette.text_secondary.hex(),

            // Button colors (rgba format)
            button_primary: palette.primary.rgba(0.9),
            button_primary_dark: palette.primary.rgba(0.75),
            button_primary_light: palette.primary.rgba(0.95),
            button_secondary: palette.secondary.rgba(0.9),
            button_secondary_dark: palette.secondary.rgba(0.75),
            button_secondary_light: palette.secondary.rgba(0.95),
            button_danger: palette.danger.rgba(0.9),
            button_danger_dark: palette.danger.rgba(0.75),
            button_danger_light: palette.danger.rgba(0.95),
            button_success: palette.success.rgba(0.9),
            button_success_dark: palette.success.rgba(0.75),
            button_success_light: palette.success.rgba(0.95),

            // Button icon colors
            button_icon_on_dark: "#ffffff".to_string(),
            button_icon_on_light: palette.primary.hex(),

            // Button text colors (based on background)
            text_color_on_primary: "#ffffff".to_string(),
            text_color_on_secondary: "#ffffff".to_string(),
            text_color_on_danger: "#ffffff".to_string(),
            text_color_on_success: "#ffffff".to_string(),
            text_color_on_ghost: palette.primary.hex(),

            // Button border colors
            border_light: "rgba(255, 255, 255, 0.2)".to_string(),
            border_ghost: palette.primary.hex(),
        }
    }

    /// Apply custom color overrides to the palette
    fn with_overrides(
        mut self,
        primary: Option<String>,
        secondary: Option<String>,
        accent: Option<String>,
        success: Option<String>,
        warning: Option<String>,
        danger: Option<String>,
        background: Option<String>,
        surface: Option<String>,
        border: Option<String>,
        text_primary: Option<String>,
        text_secondary: Option<String>,
    ) -> Self {
        if let Some(color) = primary {
            self.primary = color;
        }
        if let Some(color) = secondary {
            self.secondary = color;
        }
        if let Some(color) = accent {
            self.accent = color;
        }
        if let Some(color) = success {
            self.success = color;
        }
        if let Some(color) = warning {
            self.warning = color;
        }
        if let Some(color) = danger {
            self.danger = color;
        }
        if let Some(color) = background {
            self.background = color;
        }
        if let Some(color) = surface {
            self.surface = color;
        }
        if let Some(color) = border {
            self.border = color;
        }
        if let Some(color) = text_primary {
            self.text_primary = color;
        }
        if let Some(color) = text_secondary {
            self.text_secondary = color;
        }
        self
    }

    /// Generate CSS variables string for inline styles
    fn css_variables(&self) -> String {
        format!(
            "--hi-primary: {}; \
             --hi-secondary: {}; \
             --hi-accent: {}; \
             --hi-success: {}; \
             --hi-warning: {}; \
             --hi-danger: {}; \
             --hi-background: {}; \
             --hi-surface: {}; \
             --hi-border: {}; \
             --hi-text-primary: {}; \
             --hi-text-secondary: {}; \
             --hi-button-primary: {}; \
             --hi-button-primary-dark: {}; \
             --hi-button-primary-light: {}; \
             --hi-button-secondary: {}; \
             --hi-button-secondary-dark: {}; \
             --hi-button-secondary-light: {}; \
             --hi-button-danger: {}; \
             --hi-button-danger-dark: {}; \
             --hi-button-danger-light: {}; \
             --hi-button-success: {}; \
             --hi-button-success-dark: {}; \
             --hi-button-success-light: {}; \
             --hi-button-icon-on-dark: {}; \
             --hi-button-icon-on-light: {}; \
             --hi-color-text-on-primary: {}; \
             --hi-color-text-on-secondary: {}; \
             --hi-color-text-on-danger: {}; \
             --hi-color-text-on-success: {}; \
             --hi-color-text-on-ghost: {}; \
             --hi-color-border-ghost: {}; \
             --hi-border-light: {};",
            self.primary,
            self.secondary,
            self.accent,
            self.success,
            self.warning,
            self.danger,
            self.background,
            self.surface,
            self.border,
            self.text_primary,
            self.text_secondary,
            self.button_primary,
            self.button_primary_dark,
            self.button_primary_light,
            self.button_secondary,
            self.button_secondary_dark,
            self.button_secondary_light,
            self.button_danger,
            self.button_danger_dark,
            self.button_danger_light,
            self.button_success,
            self.button_success_dark,
            self.button_success_light,
            self.button_icon_on_dark,
            self.button_icon_on_light,
            self.text_color_on_primary,
            self.text_color_on_secondary,
            self.text_color_on_danger,
            self.text_color_on_success,
            self.text_color_on_ghost,
            self.border_ghost,
            self.border_light
        )
    }
}

/// Theme context for accessing current theme
#[derive(Clone, PartialEq)]
pub struct ThemeContext {
    pub palette: Rc<ThemePalette>,
    pub theme_name: String,
}

/// Theme provider properties
#[derive(Clone, Props, PartialEq)]
pub struct ThemeProviderProps {
    /// Theme identifier: "hikari" (light) or "tairitsu" (dark)
    #[props(default = "hikari".to_string())]
    pub palette: String,

    /// Custom color overrides (optional)
    /// When provided, these colors will override the theme's default colors
    #[props(default)]
    pub primary: Option<String>,

    #[props(default)]
    pub secondary: Option<String>,

    #[props(default)]
    pub accent: Option<String>,

    #[props(default)]
    pub success: Option<String>,

    #[props(default)]
    pub warning: Option<String>,

    #[props(default)]
    pub danger: Option<String>,

    #[props(default)]
    pub background: Option<String>,

    #[props(default)]
    pub surface: Option<String>,

    #[props(default)]
    pub border: Option<String>,

    #[props(default)]
    pub text_primary: Option<String>,

    #[props(default)]
    pub text_secondary: Option<String>,

    children: Element,
}

/// Theme Provider component
///
/// Provides theme context to all child components and injects CSS variables.
///
/// # Hierarchical Theme System
///
/// ThemeProvider components can be nested to create local theme overrides:
/// - Child providers override parent theme settings
/// - Components automatically use the nearest provider's theme
/// - CSS variables cascade naturally through the DOM
///
/// # Props
///
/// - `palette` - Theme identifier ("hikari" or "tairitsu", default: "hikari")
/// - `primary`, `secondary`, etc. - Optional color overrides
/// - `children` - Child elements that receive theme context
///
/// # Examples
///
/// ## Basic Usage
///
/// ```rust,no_run
/// use hikari_components::ThemeProvider;
///
/// rsx! {
///     ThemeProvider { palette: "hikari" } {
///         // All children use Hikari theme
///         MyComponent { }
///     }
/// }
/// ```
///
/// ## Nested Providers (Local Override)
///
/// ```rust,no_run
/// rsx! {
///     ThemeProvider { palette: "hikari" } {
///         // Main app uses light theme
///
///         Header { }
///
///         div {
///             ThemeProvider { palette: "tairitsu" } {
///                 // This section uses dark theme
///                 DarkWidget { }
///             }
///         }
///     }
/// }
/// ```
///
/// ## Custom Color Override
///
/// ```rust,no_run
/// rsx! {
///     ThemeProvider {
///         palette: "hikari",
///         primary: Some("#FF6B6B".to_string()),
///     } {
///         // Uses Hikari theme with custom primary color
///         MyComponent { }
///     }
/// }
/// ```
#[component]
pub fn ThemeProvider(props: ThemeProviderProps) -> Element {
    // Get the base palette based on theme name
    let base_palette = match props.palette.as_str() {
        "hikari" => themes::Hikari::palette(),
        "tairitsu" => themes::Tairitsu::palette(),
        _ => themes::Hikari::palette(),
    };

    // Create theme palette and apply custom overrides
    let theme_palette = Rc::new(ThemePalette::from_palette(&base_palette).with_overrides(
        props.primary,
        props.secondary,
        props.accent,
        props.success,
        props.warning,
        props.danger,
        props.background,
        props.surface,
        props.border,
        props.text_primary,
        props.text_secondary,
    ));

    let css_vars = theme_palette.css_variables();

    // Provide theme context to children (overrides any parent context)
    use_context_provider(|| ThemeContext {
        palette: theme_palette.clone(),
        theme_name: props.palette.clone(),
    });

    rsx! {
        div {
            class: "hi-theme-provider",
            "data-theme": "{props.palette}",
            style: "{css_vars}",
            {props.children}
        }
    }
}

/// Hook to access the current theme
///
/// This hook automatically finds the nearest parent ThemeProvider and returns
/// its theme context. It supports the hierarchical theme system.
///
/// # Returns
///
/// * `Option<ThemeContext>` - The current theme context, or None if used outside any ThemeProvider
///
/// # Hierarchical Behavior
///
/// When multiple ThemeProviders are nested, `use_theme()` returns the context
/// from the **nearest** provider (closest parent in the component tree).
///
/// # Example
///
/// ```rust,no_run
/// use dioxus::prelude::*;
/// use hikari_components::use_theme;
///
/// fn MyComponent() -> Element {
///     let theme = use_theme()?;  // Gets nearest theme provider
///     let primary_color = &theme.palette.primary;
///
///     rsx! {
///         div {
///             style: "color: {primary_color}",
///             "Themed text"
///         }
///     }
/// }
/// ```
///
/// # Example with Nested Providers
///
/// ```rust,no_run
/// rsx! {
///     ThemeProvider { palette: "hikari" } {
///         OuterComponent { }  // use_theme() returns Hikari theme
///
///         ThemeProvider { palette: "tairitsu" } {
///             InnerComponent { }  // use_theme() returns Tairitsu theme
///         }
///     }
/// }
/// ```
///
/// # Returns
///
/// Returns the current `ThemeContext`. If called outside of a `ThemeProvider`,
/// returns a default theme based on system color scheme (Hikari for light mode,
/// Tairitsu for dark mode) and logs a warning to the browser console.
pub fn use_theme() -> ThemeContext {
    try_consume_context::<ThemeContext>().unwrap_or_else(|| {
        #[cfg(target_arch = "wasm32")]
        {
            web_sys::console::warn_1(
                &"use_theme() called outside of ThemeProvider. Using system default theme.".into(),
            );

            if prefers_dark_mode() {
                ThemeContext {
                    palette: Rc::new(ThemePalette::from_palette(&Tairitsu::palette())),
                    theme_name: "tairitsu".to_string(),
                }
            } else {
                ThemeContext {
                    palette: Rc::new(ThemePalette::from_palette(&Hikari::palette())),
                    theme_name: "hikari".to_string(),
                }
            }
        }

        #[cfg(not(target_arch = "wasm32"))]
        {
            eprintln!("use_theme() called outside of ThemeProvider. Using default Hikari theme.");

            ThemeContext {
                palette: Rc::new(ThemePalette::from_palette(&Hikari::palette())),
                theme_name: "hikari".to_string(),
            }
        }
    })
}

/// Detect if the system prefers dark mode using `prefers-color-scheme`.
///
/// This function checks the user's system color scheme preference.
/// Returns `true` if dark mode is preferred, `false` otherwise.
///
/// # Example
///
/// ```rust,no_run
/// # use hikari_components::prefers_dark_mode;
/// if prefers_dark_mode() {
///     // Use dark theme
/// }
/// ```
///
/// # Platform Support
///
/// - **WASM**: Returns the actual `prefers-color-scheme: dark` media query result
/// - **Non-WASM**: Always returns `false` (light mode default)
pub fn prefers_dark_mode() -> bool {
    #[cfg(target_arch = "wasm32")]
    {
        use gloo::utils::window;

        // match_media returns Result<Option<MediaQueryList>, JsValue>
        // because the JS method can return null
        window()
            .match_media("(prefers-color-scheme: dark)")
            .ok()
            .flatten() // Option<Option<MediaQueryList>> -> Option<MediaQueryList>
            .map(|mql| mql.matches()) // matches() returns bool directly
            .unwrap_or(false)
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_theme_palette_from_palette() {
        let palette = Hikari::palette();
        let theme_palette = ThemePalette::from_palette(&palette);

        assert_eq!(theme_palette.primary, palette.primary.hex());
        assert_eq!(theme_palette.background, palette.background.hex());
    }

    #[test]
    fn test_css_variables_generation() {
        let palette = Hikari::palette();
        let theme_palette = ThemePalette::from_palette(&palette);
        let css_vars = theme_palette.css_variables();

        assert!(css_vars.contains("--hi-primary:"));
        assert!(css_vars.contains("--hi-background:"));
        assert!(css_vars.contains("--hi-text-primary:"));
    }

    #[test]
    fn test_color_overrides() {
        let palette = Hikari::palette();
        let theme_palette = ThemePalette::from_palette(&palette).with_overrides(
            Some("#FF0000".to_string()), // primary
            None,                        // secondary
            None,                        // accent
            None,                        // success
            None,                        // warning
            None,                        // danger
            None,                        // background
            None,                        // surface
            None,                        // border
            None,                        // text_primary
            None,                        // text_secondary
        );

        assert_eq!(theme_palette.primary, "#FF0000");
        assert_eq!(theme_palette.secondary, palette.secondary.hex()); // unchanged
    }

    #[test]
    fn test_all_color_overrides() {
        let palette = Hikari::palette();
        let theme_palette = ThemePalette::from_palette(&palette).with_overrides(
            Some("#111111".to_string()),
            Some("#222222".to_string()),
            Some("#333333".to_string()),
            Some("#444444".to_string()),
            Some("#555555".to_string()),
            Some("#666666".to_string()),
            Some("#777777".to_string()),
            Some("#888888".to_string()),
            Some("#999999".to_string()),
            Some("#AAAAAA".to_string()),
            Some("#BBBBBB".to_string()),
        );

        assert_eq!(theme_palette.primary, "#111111");
        assert_eq!(theme_palette.secondary, "#222222");
        assert_eq!(theme_palette.accent, "#333333");
        assert_eq!(theme_palette.success, "#444444");
        assert_eq!(theme_palette.warning, "#555555");
        assert_eq!(theme_palette.danger, "#666666");
        assert_eq!(theme_palette.background, "#777777");
        assert_eq!(theme_palette.surface, "#888888");
        assert_eq!(theme_palette.border, "#999999");
        assert_eq!(theme_palette.text_primary, "#AAAAAA");
        assert_eq!(theme_palette.text_secondary, "#BBBBBB");
    }

    #[test]
    fn test_hikari_theme_colors() {
        let palette = Hikari::palette();
        let theme_palette = ThemePalette::from_palette(&palette);

        // Verify colors are valid hex strings
        assert!(theme_palette.primary.starts_with('#'));
        assert!(theme_palette.secondary.starts_with('#'));
        assert!(theme_palette.accent.starts_with('#'));
        assert!(theme_palette.primary.len() == 7); // #RRGGBB
        assert!(theme_palette.secondary.len() == 7);
        assert!(theme_palette.accent.len() == 7);
    }

    #[test]
    fn test_tairitsu_theme_colors() {
        let palette = Tairitsu::palette();
        let theme_palette = ThemePalette::from_palette(&palette);

        // Verify colors are valid hex strings
        assert!(theme_palette.background.starts_with('#'));
        assert!(theme_palette.text_primary.starts_with('#'));
        assert!(theme_palette.background.len() == 7);
        assert!(theme_palette.text_primary.len() == 7);
    }
}
