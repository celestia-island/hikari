// hi-components/src/portal/types.rs
// Type definitions for the portal system

use tairitsu_hooks::ReactiveSignal;

use crate::{
    feedback::PopoverPlacement,
    modal::{MaskMode, ModalPosition, ModalSize},
    prelude::*,
};

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

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ModalAnimationState {
    #[default]
    Appearing,
    Visible,
    Disappearing,
}

#[derive(Clone, Debug)]
pub enum PortalEntry {
    Modal {
        id: String,
        title: Option<String>,
        position: ModalPosition,
        mask_mode: MaskMode,
        closable: bool,
        mask_closable: bool,
        size: ModalSize,
        children: Element,
        animation_state: ModalAnimationState,
    },
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
    Popover {
        id: String,
        trigger_rect: Option<(f64, f64, f64, f64)>,
        preferred_placements: Vec<PopoverPlacement>,
        offset: f64,
        width: Option<String>,
        title: Option<String>,
        close_on_click_outside: bool,
        close_on_select: bool,
        on_close: Option<Callback<()>>,
        close_requested: ReactiveSignal<bool>,
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
