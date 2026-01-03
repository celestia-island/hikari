// hikari-theme/src/lib.rs
// Hikari theme package

pub mod context;
pub mod generated;
pub mod provider;

pub use context::*;
pub use provider::*;

/// Tailwind CSS framework bundle
///
/// This provides access to Tailwind CSS utility classes for consistent styling.
/// All Hikari components are built using Tailwind CSS class names.
pub const TAILWIND_CSS: &str = include_str!("../styles/tailwind-bundle.css");

/// Get Tailwind CSS bundle
///
/// Returns the full Tailwind CSS framework.
pub fn get_tailwind_css() -> &'static str {
    TAILWIND_CSS
}
