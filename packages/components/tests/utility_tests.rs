// E2E tests for utility modules
// Tests verify that utilities compile and can be used in components

use hikari_components::utils::positioning::{
    use_position, OverlayZIndex, Placement, PositionConfig, PositionStrategy,
};

#[test]
fn test_placement_types() {
    // Test that all placement variants compile
    let placements = vec![
        Placement::Top,
        Placement::TopLeft,
        Placement::TopRight,
        Placement::Bottom,
        Placement::BottomLeft,
        Placement::BottomRight,
        Placement::Left,
        Placement::LeftTop,
        Placement::LeftBottom,
        Placement::Right,
        Placement::RightTop,
        Placement::RightBottom,
    ];

    for placement in placements {
        let _css = placement.css_position();
        let _flipped = placement.flip();
    }
}

#[test]
fn test_position_config_construction() {
    // Test default construction
    let config = PositionConfig::default();
    let _style = config.css_style();

    // Test builder pattern
    let config = PositionConfig::new(Placement::Top)
        .offset(10, 20)
        .strategy(PositionStrategy::Fixed)
        .flip(false)
        .padding(16);

    let _style = config.css_style();
}

#[test]
fn test_overlay_z_index() {
    let z_indices = vec![
        OverlayZIndex::Default,
        OverlayZIndex::Tooltip,
        OverlayZIndex::Dropdown,
        OverlayZIndex::Popover,
        OverlayZIndex::Modal,
    ];

    for z_index in z_indices {
        let _value = z_index.value();
    }
}

// Note: use_position hook requires Dioxus runtime, so we skip calling it in tests
// This test verifies the hook type compiles correctly
#[ignore = "use_position requires Dioxus runtime"]
#[test]
fn test_use_position_hook() {
    // Test that use_position hook compiles (cannot call outside component)
    // The return type should be verified at compile time
    let _: fn() -> hikari_components::utils::positioning::UsePositionReturn = use_position;
}

#[test]
fn test_position_strategy() {
    let strategies = vec![PositionStrategy::Absolute, PositionStrategy::Fixed];

    for strategy in strategies {
        let _value = strategy.css_value();
    }
}
