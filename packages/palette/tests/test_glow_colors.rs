use hikari_palette::*;

#[test]
fn test_hikari_glow_colors_are_themed() {
    let hikari = Hikari::palette();

    // Primary should return pink glow (牡丹粉红 - 238, 162, 164)
    let primary_glow = hikari.button_glow_color(&hikari.primary);
    assert_eq!(primary_glow, "rgba(238, 162, 164, 0.5)");

    // Secondary should return green glow (苍翠 - 81, 154, 115)
    let secondary_glow = hikari.button_glow_color(&hikari.secondary);
    assert_eq!(secondary_glow, "rgba(81, 154, 115, 0.5)");
}

#[test]
fn test_tairitsu_glow_colors_are_themed() {
    let tairitsu = Tairitsu::palette();

    // Primary should return deep blue glow (鷃蓝 - 20, 74, 116)
    let primary_glow = tairitsu.button_glow_color(&tairitsu.primary);
    assert_eq!(primary_glow, "rgba(20, 74, 116, 0.5)");

    // Secondary should return yellow glow (姜黄 - 255, 199, 115)
    let secondary_glow = tairitsu.button_glow_color(&tairitsu.secondary);
    assert_eq!(secondary_glow, "rgba(255, 199, 115, 0.5)");
}
