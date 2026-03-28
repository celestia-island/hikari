// animation/src/scrollbar.rs
// Scrollbar animation system using StyleBuilder
//
// In WASI unified environment, scrollbar registration is handled via
// tairitsu's WIT interface rather than wasm_bindgen exports.

#![allow(unused_imports)]

use std::collections::HashMap;

use web_sys::HtmlElement;

use super::style::{CssProperty, StyleBuilder};

/// Store all scrollbar elements for animation updates
static mut SCROLLBARS: Option<HashMap<String, HtmlElement>> = None;

/// Register a scrollbar element for animation
///
/// # Arguments
///
/// * `id` - Unique identifier for this scrollbar
/// * `track` - The scrollbar track element
pub fn register_scrollbar(id: String, track: HtmlElement) {
    unsafe {
        let scrollbars_ptr = &raw mut SCROLLBARS;

        if (*scrollbars_ptr).is_none() {
            *scrollbars_ptr = Some(HashMap::new());
        }

        if let Some(scrollbars) = &mut *scrollbars_ptr {
            scrollbars.insert(id, track);
        }
    }
}

/// Update scrollbar width with smooth transition
///
/// # Arguments
///
/// * `id` - Unique identifier for scrollbar
/// * `width` - Target width in pixels (e.g., 4.0 or 8.0)
pub fn update_scrollbar_width(id: String, width: f64) {
    unsafe {
        let scrollbars_ptr = &raw const SCROLLBARS;

        if let Some(scrollbars) = &*scrollbars_ptr
            && let Some(track) = scrollbars.get(&id) {
                // Use StyleBuilder (consistent with AnimationBuilder architecture)
                StyleBuilder::new(track)
                    .add(
                        CssProperty::Transition,
                        "width 300ms cubic-bezier(0.25, 0.1, 0.25, 1)",
                    )
                    .add(CssProperty::Width, &format!("{}px", width))
                    .apply();
            }
    }
}
