// hi-components/src/portal/types.rs
// Type definitions for the portal system

use crate::prelude::*;

pub static PORTAL_ID_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum PortalPositionStrategy {
    Fixed(f64, f64),
    TriggerBased { placement: TriggerPlacement },
    MouseBased { placement: TriggerPlacement },
}

impl Default for PortalPositionStrategy {
    fn default() -> Self {
        PortalPositionStrategy::TriggerBased {
            placement: TriggerPlacement::default(),
        }
    }
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TriggerPlacement {
    #[default]
    Bottom,
    BottomLeft,
    BottomRight,
    Top,
    TopLeft,
    TopRight,
    Left,
    LeftTop,
    LeftBottom,
    Right,
    RightTop,
    RightBottom,
    Center,
}

/// Animation phase of a portal layer (the legacy modal-flavoured name is
/// kept on the wire for the dropdown/popover entries that share it).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum PortalAnimationState {
    #[default]
    Appearing,
    Visible,
    Disappearing,
}

#[derive(Clone, PartialEq, Debug)]
pub enum PortalEntry {
    Dropdown {
        id: String,
        strategy: PortalPositionStrategy,
        mask_mode: PortalMaskMode,
        children: Element,
        trigger_rect: Option<(f64, f64, f64, f64)>,
        close_on_select: bool,
    },
    Toast {
        id: String,
        position: ToastPosition,
        children: Element,
    },
    Tooltip {
        id: String,
        trigger_rect: Option<(f64, f64, f64, f64)>,
        placement: TriggerPlacement,
        content: String,
        arrow: bool,
    },
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum PortalMaskMode {
    #[default]
    Dimmed,
    Transparent,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ToastPosition {
    TopLeft,
    TopCenter,
    TopRight,
    BottomLeft,
    BottomCenter,
    #[default]
    BottomRight,
}
