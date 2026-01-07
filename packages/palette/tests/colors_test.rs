// hikari-palette/tests/colors_test.rs
// 中国传统色库单元测试

use hikari_palette::*;

#[test]
fn test_color_properties() {
    let color = 彤;
    assert_eq!(color.hex(), "#F35336");
    assert_eq!(color.category, ColorCategory::Red);
}

#[test]
fn test_all_colors_are_unique() {
    let colors = vec![
        丹, 石青, 姜黄, 靛蓝, 月白, 墨灰, 朱红, 黛紫, 葱倩, 鹅黄, 莹白, 象牙白,
    ];

    let mut seen = std::collections::HashSet::new();
    for color in colors {
        let hex = color.hex();
        assert!(
            !seen.contains(&hex),
            "Duplicate color: {}",
            hex
        );
        seen.insert(hex);
    }
}

#[test]
fn test_palette_default() {
    let palette = Palette::default();
    assert_eq!(palette.primary.hex(), 石青.hex());
    assert_eq!(palette.secondary.hex(), 朱红.hex());
    assert_eq!(palette.success.hex(), 葱倩.hex());
}

#[test]
fn test_palettes() {
    let primary = primary_palette();
    let fui_dark = fui_dark_palette();

    assert_eq!(primary.background.hex(), 墨色.hex());
    assert_eq!(fui_dark.background.hex(), 墨色.hex());

    assert_eq!(primary.primary.hex(), 石青.hex());
    assert_eq!(fui_dark.accent.hex(), 靛蓝.hex());
}
