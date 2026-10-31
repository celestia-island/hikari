//! hi-components/src/feedback/mod.rs
//! Feedback components. The family is mirrored from the canonical Vue
//! implementation: each mirrored component compiles the SAME stylesheet the
//! Vue library ships (vendored under `styles/vue-mirror/`, kept in sync by
//! `scripts/sync-vue-mirror.py` + `tests/vue_mirror_drift_tests.rs`).
//!
//! Retired with the mirror wave (2026-11): the legacy `Spin` implementation
//! (replaced by the `HkSpinner` mirror in `spinner.rs`).

pub mod alert;
pub mod drawer;
pub mod glow;
pub mod modal;
pub mod popover;
pub mod progress;
pub mod spinner;
pub mod toast;
pub mod tooltip;

pub use alert::*;
pub use drawer::*;
pub use glow::*;
// Re-exports for backward compatibility
pub use glow::{Glow as Acrylic, GlowBlur as AcrylicBlur, GlowColor as AcrylicMode};
pub use modal::*;
// Modal re-exports for external components
pub use modal::{ModalConfig, ModalContent, ModalController, ModalPosition, use_modal};
pub use popover::*;
pub use progress::*;
pub use spinner::*;
pub use toast::*;
pub use tooltip::*;
