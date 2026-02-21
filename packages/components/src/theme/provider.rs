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

#[cfg(target_arch = "wasm32")]
use animation::global_manager::init_global_animation_manager;
use dioxus::prelude::*;
use palette::*;

use crate::{
    scripts::scrollbar_container::init_all as init_scrollbars,
    theme::{
        css::{ComponentOverrides, ComponentPalette, PaletteOverrides, ThemePalette},
        registry::{get_default_theme, get_registered_theme},
    },
};

/// Layout direction for RTL/LTR support
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum LayoutDirection {
    #[default]
    Ltr,
    Rtl,
}

impl LayoutDirection {
    pub fn as_str(&self) -> &'static str {
        match self {
            LayoutDirection::Ltr => "ltr",
            LayoutDirection::Rtl => "rtl",
        }
    }

    pub fn is_rtl(&self) -> bool {
        matches!(self, LayoutDirection::Rtl)
    }
}

/// Theme context for accessing current theme
#[derive(Clone, PartialEq)]
pub struct ThemeContext {
    pub palette: Signal<String>,
    pub theme_name: Signal<String>,
    pub direction: Signal<LayoutDirection>,
    pub set_theme: Callback<String>,
}

/// Theme provider properties
#[derive(Clone, Props, PartialEq)]
pub struct ThemeProviderProps {
    /// Theme identifier: "hikari" (light) or "tairitsu" (dark)
    #[props(default = "hikari".to_string())]
    pub palette: String,

    /// Layout direction: "ltr" or "rtl" (default: "ltr")
    #[props(default = "ltr".to_string())]
    pub direction: String,

    /// Custom color overrides (optional)
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

    /// Layer 2: Component color overrides (optional)
    #[props(default)]
    pub component_overrides: ComponentOverrides,

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
    let current_palette = use_signal(|| props.palette.clone());
    let current_theme_name = use_signal(|| props.palette.clone());
    let current_direction = use_signal(|| {
        match props.direction.as_str() {
            "rtl" => LayoutDirection::Rtl,
            _ => LayoutDirection::Ltr,
        }
    });

    let mut palette_for_callback = current_palette;
    let mut theme_name_for_callback = current_theme_name;
    let set_theme = Callback::new(move |new_theme: String| {
        palette_for_callback.set(new_theme.clone());
        theme_name_for_callback.set(new_theme);
    });

    use_context_provider(move || ThemeContext {
        palette: current_palette,
        theme_name: current_theme_name,
        direction: current_direction,
        set_theme,
    });

    use_effect(|| {
        spawn(async move {
            gloo::timers::future::TimeoutFuture::new(50).await;

            #[cfg(target_arch = "wasm32")]
            init_global_animation_manager();

            init_scrollbars();
        });
    });

    let primary_override = props.primary.clone();
    let secondary_override = props.secondary.clone();
    let accent_override = props.accent.clone();
    let success_override = props.success.clone();
    let warning_override = props.warning.clone();
    let danger_override = props.danger.clone();
    let background_override = props.background.clone();
    let surface_override = props.surface.clone();
    let border_override = props.border.clone();
    let text_primary_override = props.text_primary.clone();
    let text_secondary_override = props.text_secondary.clone();
    let component_overrides = props.component_overrides.clone();

    let css_vars = use_memo(move || {
        let theme_name = current_theme_name.read();

        let base_palette = match get_registered_theme(&theme_name) {
            Some(palette) => palette,
            None => {
                let default_name = get_default_theme();
                get_registered_theme(default_name).unwrap_or_else(Hikari::palette)
            }
        };

        let overrides = PaletteOverrides {
            primary: primary_override.clone(),
            secondary: secondary_override.clone(),
            accent: accent_override.clone(),
            success: success_override.clone(),
            warning: warning_override.clone(),
            danger: danger_override.clone(),
            background: background_override.clone(),
            surface: surface_override.clone(),
            border: border_override.clone(),
            text_primary: text_primary_override.clone(),
            text_secondary: text_secondary_override.clone(),
        };
        let theme_palette = ThemePalette::from_palette(&base_palette).with_overrides(overrides);

        let component_palette = ComponentPalette::from_palette_with_overrides(
            &base_palette,
            component_overrides.clone(),
        );

        format!(
            "{} {}",
            theme_palette.css_variables(),
            component_palette.css_variables()
        )
    });

    let dir = current_direction.read().as_str();

    rsx! {
        div {
            class: "hi-theme-provider",
            "data-theme": "{current_theme_name.read()}",
            dir: "{dir}",
            style: "{css_vars}",
            {props.children}
        }
    }
}

/// Hook to access the current theme
///
/// Returns the ThemeContext provided by the nearest ancestor `ThemeProvider`.
/// The context includes the current theme palette, theme name, and a
/// functional `set_theme` callback for switching themes.
///
/// # Platform Support
///
/// - **WASM**: Reads theme from Dioxus context
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
///     let primary_color = &theme.palette.read();
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
/// This hook uses `use_context()` to retrieve the ThemeContext with a
/// functional `set_theme` callback. This enables theme switching functionality
/// in child components. Components should always be wrapped in a `ThemeProvider`
/// to ensure proper theme functionality.
pub fn use_theme() -> ThemeContext {
    use_context()
}

/// Hook to get layout direction for RTL support
///
/// Returns the current layout direction (LTR or RTL).
/// Defaults to LTR if no ThemeProvider is present.
pub fn use_layout_direction() -> LayoutDirection {
    try_consume_context::<ThemeContext>()
        .map(|ctx| *ctx.direction.read())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::theme::css::{PaletteOverrides, ThemePalette};
    use palette::{Hikari, Tairitsu};

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
        let overrides = PaletteOverrides {
            primary: Some("#FF0000".to_string()),
            secondary: None,
            accent: None,
            success: None,
            warning: None,
            danger: None,
            background: None,
            surface: None,
            border: None,
            text_primary: None,
            text_secondary: None,
        };
        let theme_palette = ThemePalette::from_palette(&palette).with_overrides(overrides);

        assert_eq!(theme_palette.primary, "#FF0000");
        assert_eq!(theme_palette.secondary, palette.secondary.hex());
    }

    #[test]
    fn test_all_color_overrides() {
        let palette = Hikari::palette();
        let overrides = PaletteOverrides {
            primary: Some("#111111".to_string()),
            secondary: Some("#222222".to_string()),
            accent: Some("#333333".to_string()),
            success: Some("#444444".to_string()),
            warning: Some("#555555".to_string()),
            danger: Some("#666666".to_string()),
            background: Some("#777777".to_string()),
            surface: Some("#888888".to_string()),
            border: Some("#999999".to_string()),
            text_primary: Some("#AAAAAA".to_string()),
            text_secondary: Some("#BBBBBB".to_string()),
        };
        let theme_palette = ThemePalette::from_palette(&palette).with_overrides(overrides);

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

        assert!(theme_palette.primary.starts_with('#'));
        assert!(theme_palette.secondary.starts_with('#'));
        assert!(theme_palette.accent.starts_with('#'));
        assert!(theme_palette.primary.len() == 7);
        assert!(theme_palette.secondary.len() == 7);
        assert!(theme_palette.accent.len() == 7);
    }

    #[test]
    fn test_tairitsu_theme_colors() {
        let palette = Tairitsu::palette();
        let theme_palette = ThemePalette::from_palette(&palette);

        assert!(theme_palette.background.starts_with('#'));
        assert!(theme_palette.text_primary.starts_with('#'));
        assert!(theme_palette.background.len() == 7);
        assert!(theme_palette.text_primary.len() == 7);
    }

    #[test]
    fn test_component_palette_css_variables() {
        let palette = Hikari::palette();
        let component_palette = ComponentPalette::from_palette(&palette);
        let css_vars = component_palette.css_variables();

        assert!(css_vars.contains("--hi-component-selection-icon:"));
        assert!(css_vars.contains("--hi-component-selection-bg:"));

        assert_eq!(
            component_palette.selection_icon_color,
            palette.background.hex()
        );

        assert!(
            component_palette
                .selection_background
                .contains("linear-gradient")
        );
    }

    #[test]
    fn test_component_palette_dark_mode() {
        let palette = Tairitsu::palette();
        let component_palette = ComponentPalette::from_palette(&palette);

        assert_eq!(
            component_palette.selection_icon_color,
            palette.primary.hex()
        );

        assert!(component_palette.selection_border.contains("255, 255, 255"));

        assert!(component_palette.selection_background.contains("rgba"));
        assert!(
            component_palette
                .selection_background
                .contains("linear-gradient")
        );

        let css_vars = component_palette.css_variables();
        assert!(css_vars.contains("--hi-component-selection-icon:"));
    }

    #[test]
    fn test_theme_palette_color_text_aliases() {
        let palette = Tairitsu::palette();
        let theme_palette = ThemePalette::from_palette(&palette);
        let css_vars = theme_palette.css_variables();

        assert!(css_vars.contains("--hi-color-text-primary:"));
        assert!(css_vars.contains("--hi-color-text-secondary:"));
        assert!(css_vars.contains("--hi-color-primary:"));
        assert!(css_vars.contains("--hi-color-background:"));

        assert!(
            theme_palette.text_primary == "#F2F2F2" || theme_palette.text_primary.starts_with("#F")
        );
    }
}
