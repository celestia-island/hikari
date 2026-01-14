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
        assert!(!seen.contains(&hex), "Duplicate color: {}", hex);
        seen.insert(hex);
    }
}

#[test]
fn test_palette_default() {
    let palette = default_theme();
    assert_eq!(palette.mode, ThemeMode::Light);
    assert_eq!(palette.primary.hex(), 粉红.hex());
    assert_eq!(palette.secondary.hex(), 靛青.hex());
    assert_eq!(palette.success.hex(), 葱倩.hex());
}

#[test]
fn test_themes() {
    let hikari = themes::Hikari::palette();
    let tairitsu = themes::Tairitsu::palette();

    assert_eq!(hikari.mode, ThemeMode::Light);
    assert_eq!(tairitsu.mode, ThemeMode::Dark);

    assert_eq!(hikari.background.hex(), 月白.hex());
    assert_eq!(tairitsu.background.hex(), 墨色.hex());

    assert_eq!(hikari.primary.hex(), 粉红.hex());
    assert_eq!(tairitsu.primary.hex(), 靛蓝.hex());
}
