// animation/src/scrollbar.rs
// Scrollbar animation system
//
// In WASI unified environment, scrollbar registration is handled via
// tairitsu's Platform trait rather than direct DOM access.

#![allow(unused_imports)]

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use tairitsu_vdom::Platform;

use super::style::CssProperty;

/// Store all scrollbar elements for animation updates
///
/// Note: This is a simplified implementation for demonstration.
/// In a real application, you'd use thread-local storage or
/// a proper state management system.
pub struct ScrollbarRegistry<P: Platform> {
    scrollbars: HashMap<String, P::Element>,
}

impl<P: Platform> Default for ScrollbarRegistry<P> {
    fn default() -> Self {
        Self {
            scrollbars: HashMap::new(),
        }
    }
}

impl<P: Platform> ScrollbarRegistry<P> {
    /// Create a new scrollbar registry
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a scrollbar element for animation
    ///
    /// # Arguments
    ///
    /// * `id` - Unique identifier for this scrollbar
    /// * `track` - The scrollbar track element handle
    pub fn register(&mut self, id: String, track: P::Element) {
        self.scrollbars.insert(id, track);
    }

    /// Update scrollbar width with smooth transition
    ///
    /// # Arguments
    ///
    /// * `id` - Unique identifier for scrollbar
    /// * `width` - Target width in pixels (e.g., 4.0 or 8.0)
    /// * `platform` - Platform reference for DOM operations
    pub fn update_width(&mut self, id: &str, width: f64, platform: &Rc<RefCell<P>>) {
        if let Some(track_handle) = self.scrollbars.get(id) {
            // Apply transition and width via Platform trait
            platform.borrow_mut().set_style(
                track_handle,
                "transition",
                "width 300ms cubic-bezier(0.25, 0.1, 0.25, 1)",
            );
            platform
                .borrow_mut()
                .set_style(track_handle, "width", &format!("{}px", width));
        }
    }

    /// Unregister a scrollbar element
    ///
    /// # Arguments
    ///
    /// * `id` - Unique identifier for scrollbar to remove
    pub fn unregister(&mut self, id: &str) {
        self.scrollbars.remove(id);
    }
}

/// Legacy functions for backward compatibility
/// These use a global registry (not recommended for new code)
use std::sync::Mutex;

// Global registry for legacy API
static LEGACY_REGISTRY: Mutex<Option<HashMap<String, u64>>> = Mutex::new(None);

/// Register a scrollbar element for animation (legacy API)
///
/// # Arguments
///
/// * `id` - Unique identifier for this scrollbar
/// * `track` - The scrollbar track element handle (u64)
#[deprecated(note = "Use ScrollbarRegistry instead")]
pub fn register_scrollbar(id: String, track: u64) {
    let mut registry = LEGACY_REGISTRY.lock().unwrap();
    if registry.is_none() {
        *registry = Some(HashMap::new());
    }
    if let Some(scrollbars) = registry.as_mut() {
        scrollbars.insert(id, track);
    }
}

/// Update scrollbar width with smooth transition (legacy API)
///
/// # Arguments
///
/// * `id` - Unique identifier for scrollbar
/// * `width` - Target width in pixels (e.g., 4.0 or 8.0)
/// * `platform` - Platform reference for DOM operations
///
/// # Note
/// This function only works with platforms where Element = u64.
/// For other platforms, use ScrollbarRegistry directly.
#[deprecated(note = "Use ScrollbarRegistry instead")]
pub fn update_scrollbar_width<P: Platform<Element = u64>>(
    id: String,
    width: f64,
    platform: &Rc<RefCell<P>>,
) {
    let registry = LEGACY_REGISTRY.lock().unwrap();
    if let Some(scrollbars) = registry.as_ref()
        && let Some(&track_handle) = scrollbars.get(&id)
    {
        // For u64 elements, we can directly use the handle
        platform.borrow_mut().set_style(
            &track_handle,
            "transition",
            "width 300ms cubic-bezier(0.25, 0.1, 0.25, 1)",
        );
        platform
            .borrow_mut()
            .set_style(&track_handle, "width", &format!("{}px", width));
    }
}

/// Unregister a scrollbar element (legacy API)
///
/// # Arguments
///
/// * `id` - Unique identifier for scrollbar to remove
#[deprecated(note = "Use ScrollbarRegistry instead")]
pub fn unregister_scrollbar(id: String) {
    let mut registry = LEGACY_REGISTRY.lock().unwrap();
    if let Some(scrollbars) = registry.as_mut() {
        scrollbars.remove(&id);
    }
}
