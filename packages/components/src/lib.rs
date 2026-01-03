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
//! hikari-components = { features = ["basic"] }
//! ```
//!
//! Enable specific components:
//! ```toml
//! [dependencies]
//! hikari-components = { features = ["button", "input", "card"] }
//! ```
//!
//! ## Modules
//!
//! - [`basic`] - Basic UI components
//! - [`feedback`] - Feedback and notification components
//! - [`navigation`] - Navigation and routing components
//! - [`data`] - Data display and table components
//! - [`styled`] - Styling infrastructure traits

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
    feature = "pagination",
    feature = "virtual-scroll",
    feature = "collapse",
    feature = "drag",
    feature = "sort",
    feature = "filter",
    feature = "selection"
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
