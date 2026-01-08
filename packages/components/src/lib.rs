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

// Theme provider (always available)
pub mod theme_provider;

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

// Theme provider exports
pub use theme_provider::{prefers_dark_mode, use_theme, ThemeContext, ThemePalette, ThemeProvider};

/// # Hierarchical Theme System
///
/// Hikari components support a powerful hierarchical theme system that allows
/// you to use different themes at different levels of your application.
///
/// ## Basic Usage
///
/// ```rust,no_run
/// use hikari_components::ThemeProvider;
///
/// rsx! {
///     ThemeProvider { palette: "hikari" } {
///         // Your entire app uses Hikari (light) theme
///     }
/// }
/// ```
///
/// ## Nested Providers (Local Theme Override)
///
/// ```rust,no_run
/// rsx! {
///     ThemeProvider { palette: "hikari" } {
///         // Most of the app uses Hikari (light) theme
///
///         Sidebar { }
///
///         div {
///             ThemeProvider { palette: "tairitsu" } {
///                 // This section uses Tairitsu (dark) theme
///                 DarkWidget { }
///             }
///         }
///     }
/// }
/// ```
///
/// ## Accessing Theme in Components
///
/// ```rust,no_run
/// use hikari_components::use_theme;
///
/// fn MyComponent() -> Element {
///     let theme = use_theme();  // Always returns a ThemeContext
///
///     rsx! {
///         div {
///             style: "color: {theme.palette.primary}",
///             "Themed content"
///         }
///     }
/// }
/// ```
///
/// If called outside of a `ThemeProvider`, `use_theme()` returns a default
/// theme based on system color scheme (Hikari for light mode, Tairitsu for
/// dark mode) and logs a warning to the browser console.
///
/// For detailed documentation, see:
/// - `packages/components/docs/HIERARCHICAL_THEME.md`
/// - `ThemeProvider` component documentation

/// Get Hikari utility classes CSS
///
/// Returns the complete utility class system (similar to Tailwind CSS but independent).
/// These are basic utility classes for layout, spacing, typography, etc.
#[deprecated(note = "Utility classes are now managed by the CSS bundle. Use CSS classes directly.")]
pub fn get_utility_classes() -> &'static str {
    "" // Utility classes are now in the SCSS bundle
}

/// Get complete CSS bundle (utility classes + component styles)
///
/// This is a convenience function that combines utility classes
/// with all registered component styles.
pub fn get_complete_bundle(registry: &StyleRegistry) -> String {
    registry.css_bundle()
}
