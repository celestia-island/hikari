// This test depends on the optional Chinese color collection, selected via
// [workspace.metadata.hikari].collections in the workspace root.
#![cfg(hikari_collection_chinese)]

use hikari_palette::collections::chinese::*;

use hikari_palette::color_math::*;
use hikari_palette::colors::*;

fn is_valid_hex(s: &str) -> bool {
    if !s.starts_with('#') || s.len() != 7 {
        return false;
    }
    s[1..].chars().all(|c| c.is_ascii_hexdigit())
}

#[test]
fn test_hex_format_known_colors() {
    assert_eq!(粉红.hex(), "#FFB3A7");
    assert_eq!(黑色.hex(), "#000000");
    assert_eq!(精白.hex(), "#FFFFFF");
    assert_eq!(灰色.hex(), "#808080");
    assert_eq!(大红.hex(), "#FF2121");
    assert_eq!(靛蓝.hex(), "#065279");
}

#[test]
fn test_hex_roundtrip() {
    let colors = vec![
        (255, 0, 0),
        (0, 255, 0),
        (0, 0, 255),
        (0, 0, 0),
        (255, 255, 255),
        (128, 64, 32),
        (200, 100, 150),
    ];
    for (r, g, b) in colors {
        let color = Color::from_rgb(r, g, b);
        let hex = color.hex();
        assert!(is_valid_hex(&hex), "Invalid hex: {hex}");
        let h = hex.trim_start_matches('#');
        let parsed_r = u8::from_str_radix(&h[0..2], 16).unwrap();
        let parsed_g = u8::from_str_radix(&h[2..4], 16).unwrap();
        let parsed_b = u8::from_str_radix(&h[4..6], 16).unwrap();
        assert_eq!((parsed_r, parsed_g, parsed_b), (r, g, b));
    }
}

#[test]
fn test_complementary_color() {
    let red = Color::from_rgb(255, 0, 0);
    let hsl = red.to_hsl();
    let comp_h = (hsl.h + 180.0) % 360.0;
    let (cr, cg, cb) = Hsl::new(comp_h, hsl.s, hsl.l).to_rgb();
    assert_eq!(
        (cr, cg, cb),
        (0, 255, 255),
        "Complement of red should be cyan"
    );

    let green = Color::from_rgb(0, 255, 0);
    let hsl = green.to_hsl();
    let comp_h = (hsl.h + 180.0) % 360.0;
    let (cr, cg, cb) = Hsl::new(comp_h, hsl.s, hsl.l).to_rgb();
    assert_eq!(
        (cr, cg, cb),
        (255, 0, 255),
        "Complement of green should be magenta"
    );

    let blue = Color::from_rgb(0, 0, 255);
    let hsl = blue.to_hsl();
    let comp_h = (hsl.h + 180.0) % 360.0;
    let (cr, cg, cb) = Hsl::new(comp_h, hsl.s, hsl.l).to_rgb();
    assert_eq!(
        (cr, cg, cb),
        (255, 255, 0),
        "Complement of blue should be yellow"
    );
}

#[test]
fn test_complementary_gray_is_unchanged() {
    let gray = Color::from_rgb(128, 128, 128);
    let hsl = gray.to_hsl();
    assert_eq!(hsl.s, 0.0, "Gray should have zero saturation");
    let comp_h = (hsl.h + 180.0) % 360.0;
    let (cr, cg, cb) = Hsl::new(comp_h, hsl.s, hsl.l).to_rgb();
    assert_eq!(
        (cr, cg, cb),
        gray.rgb,
        "Complement of gray should be same gray"
    );
}

#[test]
fn test_named_colors_valid_hex() {
    let colors: Vec<Color> = vec![
        粉红,
        牡丹粉红,
        妃色,
        品红,
        桃红,
        海棠红,
        石榴红,
        樱桃色,
        银红,
        大红,
        绛紫,
        绯红,
        胭脂,
        朱红,
        丹,
        彤,
        茜色,
        火红,
        赫赤,
        嫣红,
        洋红,
        炎,
        赤,
        绾,
        枣红,
        檀,
        殷红,
        酡红,
        酡颜,
        鹅黄,
        鸭黄,
        樱草色,
        杏黄,
        杏红,
        橘黄,
        橙黄,
        橘红,
        姜黄,
        缃色,
        橙色,
        茶色,
        驼色,
        昏黄,
        栗色,
        棕色,
        棕绿,
        棕黑,
        棕红,
        棕黄,
        赭,
        赭色,
        琥珀,
        褐色,
        枯黄,
        黄栌,
        秋色,
        秋香色,
        嫩绿,
        柳黄,
        柳绿,
        竹青,
        葱黄,
        葱绿,
        葱青,
        葱倩,
        青葱,
        油绿,
        绿沈,
        碧色,
        碧绿,
        青碧,
        翡翠色,
        草绿,
        青色,
        青翠,
        青白,
        鸭卵青,
        蟹壳青,
        鸦青,
        绿色,
        豆绿,
        豆青,
        石青,
        玉色,
        缥,
        艾绿,
        松柏绿,
        松花绿,
        松花色,
        蓝,
        鷃蓝,
        靛青,
        靛蓝,
        碧蓝,
        蔚蓝,
        宝蓝,
        蓝灰色,
        藏青,
        藏蓝,
        黛,
        黛绿,
        黛蓝,
        黛紫,
        紫色,
        紫酱,
        酱紫,
        紫檀,
        绀青绀紫,
        紫棠,
        青莲,
        群青,
        雪青,
        丁香色,
        藕色,
        藕荷色,
        苍色,
        苍翠,
        苍黄,
        苍青,
        苍黑,
        苍白,
        水色,
        水红,
        水绿,
        水蓝,
        淡青,
        湖蓝,
        湖绿,
        精白,
        象牙白,
        雪白,
        月白,
        缟,
        素,
        荼白,
        霜色,
        花白,
        鱼肚白,
        莹白,
        灰色,
        牙色,
        铅白,
        玄色,
        玄青,
        乌色,
        乌黑,
        漆黑,
        墨色,
        墨灰,
        黑色,
        缁色,
        煤黑,
        黧,
        黎,
        黝,
        黝黑,
        黯,
        赤金,
        金色,
        银白,
        老银,
        乌金,
        铜绿,
    ];

    for color in &colors {
        let hex = color.hex();
        assert!(is_valid_hex(&hex), "Color produced invalid hex: {hex}");
    }
}

#[test]
fn test_brightness_known_values() {
    let black = Color::from_rgb(0, 0, 0);
    assert_eq!(black.brightness(), 0.0);

    let white = Color::from_rgb(255, 255, 255);
    assert!((white.brightness() - 1.0).abs() < 0.001);

    let pure_green = Color::from_rgb(0, 255, 0);
    let brightness = pure_green.brightness();
    assert!(
        (brightness - 0.587).abs() < 0.001,
        "Pure green brightness should be ~0.587, got {brightness}"
    );

    let pure_red = Color::from_rgb(255, 0, 0);
    let brightness = pure_red.brightness();
    assert!(
        (brightness - 0.299).abs() < 0.001,
        "Pure red brightness should be ~0.299, got {brightness}"
    );

    let pure_blue = Color::from_rgb(0, 0, 255);
    let brightness = pure_blue.brightness();
    assert!(
        (brightness - 0.114).abs() < 0.001,
        "Pure blue brightness should be ~0.114, got {brightness}"
    );
}

#[test]
fn test_brightness_is_dark_light_consistency() {
    let black = Color::from_rgb(0, 0, 0);
    assert!(black.is_dark());
    assert!(!black.is_light());

    let white = Color::from_rgb(255, 255, 255);
    assert!(!white.is_dark());
    assert!(white.is_light());

    let mid_gray = Color::from_rgb(128, 128, 128);
    let brightness = mid_gray.brightness();
    assert!(
        (brightness - 0.502).abs() < 0.01,
        "Mid gray brightness should be ~0.502"
    );
}

#[test]
fn test_rgba_output_format() {
    let color = Color::from_rgb(255, 128, 64);
    assert_eq!(color.rgba(0.5), "rgba(255, 128, 64, 0.5)");
    assert_eq!(color.rgba(1.0), "rgba(255, 128, 64, 1)");
    assert_eq!(color.rgba_u8(200), "rgba(255, 128, 64, 0.784)");
}

#[test]
fn test_from_rgb_float_clamping() {
    let color = Color::from_rgb_float(0.5, 1.5, -0.1);
    assert_eq!(color.rgb, (128, 255, 0));
}

#[test]
fn test_blend_symmetry() {
    let c1 = Color::from_rgb(100, 200, 50);
    let c2 = Color::from_rgb(200, 50, 150);
    let blend_ab = blend_colors(c1, c2, 0.3);
    let blend_ba = blend_colors(c2, c1, 0.7);
    assert_eq!(blend_ab.rgb, blend_ba.rgb, "Blending should be symmetric");
}

#[test]
fn test_gradient_interpolation_linearity() {
    let g = Gradient::from_colors(vec![Color::from_rgb(0, 0, 0), Color::from_rgb(100, 0, 0)]);
    let q1 = g.sample(0.25);
    let q3 = g.sample(0.75);
    assert_eq!(q1.rgb.0, 25);
    assert_eq!(q3.rgb.0, 75);
}

#[test]
fn test_named_color_categories() {
    assert_eq!(粉红.category, ColorCategory::Red);
    assert_eq!(鹅黄.category, ColorCategory::Yellow);
    assert_eq!(葱倩.category, ColorCategory::Green);
    assert_eq!(靛蓝.category, ColorCategory::Blue);
    assert_eq!(魏紫.category, ColorCategory::Purple);
    assert_eq!(精白.category, ColorCategory::White);
    assert_eq!(黑色.category, ColorCategory::Black);
    assert_eq!(老银.category, ColorCategory::Gray);
}

#[test]
fn test_color_accessors() {
    let color = Color::from_rgb(10, 20, 30);
    assert_eq!(color.r(), 10);
    assert_eq!(color.g(), 20);
    assert_eq!(color.b(), 30);
}

#[test]
fn test_contrast_rgba() {
    let dark = Color::from_rgb(10, 10, 10);
    assert_eq!(dark.contrast_rgba(0.8), "rgba(255, 255, 255, 0.8)");

    let light = Color::from_rgb(240, 240, 240);
    assert_eq!(light.contrast_rgba(0.9), "rgba(0, 0, 0, 0.9)");
}
