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

use std::collections::HashMap;
use std::rc::Rc;

use std::sync::RwLock;

use dioxus::prelude::*;
use palette::*;

/// Trait for converting theme identifiers to string
///
/// Components can define their own enums that implement this trait,
/// providing type-safe theme selection without string literals.
///
/// # Example
///
/// ```rust
/// use hikari_components::IntoThemeName;
///
/// enum MyThemes {
///     Light,
///     Dark,
/// }
///
/// impl IntoThemeName for MyThemes {
///     fn as_theme_name(&self) -> String {
///         match self {
///             MyThemes::Light => "hikari".to_string(),
///             MyThemes::Dark => "tairitsu".to_string(),
///         }
///     }
/// }
///
/// // Now you can use MyThemes::Light instead of "hikari"
/// ThemeProvider { palette: MyThemes::Light } { }
/// ```
pub trait IntoThemeName: std::fmt::Display + 'static {
    /// Convert to theme identifier to a string name
    fn as_theme_name(&self) -> String;
}

/// Default implementation for String (backwards compatibility)
///
/// Note: This implementation is discouraged. Use &'static str or
/// a custom enum implementing IntoThemeName instead.
impl IntoThemeName for String {
    fn as_theme_name(&self) -> String {
        self.clone()
    }
}

/// Default implementation for &str (backwards compatibility)
impl IntoThemeName for &'static str {
    fn as_theme_name(&self) -> String {
        (*self).to_string()
    }
}

/// Theme registry - global map of registered themes
type ThemeRegistry = HashMap<String, Palette>;

/// Global theme registry storage
static THEME_REGISTRY: once_cell::sync::Lazy<RwLock<ThemeRegistry>> =
    once_cell::sync::Lazy::new(|| {
        let mut registry = ThemeRegistry::new();

        // Register default themes
        registry.insert("hikari".to_string(), Hikari::palette());
        registry.insert("tairitsu".to_string(), Tairitsu::palette());

        RwLock::new(registry)
    });

/// Register a custom theme
///
/// Allows adding new themes to the global registry that can be used
/// by ThemeProvider via the palette prop.
///
/// # Arguments
///
/// * `name` - Unique identifier for the theme (e.g., "custom-dark")
/// * `palette` - Palette containing all theme colors
///
/// # Example
///
/// ```rust,no_run
/// use hikari_components::register_theme;
/// use hikari_palette::{Palette, ChineseColor};
///
/// register_theme("custom", Palette {
///     primary: ChineseColor::from_rgb(255, 100, 100),
///     secondary: ChineseColor::from_rgb(100, 100, 255),
///     // ... other colors
///     ..Default::default()
/// });
/// ```
pub fn register_theme(name: &str, palette: Palette) {
    let mut registry = THEME_REGISTRY.write().unwrap();
    registry.insert(name.to_string(), palette);
}

/// Get registered theme by name
///
/// Returns the Palette for a registered theme, or None if not found.
///
/// # Arguments
///
/// * `name` - Theme name (e.g., "hikari", "tairitsu")
pub fn get_registered_theme(name: &str) -> Option<Palette> {
    let registry = THEME_REGISTRY.read().unwrap();
    registry.get(name).cloned()
}

/// Get default theme based on system color scheme
///
/// Returns Hikari for light mode, Tairitsu for dark mode.
///
/// # Platform Support
///
/// - **WASM**: Returns actual `prefers-color-scheme: dark` media query result
/// - **Non-WASM**: Always returns Hikari (light mode default)
pub fn get_default_theme() -> &'static str {
    #[cfg(target_arch = "wasm32")]
    {
        if prefers_dark_mode() {
            "tairitsu"
        } else {
            "hikari"
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        "hikari"
    }
}

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

    // Aside/Header background colors (90% opacity with color tint)
    /// Aside background (white with red tint for light, black with blue tint for dark)
    pub aside_bg: String,
    /// Header background (same as aside)
    pub header_bg: String,

    // Menu hover glow color (white for light, black for dark)
    pub menu_hover_glow: String,

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

    // Button hover colors (dynamically selected based on contrast)
    /// Hover start color (light for dark buttons, light for light buttons)
    pub button_primary_hover_start: String,
    /// Hover end color (normal for dark buttons, normal for light buttons)
    pub button_primary_hover_end: String,
    /// Hover start color
    pub button_secondary_hover_start: String,
    /// Hover end color
    pub button_secondary_hover_end: String,
    /// Hover start color
    pub button_danger_hover_start: String,
    /// Hover end color
    pub button_danger_hover_end: String,
    /// Hover start color
    pub button_success_hover_start: String,
    /// Hover end color
    pub button_success_hover_end: String,

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

    // Button glow colors (black/white with dynamic opacity)
    /// Glow color for primary button (calculated from button color brightness)
    pub glow_button_primary: String,
    /// Glow color for secondary button
    pub glow_button_secondary: String,
    /// Glow color for success button
    pub glow_button_success: String,
    /// Glow color for danger button
    pub glow_button_danger: String,
    /// Glow color for warning button
    pub glow_button_warning: String,
    /// Glow color for info button
    pub glow_button_info: String,

    // Ghost button colors (theme-dependent)
    /// Ghost text color (black in light mode, white in dark mode)
    pub ghost_text: String,
    /// Ghost border color (based on primary color)
    pub ghost_border: String,
    /// Ghost glow color (black in light mode, white in dark mode)
    pub ghost_glow: String,

    // Button focus brightness (for filter effect)
    /// Focus brightness for primary button (1.2 or 0.8 based on contrast)
    pub focus_brightness_primary: String,
    /// Focus brightness for secondary button
    pub focus_brightness_secondary: String,
    /// Focus brightness for success button
    pub focus_brightness_success: String,
    /// Focus brightness for danger button
    pub focus_brightness_danger: String,
    /// Focus brightness for warning button
    pub focus_brightness_warning: String,
    /// Focus brightness for info button
    pub focus_brightness_info: String,
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

            // Button hover colors (dynamically selected based on contrast)
            // Dark buttons (< 0.4 brightness): hover uses normal → dark (dim)
            // Light buttons (>= 0.4 brightness): hover uses light → normal (brighten)
            button_primary_hover_start: if palette.primary.brightness() < 0.4 {
                palette.primary.rgba(0.9) // normal
            } else {
                palette.primary.rgba(0.95) // light
            },
            button_primary_hover_end: if palette.primary.brightness() < 0.4 {
                palette.primary.rgba(0.75) // dark
            } else {
                palette.primary.rgba(0.9) // normal
            },
            button_secondary_hover_start: if palette.secondary.brightness() < 0.4 {
                palette.secondary.rgba(0.9)
            } else {
                palette.secondary.rgba(0.95)
            },
            button_secondary_hover_end: if palette.secondary.brightness() < 0.4 {
                palette.secondary.rgba(0.75)
            } else {
                palette.secondary.rgba(0.9)
            },
            button_danger_hover_start: if palette.danger.brightness() < 0.4 {
                palette.danger.rgba(0.9)
            } else {
                palette.danger.rgba(0.95)
            },
            button_danger_hover_end: if palette.danger.brightness() < 0.4 {
                palette.danger.rgba(0.75)
            } else {
                palette.danger.rgba(0.9)
            },
            button_success_hover_start: if palette.success.brightness() < 0.4 {
                palette.success.rgba(0.9)
            } else {
                palette.success.rgba(0.95)
            },
            button_success_hover_end: if palette.success.brightness() < 0.4 {
                palette.success.rgba(0.75)
            } else {
                palette.success.rgba(0.9)
            },

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
            border_light: "rgba(255,255,255, 0.2)".to_string(),
            border_ghost: palette.primary.hex(),

            // Button glow colors (black/white with dynamic opacity)
            glow_button_primary: palette.button_glow_color(&palette.primary),
            glow_button_secondary: palette.button_glow_color(&palette.secondary),
            glow_button_danger: palette.button_glow_color(&palette.danger),
            glow_button_success: palette.button_glow_color(&palette.success),
            glow_button_warning: palette.button_glow_color(&palette.warning),
            glow_button_info: palette.button_glow_color(&palette.accent),

            // Ghost button colors (follow text colors)
            ghost_text: palette.text_primary.hex(),
            ghost_border: palette.text_secondary.rgba(0.4),
            ghost_glow: palette.ghost_glow_color(0.5),

            // Aside/Header background colors (90% opacity, slight color tint)
            aside_bg: if palette.mode == ThemeMode::Light {
                // 90% white with slight red tint (0.1, 0.1, 0.1)
                "rgba(255, 255, 255, 0.9)".to_string()
            } else {
                // 90% black with slight blue tint (0.1, 0.1, 0.2)
                "rgba(25, 25, 51, 0.9)".to_string()
            },
            header_bg: if palette.mode == ThemeMode::Light {
                // 90% white with slight red tint
                "rgba(255, 255, 255, 0.9)".to_string()
            } else {
                // 90% black with slight blue tint
                "rgba(25, 25, 51, 0.9)".to_string()
            },

            // Menu hover glow color (white for light, black for dark)
            menu_hover_glow: if palette.mode == ThemeMode::Light {
                "rgba(255, 255, 255, 0.6)".to_string()
            } else {
                "rgba(0, 0, 0, 0.6)".to_string()
            },

            // Button focus brightness (based on button color brightness)
            focus_brightness_primary: palette.focus_brightness_filter(&palette.primary),
            focus_brightness_secondary: palette.focus_brightness_filter(&palette.secondary),
            focus_brightness_danger: palette.focus_brightness_filter(&palette.danger),
            focus_brightness_success: palette.focus_brightness_filter(&palette.success),
            focus_brightness_warning: palette.focus_brightness_filter(&palette.warning),
            focus_brightness_info: palette.focus_brightness_filter(&palette.accent),
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
    pub fn css_variables(&self) -> String {
        [
            format!("--hi-primary: {};", self.primary),
            format!("--hi-secondary: {};", self.secondary),
            format!("--hi-accent: {};", self.accent),
            format!("--hi-success: {};", self.success),
            format!("--hi-warning: {};", self.warning),
            format!("--hi-danger: {};", self.danger),
            format!("--hi-background: {};", self.background),
            format!("--hi-surface: {};", self.surface),
            format!("--hi-border: {};", self.border),
            format!("--hi-text-primary: {};", self.text_primary),
            format!("--hi-text-secondary: {};", self.text_secondary),
            format!("--hi-button-primary: {};", self.button_primary),
            format!("--hi-button-primary-dark: {};", self.button_primary_dark),
            format!("--hi-button-primary-light: {};", self.button_primary_light),
            format!("--hi-button-secondary: {};", self.button_secondary),
            format!(
                "--hi-button-secondary-dark: {};",
                self.button_secondary_dark
            ),
            format!(
                "--hi-button-secondary-light: {};",
                self.button_secondary_light
            ),
            format!("--hi-button-danger: {};", self.button_danger),
            format!("--hi-button-danger-dark: {};", self.button_danger_dark),
            format!("--hi-button-danger-light: {};", self.button_danger_light),
            format!("--hi-button-success: {};", self.button_success),
            format!("--hi-button-success-dark: {};", self.button_success_dark),
            format!("--hi-button-success-light: {};", self.button_success_light),
            format!(
                "--hi-button-primary-hover-start: {};",
                self.button_primary_hover_start
            ),
            format!(
                "--hi-button-primary-hover-end: {};",
                self.button_primary_hover_end
            ),
            format!(
                "--hi-button-secondary-hover-start: {};",
                self.button_secondary_hover_start
            ),
            format!(
                "--hi-button-secondary-hover-end: {};",
                self.button_secondary_hover_end
            ),
            format!(
                "--hi-button-danger-hover-start: {};",
                self.button_danger_hover_start
            ),
            format!(
                "--hi-button-danger-hover-end: {};",
                self.button_danger_hover_end
            ),
            format!(
                "--hi-button-success-hover-start: {};",
                self.button_success_hover_start
            ),
            format!(
                "--hi-button-success-hover-end: {};",
                self.button_success_hover_end
            ),
            format!("--hi-button-icon-on-dark: {};", self.button_icon_on_dark),
            format!("--hi-button-icon-on-light: {};", self.button_icon_on_light),
            format!(
                "--hi-color-text-on-primary: {};",
                self.text_color_on_primary
            ),
            format!(
                "--hi-color-text-on-secondary: {};",
                self.text_color_on_secondary
            ),
            format!("--hi-color-text-on-danger: {};", self.text_color_on_danger),
            format!(
                "--hi-color-text-on-success: {};",
                self.text_color_on_success
            ),
            format!("--hi-color-text-on-ghost: {};", self.text_color_on_ghost),
            format!("--hi-color-border-ghost: {};", self.border_ghost),
            format!("--hi-border-light: {};", self.border_light),
            format!("--hi-glow-button-primary: {};", self.glow_button_primary),
            format!(
                "--hi-glow-button-secondary: {};",
                self.glow_button_secondary
            ),
            format!("--hi-glow-button-danger: {};", self.glow_button_danger),
            format!("--hi-glow-button-success: {};", self.glow_button_success),
            format!("--hi-glow-button-warning: {};", self.glow_button_warning),
            format!("--hi-glow-button-info: {};", self.glow_button_info),
            format!("--hi-ghost-text: {};", self.ghost_text),
            format!("--hi-ghost-border: {};", self.ghost_border),
            format!("--hi-ghost-glow: {};", self.ghost_glow),
            format!(
                "--hi-focus-brightness-primary: {};",
                self.focus_brightness_primary
            ),
            format!(
                "--hi-focus-brightness-secondary: {};",
                self.focus_brightness_secondary
            ),
            format!(
                "--hi-focus-brightness-danger: {};",
                self.focus_brightness_danger
            ),
            format!(
                "--hi-focus-brightness-success: {};",
                self.focus_brightness_success
            ),
            format!(
                "--hi-focus-brightness-warning: {};",
                self.focus_brightness_warning
            ),
            format!(
                "--hi-focus-brightness-info: {};",
                self.focus_brightness_info
            ),
            format!("--hi-aside-bg: {};", self.aside_bg),
            format!("--hi-header-bg: {};", self.header_bg),
            format!("--hi-menu-hover-glow: {};", self.menu_hover_glow),
        ]
        .join(" ")
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
    ///
    /// # Type Safety with IntoThemeName
    ///
    /// For better type safety, use a custom enum implementing IntoThemeName:
    ///
    /// ```rust
    /// use hikari_components::IntoThemeName;
    ///
    /// enum MyTheme {
    ///     Light,
    ///     Dark,
    /// }
    ///
    /// impl IntoThemeName for MyTheme {
    ///     fn as_theme_name(&self) -> String {
    ///         match self {
    ///             MyTheme::Light => "hikari".to_string(),
    ///             MyTheme::Dark => "tairitsu".to_string(),
    ///         }
    ///     }
    /// }
    ///
    /// // Usage
    /// ThemeProvider { palette: MyTheme::Light.as_theme_name() } { }
    /// ```
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
    // Get the base palette from theme registry
    let base_palette = get_registered_theme(&props.palette)
        .unwrap_or_else(|| get_registered_theme(get_default_theme()).unwrap());

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
/// Reads the current theme from the DOM by finding the nearest ancestor
/// `.hi-theme-provider[data-theme]` element and reading its `data-theme` attribute.
/// Supports nested ThemeProviders with proper proximity - always returns the theme
/// from the closest (most nested) provider.
///
/// # Platform Support
///
/// - **WASM**: Reads theme from DOM elements
/// - **Non-WASM**: Returns default Hikari theme
///
/// # Hierarchical Behavior
///
/// When multiple ThemeProviders are nested, `use_theme()` returns the theme
/// from the **nearest** provider (closest parent in the DOM hierarchy).
///
/// # Example
///
/// ```rust,no_run
/// use dioxus::prelude::*;
/// use hikari_components::use_theme;
///
/// fn MyComponent() -> Element {
///     let theme = use_theme();
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
/// Returns the current `ThemeContext`. If called outside of any `ThemeProvider`,
/// returns a default theme based on system color scheme (Hikari for light mode,
/// Tairitsu for dark mode) and logs a warning to the browser console.
///
/// # Note
///
/// This implementation reads theme directly from DOM rather than using Dioxus
/// context, ensuring real-time updates even in animation loops.
pub fn use_theme() -> ThemeContext {
    #[cfg(target_arch = "wasm32")]
    {
        let window = match web_sys::window() {
            Some(w) => w,
            None => return default_theme_context(),
        };

        let document = match window.document() {
            Some(doc) => doc,
            None => return default_theme_context(),
        };

        let theme_name = match document
            .query_selector(".hi-theme-provider[data-theme]")
            .ok()
            .flatten()
            .and_then(|el| el.get_attribute("data-theme"))
        {
            Some(theme) => theme,
            None => return default_theme_context(),
        };

        let palette = get_registered_theme(&theme_name)
            .unwrap_or_else(|| get_registered_theme(get_default_theme()).unwrap());

        ThemeContext {
            palette: Rc::new(ThemePalette::from_palette(&palette)),
            theme_name,
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    default_theme_context()
}

fn default_theme_context() -> ThemeContext {
    #[cfg(target_arch = "wasm32")]
    {
        web_sys::console::warn_1(
            &"use_theme() called outside of ThemeProvider. Using system default theme.".into(),
        );
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        eprintln!("use_theme() called outside of ThemeProvider. Using default Hikari theme.");
    }

    #[cfg(target_arch = "wasm32")]
    if prefers_dark_mode() {
        return ThemeContext {
            palette: Rc::new(ThemePalette::from_palette(&Tairitsu::palette())),
            theme_name: "tairitsu".to_string(),
        };
    }

    ThemeContext {
        palette: Rc::new(ThemePalette::from_palette(&Hikari::palette())),
        theme_name: "hikari".to_string(),
    }
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
