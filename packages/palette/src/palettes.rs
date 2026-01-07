//! Color palette definitions
//!
//! This module provides predefined color schemes and themes
//! that combine traditional Chinese colors in aesthetically pleasing ways.

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

impl Default for Palette {
    fn default() -> Self {
        Palette {
            primary: 石青,
            secondary: 朱红,
            accent: 姜黄,
            success: 葱倩,
            warning: 鹅黄,
            danger: 朱红,
            background: 墨色,
            surface: 素,
            border: 素,
            text_primary: 月白,
            text_secondary: 黛,
        }
    }
}

/// 主色调配色方案（四大传统色）
pub fn primary_palette() -> Palette {
    Palette {
        primary: 石青,
        secondary: 朱红,
        accent: 姜黄,
        success: 葱倩,
        warning: 鹅黄,
        danger: 朱红,
        background: 墨色,
        surface: 素,
        border: 素,
        text_primary: 月白,
        text_secondary: 黛,
    }
}

/// FUI 科幻配色方案（深色主题）
pub fn fui_dark_palette() -> Palette {
    Palette {
        background: 墨色,
        surface: 素,
        primary: 石青,
        accent: 靛蓝,
        success: 葱倩,
        warning: 鹅黄,
        danger: 朱红,
        border: 素,
        text_primary: 月白,
        text_secondary: 黛,
        ..Default::default()
    }
}

/// Arknights 风格配色方案
pub fn arknights_palette() -> Palette {
    Palette {
        background: 墨色,
        surface: 素,
        primary: 石青,
        secondary: 绛紫,
        accent: 姜黄,
        success: 葱倩,
        warning: 鹅黄,
        danger: 朱红,
        border: 墨灰,
        text_primary: 月白,
        text_secondary: 黛,
    }
}

/// 清新雅致配色方案
pub fn fresh_palette() -> Palette {
    Palette {
        background: 精白,
        surface: 月白,
        primary: 群青,
        secondary: 紫檀,
        accent: 姜黄,
        success: 竹青,
        warning: 鹅黄,
        danger: 绯红,
        border: 墨灰,
        text_primary: 墨色,
        text_secondary: 墨灰,
    }
}
