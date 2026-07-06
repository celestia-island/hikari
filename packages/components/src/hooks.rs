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

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use crate::platform::{inner_width as platform_inner_width, on_resize};
use crate::prelude::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Breakpoint {
    Mobile = 0,
    Tablet = 641,
    Desktop = 1024,
}

impl Breakpoint {
    pub fn min_width(&self) -> u32 {
        match self {
            Breakpoint::Mobile => 0,
            Breakpoint::Tablet => 641,
            Breakpoint::Desktop => 1024,
        }
    }

    pub fn max_width(&self) -> Option<u32> {
        match self {
            Breakpoint::Mobile => Some(640),
            Breakpoint::Tablet => Some(1023),
            Breakpoint::Desktop => None,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ScreenSize {
    Mobile,
    Tablet,
    Desktop,
}

impl ScreenSize {
    pub fn is_mobile(&self) -> bool {
        matches!(self, ScreenSize::Mobile)
    }

    pub fn is_tablet_or_larger(&self) -> bool {
        matches!(self, ScreenSize::Tablet | ScreenSize::Desktop)
    }

    pub fn is_desktop_or_larger(&self) -> bool {
        matches!(self, ScreenSize::Desktop)
    }
}

pub fn use_screen_size() -> Signal<ScreenSize> {
    let screen_size = use_signal(get_screen_size_from_window);

    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    {
        let screen_size = screen_size.clone();
        use_effect(move || {
            let screen_size = screen_size.clone();
            on_resize(move || {
                screen_size.set(get_screen_size_from_window());
            });
        });
    }

    screen_size.inner().clone()
}

pub fn use_is_mobile() -> Signal<bool> {
    let screen_size = use_screen_size();
    use_memo(move || screen_size.read().is_mobile())
        .signal()
        .clone()
}

pub fn use_is_desktop() -> Signal<bool> {
    let screen_size = use_screen_size();
    use_memo(move || screen_size.read().is_desktop_or_larger())
        .signal()
        .clone()
}

fn get_screen_size_from_window() -> ScreenSize {
    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    {
        let width = platform_inner_width() as u32;
        match width {
            0..=640 => ScreenSize::Mobile,
            641..=1023 => ScreenSize::Tablet,
            1024.. => ScreenSize::Desktop,
        }
    }
    #[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
    {
        ScreenSize::Desktop
    }
}

pub fn use_media_query(min_width: Option<u32>, max_width: Option<u32>) -> Signal<bool> {
    let matches = use_signal(|| check_media_query(min_width, max_width));

    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    {
        let matches = matches.clone();
        use_effect(move || {
            let matches = matches.clone();
            on_resize(move || {
                matches.set(check_media_query(min_width, max_width));
            });
        });
    }

    matches.inner().clone()
}

fn check_media_query(min_width: Option<u32>, max_width: Option<u32>) -> bool {
    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    {
        let width = platform_inner_width() as u32;

        if let Some(min) = min_width
            && width < min
        {
            return false;
        }

        if let Some(max) = max_width
            && width > max
        {
            return false;
        }

        true
    }
    #[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
    {
        let _ = (min_width, max_width);
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
