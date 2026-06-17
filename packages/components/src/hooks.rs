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

use tairitsu_hooks::{ReactiveSignal, use_effect, use_memo, use_ref, use_signal};
use tairitsu_vdom::Signal;

use crate::platform::{inner_width as platform_inner_width, on_resize};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Breakpoint {
    Mobile = 0,
    Tablet = 641,
    Desktop = 1024,
}

impl Breakpoint {
    #[must_use]
    pub fn min_width(&self) -> u32 {
        match self {
            Breakpoint::Mobile => 0,
            Breakpoint::Tablet => 641,
            Breakpoint::Desktop => 1024,
        }
    }

    #[must_use]
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
    #[must_use]
    pub fn is_mobile(&self) -> bool {
        matches!(self, ScreenSize::Mobile)
    }

    #[must_use]
    pub fn is_tablet_or_larger(&self) -> bool {
        matches!(self, ScreenSize::Tablet | ScreenSize::Desktop)
    }

    #[must_use]
    pub fn is_desktop_or_larger(&self) -> bool {
        matches!(self, ScreenSize::Desktop)
    }
}

pub fn use_screen_size() -> ReactiveSignal<ScreenSize> {
    let screen_size = use_signal(get_screen_size_from_window);
    let cleanup_gen = use_ref(0u64);

    use_effect({
        let screen_size = screen_size.clone();
        let generation = cleanup_gen.clone();
        move || {
            let ss = screen_size.clone();
            let gen_ref = generation.clone();
            let my_gen = {
                let mut g = generation.current_mut();
                *g += 1;
                *g
            };
            on_resize(move || {
                if *gen_ref.current() == my_gen {
                    ss.set(get_screen_size_from_window());
                }
            });
        }
    });

    screen_size
}

#[must_use]
pub fn use_is_mobile() -> Signal<bool> {
    let screen_size = use_screen_size();
    use_memo(move || screen_size.read().is_mobile()).value()
}

#[must_use]
pub fn use_is_desktop() -> Signal<bool> {
    let screen_size = use_screen_size();
    use_memo(move || screen_size.read().is_desktop_or_larger()).value()
}

fn get_screen_size_from_window() -> ScreenSize {
    let width = platform_inner_width() as u32;
    if width < Breakpoint::Tablet.min_width() {
        ScreenSize::Mobile
    } else if width < Breakpoint::Desktop.min_width() {
        ScreenSize::Tablet
    } else {
        ScreenSize::Desktop
    }
}

#[must_use]
pub fn use_media_query(min_width: Option<u32>, max_width: Option<u32>) -> ReactiveSignal<bool> {
    let matches = use_signal(|| check_media_query(min_width, max_width));
    let cleanup_gen = use_ref(0u64);

    use_effect({
        let matches = matches.clone();
        let generation = cleanup_gen.clone();
        move || {
            let m = matches.clone();
            let gen_ref = generation.clone();
            let my_gen = {
                let mut g = generation.current_mut();
                *g += 1;
                *g
            };
            on_resize(move || {
                if *gen_ref.current() == my_gen {
                    m.set(check_media_query(min_width, max_width));
                }
            });
        }
    });

    matches
}

fn check_media_query(min_width: Option<u32>, max_width: Option<u32>) -> bool {
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
