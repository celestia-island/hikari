//! Responsive hooks for Hikari components
//!
//! This module provides hooks for responsive design and media queries,
//! allowing components to adapt to different screen sizes.
//!
//! # Breakpoints
//!
//! - **Mobile**: 0-640px
//! - **Tablet**: 641-1023px
//! - **Desktop**: ≥1024px

use dioxus::prelude::*;
use wasm_bindgen::prelude::*;

/// Breakpoint definitions for responsive design
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Breakpoint {
    Mobile = 0,
    Tablet = 641,
    Desktop = 1024,
}

impl Breakpoint {
    /// Get the minimum width in pixels for this breakpoint
    pub fn min_width(&self) -> u32 {
        match self {
            Breakpoint::Mobile => 0,
            Breakpoint::Tablet => 641,
            Breakpoint::Desktop => 1024,
        }
    }

    /// Get the maximum width in pixels for this breakpoint
    pub fn max_width(&self) -> Option<u32> {
        match self {
            Breakpoint::Mobile => Some(640),
            Breakpoint::Tablet => Some(1023),
            Breakpoint::Desktop => None,
        }
    }
}

/// Screen size category
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ScreenSize {
    Mobile,
    Tablet,
    Desktop,
}

impl ScreenSize {
    /// Check if this is a mobile screen
    pub fn is_mobile(&self) -> bool {
        matches!(self, ScreenSize::Mobile)
    }

    /// Check if this is a tablet or larger
    pub fn is_tablet_or_larger(&self) -> bool {
        matches!(self, ScreenSize::Tablet | ScreenSize::Desktop)
    }

    /// Check if this is a desktop or larger
    pub fn is_desktop_or_larger(&self) -> bool {
        matches!(self, ScreenSize::Desktop)
    }
}

/// Hook to get the current screen size
///
/// This hook monitors window resize events and returns the current screen size category.
///
/// # Example
///
/// ```rust,no_run
/// use hikari_components::hooks::use_screen_size;
///
/// fn App() -> Element {
///     let screen_size = use_screen_size();
///
///     rsx! {
///         div {
///             style: if screen_size.is_mobile() {
///                 "font-size: 14px;"
///             } else {
///                 "font-size: 16px;"
///             },
///             {format!("{:?}", screen_size)}
///         }
///     }
/// }
/// ```
pub fn use_screen_size() -> Signal<ScreenSize> {
    let screen_size = use_signal(get_screen_size_from_window);

    // Set up resize listener
    use_effect(move || {
        let window = web_sys::window().expect("no window");
        let mut screen_size = screen_size;

        let closure = Closure::wrap(Box::new(move || {
            screen_size.set(get_screen_size_from_window());
        }) as Box<dyn FnMut()>);

        window
            .add_event_listener_with_callback("resize", closure.as_ref().unchecked_ref())
            .expect("failed to add resize listener");

        // Store closure for cleanup
        closure.forget();
    });

    screen_size
}

/// Hook to check if the current screen is mobile
///
/// # Example
///
/// ```rust,no_run
/// use dioxus::prelude::*;
/// use hikari_components::hooks::use_is_mobile;
///
/// fn Sidebar() -> Element {
///     let is_mobile = use_is_mobile();
///
///     rsx! {
///         div {
///             style: if *is_mobile { "display: none;" } else { "display: block;" }
///         }
///     }
/// }
/// ```
pub fn use_is_mobile() -> Memo<bool> {
    let screen_size = use_screen_size();
    use_memo(move || screen_size.read().is_mobile())
}

/// Hook to check if the current screen is desktop or larger
///
/// # Example
///
/// ```rust,no_run
/// use dioxus::prelude::*;
/// use hikari_components::hooks::use_is_desktop;
///
/// fn Layout() -> Element {
///     let is_desktop = use_is_desktop();
///
///     rsx! {
///         div {
///             // Only show sidebar on desktop
///             style: if *is_desktop { "display: flex;" } else { "display: none;" }
///         }
///     }
/// }
/// ```
pub fn use_is_desktop() -> Memo<bool> {
    let screen_size = use_screen_size();
    use_memo(move || screen_size.read().is_desktop_or_larger())
}

/// Get screen size from browser window
fn get_screen_size_from_window() -> ScreenSize {
    if let Some(window) = web_sys::window() {
        let width_result = window.inner_width();
        let width = match width_result {
            Ok(w) => w.as_f64().unwrap_or(0.0) as u32,
            Err(_) => 0,
        };

        match width {
            0..=640 => ScreenSize::Mobile,
            641..=1023 => ScreenSize::Tablet,
            1024.. => ScreenSize::Desktop,
        }
    } else {
        // Default to desktop for SSR
        ScreenSize::Desktop
    }
}

/// Hook to get media query state for custom breakpoints
///
/// # Arguments
///
/// * `min_width` - Minimum width in pixels (None for no minimum)
/// * `max_width` - Maximum width in pixels (None for no maximum)
///
/// # Example
///
/// ```rust,no_run
/// use hikari_components::hooks::use_media_query;
///
/// fn Component() -> Element {
///     let is_medium = use_media_query(Some(768), Some(1023));
///
///     rsx! {
///         div {
///             style: if *is_medium { "background: blue;" } else { "background: red;" }
///         }
///     }
/// }
/// ```
pub fn use_media_query(min_width: Option<u32>, max_width: Option<u32>) -> Signal<bool> {
    let matches = use_signal(|| check_media_query(min_width, max_width));

    use_effect(move || {
        let window = web_sys::window().expect("no window");
        let mut matches = matches;

        let closure = Closure::wrap(Box::new(move || {
            matches.set(check_media_query(min_width, max_width));
        }) as Box<dyn FnMut()>);

        window
            .add_event_listener_with_callback("resize", closure.as_ref().unchecked_ref())
            .expect("failed to add resize listener");

        // Store closure for cleanup
        closure.forget();
    });

    matches
}

/// Check if the current window matches the media query criteria
fn check_media_query(min_width: Option<u32>, max_width: Option<u32>) -> bool {
    if let Some(window) = web_sys::window() {
        let width_result = window.inner_width();
        let width = match width_result {
            Ok(w) => w.as_f64().unwrap_or(0.0) as u32,
            Err(_) => 0,
        };

        if let Some(min) = min_width
            && width < min {
                return false;
            }

        if let Some(max) = max_width
            && width > max {
                return false;
            }

        true
    } else {
        // Default to false for SSR
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_breakpoint_widths() {
        assert_eq!(Breakpoint::Mobile.min_width(), 0);
        assert_eq!(Breakpoint::Mobile.max_width(), Some(640));
        assert_eq!(Breakpoint::Tablet.min_width(), 641);
        assert_eq!(Breakpoint::Tablet.max_width(), Some(1023));
        assert_eq!(Breakpoint::Desktop.min_width(), 1024);
        assert_eq!(Breakpoint::Desktop.max_width(), None);
    }

    #[test]
    fn test_screen_size_checks() {
        assert!(ScreenSize::Mobile.is_mobile());
        assert!(!ScreenSize::Mobile.is_tablet_or_larger());
        assert!(!ScreenSize::Mobile.is_desktop_or_larger());

        assert!(!ScreenSize::Desktop.is_mobile());
        assert!(ScreenSize::Desktop.is_tablet_or_larger());
        assert!(ScreenSize::Desktop.is_desktop_or_larger());
    }
}
