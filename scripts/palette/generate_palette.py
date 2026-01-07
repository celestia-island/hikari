#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hikari Palette Generator

从 lanqy/chinese-colors 数据源生成完整的中国传统色 Rust 代码
数据源: https://github.com/lanqy/chinese-colors

优化版本：
- 历史典故作为文档注释（不参与编译）
- 中文名称通过 feature gate 控制（默认关闭）
- 最小化 wasm 体积
"""

import json
import sys
import io
import urllib.request
from pathlib import Path
from typing import Dict, List

# Set UTF-8 encoding for stdout on Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


def main():
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("Hikari Chinese Traditional Colors Generator")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    # 从 GitHub 拉取完整的中国传统色数据
    colors_data = fetch_chinese_colors()
    print(f"\n✓ Fetched {len(colors_data)} color categories")

    # 统计总颜色数
    total_colors = sum(len(cat['colors']) for cat in colors_data)
    print(f"✓ Total colors: {total_colors}")

    # 生成文档注释（历史典故）
    docs = generate_documentation(colors_data)

    # 生成 Rust 代码
    rust_code = generate_rust_colors(colors_data)

    # 写入到 colors.rs
    output_path = Path("packages/palette/src/colors.rs")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # 合并文档和代码
    full_content = docs + "\n" + rust_code
    output_path.write_text(full_content, encoding='utf-8')

    print(f"\n✅ Generated {total_colors} traditional Chinese colors")
    print(f"📄 Written to: {output_path}")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")


def fetch_chinese_colors() -> List[Dict]:
    """从 GitHub 拉取完整的中国传统色数据"""
    url = "https://raw.githubusercontent.com/lanqy/chinese-colors/master/colors.json"

    print(f"📡 Fetching from: {url}")
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
        print("✓ Successfully fetched Chinese colors data")
        return data
    except Exception as e:
        print(f"✗ Failed to fetch: {e}")
        print("📦 Using fallback hardcoded data...")
        return get_fallback_data()


def get_fallback_data() -> List[Dict]:
    """备用数据（当网络请求失败时使用）"""
    return [
        {
            "name": "红",
            "hex": "#ffb3a7",
            "colors": [
                {"hex": "#ffb3a7", "name": "粉红", "intro": "即浅红色。别称：妃色、杨妃色、湘妃色、妃红色"},
                {"hex": "#ed5736", "name": "妃色", "intro": "妃红色。古同\"绯\"，粉红色。杨妃色湘妃色粉红皆同义。"},
                {"hex": "#ff4c00", "name": "朱红", "intro": "朱砂的颜色，比大红活泼，也称铅朱朱色丹色"},
            ]
        },
        {
            "name": "黄",
            "hex": "#fff143",
            "colors": [
                {"hex": "#fff143", "name": "鹅黄", "intro": "淡黄色（鹅嘴的颜色，高明度微偏红黄色）"},
                {"hex": "#ffa631", "name": "杏黄", "intro": "成熟杏子的黄色"},
                {"hex": "#f0c239", "name": "缃色", "intro": "浅黄色。"},
            ]
        },
        {
            "name": "绿",
            "hex": "#0aa344",
            "colors": [
                {"hex": "#bddd22", "name": "嫩绿", "intro": "像刚长出的嫩叶的浅绿色"},
                {"hex": "#789262", "name": "竹青", "intro": "竹子的绿色"},
                {"hex": "#9ed048", "name": "豆绿", "intro": "浅黄绿色"},
                {"hex": "#5CBF91", "name": "葱倩", "intro": "青绿色"},
            ]
        },
        {
            "name": "蓝",
            "hex": "#44cef6",
            "colors": [
                {"hex": "#177cb0", "name": "靛青", "intro": "也叫\"蓝靛\"。用蓼蓝叶泡水调和与石灰沉淀所得的蓝色染料。呈深蓝绿色"},
                {"hex": "#065279", "name": "靛蓝", "intro": "由植物(例如靛蓝或菘蓝属植物)得到的蓝色染料"},
                {"hex": "#1759A8", "name": "石青", "intro": "淡灰绿色"},
            ]
        },
        {
            "name": "灰白",
            "hex": "#f0f0f4",
            "colors": [
                {"hex": "#ffffff", "name": "精白", "intro": "纯白，洁白，净白，粉白。"},
                {"hex": "#d6ecf0", "name": "月白", "intro": "淡蓝色"},
                {"hex": "#e0f0e9", "name": "素", "intro": "白色，无色"},
            ]
        },
        {
            "name": "黑",
            "hex": "#000000",
            "colors": [
                {"hex": "#333333", "name": "墨色", "intro": "即黑色"},
                {"hex": "#50616d", "name": "墨色", "intro": "即黑色"},
            ]
        },
    ]


def generate_documentation(colors_data: List[Dict]) -> str:
    """生成历史典故文档注释（不参与编译）"""
    docs = []

    docs.append("//! ============================================================\n")
    docs.append("//! 中国传统色历史典故 (Chinese Traditional Colors Documentation)\n")
    docs.append("//! ============================================================\n")
    docs.append("//! \n")
    docs.append("//! 本文档收录了161个中国传统色的正式名称和历史典故\n")
    docs.append("//! These historical notes are compiled from lanqy/chinese-colors\n")
    docs.append("//! \n")
    docs.append("//! 数据来源: https://github.com/lanqy/chinese-colors\n")
    docs.append("//! \n")

    for color_category in colors_data:
        category_name = color_category['name']
        colors = color_category['colors']

        docs.append(f"//! ────────────────────────────────────────────────────\n")
        docs.append(f"//! {category_name}色系 ({len(colors)} colors)\n")
        docs.append(f"//! ────────────────────────────────────────────────────\n")
        docs.append("//! \n")

        for color in colors:
            name = color['name']
            hex_color = color['hex']
            intro = color.get('intro', '')

            docs.append(f"//! {name} ({hex_color})\n")
            if intro:
                docs.append(f"//!   {intro}\n")
            docs.append("//! \n")

    docs.append("//! ============================================================\n")
    docs.append("//! End of Documentation\n")
    docs.append("//! ============================================================\n")
    docs.append("//! \n")

    return ''.join(docs)


def hex_to_rgb(hex_color: str) -> tuple:
    """将十六进制颜色转换为RGB元组"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def map_category(category_name: str) -> str:
    """将中文分类名映射到Rust枚举"""
    category_map = {
        '红': 'ColorCategory::Red',
        '黄': 'ColorCategory::Yellow',
        '绿': 'ColorCategory::Green',
        '蓝': 'ColorCategory::Blue',
        '苍': 'ColorCategory::Cyan',
        '水': 'ColorCategory::Cyan',
        '灰白': 'ColorCategory::White',
        '黑': 'ColorCategory::Black',
        '金银': 'ColorCategory::Gray',
    }
    return category_map.get(category_name, 'ColorCategory::Gray')


def generate_rust_colors(colors_data: List[Dict]) -> str:
    """生成 Rust 颜色代码"""
    code = []

    # 文件头
    code.append("//! Traditional Chinese color definitions\n")
    code.append("//!\n")
    code.append("//! This module provides 161 traditional Chinese colors.\n")
    code.append("//!\n")
    code.append("//! Each color includes:\n")
    code.append("//! - Optional Chinese name (via `chinese-names` feature)\n")
    code.append("//! - RGB values (stored as u8 tuple)\n")
    code.append("//! - Color category\n")
    code.append("//! - Conversion methods: `hex()`, `rgba(alpha)`\n")
    code.append("//!\n")
    code.append("//! ## Features\n")
    code.append("//!\n")
    code.append("//! - `chinese-names`: Include Chinese color names in the binary.\n")
    code.append("//!   Disabled by default to minimize wasm binary size.\n")
    code.append("//!   Enable with: `hikari-palette = { features = [\"chinese-names\"] }`\n")
    code.append("//!\n")
    code.append("//! Data source: https://github.com/lanqy/chinese-colors\n\n")
    code.append("#[allow(dead_code)]  // 中国传统色常量库 - 允许未使用的颜色定义\n\n")
    code.append("use serde::Serialize;\n")
    code.append("use serde::Deserialize;\n\n")

    # ChineseColor 结构
    code.append("/// Traditional Chinese color representation\n")
    code.append("///\n")
    code.append("/// Stores only RGB values to minimize binary size.\n")
    code.append("/// Use `hex()` method to get hex string, `rgba(alpha)` for CSS.\n")
    code.append("///\n")
    code.append("/// # Fields\n")
    code.append("///\n")
    code.append("/// - `name` - The Chinese name of the color (only available with `chinese-names` feature)\n")
    code.append("/// - `rgb` - RGB values as a tuple (R, G, B, each 0-255)\n")
    code.append("/// - `category` - Color category classification\n")
    code.append("#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]\n")
    code.append("#[serde(rename_all = \"camelCase\")]\n")
    code.append("pub struct ChineseColor {\n")

    # 中文名称通过 feature gate
    code.append("    #[cfg(feature = \"chinese-names\")]\n")
    code.append("    pub name: &'static str,\n")
    code.append("    #[cfg(not(feature = \"chinese-names\"))]\n")
    code.append("    #[serde(skip)]\n")
    code.append("    pub name: (),\n")
    code.append("    pub rgb: (u8, u8, u8),\n")
    code.append("    pub category: ColorCategory,\n")
    code.append("}\n\n")

    # ChineseColor 方法实现
    code.append("impl ChineseColor {\n")
    code.append("    /// Get hex color string (e.g., \"#FF4C00\")\n")
    code.append("    ///\n")
    code.append("    /// Computed from RGB values.\n")
    code.append("    pub fn hex(&self) -> String {\n")
    code.append("        format!(\"#{:02X}{:02X}{:02X}\", self.rgb.0, self.rgb.1, self.rgb.2)\n")
    code.append("    }\n\n")
    code.append("    /// Get CSS rgba string (e.g., \"rgba(255, 76, 0, 1.0)\")\n")
    code.append("    ///\n")
    code.append("    /// # Arguments\n")
    code.append("    ///\n")
    code.append("    /// * `alpha` - Opacity value from 0.0 to 1.0\n")
    code.append("    pub fn rgba(&self, alpha: f64) -> String {\n")
    code.append("        format!(\"rgba({}, {}, {}, {})\", self.rgb.0, self.rgb.1, self.rgb.2, alpha)\n")
    code.append("    }\n\n")
    code.append("    /// Get CSS rgba string with u8 alpha (e.g., \"rgba(255, 76, 0, 255)\")\n")
    code.append("    ///\n")
    code.append("    /// # Arguments\n")
    code.append("    ///\n")
    code.append("    /// * `alpha` - Opacity value from 0 to 255\n")
    code.append("    pub fn rgba_u8(&self, alpha: u8) -> String {\n")
    code.append("        format!(\"rgba({}, {}, {}, {})\", self.rgb.0, self.rgb.1, self.rgb.2, alpha)\n")
    code.append("    }\n\n")
    code.append("    /// Get individual RGB components\n")
    code.append("    pub const fn r(&self) -> u8 { self.rgb.0 }\n")
    code.append("    pub const fn g(&self) -> u8 { self.rgb.1 }\n")
    code.append("    pub const fn b(&self) -> u8 { self.rgb.2 }\n")
    code.append("}\n\n")

    # ColorCategory 枚举
    code.append("#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]\n")
    code.append("pub enum ColorCategory {\n")
    code.append("    Red,\n")
    code.append("    Yellow,\n")
    code.append("    Green,\n")
    code.append("    Blue,\n")
    code.append("    Cyan,\n")
    code.append("    White,\n")
    code.append("    Black,\n")
    code.append("    Gray,\n")
    code.append("    Purple,\n")
    code.append("    Orange,\n")
    code.append("}\n\n")

    # 生成所有颜色常量
    code.append("// ============================================================\n")
    code.append("// Traditional Chinese Colors (中国传​​统​​色)\n")
    code.append("// ============================================================\n")
    code.append("//\n")
    code.append("// NOTE: Historical documentation is provided at the top of this file.\n")
    code.append("//       Color constants store only RGB values to minimize binary size.\n")
    code.append("//       Use `.hex()` or `.rgba(alpha)` methods for string representations.\n\n")

    # 按色系生成颜色
    for color_category in colors_data:
        category_name = color_category['name']
        colors = color_category['colors']

        # 添加分类注释
        code.append(f"// ─── {category_name}色系 ({len(colors)} colors) ───\n\n")

        # 生成该色系下的所有颜色
        for color in colors:
            name = color['name']
            hex_color = color['hex']
            rgb = hex_to_rgb(hex_color)
            rust_category = map_category(category_name)

            # 生成常量定义（只存储 RGB，不存储 hex）
            code.append(f"pub const {name}: ChineseColor = ChineseColor {{\n")

            # 中文名称（feature gated）
            code.append("    #[cfg(feature = \"chinese-names\")]\n")
            code.append(f"    name: \"{name}\",\n")
            code.append("    #[cfg(not(feature = \"chinese-names\"))]\n")
            code.append("    name: (),\n")

            code.append(f"    rgb: ({rgb[0]}, {rgb[1]}, {rgb[2]}),\n")
            code.append(f"    category: {rust_category},\n")
            code.append("};\n\n")

    return ''.join(code)


if __name__ == '__main__':
    main()
