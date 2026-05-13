// hi-components/src/feedback/modal.rs
// Modal component using Portal system

use std::sync::atomic::{AtomicU64, Ordering};

use crate::{
    portal::{PortalEntry, use_portal},
    prelude::*,
    styled::StyledComponent,
};
use tairitsu_hooks::ReactiveSignal;

static MODAL_ID_COUNTER: AtomicU64 = AtomicU64::new(0);

pub struct ModalComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ModalPosition {
    #[default]
    Center,

    TopLeft,
    Top,
    TopRight,
    Right,
    BottomRight,
    Bottom,
    BottomLeft,
    Left,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MaskMode {
    #[default]
    Opaque,

    Transparent,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ModalSize {
    #[default]
    Md,
    Sm,
    Lg,
    Xl,
}

#[derive(Clone, PartialEq)]
pub struct ModalConfig {
    pub id: String,
    pub position: ModalPosition,
    pub mask_mode: MaskMode,
    pub closable: bool,
    pub mask_closable: bool,
    pub size: ModalSize,
    pub class: String,
}

impl Default for ModalConfig {
    fn default() -> Self {
        Self {
            id: format!("modal-{}", MODAL_ID_COUNTER.fetch_add(1, Ordering::SeqCst)),
            position: ModalPosition::Center,
            mask_mode: MaskMode::Opaque,
            closable: true,
            mask_closable: true,
            size: ModalSize::Md,
            class: String::new(),
        }
    }
}

pub fn use_modal(initial_config: ModalConfig) -> ModalController {
    let portal = use_portal();
    let config = use_signal(|| initial_config);

    let open = {
        let add_entry = portal.add_entry;
        let cfg = config.clone();
        Callback::new(move |content: ModalContent| {
            let current_cfg = cfg.read();
            let entry = PortalEntry::Modal {
                id: current_cfg.id.clone(),
                title: content.title,
                position: current_cfg.position,
                mask_mode: current_cfg.mask_mode,
                closable: current_cfg.closable,
                mask_closable: current_cfg.mask_closable,
                size: current_cfg.size,
                children: content.children,
                animation_state: crate::portal::ModalAnimationState::Appearing,
            };
            add_entry.call(entry);
        })
    };

    let close = {
        let start_close = portal.start_close_animation;
        let cfg = config.clone();
        Callback::new(move |_| {
            let id = cfg.read().id.clone();
            start_close.call(id.clone());
        })
    };

    ModalController {
        config,
        open,
        close,
    }
}

#[derive(Clone, PartialEq)]
pub struct ModalContent {
    pub title: Option<String>,
    pub children: Element,
}

#[derive(Clone)]
pub struct ModalController {
    pub config: ReactiveSignal<ModalConfig>,
    pub open: Callback<ModalContent>,
    pub close: Callback<()>,
}

pub fn calculate_position(
    position: ModalPosition,
    mouse_x: Option<f64>,
    mouse_y: Option<f64>,
    modal_width: f64,
    modal_height: f64,
    window_width: f64,
    window_height: f64,
) -> (f64, f64) {
    const OFFSET: f64 = 16.0;
    const PADDING: f64 = 16.0;

    fn mouse_pos(
        mouse_x: Option<f64>,
        mouse_y: Option<f64>,
        window_width: f64,
        window_height: f64,
    ) -> (f64, f64) {
        (
            mouse_x.unwrap_or(window_width / 2.0),
            mouse_y.unwrap_or(window_height / 2.0),
        )
    }

    fn clamp_pos(
        x: f64,
        y: f64,
        w: f64,
        h: f64,
        window_width: f64,
        window_height: f64,
    ) -> (f64, f64) {
        let x = x.clamp(PADDING, window_width - w - PADDING);
        let y = y.clamp(PADDING, window_height - h - PADDING);
        (x, y)
    }

    match position {
        ModalPosition::Center => (
            (window_width - modal_width) / 2.0,
            (window_height - modal_height) / 2.0,
        ),
        ModalPosition::TopLeft => {
            let (mx, my) = mouse_pos(mouse_x, mouse_y, window_width, window_height);
            clamp_pos(
                mx - OFFSET,
                my - OFFSET - modal_height,
                modal_width,
                modal_height,
                window_width,
                window_height,
            )
        }
        ModalPosition::Top => {
            let (mx, my) = mouse_pos(mouse_x, mouse_y, window_width, window_height);
            clamp_pos(
                mx - modal_width / 2.0,
                my - OFFSET - modal_height,
                modal_width,
                modal_height,
                window_width,
                window_height,
            )
        }
        ModalPosition::TopRight => {
            let (mx, my) = mouse_pos(mouse_x, mouse_y, window_width, window_height);
            clamp_pos(
                mx + OFFSET,
                my - OFFSET - modal_height,
                modal_width,
                modal_height,
                window_width,
                window_height,
            )
        }
        ModalPosition::Right => {
            let (mx, my) = mouse_pos(mouse_x, mouse_y, window_width, window_height);
            clamp_pos(
                mx + OFFSET,
                my - modal_height / 2.0,
                modal_width,
                modal_height,
                window_width,
                window_height,
            )
        }
        ModalPosition::BottomRight => {
            let (mx, my) = mouse_pos(mouse_x, mouse_y, window_width, window_height);
            clamp_pos(
                mx + OFFSET,
                my + OFFSET,
                modal_width,
                modal_height,
                window_width,
                window_height,
            )
        }
        ModalPosition::Bottom => {
            let (mx, my) = mouse_pos(mouse_x, mouse_y, window_width, window_height);
            clamp_pos(
                mx - modal_width / 2.0,
                my + OFFSET,
                modal_width,
                modal_height,
                window_width,
                window_height,
            )
        }
        ModalPosition::BottomLeft => {
            let (mx, my) = mouse_pos(mouse_x, mouse_y, window_width, window_height);
            clamp_pos(
                mx - OFFSET - modal_width,
                my + OFFSET,
                modal_width,
                modal_height,
                window_width,
                window_height,
            )
        }
        ModalPosition::Left => {
            let (mx, my) = mouse_pos(mouse_x, mouse_y, window_width, window_height);
            clamp_pos(
                mx - OFFSET - modal_width,
                my - modal_height / 2.0,
                modal_width,
                modal_height,
                window_width,
                window_height,
            )
        }
    }
}

impl StyledComponent for ModalComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/modal.css"))
    }

    fn name() -> &'static str {
        "modal"
    }
}
