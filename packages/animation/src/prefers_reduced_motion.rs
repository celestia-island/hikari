//! Prefers-reduced-motion detection
//!
//! Provides functions to detect and monitor the user's system preference
//! for reduced motion.
//!
//! In WASI unified environment, uses tairitsu's browser API access via
//! Platform trait and WIT bindings.

use std::{cell::RefCell, rc::Rc};

use tairitsu_vdom::Platform;

/// Detect system prefers-reduced-motion setting
///
/// This is a placeholder implementation. In a real WIT environment,
/// this would need to be implemented via a media query interface.
///
/// Returns false by default (no preference detected).
pub fn prefers_reduced_motion<P: Platform>(_platform: &Rc<RefCell<P>>) -> bool {
    // WIT bindings don't currently expose matchMedia API
    // This would need to be added to the WIT interface
    false
}

/// Watch for prefers-reduced-motion changes
///
/// This is a placeholder implementation. In a real WIT environment,
/// this would set up a listener that calls the callback when the system preference changes.
///
/// # Arguments
///
/// * `callback` - Function to call when preference changes
pub fn watch_prefers_reduced_motion<P: Platform>(
    _platform: &Rc<RefCell<P>>,
    _callback: impl Fn(bool) + 'static,
) {
    // WIT bindings don't currently expose MediaQueryList API
    // This would need to be added to the WIT interface
    // For now, this is a no-op
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
