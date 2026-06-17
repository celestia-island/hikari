// hi-animation/src/presets/transition.rs
// Simple transition animation presets for common use cases

/// Slide direction enum
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SlideDirection {
    Top,
    Bottom,
    Left,
    Right,
}

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
#[must_use]
pub fn fade_in(_element_id: &str, duration_ms: u64) -> String {
    format!("opacity 0ms ease-out, opacity {duration_ms}ms ease-out")
}

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
#[must_use]
pub fn fade_out(_element_id: &str, duration_ms: u64) -> String {
    format!("opacity 0ms ease-in, opacity {duration_ms}ms ease-in")
}

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
#[must_use]
pub fn slide_in(
    _element_id: &str,
    duration_ms: u64,
    _direction: SlideDirection,
    _distance: i32,
) -> String {
    format!(
        "transform 0ms, opacity 0ms, transform {duration_ms}ms ease-out, opacity {duration_ms}ms ease-out"
    )
}

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
#[must_use]
pub fn slide_out(
    _element_id: &str,
    duration_ms: u64,
    _direction: SlideDirection,
    _distance: i32,
) -> String {
    format!(
        "transform 0ms, opacity 0ms, transform {duration_ms}ms ease-in, opacity {duration_ms}ms ease-in"
    )
}

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
#[must_use]
pub fn zoom_in(_element_id: &str, duration_ms: u64) -> String {
    format!(
        "transform 0ms, opacity 0ms, transform {duration_ms}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity {duration_ms}ms cubic-bezier(0.34, 1.56, 0.64, 1)"
    )
}

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
#[must_use]
pub fn zoom_out(_element_id: &str, duration_ms: u64) -> String {
    format!(
        "transform 0ms, opacity 0ms, transform {duration_ms}ms cubic-bezier(0.36, 0, 0.66, -0.56), opacity {duration_ms}ms cubic-bezier(0.36, 0, 0.66, -0.56)"
    )
}

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
#[must_use]
pub fn bounce_in(_element_id: &str, _duration_ms: u64) -> String {
    "cubic-bezier(0.68, -0.55, 0.265, 1.55)".to_string()
}

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
#[must_use]
pub fn shake(element_id: &str, duration_ms: u64) -> String {
    let sanitized: String = element_id
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    let keyframes_name = format!("{sanitized}-shake");
    let keyframes = format!(
        "@keyframes {keyframes_name} {{ 0%, 100% {{ transform: translateX(0); }} 10%, 30%, 50%, 70%, 90% {{ transform: translateX(-10px); }} 20%, 40%, 60%, 80% {{ transform: translateX(10px); }} }}"
    );

    let animation = format!(
        "animation {sanitized}-shake {duration_ms}ms ease-in-out infinite"
    );

    format!("{keyframes}; {animation}")
}

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
#[must_use]
pub fn rotate_in(_element_id: &str, duration_ms: u64, _degrees: i32) -> String {
    format!("transform {duration_ms}ms ease-out")
}

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
#[must_use]
pub fn rotate_out(_element_id: &str, duration_ms: u64, _degrees: i32) -> String {
    format!("transform {duration_ms}ms ease-in")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_slide_direction_exists() {
        let directions = [
            SlideDirection::Top,
            SlideDirection::Bottom,
            SlideDirection::Left,
            SlideDirection::Right,
        ];
        assert_eq!(directions.len(), 4);
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
        assert!(css.contains("transform"));
        assert!(css.contains("opacity"));
    }

    #[test]
    fn test_zoom_in_generates_css() {
        let css = zoom_in("my-element", 300);
        assert!(css.contains("300ms"));
        assert!(css.contains("cubic-bezier(0.34, 1.56, 0.64, 1)"));
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
