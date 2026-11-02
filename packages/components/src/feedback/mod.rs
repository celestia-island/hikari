//! hi-components/src/feedback/mod.rs
//! Feedback components. The family is mirrored from the canonical Vue
//! implementation: each mirrored component compiles the SAME stylesheet the
//! Vue library ships (vendored under `styles/vue-mirror/`, kept in sync by
//! `scripts/sync-vue-mirror.py` + `tests/vue_mirror_drift_tests.rs`).
//!
//! Retired with the mirror wave (2026-11): the legacy `Spin` implementation
//! (replaced by the `HkSpinner` mirror in `spinner.rs`) and the legacy
//! `Progress` component (split into the `HkProgressBar` / `HkProgressRing`
//! mirrors in `progress_bar.rs` / `progress_ring.rs`).

pub mod alert;
pub mod blocking_toast;
pub mod confirm_dialog;
pub mod drawer;
pub mod glow;
pub mod loading_veil;
pub mod message_box;
pub mod modal;
pub mod persistent_toast;
pub mod persistent_toast_group;
pub mod phase_transition;
pub mod popover;
pub mod progress_bar;
pub mod progress_dialog;
pub mod progress_ring;
pub mod spinner;
pub mod toast;
pub mod tooltip;

pub use alert::*;
pub use blocking_toast::*;
pub use confirm_dialog::*;
pub use drawer::*;
pub use glow::*;
pub use loading_veil::*;
pub use phase_transition::*;
// Re-exports for backward compatibility
pub use glow::{Glow as Acrylic, GlowBlur as AcrylicBlur, GlowColor as AcrylicMode};
pub use message_box::*;
pub use modal::*;
pub use persistent_toast::*;
pub use persistent_toast_group::*;
pub use popover::*;
pub use progress_bar::*;
pub use progress_dialog::*;
pub use progress_ring::*;
pub use spinner::*;
pub use toast::*;
pub use tooltip::*;
