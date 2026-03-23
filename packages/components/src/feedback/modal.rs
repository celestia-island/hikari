// hi-components/src/feedback/modal.rs
// Modal component using Portal system

use std::sync::atomic::{AtomicU64, Ordering};

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use crate::platform::set_timeout;
use crate::prelude::*;

use crate::{
    portal::{use_portal, PortalEntry},
    styled::StyledComponent,
};

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
        let remove_entry = portal.remove_entry;
        let start_close = portal.start_close_animation;
        let cfg = config.clone();
        Callback::new(move |_| {
            let id = cfg.read().id.clone();
            start_close.call(id.clone());

            #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
            {
                let remove = remove_entry.clone();
                let id_timeout = id.clone();
                set_timeout(
                    move || {
                        remove.call(id_timeout);
                    },
                    200,
                );
            }

            #[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
            {
                remove_entry.call(id);
            }
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
    pub config: Signal<ModalConfig>,
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

    match position {
        ModalPosition::Center => (
            (window_width - modal_width) / 2.0,
            (window_height - modal_height) / 2.0,
        ),
        _ => {
            let mx = mouse_x.unwrap_or(window_width / 2.0);
            let my = mouse_y.unwrap_or(window_height / 2.0);

            let (mut x, mut y) = match position {
                ModalPosition::TopLeft => (mx - OFFSET, my - OFFSET - modal_height),
                ModalPosition::Top => (mx - modal_width / 2.0, my - OFFSET - modal_height),
                ModalPosition::TopRight => (mx + OFFSET, my - OFFSET - modal_height),
                ModalPosition::Right => (mx + OFFSET, my - modal_height / 2.0),
                ModalPosition::BottomRight => (mx + OFFSET, my + OFFSET),
                ModalPosition::Bottom => (mx - modal_width / 2.0, my + OFFSET),
                ModalPosition::BottomLeft => (mx - OFFSET - modal_width, my + OFFSET),
                ModalPosition::Left => (mx - OFFSET - modal_width, my - modal_height / 2.0),
                ModalPosition::Center => unreachable!(),
            };

            if x < PADDING {
                x = PADDING;
            } else if x + modal_width > window_width - PADDING {
                x = window_width - modal_width - PADDING;
            }

            if y < PADDING {
                y = PADDING;
            } else if y + modal_height > window_height - PADDING {
                y = window_height - modal_height - PADDING;
            }

            (x, y)
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
