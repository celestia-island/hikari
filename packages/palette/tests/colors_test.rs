// hikari-palette/tests/colors_test.rs
// 中国传统色库单元测试

use hikari_palette::*;

#[test]
fn test_color_properties() {
    let color = 朱砂;
    assert_eq!(color.name, "朱砂");
    assert_eq!(color.hex, "#FF4C00");
    assert_eq!(color.category, ColorCategory::Red);
}

#[test]
fn test_all_colors_are_unique() {
    let colors = vec![
        朱砂, 石青, 藤黄, 靛蓝, 月白, 墨色, 丹雘, 黛色, 葱倩, 鹅黄, 缟色, 云白, 烟灰,
    ];

    let mut seen: std::collections::HashMap<String, bool> = std::collections::HashMap::new();
    for color in colors {
        assert!(
            !seen.contains_key(&color.name.to_string()),
            "Duplicate color: {}",
            color.name
        );
        seen.insert(color.name.to_string(), true);
    }
}

#[test]
fn test_palette_default() {
    let palette = Palette::default();
    assert_eq!(palette.primary.name, 石青.name);
    assert_eq!(palette.secondary.name, 朱砂.name);
    assert_eq!(palette.success.name, 葱倩.name);
}

#[test]
fn test_palettes() {
    let primary = primary_palette();
    let fui_dark = fui_dark_palette();

    assert_eq!(primary.background, 墨色);
    assert_eq!(fui_dark.background, 墨色);

    assert_eq!(primary.primary.name, 石青.name);
    assert_eq!(fui_dark.accent.name, 靛蓝.name);
}
