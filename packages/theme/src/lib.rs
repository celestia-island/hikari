//! # Hikari Theme System
//!
//! Theme system for Hikari UI applications.
//! Provides SCSS/CSS variable compilation for the Hikari design system.
//!
//! ## Architecture
//!
//! - **[`assets`]** - Auto-generated theme assets
//!
//! ## CSS Variables
//!
//! The theme system generates CSS variables for easy access in styles:
//!
//! ```css
//! .hi-theme-provider[data-theme="hikari"] {
//!     --hi-primary: #FFB3A7;
//!     --hi-secondary: #519A73;
//!     --hi-accent: #FFC773;
//!     /* ... more variables */
//! }
//! ```

pub mod assets;
pub mod prelude;

pub use prelude::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prelude_re_exports_palette_type() {
        let _palette: Palette = themes::light_theme();
    }

    #[test]
    fn prelude_re_exports_dark_theme() {
        let palette = themes::dark_theme();
        assert_eq!(palette.mode, themes::ThemeMode::Dark);
    }

    #[test]
    fn prelude_re_exports_default_theme() {
        let palette = themes::default_theme();
        assert_eq!(palette.mode, themes::ThemeMode::Light);
    }

    #[test]
    fn themes_module_accessible() {
        let _ = themes::Hikari::palette();
        let _ = themes::Tairitsu::palette();
        let _ = themes::Arknights::palette();
    }

    #[test]
    fn colors_module_accessible() {
        let _ = colors::粉红;
        let _ = colors::精白;
        let _ = colors::漆黑;
    }

    #[test]
    fn classes_module_accessible() {
        let _ = classes::Display::Flex;
        let _ = classes::FlexDirection::Row;
    }

    #[test]
    fn color_math_module_accessible() {
        let c = colors::粉红;
        let hsl = c.to_hsl();
        let _ = color_math::blend_colors(colors::粉红, colors::石青, 0.5);
        let _ = hsl;
    }

    #[test]
    fn hikari_palette_has_expected_primary_color() {
        let palette = themes::light_theme();
        assert_eq!(palette.primary.hex(), "#FFB3A7");
    }

    #[test]
    fn tairitsu_palette_has_expected_primary_color() {
        let palette = themes::dark_theme();
        assert_eq!(palette.primary.hex(), "#144A74");
    }

    #[test]
    fn palette_clone_works() {
        let p1 = themes::light_theme();
        let p2 = p1.clone();
        assert_eq!(p1.primary.hex(), p2.primary.hex());
        assert_eq!(p1.mode, p2.mode);
    }

    #[test]
    fn theme_registry_accessible_via_prelude() {
        let registry = themes::ThemeRegistry::new();
        let names = registry.list();
        assert!(names.contains(&"hikari".to_string()));
        assert!(names.contains(&"tairitsu".to_string()));
        assert!(names.contains(&"arknights".to_string()));
    }

    #[test]
    fn theme_registry_get_returns_correct_palettes() {
        let registry = themes::ThemeRegistry::new();
        let hikari = registry.get("hikari").unwrap();
        assert_eq!(hikari.mode, themes::ThemeMode::Light);
        let tairitsu = registry.get("tairitsu").unwrap();
        assert_eq!(tairitsu.mode, themes::ThemeMode::Dark);
    }

    #[test]
    fn theme_registry_nonexistent_returns_none() {
        let registry = themes::ThemeRegistry::new();
        assert!(registry.get("nonexistent_theme").is_none());
    }

    #[test]
    fn palette_ghost_text_color_light_mode() {
        let palette = themes::light_theme();
        let text = palette.ghost_text_color(0.9);
        assert_eq!(text, "rgba(0, 0, 0, 0.9)");
    }

    #[test]
    fn palette_ghost_text_color_dark_mode() {
        let palette = themes::dark_theme();
        let text = palette.ghost_text_color(0.9);
        assert_eq!(text, "rgba(255, 255, 255, 0.9)");
    }

    #[test]
    fn palette_button_glow_color_primary() {
        let palette = themes::light_theme();
        let glow = palette.button_glow_color(&palette.primary);
        assert!(glow.starts_with("rgba("));
    }

    #[test]
    fn palette_focus_brightness_filter() {
        let palette = themes::light_theme();
        let filter = palette.focus_brightness_filter(&palette.primary);
        assert!(filter == "0.8" || filter == "1.2");
    }

    #[test]
    fn global_get_palette_function() {
        let p = themes::get_palette("hikari");
        assert!(p.is_some());
        assert_eq!(p.unwrap().mode, themes::ThemeMode::Light);
    }
}
