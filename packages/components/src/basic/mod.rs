//! Basic components module
//!
//! Provides fundamental UI components with Arknights-style design
//! and FUI aesthetics.
//!
//! ## Components
//!
//! - [`Badge`] - Small status indicators and labels
//! - [`Button`] - Interactive button with multiple variants
//! - [`Card`] - Content container with optional header
//! - [`Input`] - Text input with styling support

pub mod badge;
pub mod button;
pub mod card;
pub mod input;

pub use badge::*;
pub use button::*;
pub use card::*;
pub use input::*;
