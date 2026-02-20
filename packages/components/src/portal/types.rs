// hi-components/src/portal/types.rs
// Type definitions for the portal system

use dioxus::prelude::*;

use crate::{
    feedback::PopoverPlacement,
    modal::{MaskMode, ModalPosition},
};

pub static PORTAL_ID_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum PortalPositionStrategy {
    Fixed(f64, f64),
    TriggerBased { placement: TriggerPlacement },
    MouseBased { placement: TriggerPlacement },
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

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum ModalAnimationState {
    Appearing,
    Visible,
    Disappearing,
}

#[derive(Clone, PartialEq, Debug)]
pub enum PortalEntry {
    Modal {
        id: String,
        title: Option<String>,
        position: ModalPosition,
        mask_mode: MaskMode,
        closable: bool,
        mask_closable: bool,
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
        close_requested: Signal<bool>,
        children: Element,
    },
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum PortalMaskMode {
    Dimmed,
    Transparent,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum ToastPosition {
    TopLeft,
    TopCenter,
    TopRight,
    BottomLeft,
    BottomCenter,
    BottomRight,
}
