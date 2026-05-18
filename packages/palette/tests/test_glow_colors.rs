use hikari_palette::themes::{Hikari, Tairitsu};

#[test]
fn test_hikari_glow_colors_are_contrast() {
    let hikari = Hikari::palette();

    // Primary (粉红, brightness ~0.786) → black glow for contrast
    let primary_glow = hikari.button_glow_color(&hikari.primary);
    assert_eq!(primary_glow, "rgba(0, 0, 0, 0.7)");

    // Secondary (苍翠, brightness ~0.501) → black glow for contrast
    let secondary_glow = hikari.button_glow_color(&hikari.secondary);
    assert_eq!(secondary_glow, "rgba(0, 0, 0, 0.6)");
}

#[test]
fn test_tairitsu_glow_colors_are_contrast() {
    let tairitsu = Tairitsu::palette();

    // Primary (鷃蓝, brightness ~0.297) → white glow for contrast on dark
    let primary_glow = tairitsu.button_glow_color(&tairitsu.primary);
    assert_eq!(primary_glow, "rgba(255, 255, 255, 0.7)");

    // Secondary (姜黄, brightness ~0.841) → black glow for contrast
    let secondary_glow = tairitsu.button_glow_color(&tairitsu.secondary);
    assert_eq!(secondary_glow, "rgba(0, 0, 0, 0.7)");
}
