// Verifies the optional Tailwind color collection, selected via
// [workspace.metadata.hikari.palette].collections in the workspace root.
#![cfg(hikari_collection_tailwind)]

use hikari_palette::collections::tailwind::*;

#[test]
fn test_known_tailwind_values() {
    // Sanity: a few canonical Tailwind v3 values.
    assert_eq!(red_500.hex(), "#EF4444");
    assert_eq!(blue_500.hex(), "#3B82F6");
    assert_eq!(green_500.hex(), "#22C55E");
    assert_eq!(slate_900.hex(), "#0F172A");
    assert_eq!(slate_50.hex(), "#F8FAFC");
}

#[test]
fn test_tailwind_shade_progression_is_monotonic_brightness() {
    // Within a hue family, darker shades (higher number) should be darker.
    let pairs = [
        (slate_50, slate_900),
        (red_50, red_900),
        (blue_50, blue_900),
        (emerald_50, emerald_900),
    ];
    for (light, dark) in pairs {
        assert!(
            light.brightness() > dark.brightness(),
            "shade progression broken: {} vs {}",
            light.hex(),
            dark.hex()
        );
    }
}

#[test]
fn test_tailwind_colors_carry_source_name() {
    assert_eq!(red_500.name(), Some("red_500"));
    assert_eq!(indigo_700.name(), Some("indigo_700"));
}
