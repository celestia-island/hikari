//! Prefers-reduced-motion detection
//!
//! Provides functions to detect and monitor the user's system preference
//! for reduced motion.
//!
//! In WASI unified environment, this module currently provides a default
//! implementation. The tairitsu WIT interface does not currently expose
//! the `matchMedia` API needed for `prefers-reduced-motion` detection.
//!
//! When the WIT interface adds this capability, this module can be updated
//! to use it.

use std::cell::RefCell;
use std::rc::Rc;

use tairitsu_vdom::Platform;

/// Detect system prefers-reduced-motion setting
///
/// Currently returns false (no preference detected) as the WIT interface
/// does not expose the matchMedia API.
///
/// When available, this should use: `window.matchMedia("(prefers-reduced-motion: reduce)").matches()`
pub const fn prefers_reduced_motion<P: Platform>(_platform: &Rc<RefCell<P>>) -> bool {
    false
}

/// Watch for prefers-reduced-motion changes
///
/// Currently a no-op as the WIT interface does not expose the MediaQueryList API.
///
/// When available, this should use: `window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", callback)`
///
/// # Arguments
///
/// * `callback` - Function to call when preference changes
pub fn watch_prefers_reduced_motion<P: Platform>(
    _platform: &Rc<RefCell<P>>,
    _callback: impl Fn(bool) + 'static,
) {
}

/// Check if reduced motion should be applied
///
/// This is a convenience function that checks both the system preference
/// and any application-level override.
///
/// # Arguments
///
/// * `platform` - Platform reference
/// * `enabled_override` - Optional application-level override (Some(true) = always enabled)
pub fn should_reduce_motion<P: Platform>(
    platform: &Rc<RefCell<P>>,
    enabled_override: Option<bool>,
) -> bool {
    enabled_override.unwrap_or_else(|| prefers_reduced_motion(platform))
}
