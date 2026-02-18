use super::*;

#[test]
fn test_brightness_light() {
    assert!(粉红.is_light(), "粉红 should be light");
    assert!(!粉红.is_dark(), "粉红 should not be dark");
    assert!(粉红.brightness() > 0.5, "粉红 brightness should be > 0.5");
}

#[test]
fn test_brightness_dark() {
    assert!(靛蓝.is_dark(), "靛蓝 should be dark");
    assert!(!靛蓝.is_light(), "靛蓝 should not be light");
    assert!(靛蓝.brightness() < 0.5, "靛蓝 brightness should be < 0.5");
}

#[test]
fn test_contrast_light_color() {
    let (r, g, b, a) = 粉红.contrast(0.9);
    assert_eq!(
        (r, g, b),
        (0, 0, 0),
        "Light color should contrast with black"
    );
    assert_eq!(a, 0.9, "Alpha should match input");
}

#[test]
fn test_contrast_dark_color() {
    let (r, g, b, a) = 靛蓝.contrast(0.8);
    assert_eq!(
        (r, g, b),
        (255, 255, 255),
        "Dark color should contrast with white"
    );
    assert_eq!(a, 0.8, "Alpha should match input");
}

#[test]
fn test_contrast_rgba_light() {
    let rgba = 粉红.contrast_rgba(0.9);
    assert_eq!(rgba, "rgba(0, 0, 0, 0.9)", "Light color returns black rgba");
}

#[test]
fn test_contrast_rgba_dark() {
    let rgba = 靛蓝.contrast_rgba(0.8);
    assert_eq!(
        rgba, "rgba(255, 255, 255, 0.8)",
        "Dark color returns white rgba"
    );
}
