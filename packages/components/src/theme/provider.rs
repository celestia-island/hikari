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
//! ```rust,ignore
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
//! ```rust,ignore
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
//! ```rust,ignore
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

use hikari_palette::themes::Hikari;
use tairitsu_hooks::ReactiveSignal;

use crate::prelude::*;
use crate::theme::css::{ComponentOverrides, ComponentPalette, PaletteOverrides, ThemePalette};
use crate::theme::registry::{get_default_theme, get_registered_theme};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum LayoutDirection {
    #[default]
    Ltr,
    Rtl,
}

impl LayoutDirection {
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            LayoutDirection::Ltr => "ltr",
            LayoutDirection::Rtl => "rtl",
        }
    }

    #[must_use]
    pub fn is_rtl(&self) -> bool {
        matches!(self, LayoutDirection::Rtl)
    }
}

#[derive(Clone)]
pub struct ThemeContext {
    pub palette: ReactiveSignal<String>,
    pub theme_name: ReactiveSignal<String>,
    pub direction: ReactiveSignal<LayoutDirection>,
    pub set_theme: Callback<String>,
}

#[define_props]
pub struct ThemeProviderProps {
    #[default("hikari".to_string())]
    pub palette: String,

    #[default("ltr".to_string())]
    pub direction: String,

    #[default]
    pub primary: Option<String>,

    #[default]
    pub secondary: Option<String>,

    #[default]
    pub accent: Option<String>,

    #[default]
    pub success: Option<String>,

    #[default]
    pub warning: Option<String>,

    #[default]
    pub danger: Option<String>,

    #[default]
    pub background: Option<String>,

    #[default]
    pub surface: Option<String>,

    #[default]
    pub border: Option<String>,

    #[default]
    pub text_primary: Option<String>,

    #[default]
    pub text_secondary: Option<String>,

    #[default]
    pub component_overrides: ComponentOverrides,

    pub children: Element,
}

///
/// Theme provider component
///
/// Provides hierarchical theme management across the application.
/// Child providers can override parent theme settings.
#[component]
pub fn ThemeProvider(props: ThemeProviderProps) -> Element {
    let current_palette = use_signal(|| props.palette.clone());
    let current_theme_name = use_signal(|| props.palette.clone());
    let current_direction = use_signal(|| match props.direction.as_str() {
        "rtl" => LayoutDirection::Rtl,
        _ => LayoutDirection::Ltr,
    });

    let palette_for_callback = current_palette.clone();
    let theme_name_for_callback = current_theme_name.clone();
    let set_theme = Callback::new(move |new_theme: String| {
        palette_for_callback.set(new_theme.clone());
        theme_name_for_callback.set(new_theme);
    });

    let palette_for_context = current_palette.clone();
    let theme_name_for_context = current_theme_name.clone();
    let direction_for_context = current_direction.clone();
    use_context_provider(move || ThemeContext {
        palette: palette_for_context,
        theme_name: theme_name_for_context,
        direction: direction_for_context,
        set_theme,
    });

    let theme_name_for_memo = current_theme_name.clone();
    let props_for_memo = props.clone();
    let css_vars = use_memo(move || {
        let theme_name = theme_name_for_memo.read();

        let base_palette = match get_registered_theme(&theme_name) {
            Some(palette) => palette,
            None => {
                let default_name = get_default_theme();
                get_registered_theme(default_name).unwrap_or_else(Hikari::palette)
            }
        };

        let overrides = PaletteOverrides {
            primary: props_for_memo.primary.clone(),
            secondary: props_for_memo.secondary.clone(),
            accent: props_for_memo.accent.clone(),
            success: props_for_memo.success.clone(),
            warning: props_for_memo.warning.clone(),
            danger: props_for_memo.danger.clone(),
            background: props_for_memo.background.clone(),
            surface: props_for_memo.surface.clone(),
            border: props_for_memo.border.clone(),
            text_primary: props_for_memo.text_primary.clone(),
            text_secondary: props_for_memo.text_secondary.clone(),
        };
        let theme_palette =
            ThemePalette::from_palette(&base_palette).with_overrides(overrides, &base_palette);

        let component_palette = ComponentPalette::from_palette_with_overrides(
            &base_palette,
            props_for_memo.component_overrides.clone(),
        );

        format!(
            "{} {}",
            theme_palette.css_variables(),
            component_palette.css_variables()
        )
    });

    let theme_name = current_theme_name.read();
    let dir = current_direction.read().as_str();

    rsx! {
        div {
            class: "hi-theme-provider",
            "data-theme": theme_name,
            dir,
            style: css_vars,
            {props.children}
        }
    }
}

/// Hook to access the current theme context.
///
/// # Panics
/// Panics if no `ThemeProvider` ancestor is present in the component tree.
#[track_caller]
#[must_use]
pub fn use_theme() -> ThemeContext {
    try_use_theme().expect("use_theme() requires a ThemeProvider ancestor")
}

/// Non-panicking variant of [`use_theme`].
///
/// Returns `None` if no `ThemeProvider` ancestor is present.
pub fn try_use_theme() -> Option<ThemeContext> {
    use_context::<ThemeContext>().map(|ctx| ctx.get().clone())
}

/// Hook to access the current layout direction
#[must_use]
pub fn use_layout_direction() -> LayoutDirection {
    use_context::<ThemeContext>()
        .map(|ctx| ctx.get().direction.read())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use hikari_palette::themes::{Hikari, Tairitsu};

    use super::*;
    use crate::theme::css::{PaletteOverrides, ThemePalette};

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
        let theme_palette =
            ThemePalette::from_palette(&palette).with_overrides(overrides, &palette);

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
        let theme_palette =
            ThemePalette::from_palette(&palette).with_overrides(overrides, &palette);

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

    #[test]
    fn test_layout_direction_default_is_ltr() {
        let dir = LayoutDirection::default();
        assert_eq!(dir, LayoutDirection::Ltr);
    }

    #[test]
    fn test_layout_direction_as_str() {
        assert_eq!(LayoutDirection::Ltr.as_str(), "ltr");
        assert_eq!(LayoutDirection::Rtl.as_str(), "rtl");
    }

    #[test]
    fn test_layout_direction_is_rtl() {
        assert!(!LayoutDirection::Ltr.is_rtl());
        assert!(LayoutDirection::Rtl.is_rtl());
    }

    #[test]
    fn test_into_theme_name_for_str() {
        use crate::theme::traits::IntoThemeName;
        let name: &'static str = "hikari";
        assert_eq!(name.as_theme_name(), "hikari");
    }

    #[test]
    fn test_into_theme_name_for_string() {
        use crate::theme::traits::IntoThemeName;
        let name: String = "tairitsu".to_string();
        assert_eq!(name.as_theme_name(), "tairitsu");
    }

    #[test]
    fn test_layout_direction_copy_eq_hash() {
        let a = LayoutDirection::Ltr;
        let b = LayoutDirection::Ltr;
        let c = LayoutDirection::Rtl;
        assert_eq!(a, b);
        assert_ne!(a, c);
        let mut set = std::collections::HashSet::new();
        set.insert(a);
        set.insert(b);
        set.insert(c);
        assert_eq!(set.len(), 2);
    }
}
