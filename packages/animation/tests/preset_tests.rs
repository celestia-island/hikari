// E2E tests for animation presets
// Tests verify that animation presets compile and generate correct CSS

#[cfg(target_arch = "wasm32")]
use hikari_animation::presets::transition::{
    bounce_in, fade_in, fade_out, rotate_in, rotate_out, shake, slide_in, slide_out, zoom_in,
    zoom_out, SlideDirection,
};

#[cfg(target_arch = "wasm32")]
#[test]
fn test_transition_presets_compile() {
    // Test that all transition presets compile and return CSS strings
    let fade_css = fade_in("my-element", 300);
    assert!(fade_css.contains("300ms"));
    assert!(fade_css.contains("ease-out"));

    let fade_out_css = fade_out("my-element", 300);
    assert!(fade_out_css.contains("300ms"));
    assert!(fade_out_css.contains("ease-in"));

    let slide_in_css = slide_in("my-element", 300, SlideDirection::Top, 50);
    assert!(slide_in_css.contains("300ms"));
    assert!(slide_in_css.contains("ease-out"));

    let slide_out_css = slide_out("my-element", 300, SlideDirection::Bottom, 50);
    assert!(slide_out_css.contains("300ms"));
    assert!(slide_out_css.contains("ease-in"));

    let zoom_in_css = zoom_in("my-element", 300);
    assert!(zoom_in_css.contains("300ms"));
    assert!(zoom_in_css.contains("ease-out-back"));

    let zoom_out_css = zoom_out("my-element", 300);
    assert!(zoom_out_css.contains("300ms"));
    assert!(zoom_out_css.contains("ease-in-back"));

    let bounce_css = bounce_in("my-element", 300);
    assert!(bounce_css.contains("cubic-bezier"));

    let shake_css = shake("my-element", 500);
    assert!(shake_css.contains("@keyframes"));
    assert!(shake_css.contains("my-element-shake"));

    let rotate_in_css = rotate_in("my-element", 300, -45);
    assert!(rotate_in_css.contains("300ms"));
    assert!(rotate_in_css.contains("ease-out"));

    let rotate_out_css = rotate_out("my-element", 300, 45);
    assert!(rotate_out_css.contains("300ms"));
    assert!(rotate_out_css.contains("ease-in"));
}

#[cfg(target_arch = "wasm32")]
#[test]
fn test_all_slide_directions() {
    let directions = vec![
        SlideDirection::Top,
        SlideDirection::Bottom,
        SlideDirection::Left,
        SlideDirection::Right,
    ];

    for direction in directions {
        let css = slide_in("my-element", 300, direction, 50);
        assert!(css.contains("300ms"));
    }
}
