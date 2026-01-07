//! Hikari Components Library
//!
//! Comprehensive UI component library with Arknights-style design
//! and FUI (Future User Interface) aesthetics.
//!
//! ## Features
//!
//! This library uses Cargo features to enable/disable component groups:
//!
//! - `basic` - Basic components (Button, Input, Card, Badge)
//! - `feedback` - Feedback components (Alert, Toast, Tooltip)
//! - `navigation` - Navigation components (Menu, Tabs, Breadcrumb)
//! - `data` - Data display components (Table, Tree, Pagination, etc.)
//!
//! ## Feature flags
//!
//! Enable all basic components:
//! ```toml
//! [dependencies]
//! hi-components = { features = ["basic"] }
//! ```
//!
//! Enable specific components:
//! ```toml
//! [dependencies]
//! hi-components = { features = ["button", "input", "card"] }
//! ```
//!
//! ## Modules
//!
//! - [`layout`] - Layout components (Layout, Header, Aside, Content)
//! - [`hooks`] - Responsive design hooks and media queries
//! - [`basic`] - Basic UI components
//! - [`feedback`] - Feedback and notification components
//! - [`navigation`] - Navigation and routing components
//! - [`data`] - Data display and table components
//! - [`styled`] - Styling infrastructure traits

// Layout components (always available)
pub mod layout;

// Responsive hooks (always available)
pub mod hooks;

// JavaScript utilities (always available)
pub mod scripts;

// Feature-gated modules
#[cfg(any(
    feature = "basic",
    feature = "button",
    feature = "input",
    feature = "card",
    feature = "badge"
))]
pub mod basic;

#[cfg(any(
    feature = "feedback",
    feature = "alert",
    feature = "toast",
    feature = "tooltip"
))]
pub mod feedback;

#[cfg(any(
    feature = "navigation",
    feature = "menu",
    feature = "tabs",
    feature = "breadcrumb"
))]
pub mod navigation;

#[cfg(any(
    feature = "data",
    feature = "table",
    feature = "tree",
    feature = "pagination"
))]
pub mod data;

pub mod styled;

// Conditional re-exports
#[cfg(feature = "basic")]
pub use basic::*;

#[cfg(feature = "feedback")]
pub use feedback::*;

#[cfg(feature = "navigation")]
pub use navigation::*;

#[cfg(feature = "data")]
pub use data::*;

pub use styled::{StyleRegistry, StyledComponent};

/// Get Hikari utility classes CSS
///
/// Returns the complete utility class system (similar to Tailwind CSS but independent).
/// These are basic utility classes for layout, spacing, typography, etc.
#[deprecated(note = "Utility classes are now managed by the CSS bundle. Use CSS classes directly.")]
pub fn get_utility_classes() -> &'static str {
    ""  // Utility classes are now in the SCSS bundle
}

/// Get complete CSS bundle (utility classes + component styles)
///
/// This is a convenience function that combines utility classes
/// with all registered component styles.
pub fn get_complete_bundle(registry: &StyleRegistry) -> String {
    registry.css_bundle()
}
