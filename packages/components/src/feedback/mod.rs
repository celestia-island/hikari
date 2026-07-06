//! hi-components/src/feedback/mod.rs
//! Feedback components: Alert, Toast, Tooltip, Glow, Popover, Drawer, Spin, Progress
//!
//! Arknights + FUI styling:
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
pub use modal::*;
pub use popover::*;
pub use progress::*;
pub use spin::*;
pub use toast::*;
pub use tooltip::*;

// Re-exports for backward compatibility
pub use glow::{Glow as Acrylic, GlowBlur as AcrylicBlur, GlowColor as AcrylicMode};

// Modal re-exports for external components
pub use modal::{ModalConfig, ModalContent, ModalController, ModalPosition, use_modal};
