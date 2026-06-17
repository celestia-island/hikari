//! Prelude for hikari-theme (style generation only)

pub use hikari_palette::themes::Palette;
pub use hikari_palette::{classes, color_math, colors, themes};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn palette_type_is_accessible() {
        let _palette: Palette = themes::Hikari::palette();
    }

    #[test]
    fn light_theme_accessible() {
        let palette = themes::light_theme();
        assert_eq!(palette.mode, themes::ThemeMode::Light);
    }

    #[test]
    fn dark_theme_accessible() {
        let palette = themes::dark_theme();
        assert_eq!(palette.mode, themes::ThemeMode::Dark);
    }

    #[test]
    fn default_theme_is_light() {
        let palette = themes::default_theme();
        assert_eq!(palette.mode, themes::ThemeMode::Light);
    }

    #[test]
    fn colors_re_export_works() {
        let _ = colors::粉红;
        let _ = colors::苍翠;
        let _ = colors::姜黄;
    }

    #[test]
    fn classes_re_export_works() {
        let _ = classes::Display::Flex;
        let _ = classes::Display::Block;
        let _ = classes::Display::InlineFlex;
        let _ = classes::FlexDirection::Row;
        let _ = classes::FlexDirection::Column;
    }

    #[test]
    fn color_math_re_export_works() {
        let blended = color_math::blend_colors(colors::粉红, colors::石青, 0.5);
        assert!(!blended.hex().is_empty());
    }

    #[test]
    fn theme_mode_equality() {
        assert_eq!(themes::ThemeMode::Light, themes::ThemeMode::Light);
        assert_ne!(themes::ThemeMode::Light, themes::ThemeMode::Dark);
    }

    #[test]
    fn hikari_default_trait() {
        let _ = themes::Hikari;
    }

    #[test]
    fn tairitsu_default_trait() {
        let _ = themes::Tairitsu;
    }

    #[test]
    fn arknights_default_trait() {
        let _ = themes::Arknights;
    }

    #[test]
    fn palette_fields_are_populated() {
        let p = themes::Hikari::palette();
        assert!(!p.primary.hex().is_empty());
        assert!(!p.secondary.hex().is_empty());
        assert!(!p.accent.hex().is_empty());
        assert!(!p.success.hex().is_empty());
        assert!(!p.warning.hex().is_empty());
        assert!(!p.danger.hex().is_empty());
        assert!(!p.background.hex().is_empty());
        assert!(!p.surface.hex().is_empty());
        assert!(!p.border.hex().is_empty());
        assert!(!p.text_primary.hex().is_empty());
        assert!(!p.text_secondary.hex().is_empty());
    }
}
