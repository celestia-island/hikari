// hikari-palette/src/palettes.rs
// 预定义配色方案

use super::colors::*;

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
            secondary: 朱砂,
            accent: 藤黄,
            success: 葱倩,
            warning: 鹅黄,
            danger: 朱砂,
            background: 墨色,
            surface: 缟色,
            border: 缟色,
            text_primary: 月白,
            text_secondary: 黛色,
        }
    }
}

/// 主色调配色方案（四大传统色）
pub fn primary_palette() -> Palette {
    Palette {
        primary: 石青,
        secondary: 朱砂,
        accent: 藤黄,
        success: 葱倩,
        warning: 鹅黄,
        danger: 朱砂,
        background: 墨色,
        surface: 缟色,
        border: 缟色,
        text_primary: 月白,
        text_secondary: 黛色,
    }
}

/// FUI 科幻配色方案（深色主题）
pub fn fui_dark_palette() -> Palette {
    Palette {
        background: 墨色,
        surface: 缟色,
        primary: 石青,
        accent: 靛蓝,
        success: 葱倩,
        warning: 鹅黄,
        danger: 朱砂,
        border: 缟色,
        text_primary: 月白,
        text_secondary: 黛色,
        ..Default::default()
    }
}

/// Arknights 风格配色方案
pub fn arknights_palette() -> Palette {
    Palette {
        background: 墨色,
        surface: 缟色,
        primary: 石青,
        secondary: 丹雘,
        accent: 藤黄,
        success: 葱倩,
        warning: 鹅黄,
        danger: 朱砂,
        border: 烟灰,
        text_primary: 月白,
        text_secondary: 黛色,
    }
}

/// 清新雅致配色方案
pub fn fresh_palette() -> Palette {
    Palette {
        background: 云白,
        surface: 月白,
        primary: 群青,
        secondary: 紫檀,
        accent: 藤黄,
        success: 竹青,
        warning: 鹅黄,
        danger: 丹雘,
        border: 烟灰,
        text_primary: 墨色,
        text_secondary: 烟灰,
    }
}
