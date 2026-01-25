//! # Hikari Components Library
//!
//! Comprehensive UI component library with Arknights-style design
//! and FUI (Future User Interface) aesthetics.
//!
//! ## Overview
//!
//! `hikari-components` provides:
//!
//! - **Basic Components** - Button, Input, Card, Badge
//! - **Feedback Components** - Alert, Toast, Tooltip
//! - **Navigation Components** - Menu, Tabs, Breadcrumb
//! - **Data Components** - Table, Tree, Pagination (with modular sub-components)
//! - **Layout Components** - Layout, Header, Aside, Content, Footer
//! - **Arknights + FUI Styling** - Consistent design language
//! - **Type-Safe Props** - Full TypeScript-like safety in Rust
//! - **Accessible** - WCAG compliant components
//!
//! ## Design Philosophy
//!
//! Hikari components follow these design principles:
//!
//! ### Arknights Aesthetics
//! - Clean lines and clear information hierarchy
//! - High contrast for readability
//! - Minimalist yet refined design
//!
//! ### FUI (Future User Interface)
//! - Subtle glow effects (box-shadow, text-shadow)
//! - Dynamic indicators (breathing lights, pulse animations)
//! - Fine borders (1px semi-transparent)
//! - Geometric patterns (hexagons, grids)
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
//! ## Quick Start
//!
//! ### Basic Usage
//!
//! ```rust,no_run
//! use dioxus::prelude::*;
//! use hikari_components::*;
//! use hikari_theme::ThemeProvider;
//!
//! fn app() -> Element {
//!     rsx! {
//!         ThemeProvider { palette: "arknights".to_string(),
//!             div { class: "container",
//!                 Button { variant: ButtonVariant::Primary, "Click Me" }
//!                 Card {
//!                     header: rsx! { h2 { "Card Title" } },
//!                     "Card content goes here"
//!                 }
//!             }
//!         }
//!     }
//! }
//! ```
//!
//! ## Modules
//!
//! - [`layout`] - Layout components (Layout, Header, Aside, Content, Footer)
//! - [`hooks`] - Responsive design hooks and media queries
//! - [`basic`] - Basic UI components
//! - [`feedback`] - Feedback and notification components
//! - [`navigation`] - Navigation and routing components
//! - [`data`] - Data display and table components
//! - [`styled`] - Styling infrastructure traits
//! - [`utils`] - Utility modules (positioning, etc.)

// Styling infrastructure (always available)
pub mod styled;

// Layout components (always available)
pub mod layout;

// Theme provider (always available)
pub mod theme_provider;

// Responsive hooks (always available)
pub mod hooks;

// JavaScript utilities (always available)
pub mod scripts;

// Utility modules (always available)
pub mod utils;

// Portal system (always available)
pub mod portal;

// Feature-gated modules
#[cfg(any(
    feature = "basic",
    feature = "button",
    feature = "input",
    feature = "card",
    feature = "badge",
    feature = "checkbox",
    feature = "radio_group",
    feature = "switch",
    feature = "slider",
    feature = "textarea",
    feature = "file_upload",
    feature = "form_field",
    feature = "date_picker"
))]
pub mod basic;

#[cfg(any(
    feature = "display",
    feature = "tag",
    feature = "empty",
    feature = "comment",
    feature = "description_list",
    feature = "qrcode"
))]
pub mod display;

// Re-export display components when display feature is enabled
#[cfg(any(
    feature = "display",
    feature = "avatar",
    feature = "comment",
    feature = "description_list",
    feature = "empty",
    feature = "image",
    feature = "qrcode",
    feature = "tag"
))]
pub use display::*;

#[cfg(any(
    feature = "feedback",
    feature = "alert",
    feature = "toast",
    feature = "tooltip",
    feature = "modal",
    feature = "popover",
    feature = "drawer",
    feature = "dropdown",
    feature = "progress",
    feature = "skeleton",
    feature = "spin",
    feature = "spotlight",
    feature = "glow"
))]
pub mod feedback;

#[cfg(any(
    feature = "navigation",
    feature = "menu",
    feature = "tabs",
    feature = "breadcrumb",
    feature = "steps"
))]
pub mod navigation;

#[cfg(any(
    feature = "data",
    feature = "table",
    feature = "tree",
    feature = "pagination"
))]
pub mod data;

// Re-export data components when data feature is enabled
#[cfg(any(
    feature = "data",
    feature = "table",
    feature = "tree",
    feature = "pagination"
))]
pub use data::*;

#[cfg(any(
    feature = "entry",
    feature = "number_input",
    feature = "search",
    feature = "cascader",
    feature = "transfer"
))]
pub mod entry;

// Re-export entry components when entry feature is enabled
#[cfg(any(feature = "entry", feature = "number_input", feature = "search"))]
pub use entry::*;

// Re-export basic components when basic feature is enabled
#[cfg(feature = "basic")]
pub use basic::*;

// Re-export navigation components when navigation feature is enabled
#[cfg(feature = "navigation")]
pub use navigation::*;

// Re-export feedback components when feedback feature is enabled
#[cfg(feature = "feedback")]
pub use feedback::*;

// Re-export display components when display feature is enabled
#[cfg(feature = "display")]
#[allow(unused_imports)]
pub use display::*;

pub use icons::{Icon, MdiIcon};
pub use styled::{StyleRegistry, StyledComponent};

// Utility exports
pub use utils::positioning::{
    use_position, OverlayZIndex, Placement, PositionConfig, PositionStrategy, UsePositionReturn,
};

// Theme provider exports
pub use theme_provider::{
    get_default_theme, get_registered_theme, prefers_dark_mode, register_theme, use_theme,
    ThemeContext, ThemePalette, ThemeProvider,
};

// Portal exports
pub use portal::{
    generate_portal_id, use_portal, PortalEntry, PortalMaskMode, PortalPositionStrategy,
    PortalProvider, TriggerPlacement,
};

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
