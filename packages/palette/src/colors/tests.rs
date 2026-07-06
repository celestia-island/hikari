//! Tests for the color primitives. Collection-free — uses [`Color::from_rgb_hex`]
//! directly so they run regardless of which `collection-*` features are enabled.

use super::*;

// A light pink (was 粉红 #ffb3a7) and a dark indigo (was 靛蓝 #065279) — these
// mirror the colors the old chinese-constant-based tests used, but constructed
// inline so this test module does not depend on any collection feature.
const LIGHT: Color = Color::from_rgb_hex(0xff, 0xb3, 0xa7);
const DARK: Color = Color::from_rgb_hex(0x06, 0x52, 0x79);

#[test]
fn test_brightness_light() {
    assert!(LIGHT.is_light(), "{LIGHT:?} should be light");
    assert!(!LIGHT.is_dark(), "{LIGHT:?} should not be dark");
    assert!(LIGHT.brightness() > 0.5);
}

#[test]
fn test_brightness_dark() {
    assert!(DARK.is_dark(), "{DARK:?} should be dark");
    assert!(!DARK.is_light(), "{DARK:?} should not be light");
    assert!(DARK.brightness() < 0.5);
}

#[test]
fn test_contrast_light_color() {
    let (r, g, b, a) = LIGHT.contrast(0.9);
    assert_eq!((r, g, b), (0, 0, 0));
    assert_eq!(a, 0.9);
}

#[test]
fn test_contrast_dark_color() {
    let (r, g, b, a) = DARK.contrast(0.8);
    assert_eq!((r, g, b), (255, 255, 255));
    assert_eq!(a, 0.8);
}

#[test]
fn test_contrast_rgba_light() {
    assert_eq!(LIGHT.contrast_rgba(0.9), "rgba(0, 0, 0, 0.9)");
}

#[test]
fn test_contrast_rgba_dark() {
    assert_eq!(DARK.contrast_rgba(0.8), "rgba(255, 255, 255, 0.8)");
}

#[test]
fn test_from_rgb_hex_infer_category() {
    // Purity anchors — the inference is a hue hint, not a precise classifier.
    assert_eq!(
        Color::from_rgb_hex(0xff, 0x00, 0x00).category,
        ColorCategory::Red
    );
    assert_eq!(
        Color::from_rgb_hex(0xff, 0xa5, 0x00).category,
        ColorCategory::Orange
    );
    assert_eq!(
        Color::from_rgb_hex(0xff, 0xff, 0x00).category,
        ColorCategory::Yellow
    );
    assert_eq!(
        Color::from_rgb_hex(0x00, 0xff, 0x00).category,
        ColorCategory::Green
    );
    assert_eq!(
        Color::from_rgb_hex(0x00, 0xff, 0xff).category,
        ColorCategory::Cyan
    );
    assert_eq!(
        Color::from_rgb_hex(0x00, 0x00, 0xff).category,
        ColorCategory::Blue
    );
    assert_eq!(
        Color::from_rgb_hex(0xff, 0x00, 0xff).category,
        ColorCategory::Purple
    );
    // Extremes.
    assert_eq!(
        Color::from_rgb_hex(0xff, 0xff, 0xff).category,
        ColorCategory::White
    );
    assert_eq!(
        Color::from_rgb_hex(0x00, 0x00, 0x00).category,
        ColorCategory::Black
    );
    assert_eq!(
        Color::from_rgb_hex(0x80, 0x80, 0x80).category,
        ColorCategory::Gray
    );
    // A few concrete collection colors (sanity).
    assert_eq!(
        Color::from_rgb_hex(0x0e, 0xb8, 0x40).category,
        ColorCategory::Green
    ); // 葱倩-ish
    assert_eq!(
        Color::from_rgb_hex(0x14, 0x4a, 0x74).category,
        ColorCategory::Blue
    ); // 鷃蓝-ish
}

#[test]
fn test_with_name_round_trip() {
    let c = Color::from_rgb_hex(0xff, 0xb3, 0xa7).with_name("粉红");
    assert_eq!(c.name(), Some("粉红"));
    // Without a name, defaults to None.
    assert_eq!(Color::from_rgb_hex(1, 2, 3).name(), None);
}
