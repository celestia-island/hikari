//! Theme palette definitions
//!
//! This module provides the two official theme palettes:
//! - **Hikari** - Light theme (光)
//! - **Tairitsu** - Dark theme (tairitsu)

use super::colors::*;

/// Color palette configuration
///
/// Defines a complete color scheme with primary, secondary,
/// accent, semantic colors, and surface/text colors.
#[derive(Debug, Clone)]
pub struct Palette {
    pub primary: ChineseColor,
    pub secondary: ChineseColor,
    pub accent: ChineseColor,
    pub success: ChineseColor,
    pub warning: ChineseColor,
    pub danger: ChineseColor,
    pub background: ChineseColor,
    pub surface: ChineseColor,
    pub border: ChineseColor,
    pub text_primary: ChineseColor,
    pub text_secondary: ChineseColor,
}

/// Hikari theme - Light theme (光)
///
/// Represents light and brightness. This is the default light theme
/// with clean, bright colors suitable for daytime use.
#[derive(Debug, Clone)]
pub struct Hikari;

impl Hikari {
    pub fn palette() -> Palette {
        Palette {
            primary: 石青,
            secondary: 朱红,
            accent: 姜黄,
            success: 葱倩,
            warning: 鹅黄,
            danger: 朱红,
            background: 素,
            surface: 月白,
            border: 素,
            text_primary: 墨色,
            text_secondary: 黛,
        }
    }
}

impl Default for Hikari {
    fn default() -> Self {
        Self
    }
}

/// Tairitsu theme - Dark theme (tairitsu)
///
/// Represents darkness and contrast. This is the dark theme
/// with deep, rich colors suitable for nighttime use.
#[derive(Debug, Clone)]
pub struct Tairitsu;

impl Tairitsu {
    pub fn palette() -> Palette {
        Palette {
            primary: 靛蓝,
            secondary: 石青,
            accent: 姜黄,
            success: 葱倩,
            warning: 鹅黄,
            danger: 朱红,
            background: 墨色,
            surface: 黛,
            border: 黛,
            text_primary: 月白,
            text_secondary: 素,
        }
    }
}

impl Default for Tairitsu {
    fn default() -> Self {
        Self
    }
}

/// Get the default theme (Hikari light theme)
pub fn default_theme() -> Palette {
    Hikari::palette()
}

/// Get the light theme (Hikari)
pub fn light_theme() -> Palette {
    Hikari::palette()
}

/// Get the dark theme (Tairitsu)
pub fn dark_theme() -> Palette {
    Tairitsu::palette()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hikari_theme() {
        let palette = Hikari::palette();
        assert_eq!(palette.background, 素);
        assert_eq!(palette.text_primary, 墨色);
    }

    #[test]
    fn test_tairitsu_theme() {
        let palette = Tairitsu::palette();
        assert_eq!(palette.background, 墨色);
        assert_eq!(palette.text_primary, 月白);
    }

    #[test]
    fn test_default_is_hikari() {
        let palette = default_theme();
        assert_eq!(palette.background, 素);
    }
}
