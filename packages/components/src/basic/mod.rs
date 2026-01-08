//! Basic components module
//!
//! Provides fundamental UI components with Arknights-style design
//! and FUI aesthetics.
//!
//! ## Components
//!
//! - [`Avatar`] - User profile image with fixed sizes
//! - [`Badge`] - Small status indicators and labels
//! - [`Button`] - Interactive button with multiple variants
//! - [`Card`] - Content container with optional header
//! - [`Image`] - Image with configurable fit modes
//! - [`Input`] - Text input with styling support
//! - [`Logo`] - App logo component

pub mod avatar;
pub mod badge;
pub mod button;
pub mod card;
pub mod image;
pub mod input;

pub use avatar::*;
pub use badge::*;
pub use button::*;
pub use card::*;
pub use image::*;
pub use input::*;
