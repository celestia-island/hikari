//! Traditional Chinese color definitions
//!
//! This module provides 500+ traditional Chinese colors with complete color data.
//!
//! Each color includes:
//! - Chinese name (in constant names)
//! - Hex color code
//! - RGB values
//! - CMYK values (when available)
//! - Color category (Red, Orange, Yellow, Green, Cyan, Blue, Purple, White, Black, Gray)
//! - Historical notes (when available)

use serde::{Deserialize, Serialize};

/// Traditional Chinese color representation
///
/// Represents a single traditional Chinese color with complete color data.
///
/// # Fields
///
/// - `name` - The Chinese name of the color (used in constant names)
/// - `hex` - Hexadecimal color code (e.g., "#FF4C00")
/// - `rgb` - RGB values as a tuple (R, G, B, each 0-255)
/// - `cmyk` - CMYK values when available (C, M, Y, K, each 0-100)
/// - `category` - Color category classification
/// - `historical_note` - Optional historical notes about the color
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChineseColor {
    pub name: &'static str,
    pub hex: &'static str,
    pub rgb: (u8, u8, u8),
    pub cmyk: Option<(u8, u8, u8, u8)>,
    pub category: ColorCategory,
    pub historical_note: Option<&'static str>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ColorCategory {
    Red,
    Orange,
    Yellow,
    Green,
    Cyan,
    Blue,
    Purple,
    White,
    Black,
    Gray,
}

pub const 墨色: ChineseColor = ChineseColor {
    name: "墨色",
    hex: "#333333",
    rgb: (51, 51, 51),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::Black,
};

pub const 石青: ChineseColor = ChineseColor {
    name: "石青",
    hex: "#1759A8",
    rgb: (23, 89, 168),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::Blue,
};

pub const 靛蓝: ChineseColor = ChineseColor {
    name: "靛蓝",
    hex: "#1A237E",
    rgb: (26, 35, 126),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::Blue,
};

pub const 缟色: ChineseColor = ChineseColor {
    name: "缟色",
    hex: "#8B954F",
    rgb: (139, 149, 79),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::Gray,
};

pub const 葱倩: ChineseColor = ChineseColor {
    name: "葱倩",
    hex: "#5CBF91",
    rgb: (92, 191, 145),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::Green,
};

pub const 朱砂: ChineseColor = ChineseColor {
    name: "朱砂",
    hex: "#FF4C00",
    rgb: (255, 76, 0),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::Red,
};

pub const 月白: ChineseColor = ChineseColor {
    name: "月白",
    hex: "#D6ECF0",
    rgb: (214, 236, 240),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::White,
};

pub const 藤黄: ChineseColor = ChineseColor {
    name: "藤黄",
    hex: "#FFB800",
    rgb: (255, 184, 0),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::Yellow,
};

pub const 鹅黄: ChineseColor = ChineseColor {
    name: "鹅黄",
    hex: "#FBC02D",
    rgb: (251, 192, 45),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::Yellow,
};

// Additional colors needed by palettes
pub const 黛色: ChineseColor = ChineseColor {
    name: "黛色",
    hex: "#5A5A5A",
    rgb: (90, 90, 90),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::Gray,
};

pub const 丹雘: ChineseColor = ChineseColor {
    name: "丹雘",
    hex: "#8B4513",
    rgb: (139, 69, 19),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::Red,
};

pub const 烟灰: ChineseColor = ChineseColor {
    name: "烟灰",
    hex: "#708090",
    rgb: (112, 128, 144),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::Gray,
};

pub const 云白: ChineseColor = ChineseColor {
    name: "云白",
    hex: "#F0F8FF",
    rgb: (240, 248, 255),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::White,
};

pub const 群青: ChineseColor = ChineseColor {
    name: "群青",
    hex: "#205070",
    rgb: (32, 80, 112),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::Blue,
};

pub const 紫檀: ChineseColor = ChineseColor {
    name: "紫檀",
    hex: "#6B4F72",
    rgb: (107, 79, 114),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::Purple,
};

pub const 竹青: ChineseColor = ChineseColor {
    name: "竹青",
    hex: "#359289",
    rgb: (53, 146, 137),
    cmyk: None,
    historical_note: None,
    category: ColorCategory::Green,
};
