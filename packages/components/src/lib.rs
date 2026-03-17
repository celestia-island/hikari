//! # Hikari Components Library
//!
//! Comprehensive UI component library with Arknights-style design
//! and FUI (Future User Interface) aesthetics.
//!
//! Built on Tairitsu framework.

// Core modules
pub mod basic;
pub mod display;
pub mod feedback;
pub mod navigation;
pub mod data;
pub mod entry;
pub mod production;
pub mod portal;
pub mod hooks;
pub mod utils;

// Re-exports
pub use basic::*;
pub use display::*;
pub use feedback::*;
pub use navigation::*;
pub use data::*;
pub use entry::*;
pub use production::*;

// Theme system
pub mod theme;
pub use theme::{
    ComponentOverrides, ComponentPalette, IntoTheme, LayoutDirection, ThemeContext,
    ThemePalette, ThemeProvider, get_default_theme, get_registered_theme, prefers_dark_mode,
    register_theme, use_layout_direction, use_theme,
};

// Portal system
pub use portal::{
    PortalEntry, PortalMaskMode, PortalPositionStrategy, PortalProvider, TriggerPlacement,
    generate_portal_id, use_portal,
};

// Re-export tairitsu prelude for convenience
pub use tairitsu_vdom::{
    VNode, VElement, VText, Classes, Style,
    Signal, batch, create_effect,
    EventData, MouseEvent, KeyboardEvent, InputEvent, FocusEvent, ChangeEvent,
    ElementHandle, EventHandle, Platform,
};

pub use tairitsu_hooks::{
    use_signal, use_state, use_effect, use_ref, use_context,
    provide_context, consume_context, Context, UseRef,
    use_animation, use_simple_animation, AnimationConfig, AnimationDirection, AnimationState, EasingFunction,
};

pub use tairitsu_macros::{rsx, component};

/// # Hierarchical Theme System
///
/// Hikari components support a powerful hierarchical theme system that allows
/// you to use different themes at different levels of your application.
///
/// ## Basic Usage
///
/// ```rust,ignore
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
/// ```rust,ignore
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
/// ```rust,ignore
/// use hikari_components::use_theme;
///
/// fn MyComponent() -> VNode {
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

/// Get complete CSS bundle (utility classes + component styles)
///
/// This is a convenience function that combines utility classes
/// with all registered component styles.
#[deprecated(note = "Utility classes are now managed by the CSS bundle. Use CSS classes directly.")]
pub fn get_utility_classes() -> &'static str {
    "" // Utility classes are now in the SCSS bundle
}
