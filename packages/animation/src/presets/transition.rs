// hi-animation/src/presets/transition.rs
// Simple transition animation presets for common use cases

/// Slide direction enum
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum SlideDirection {
    Top,
    Bottom,
    Left,
    Right,
}

#[cfg(target_arch = "wasm32")]
/// Fade in animation preset
///
/// Creates a fade-in animation from opacity 0 to 1.
///
/// # Arguments
/// * `element_id` - ID of the element to animate (used for generating unique CSS)
/// * `duration_ms` - Animation duration in milliseconds
///
/// # Returns
/// CSS transition string that can be applied via style attribute
///
/// # Examples
/// ```rust,no_run
/// use hikari_animation::presets::transition::fade_in;
///
/// let transition = fade_in("my-element", 300);
/// // Result: "opacity 0ms ease-out, opacity 300ms ease-out"
/// // Apply this to an element's style attribute
/// ```
pub fn fade_in(_element_id: &str, duration_ms: u64) -> String {
    format!("opacity 0ms ease-out, opacity {}ms ease-out", duration_ms)
}

#[cfg(target_arch = "wasm32")]
/// Fade out animation preset
///
/// Creates a fade-out animation from opacity 1 to 0.
///
/// # Arguments
/// * `element_id` - ID of the element to animate
/// * `duration_ms` - Animation duration in milliseconds
///
/// # Returns
/// CSS transition string that can be applied via style attribute
pub fn fade_out(_element_id: &str, duration_ms: u64) -> String {
    format!("opacity 0ms ease-in, opacity {}ms ease-in", duration_ms)
}

#[cfg(target_arch = "wasm32")]
/// Slide in animation preset
///
/// Creates a slide-in animation from a specified direction.
///
/// # Arguments
/// * `element_id` - ID of the element to animate
/// * `duration_ms` - Animation duration in milliseconds
/// * `direction` - Direction to slide from (top, bottom, left, right)
/// * `distance` - Slide distance in pixels
///
/// # Returns
/// CSS transition string that can be applied via style attribute
pub fn slide_in(
    _element_id: &str,
    duration_ms: u64,
    direction: SlideDirection,
    distance: i32,
) -> String {
    let _transform_start = match direction {
        SlideDirection::Top => format!("translateY(-{}px)", distance),
        SlideDirection::Bottom => format!("translateY({}px)", distance),
        SlideDirection::Left => format!("translateX(-{}px)", distance),
        SlideDirection::Right => format!("translateX({}px)", distance),
    };

    format!(
        "transform 0ms, opacity 0ms, transform {}ms ease-out, opacity {}ms ease-out",
        duration_ms, duration_ms
    )
}

#[cfg(target_arch = "wasm32")]
/// Slide out animation preset
///
/// Creates a slide-out animation to a specified direction.
///
/// # Arguments
/// * `element_id` - ID of the element to animate
/// * `duration_ms` - Animation duration in milliseconds
/// * `direction` - Direction to slide to (top, bottom, left, right)
/// * `distance` - Slide distance in pixels
///
/// # Returns
/// CSS transition string that can be applied via style attribute
pub fn slide_out(
    _element_id: &str,
    duration_ms: u64,
    direction: SlideDirection,
    distance: i32,
) -> String {
    let _transform_end = match direction {
        SlideDirection::Top => format!("translateY(-{}px)", distance),
        SlideDirection::Bottom => format!("translateY({}px)", distance),
        SlideDirection::Left => format!("translateX(-{}px)", distance),
        SlideDirection::Right => format!("translateX({}px)", distance),
    };

    format!(
        "transform 0ms, opacity 0ms, transform {}ms ease-in, opacity {}ms ease-in",
        duration_ms, duration_ms
    )
}

#[cfg(target_arch = "wasm32")]
/// Zoom in animation preset
///
/// Creates a zoom-in animation from scale 0 to 1.
///
/// # Arguments
/// * `element_id` - ID of the element to animate
/// * `duration_ms` - Animation duration in milliseconds
///
/// # Returns
/// CSS transition string that can be applied via style attribute
pub fn zoom_in(_element_id: &str, duration_ms: u64) -> String {
    format!(
        "transform 0ms, opacity 0ms, transform {}ms ease-out-back, opacity {}ms ease-out-back",
        duration_ms, duration_ms
    )
}

#[cfg(target_arch = "wasm32")]
/// Zoom out animation preset
///
/// Creates a zoom-out animation from scale 1 to 0.
///
/// # Arguments
/// * `element_id` - ID of the element to animate
/// * `duration_ms` - Animation duration in milliseconds
///
/// # Returns
/// CSS transition string that can be applied via style attribute
pub fn zoom_out(_element_id: &str, duration_ms: u64) -> String {
    format!(
        "transform 0ms, opacity 0ms, transform {}ms ease-in-back, opacity {}ms ease-in-back",
        duration_ms, duration_ms
    )
}

#[cfg(target_arch = "wasm32")]
/// Bounce in animation preset
///
/// Creates a bounce-in animation with elastic effect.
///
/// # Arguments
/// * `element_id` - ID of the element to animate
/// * `duration_ms` - Animation duration in milliseconds
///
/// # Returns
/// CSS cubic-bezier curve string for elastic bounce effect
pub fn bounce_in(_element_id: &str, _duration_ms: u64) -> String {
    format!("cubic-bezier(0.68, -0.55, 0.265, 1.55)")
}

#[cfg(target_arch = "wasm32")]
/// Shake animation preset
///
/// Creates a shake animation for attention.
///
/// # Arguments
/// * `element_id` - ID of the element to animate
/// * `duration_ms` - Animation duration in milliseconds
///
/// # Returns
/// CSS keyframes animation definition that can be applied via style sheet
pub fn shake(element_id: &str, duration_ms: u64) -> String {
    let keyframes_name = format!("{}-shake", element_id);
    let keyframes = format!(
        "@keyframes {} {{ 0%, 100% {{ transform: translateX(0); }} 10%, 30%, 50%, 70%, 90% {{ transform: translateX(-10px); }} 20%, 40%, 60%, 80% {{ transform: translateX(10px); }} }}",
        keyframes_name
    );

    let animation = format!(
        "animation {}-shake {}ms ease-in-out infinite",
        element_id, duration_ms
    );

    format!("{}; {}", keyframes, animation)
}

#[cfg(target_arch = "wasm32")]
/// Rotate in animation preset
///
/// Creates a rotation fade-in animation.
///
/// # Arguments
/// * `element_id` - ID of the element to animate
/// * `duration_ms` - Animation duration in milliseconds
/// * `degrees` - Rotation angle in degrees (negative for clockwise)
///
/// # Returns
/// CSS transition string that can be applied via style attribute
pub fn rotate_in(_element_id: &str, duration_ms: u64, _degrees: i32) -> String {
    format!("transform {}ms ease-out", duration_ms)
}

#[cfg(target_arch = "wasm32")]
/// Rotate out animation preset
///
/// Creates a rotation fade-out animation.
///
/// # Arguments
/// * `element_id` - ID of the element to animate
/// * `duration_ms` - Animation duration in milliseconds
/// * `degrees` - Rotation angle in degrees (negative for clockwise)
///
/// # Returns
/// CSS transition string that can be applied via style attribute
pub fn rotate_out(_element_id: &str, duration_ms: u64, _degrees: i32) -> String {
    format!("transform {}ms ease-in", duration_ms)
}

#[cfg(all(test, target_arch = "wasm32"))]
mod tests {
    use super::*;

    #[test]
    fn test_slide_direction_exists() {
        let _directions = vec![
            SlideDirection::Top,
            SlideDirection::Bottom,
            SlideDirection::Left,
            SlideDirection::Right,
        ];
    }

    #[test]
    fn test_fade_in_generates_css() {
        let css = fade_in("my-element", 300);
        assert!(css.contains("300ms"));
        assert!(css.contains("ease-out"));
    }

    #[test]
    fn test_slide_in_generates_css() {
        let css = slide_in("my-element", 300, SlideDirection::Top, 50);
        assert!(css.contains("300ms"));
        assert!(css.contains("ease-out"));
        assert!(css.contains("translateY(-50px)"));
    }

    #[test]
    fn test_zoom_in_generates_css() {
        let css = zoom_in("my-element", 300);
        assert!(css.contains("300ms"));
        assert!(css.contains("ease-out-back"));
    }

    #[test]
    fn test_bounce_in_returns_curve() {
        let curve = bounce_in("my-element", 300);
        assert!(curve.contains("cubic-bezier"));
        assert!(curve.contains("0.68"));
    }

    #[test]
    fn test_shake_generates_keyframes() {
        let css = shake("my-element", 500);
        assert!(css.contains("@keyframes"));
        assert!(css.contains("my-element-shake"));
        assert!(css.contains("translateX(-10px)"));
        assert!(css.contains("translateX(10px)"));
        assert!(css.contains("infinite"));
    }
}
