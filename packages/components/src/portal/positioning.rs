// hi-components/src/portal/positioning.rs
// Position calculation logic for portal elements

use crate::portal::types::{PortalPositionStrategy, TriggerPlacement};

pub fn calculate_position(
    strategy: &PortalPositionStrategy,
    viewport_width: f64,
    viewport_height: f64,
    element_width: f64,
    trigger_rect: Option<(f64, f64, f64, f64)>,
) -> (f64, f64) {
    const OFFSET: f64 = 8.0;
    const PADDING: f64 = 16.0;
    const MENU_MAX_HEIGHT: f64 = 400.0;

    match strategy {
        PortalPositionStrategy::Fixed(x, y) => {
            let x_pos = x.clamp(PADDING, viewport_width - element_width - PADDING);
            let y_pos = y.clamp(PADDING, viewport_height - 100.0 - PADDING);
            (x_pos, y_pos)
        }
        PortalPositionStrategy::TriggerBased { placement } => {
            if let Some((rect_x, rect_y, rect_w, rect_h)) = trigger_rect {
                let trigger_center_x = rect_x + rect_w / 2.0;
                let trigger_center_y = rect_y + rect_h / 2.0;

                #[cfg(target_arch = "wasm32")]
                {
                    web_sys::console::log_1(
                        &format!("Portal calculate_position: placement={:?}, trigger_rect=({:.1}, {:.1}, {:.1}, {:.1}), viewport=({:.1}, {:.1}), elem_width={:.1}",
                            placement, rect_x, rect_y, rect_w, rect_h, viewport_width, viewport_height, element_width).into()
                    );
                }

                let (x, y) = match placement {
                    TriggerPlacement::Bottom => (trigger_center_x, rect_y + rect_h + OFFSET),
                    TriggerPlacement::BottomLeft => (rect_x, rect_y + rect_h + OFFSET),
                    TriggerPlacement::BottomRight => (rect_x + rect_w, rect_y + rect_h + OFFSET),
                    TriggerPlacement::Top => {
                        (trigger_center_x - element_width / 2.0, rect_y - OFFSET)
                    }
                    TriggerPlacement::TopLeft => (rect_x, rect_y - OFFSET),
                    TriggerPlacement::TopRight => (rect_x + rect_w, rect_y - OFFSET),
                    TriggerPlacement::Left => (rect_x - OFFSET - element_width, trigger_center_y),
                    TriggerPlacement::LeftTop => (rect_x - OFFSET - element_width, rect_y),
                    TriggerPlacement::LeftBottom => {
                        (rect_x - OFFSET - element_width, rect_y + rect_h)
                    }
                    TriggerPlacement::Right => (rect_x + rect_w + OFFSET, trigger_center_y),
                    TriggerPlacement::RightTop => (rect_x + rect_w + OFFSET, rect_y),
                    TriggerPlacement::RightBottom => (rect_x + rect_w + OFFSET, rect_y + rect_h),
                    TriggerPlacement::Center => (trigger_center_x, trigger_center_y),
                };

                let x_clamped = x.clamp(PADDING, viewport_width - element_width - PADDING);

                let y_clamped = match placement {
                    TriggerPlacement::Bottom
                    | TriggerPlacement::BottomLeft
                    | TriggerPlacement::BottomRight => y.clamp(PADDING, viewport_height - PADDING),
                    TriggerPlacement::Top
                    | TriggerPlacement::TopLeft
                    | TriggerPlacement::TopRight => y.max(PADDING),
                    TriggerPlacement::Left
                    | TriggerPlacement::LeftTop
                    | TriggerPlacement::LeftBottom => y.clamp(PADDING, viewport_height - PADDING),
                    TriggerPlacement::Right
                    | TriggerPlacement::RightTop
                    | TriggerPlacement::RightBottom => y.clamp(PADDING, viewport_height - PADDING),
                    TriggerPlacement::Center => y.clamp(PADDING, viewport_height - PADDING),
                };

                #[cfg(target_arch = "wasm32")]
                {
                    web_sys::console::log_1(
                        &format!(
                            "Portal calculated position: ({:.1}, {:.1}) -> ({:.1}, {:.1}), placement={:?}",
                            x, y, x_clamped, y_clamped, placement
                        )
                        .into(),
                    );
                }

                (x_clamped, y_clamped)
            } else {
                #[cfg(target_arch = "wasm32")]
                {
                    web_sys::console::log_1(
                        &"Portal: trigger_rect is None, using center fallback".into(),
                    );
                }

                let x = (viewport_width - element_width) / 2.0;
                let y = (viewport_height - MENU_MAX_HEIGHT) / 2.0;
                (x, y)
            }
        }
        PortalPositionStrategy::MouseBased { placement: _ } => {
            let x = (viewport_width - element_width) / 2.0;
            let y = (viewport_height - MENU_MAX_HEIGHT) / 2.0;
            (x, y)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_position(
        placement: TriggerPlacement,
        trigger_rect: (f64, f64, f64, f64),
        expected_x: f64,
        expected_y: f64,
        description: &str,
    ) {
        let strategy = PortalPositionStrategy::TriggerBased { placement };
        let viewport_width = 1920.0;
        let viewport_height = 1080.0;
        let element_width = 200.0;

        let (x, y) = calculate_position(
            &strategy,
            viewport_width,
            viewport_height,
            element_width,
            Some(trigger_rect),
        );

        let tolerance = 0.01;
        assert!(
            (x - expected_x).abs() < tolerance,
            "{}: x mismatch: expected {}, got {}",
            description,
            expected_x,
            x
        );
        assert!(
            (y - expected_y).abs() < tolerance,
            "{}: y mismatch: expected {}, got {}",
            description,
            expected_y,
            y
        );
    }

    #[test]
    fn test_bottom_placement_centered() {
        test_position(
            TriggerPlacement::Bottom,
            (100.0, 100.0, 80.0, 40.0),
            140.0,
            148.0,
            "Bottom placement should center menu below trigger",
        );
    }

    #[test]
    fn test_bottom_right_placement() {
        test_position(
            TriggerPlacement::BottomRight,
            (100.0, 100.0, 80.0, 40.0),
            180.0,
            148.0,
            "BottomRight should align menu right edge with trigger right",
        );
    }

    #[test]
    fn test_top_placement_centered() {
        test_position(
            TriggerPlacement::Top,
            (100.0, 100.0, 80.0, 40.0),
            40.0,
            92.0,
            "Top placement should center menu above trigger",
        );
    }

    #[test]
    fn test_top_left_placement() {
        test_position(
            TriggerPlacement::TopLeft,
            (100.0, 100.0, 80.0, 40.0),
            100.0,
            92.0,
            "TopLeft should align menu left edge with trigger left",
        );
    }

    #[test]
    fn test_top_right_placement() {
        test_position(
            TriggerPlacement::TopRight,
            (100.0, 100.0, 80.0, 40.0),
            180.0,
            92.0,
            "TopRight should align menu right edge with trigger right",
        );
    }

    #[test]
    fn test_left_placement_centered() {
        test_position(
            TriggerPlacement::Left,
            (100.0, 100.0, 80.0, 40.0),
            16.0,
            120.0,
            "Left placement should position menu to left of trigger, vertically centered, with X clamped to PADDING",
        );
    }

    #[test]
    fn test_left_top_placement() {
        test_position(
            TriggerPlacement::LeftTop,
            (100.0, 100.0, 80.0, 40.0),
            16.0,
            100.0,
            "LeftTop should position menu to left of trigger, top aligned, with X clamped to PADDING",
        );
    }

    #[test]
    fn test_left_bottom_placement() {
        test_position(
            TriggerPlacement::LeftBottom,
            (100.0, 100.0, 80.0, 40.0),
            16.0,
            140.0,
            "LeftBottom should position menu to left of trigger, bottom aligned, with X clamped to PADDING",
        );
    }

    #[test]
    fn test_right_placement_centered() {
        test_position(
            TriggerPlacement::Right,
            (100.0, 100.0, 80.0, 40.0),
            188.0,
            120.0,
            "Right placement should position menu to right of trigger, vertically centered",
        );
    }

    #[test]
    fn test_right_top_placement() {
        test_position(
            TriggerPlacement::RightTop,
            (100.0, 100.0, 80.0, 40.0),
            188.0,
            100.0,
            "RightTop should position menu to right of trigger, top aligned",
        );
    }

    #[test]
    fn test_right_bottom_placement() {
        test_position(
            TriggerPlacement::RightBottom,
            (100.0, 100.0, 80.0, 40.0),
            188.0,
            140.0,
            "RightBottom should position menu to right of trigger, bottom aligned",
        );
    }

    #[test]
    fn test_center_placement() {
        test_position(
            TriggerPlacement::Center,
            (100.0, 100.0, 80.0, 40.0),
            140.0,
            120.0,
            "Center placement should position menu at trigger center",
        );
    }

    #[test]
    fn test_bottom_left_boundary_clamping() {
        let strategy = PortalPositionStrategy::TriggerBased {
            placement: TriggerPlacement::BottomLeft,
        };
        let viewport_width = 1920.0;
        let viewport_height = 1080.0;
        let element_width = 200.0;

        let (x, y) = calculate_position(
            &strategy,
            viewport_width,
            viewport_height,
            element_width,
            Some((0.0, 100.0, 80.0, 40.0)),
        );

        assert_eq!(x, 16.0, "X should be clamped to PADDING when at left edge");
        assert_eq!(y, 148.0, "Y should not be clamped for Bottom* placement");
    }

    #[test]
    fn test_bottom_right_boundary_clamping() {
        let strategy = PortalPositionStrategy::TriggerBased {
            placement: TriggerPlacement::BottomRight,
        };
        let viewport_width = 1920.0;
        let viewport_height = 1080.0;
        let element_width = 200.0;

        let (x, y) = calculate_position(
            &strategy,
            viewport_width,
            viewport_height,
            element_width,
            Some((1900.0, 100.0, 80.0, 40.0)),
        );

        assert_eq!(x, 1704.0, "X should be clamped to prevent right overflow");
        assert_eq!(y, 148.0, "Y should not be clamped for Bottom* placement");
    }

    #[test]
    fn test_fixed_positioning() {
        let strategy = PortalPositionStrategy::Fixed(500.0, 300.0);
        let viewport_width = 1920.0;
        let viewport_height = 1080.0;
        let element_width = 200.0;

        let (x, y) = calculate_position(
            &strategy,
            viewport_width,
            viewport_height,
            element_width,
            None,
        );

        assert_eq!(x, 500.0, "X should match Fixed input");
        assert_eq!(y, 300.0, "Y should match Fixed input");
    }

    #[test]
    fn test_fixed_positioning_out_of_bounds() {
        let strategy = PortalPositionStrategy::Fixed(-100.0, -100.0);
        let viewport_width = 1920.0;
        let viewport_height = 1080.0;
        let element_width = 200.0;

        let (x, y) = calculate_position(
            &strategy,
            viewport_width,
            viewport_height,
            element_width,
            None,
        );

        assert_eq!(x, 16.0, "X should be clamped to PADDING when negative");
        assert_eq!(y, 16.0, "Y should be clamped to PADDING when negative");
    }

    #[test]
    fn test_mouse_based_fallback() {
        let strategy = PortalPositionStrategy::MouseBased {
            placement: TriggerPlacement::Bottom,
        };
        let viewport_width = 1920.0;
        let viewport_height = 1080.0;
        let element_width = 200.0;

        let (x, y) = calculate_position(
            &strategy,
            viewport_width,
            viewport_height,
            element_width,
            None,
        );

        let expected_x = (viewport_width - element_width) / 2.0;
        let expected_y = (viewport_height - 400.0) / 2.0;

        assert_eq!(x, expected_x, "MouseBased should fallback to center X");
        assert_eq!(y, expected_y, "MouseBased should fallback to center Y");
    }

    #[test]
    fn test_trigger_based_no_rect() {
        let strategy = PortalPositionStrategy::TriggerBased {
            placement: TriggerPlacement::Bottom,
        };
        let viewport_width = 1920.0;
        let viewport_height = 1080.0;
        let element_width = 200.0;

        let (x, y) = calculate_position(
            &strategy,
            viewport_width,
            viewport_height,
            element_width,
            None,
        );

        let expected_x = (viewport_width - element_width) / 2.0;
        let expected_y = (viewport_height - 400.0) / 2.0;

        assert_eq!(
            x, expected_x,
            "TriggerBased without rect should fallback to center X"
        );
        assert_eq!(
            y, expected_y,
            "TriggerBased without rect should fallback to center Y"
        );
    }
}
