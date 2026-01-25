// hi-components/src/feedback/modal.rs
// Modal component using Portal system

use dioxus::prelude::*;
use std::sync::atomic::{AtomicU64, Ordering};

use crate::portal::{use_portal, PortalEntry};
use crate::styled::StyledComponent;

static MODAL_ID_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Modal 组件的类型包装器（用于实现 StyledComponent）
pub struct ModalComponent;

/// Modal 定位方式
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ModalPosition {
    /// 屏幕中间居中
    #[default]
    Center,

    /// 基于鼠标坐标的八个方位
    TopLeft,
    Top,
    TopRight,
    Right,
    BottomRight,
    Bottom,
    BottomLeft,
    Left,
}

/// Modal 遮掩方式
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MaskMode {
    /// 变黑蒙版（阻塞式 modal，如对话框）
    #[default]
    Opaque,

    /// 穿透透明（非阻塞式 modal，如 toast）
    Transparent,
}

/// Modal 实例配置
#[derive(Clone, PartialEq)]
pub struct ModalConfig {
    pub id: String,
    pub position: ModalPosition,
    pub mask_mode: MaskMode,
    pub closable: bool,
    pub mask_closable: bool,
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
            class: String::new(),
        }
    }
}

/// Hook for controlling a modal instance
pub fn use_modal(initial_config: ModalConfig) -> ModalController {
    let portal = use_portal();
    let config = use_signal(|| initial_config);

    let open = {
        let add_entry = portal.add_entry.clone();
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
                children: content.children,
            };
            add_entry.call(entry);
        })
    };

    let close = {
        let remove_entry = portal.remove_entry.clone();
        let cfg = config.clone();
        Callback::new(move |_| {
            let id = cfg.read().id.clone();
            remove_entry.call(id);
        })
    };

    ModalController {
        config,
        open,
        close,
    }
}

/// Modal Content - Content to display in modal
#[derive(Clone, PartialEq)]
pub struct ModalContent {
    pub title: Option<String>,
    pub children: Element,
}

/// Modal Controller - 用于控制单个 modal 实例
#[derive(Clone)]
pub struct ModalController {
    pub config: Signal<ModalConfig>,
    pub open: Callback<ModalContent>,
    pub close: Callback<()>,
}

/// 计算智能定位后的实际位置（检测溢出并自动调整）
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
