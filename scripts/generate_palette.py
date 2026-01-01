#!/usr/bin/env python3
"""
Hikari Palette Generator

从 ChineseColors 数据源生成 Rust 代码

参考: https://github.com/zhaoolee/ChineseColors
"""

import json
from pathlib import Path
from typing import Dict, List


def main():
    # 中国传统色数据
    colors_data = load_chinese_colors()
    
    # 生成 Rust 代码
    rust_code = generate_rust_colors(colors_data)
    
    # 写入到 colors.rs
    output_path = Path("packages/hikari-palette/src/colors.rs")
    output_path.write_text(rust_code, encoding='utf-8')
    print(f"✅ Generated {len(colors_data)} colors")
    print(f"📄 Written to {output_path}")


def load_chinese_colors() -> List[Dict[str, any]]:
    """从 zhaoolee/ChineseColors 加载颜色数据"""
    # 简化版数据（用于演示）
    return [
        {"name": "朱砂", "hex": "#FF4C00", "rgb": [255, 76, 0], "category": "Red"},
        {"name": "石青", "hex": "#1759A8", "rgb": [23, 89, 168], "category": "Blue"},
        {"name": "藤黄", "hex": "#FFB800", "rgb": [255, 184, 0], "category": "Yellow"},
        {"name": "靛蓝", "hex": "#1A237E", "rgb": [26, 35, 126], "category": "Blue"},
        {"name": "月白", "hex": "#D6ECF0", "rgb": [214, 236, 240], "category": "White"},
        {"name": "墨色", "hex": "#333333", "rgb": [51, 51, 51], "category": "Black"},
        {"name": "葱倩", "hex": "#5CBF91", "rgb": [92, 191, 145], "category": "Green"},
        {"name": "鹅黄", "hex": "#FBC02D", "rgb": [251, 192, 45], "category": "Yellow"},
        {"name": "缟色", "hex": "#8B954F", "rgb": [139, 149, 79], "category": "Gray"},
    ]


def generate_rust_colors(colors_data: List[Dict[str, any]]) -> str:
    """生成 Rust 颜色代码"""
    code = []
    
    # 文件头
    code.append("/// 中国传统色定义（方案 C-Plus：常量名中文，其他保留英文）\n\n")
    code.append("#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]\n")
    code.append("pub struct ChineseColor {\n")
    code.append("    pub name: &'static str,\n")
    code.append("    pub hex: &'static str,\n")
    code.append("    pub rgb: (u8, u8, u8),\n")
    code.append("    pub cmyk: Option<(u8, u8, u8, u8)>,\n")
    code.append("    pub category: ColorCategory,\n")
    code.append("    pub historical_note: Option<&'static str>,\n")
    code.append("}\n\n")
    
    # 枚举定义
    code.append("#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]\n")
    code.append("pub enum ColorCategory {\n")
    code.append("    Red,\n")
    code.append("    Orange,\n")
    code.append("    Yellow,\n")
    code.append("    Green,\n")
    code.append("    Cyan,\n")
    code.append("    Blue,\n")
    code.append("    Purple,\n")
    code.append("    White,\n")
    code.append("    Black,\n")
    code.append("    Gray,\n")
    code.append("}\n\n")
    
    # 常量定义
    for color in sorted(colors_data, key=lambda x: x['category']):
        name = color['name']
        hex = color['hex']
        rgb = color['rgb']
        category = color['category']
        historical_note = color.get('historical_note')
        
        rust_category = {
            'Red': 'ColorCategory::Red',
            'Orange': 'ColorCategory::Orange',
            'Yellow': 'ColorCategory::Yellow',
            'Green': 'ColorCategory::Green',
            'Cyan': 'ColorCategory::Cyan',
            'Blue': 'ColorCategory::Blue',
            'Purple': 'ColorCategory::Purple',
            'White': 'ColorCategory::White',
            'Black': 'ColorCategory::Black',
            'Gray': 'ColorCategory::Gray',
        }.get(category, 'ColorCategory::Unknown')
        
        # 历史典故处理
        note_str = f'    historical_note: Some("{historical_note}"),' if historical_note else "    historical_note: None,"
        
        code.append(f"pub const {name}: ChineseColor = ChineseColor {{\n")
        code.append(f"    name: \"{name}\",\n")
        code.append(f"    hex: \"{hex}\",\n")
        code.append(f"    rgb: ({rgb[0]}, {rgb[1]}, {rgb[2]}),\n")
        code.append(note_str)
        code.append(f"    category: {rust_category},\n")
        code.append("};\n")
    
    return ''.join(code)


if __name__ == '__main__':
    main()
