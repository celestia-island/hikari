// hikari-palette/src/colors.rs
// 中国传统色定义（方案 C-Plus：常量名中文，其他保留英文）

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ChineseColor {
    pub name: &'static str,
    pub hex: &'static str,
    pub rgb: (u8, u8, u8),
    pub cmyk: Option<(u8, u8, u8, u8)>,
    pub category: ColorCategory,
    pub historical_note: Option<&'static str>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
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

// ===== 赤色系 =====
pub const 朱砂: ChineseColor = ChineseColor {
    name: "朱砂",
    hex: "#FF4C00",
    rgb: (255, 76, 0),
    cmyk: Some((0, 70, 100, 0)),
    category: ColorCategory::Red,
    historical_note: Some("中国传统矿物颜料，主产于湖南辰州"),
};

pub const 丹雘: ChineseColor = ChineseColor {
    name: "丹雘",
    hex: "#E74C3C",
    rgb: (231, 76, 60),
    cmyk: None,
    category: ColorCategory::Red,
    historical_note: None,
};

pub const 银红: ChineseColor = ChineseColor {
    name: "银红",
    hex: "#D94938",
    rgb: (217, 73, 56),
    cmyk: None,
    category: ColorCategory::Red,
    historical_note: Some("银红，中国传统色"),
};

// ===== 橙色系 =====
pub const 藤黄: ChineseColor = ChineseColor {
    name: "藤黄",
    hex: "#FFB800",
    rgb: (255, 184, 0),
    cmyk: Some((0, 28, 100, 0)),
    category: ColorCategory::Yellow,
    historical_note: Some("从海藤树汁液中提取的黄色颜料"),
};

pub const 鹅黄: ChineseColor = ChineseColor {
    name: "鹅黄",
    hex: "#FBC02D",
    rgb: (251, 192, 45),
    cmyk: None,
    category: ColorCategory::Yellow,
    historical_note: None,
};

pub const 杏黄: ChineseColor = ChineseColor {
    name: "金黄",
    hex: "#FFD700",
    rgb: (255, 215, 0),
    cmyk: None,
    category: ColorCategory::Yellow,
    historical_note: Some("黄金的颜色"),
};

// ===== 绿色系 =====
pub const 葱倩: ChineseColor = ChineseColor {
    name: "葱倩",
    hex: "#5CBF91",
    rgb: (92, 191, 145),
    cmyk: None,
    category: ColorCategory::Green,
    historical_note: None,
};

pub const 竹青: ChineseColor = ChineseColor {
    name: "竹青",
    hex: "#78A355",
    rgb: (120, 163, 85),
    cmyk: None,
    category: ColorCategory::Green,
    historical_note: Some("竹子的青绿色"),
};

pub const 豆碧: ChineseColor = ChineseColor {
    name: "豇碧",
    hex: "#4A6F5E",
    rgb: (74, 111, 94),
    cmyk: None,
    category: ColorCategory::Green,
    historical_note: Some("中国古铜器的颜色"),
};

// ===== 青色系 =====
pub const 石青: ChineseColor = ChineseColor {
    name: "石青",
    hex: "#1759A8",
    rgb: (23, 89, 168),
    cmyk: Some((86, 47, 0, 34)),
    category: ColorCategory::Blue,
    historical_note: Some("中国画传统颜料，源于蓝铜矿石"),
};

pub const 靛蓝: ChineseColor = ChineseColor {
    name: "靛蓝",
    hex: "#1A237E",
    rgb: (26, 35, 126),
    cmyk: Some((79, 72, 0, 51)),
    category: ColorCategory::Blue,
    historical_note: Some("从蓼蓝等植物中提取的蓝色染料"),
};

pub const 群碧: ChineseColor = ChineseColor {
    name: "羽碧",
    hex: "#00A0E9",
    rgb: (0, 160, 233),
    cmyk: None,
    category: ColorCategory::Blue,
    historical_note: None,
};

pub const 群青: ChineseColor = ChineseColor {
    name: "鸦青",
    hex: "#1B3E78",
    rgb: (27, 62, 120),
    cmyk: None,
    category: ColorCategory::Blue,
    historical_note: None,
};

// ===== 紫色系 =====
pub const 紫檀: ChineseColor = ChineseColor {
    name: "紫檀",
    hex: "#6A439A",
    rgb: (106, 67, 154),
    cmyk: None,
    category: ColorCategory::Purple,
    historical_note: Some("紫檀木的颜色"),
};

pub const 丁香: ChineseColor = ChineseColor {
    name: "丁香",
    hex: "#9F7ED6",
    rgb: (159, 126, 214),
    cmyk: None,
    category: ColorCategory::Purple,
    historical_note: None,
};

pub const 牡丹: ChineseColor = ChineseColor {
    name: "牡丹",
    hex: "#A06060",
    rgb: (160, 96, 96),
    cmyk: None,
    category: ColorCategory::Purple,
    historical_note: None,
};

// ===== 白色系 =====
pub const 月白: ChineseColor = ChineseColor {
    name: "月白",
    hex: "#D6ECF0",
    rgb: (214, 236, 240),
    cmyk: Some((11, 2, 0, 6)),
    category: ColorCategory::White,
    historical_note: Some("月光的颜色，似白非白，淡雅清冷"),
};

pub const 缟色: ChineseColor = ChineseColor {
    name: "缟色",
    hex: "#8B954F",
    rgb: (139, 149, 79),
    cmyk: None,
    category: ColorCategory::Gray,
    historical_note: None,
};

pub const 云白: ChineseColor = ChineseColor {
    name: "云白",
    hex: "#D3D4DB",
    rgb: (211, 212, 219),
    cmyk: None,
    category: ColorCategory::White,
    historical_note: None,
};

// ===== 黑色系 =====
pub const 墨色: ChineseColor = ChineseColor {
    name: "墨色",
    hex: "#333333",
    rgb: (51, 51, 51),
    cmyk: Some((0, 0, 0, 80)),
    category: ColorCategory::Black,
    historical_note: Some("墨汁的颜色，是书画的基本色"),
};

pub const 玄色: ChineseColor = ChineseColor {
    name: "玄色",
    hex: "#1A1A1A",
    rgb: (26, 26, 26),
    cmyk: None,
    category: ColorCategory::Black,
    historical_note: Some("玄青色的玄"),
};

pub const 黛色: ChineseColor = ChineseColor {
    name: "黛色",
    hex: "#404050",
    rgb: (64, 64, 80),
    cmyk: None,
    category: ColorCategory::Gray,
    historical_note: Some("古代画中常用的青黑色"),
};

pub const 铁灰: ChineseColor = ChineseColor {
    name: "银灰",
    hex: "#B0B8B8",
    rgb: (176, 184, 184),
    cmyk: None,
    category: ColorCategory::Gray,
    historical_note: None,
};

pub const 烟灰: ChineseColor = ChineseColor {
    name: "烟灰",
    hex: "#666666",
    rgb: (102, 102, 102),
    cmyk: None,
    category: ColorCategory::Gray,
    historical_note: None,
};
