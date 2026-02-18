// hi-components/src/utils/positioning.rs
// Positioning utility for components (Tooltip, Popover, Dropdown, Select)

use dioxus::prelude::*;

/// Placement position relative to trigger element
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum Placement {
    #[default]
    Top,
    TopLeft,
    TopRight,
    Bottom,
    BottomLeft,
    BottomRight,
    Left,
    LeftTop,
    LeftBottom,
    Right,
    RightTop,
    RightBottom,
}

impl Placement {
    /// Get the opposite placement
    pub fn flip(&self) -> Self {
        match self {
            Placement::Top => Placement::Bottom,
            Placement::Bottom => Placement::Top,
            Placement::Left => Placement::Right,
            Placement::Right => Placement::Left,
            Placement::TopLeft => Placement::BottomLeft,
            Placement::BottomLeft => Placement::TopLeft,
            Placement::TopRight => Placement::BottomRight,
            Placement::BottomRight => Placement::TopRight,
            Placement::LeftTop => Placement::RightTop,
            Placement::RightTop => Placement::LeftTop,
            Placement::LeftBottom => Placement::RightBottom,
            Placement::RightBottom => Placement::LeftBottom,
        }
    }

    /// Get CSS position string
    pub fn css_position(&self) -> &'static str {
        match self {
            Placement::Top => "top: 100%; left: 50%; transform: translateX(-50%);",
            Placement::TopLeft => "top: 100%; left: 0;",
            Placement::TopRight => "top: 100%; right: 0;",
            Placement::Bottom => "bottom: 100%; left: 50%; transform: translateX(-50%);",
            Placement::BottomLeft => "bottom: 100%; left: 0;",
            Placement::BottomRight => "bottom: 100%; right: 0;",
            Placement::Left => "left: 100%; top: 50%; transform: translateY(-50%);",
            Placement::LeftTop => "left: 100%; top: 0;",
            Placement::LeftBottom => "left: 100%; bottom: 0;",
            Placement::Right => "right: 100%; top: 50%; transform: translateY(-50%);",
            Placement::RightTop => "right: 100%; top: 0;",
            Placement::RightBottom => "right: 100%; bottom: 0;",
        }
    }
}

/// Position strategy for overlay components
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum PositionStrategy {
    #[default]
    Absolute,
    Fixed,
}

impl PositionStrategy {
    /// Get CSS position value
    pub fn css_value(&self) -> &'static str {
        match self {
            PositionStrategy::Absolute => "absolute",
            PositionStrategy::Fixed => "fixed",
        }
    }
}

/// Position configuration for overlay components
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct PositionConfig {
    /// Placement relative to trigger
    pub placement: Placement,

    /// Position strategy (absolute or fixed)
    pub strategy: PositionStrategy,

    /// Offset from trigger (pixels)
    pub offset: (i32, i32),

    /// Flip to opposite side if not enough space
    pub flip: bool,

    /// Minimum distance from viewport edge (pixels)
    pub padding: i32,
}

impl Default for PositionConfig {
    fn default() -> Self {
        Self {
            placement: Placement::Bottom,
            strategy: PositionStrategy::Absolute,
            offset: (0, 8),
            flip: true,
            padding: 8,
        }
    }
}

impl PositionConfig {
    /// Create new position config with custom placement
    pub fn new(placement: Placement) -> Self {
        Self {
            placement,
            ..Default::default()
        }
    }

    /// Set custom offset
    pub fn offset(mut self, x: i32, y: i32) -> Self {
        self.offset = (x, y);
        self
    }

    /// Set position strategy
    pub fn strategy(mut self, strategy: PositionStrategy) -> Self {
        self.strategy = strategy;
        self
    }

    /// Enable or disable flipping
    pub fn flip(mut self, flip: bool) -> Self {
        self.flip = flip;
        self
    }

    /// Set padding from viewport edge
    pub fn padding(mut self, padding: i32) -> Self {
        self.padding = padding;
        self
    }

    /// Generate CSS style string for positioning
    pub fn css_style(&self) -> String {
        let mut style = format!(
            "position: {}; {};",
            self.strategy.css_value(),
            self.placement.css_position()
        );

        // Apply offset
        let (offset_x, offset_y) = self.offset;
        if offset_x != 0 || offset_y != 0 {
            let transform = if offset_y != 0 {
                format!(
                    "translate(calc(-50% + {}px), calc(0% + {}px))",
                    offset_x, offset_y
                )
            } else {
                format!("translate(calc(-50% + {}px), 0)", offset_x)
            };

            // Replace existing transform
            style = style.replacen(
                "transform: translateX(-50%)",
                &format!("transform: {}", transform),
                1,
            );
            style = style.replacen(
                "transform: translateY(-50%)",
                &format!("transform: {}", transform),
                1,
            );
        }

        style
    }
}

/// Z-index management for overlay components
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum OverlayZIndex {
    /// Default overlay (1000-1099)
    Default,
    /// Tooltip (1100-1199)
    Tooltip,
    /// Dropdown (1200-1299)
    Dropdown,
    /// Popover (1300-1399)
    Popover,
    /// Modal (2000+)
    Modal,
}

impl OverlayZIndex {
    /// Get z-index value
    pub fn value(&self) -> i32 {
        match self {
            OverlayZIndex::Default => 1000,
            OverlayZIndex::Tooltip => 1100,
            OverlayZIndex::Dropdown => 1200,
            OverlayZIndex::Popover => 1300,
            OverlayZIndex::Modal => 2000,
        }
    }
}

/// Hook for managing overlay position
pub fn use_position() -> UsePositionReturn {
    // In a full implementation, this would:
    // 1. Track trigger element position
    // 2. Calculate overlay position based on config
    // 3. Handle viewport boundaries
    // 4. Flip placement if needed
    // 5. Listen to resize events
    // 6. Update position dynamically

    UsePositionReturn {
        update_position: Callback::new(|_config: PositionConfig| {
            // Trigger position update
        }),
        get_position: Callback::new(|_config: PositionConfig| -> String {
            // Return CSS position string
            _config.css_style()
        }),
    }
}

/// Return value for use_position hook
#[derive(Clone, PartialEq)]
pub struct UsePositionReturn {
    /// Update position based on config
    pub update_position: Callback<PositionConfig>,

    /// Get CSS position string
    pub get_position: Callback<PositionConfig, String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_placement_flip() {
        assert_eq!(Placement::Top.flip(), Placement::Bottom);
        assert_eq!(Placement::Bottom.flip(), Placement::Top);
        assert_eq!(Placement::Left.flip(), Placement::Right);
        assert_eq!(Placement::Right.flip(), Placement::Left);
        assert_eq!(Placement::TopLeft.flip(), Placement::BottomLeft);
        assert_eq!(Placement::TopRight.flip(), Placement::BottomRight);
    }

    #[test]
    fn test_placement_css_position() {
        assert_eq!(
            Placement::Top.css_position(),
            "top: 100%; left: 50%; transform: translateX(-50%);"
        );
        assert_eq!(
            Placement::Bottom.css_position(),
            "bottom: 100%; left: 50%; transform: translateX(-50%);"
        );
        assert_eq!(
            Placement::Left.css_position(),
            "left: 100%; top: 50%; transform: translateY(-50%);"
        );
        assert_eq!(
            Placement::Right.css_position(),
            "right: 100%; top: 50%; transform: translateY(-50%);"
        );
    }

    #[test]
    fn test_position_config_default() {
        let config = PositionConfig::default();
        assert_eq!(config.placement, Placement::Bottom);
        assert_eq!(config.strategy, PositionStrategy::Absolute);
        assert_eq!(config.offset, (0, 8));
        assert_eq!(config.flip, true);
        assert_eq!(config.padding, 8);
    }

    #[test]
    fn test_position_config_builder() {
        let config = PositionConfig::new(Placement::Top)
            .offset(10, 20)
            .strategy(PositionStrategy::Fixed)
            .flip(false)
            .padding(16);

        assert_eq!(config.placement, Placement::Top);
        assert_eq!(config.strategy, PositionStrategy::Fixed);
        assert_eq!(config.offset, (10, 20));
        assert_eq!(config.flip, false);
        assert_eq!(config.padding, 16);
    }

    #[test]
    fn test_position_config_css_style() {
        let config = PositionConfig::default();
        let style = config.css_style();
        assert!(style.contains("position: absolute"));
        assert!(style.contains("bottom: 100%"));
        assert!(style.contains("left: 50%"));

        // With default offset (0, 8), the transform is modified
        // Default: transform: translateX(-50%)
        // With offset: transform: translate(calc(-50% + 0px), calc(0% + 8px))
        assert!(style.contains("transform:"));
    }

    #[test]
    fn test_overlay_z_index() {
        assert_eq!(OverlayZIndex::Default.value(), 1000);
        assert_eq!(OverlayZIndex::Tooltip.value(), 1100);
        assert_eq!(OverlayZIndex::Dropdown.value(), 1200);
        assert_eq!(OverlayZIndex::Popover.value(), 1300);
        assert_eq!(OverlayZIndex::Modal.value(), 2000);
    }

    #[test]
    fn test_position_strategy() {
        assert_eq!(PositionStrategy::Absolute.css_value(), "absolute");
        assert_eq!(PositionStrategy::Fixed.css_value(), "fixed");
    }
}
