//! Feedback components: Alert, Toast, Tooltip, Glow, Popover, Drawer, Spin, Progress
//!
//!
//! - Shimmer animations
//! - Status-based visual feedback
//! - Gradient backgrounds with acrylic effect
//! - Smooth transitions

pub mod alert;
pub mod drawer;
pub mod glow;
pub mod modal;
pub mod popover;
pub mod progress;
pub mod spin;
pub mod toast;
pub mod tooltip;

pub use alert::*;
pub use drawer::*;
pub use glow::*;
pub use modal::{ModalConfig, ModalContent, ModalController, use_modal, *};
pub use popover::*;
pub use progress::*;
pub use spin::*;
pub use toast::*;
pub use tooltip::*;

pub use crate::feedback::glow::Glow as Acrylic;
pub use crate::utils::glow_types::{GlowBlur as AcrylicBlur, GlowColor as AcrylicColor};
pub use crate::utils::portal_types::{MaskMode, ModalPosition, ModalSize, PopoverPlacement};
