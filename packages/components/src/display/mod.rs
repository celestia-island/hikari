// Display components module
//!
//! Provides data display components with Arknights-style design
//! and FUI aesthetics.
//!
//! ## Components
//!
//! - [`Tag`] - Tag labels with optional close button
//! - [`Skeleton`] / [`Empty`] - Skeleton loading states
//! - [`Comment`] - Comment/feedback display
//! - [`QRCode`] - QR code display
//! - [`Calendar`] - Date picker with calendar grid
//! - [`Timeline`] - Vertical timeline for events
//! - [`UserGuide`] - Step-by-step user onboarding
//! - [`DragLayer`] - Drag and drop visualization layer
//! - [`ZoomControls`] - Zoom in/out controls

pub mod calendar;
pub mod comment;
pub mod drag_layer;
pub mod empty;
pub mod qrcode;
pub mod skeleton;
pub mod tag;
pub mod timeline;
pub mod user_guide;
pub mod zoom_controls;

pub use calendar::*;
pub use comment::*;
pub use drag_layer::*;
pub use empty::*;
pub use qrcode::*;
pub use skeleton::*;
pub use tag::*;
pub use timeline::*;
pub use user_guide::*;
pub use zoom_controls::*;
