// Display components module
//!
//! Provides data display components with Arknights-style design
//! and FUI aesthetics.
//!
//! ## Components
//!
//! - [`Tag`] - Tag labels with optional close button
//! - [`Empty`] - Empty state illustration
//! - [`Comment`] - Comment/feedback display
//! - [`DescriptionList`] - Key-value display
//! - [`QRCode`] - QR code display
//! - [`Calendar`] - Date picker with calendar grid
//! - [`Timeline`] - Vertical timeline for events
//! - [`UserGuide`] - Step-by-step user onboarding

pub mod calendar;
pub mod comment;
pub mod description_list;
pub mod empty;
pub mod qrcode;
pub mod tag;
pub mod timeline;
pub mod user_guide;

pub use calendar::*;
pub use comment::*;
pub use description_list::*;
pub use empty::*;
pub use qrcode::*;
pub use tag::*;
pub use timeline::*;
pub use user_guide::*;
