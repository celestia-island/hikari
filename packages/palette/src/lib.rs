//! Hikari Palette
//!
//! Chinese traditional color palette library with 500+ predefined colors.
//!
//! This crate provides a comprehensive collection of traditional Chinese colors,
//! including their hex codes, RGB values, and color categories.
//!
//! ## Modules
//!
//! - [`colors`] - Individual color definitions (500+ traditional colors)
//! - [`themes`] - Theme palettes (Hikari & Tairitsu)
//! - [`classes`] - Type-safe utility class system with hierarchical enums
//!
//! ## Usage
//!
//! ```rust,no_run
//! use palette::{朱红, themes::Hikari};
//! use palette::classes::*;
//!
//! // Use a specific color
//! let red = 朱红;
//! println!("{:?}", red.hex());
//!
//! // Use a theme
//! let theme = Hikari::default();
//! println!("{:?}", theme.primary.hex());
//!
//! // Use utility classes
//! use palette::ClassesBuilder;
//! let classes = ClassesBuilder::new()
//!     .add(Display::Flex)
//!     .add(FlexDirection::Row)
//!     .add(Gap::Gap4)
//!     .build();
//! // Output: "hi-flex hi-flex-row hi-gap-4"
//! ```

pub mod classes;
pub mod colors;
pub mod themes;

pub use classes::*;
pub use colors::*;
pub use themes::*;
