// animation/src/scrollbar.rs
// Scrollbar animation system using AnimationBuilder

use std::collections::HashMap;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use web_sys::HtmlElement;

use super::style::{CssProperty, StyleBuilder};

/// Store all scrollbar elements for animation updates
#[cfg(target_arch = "wasm32")]
static mut SCROLLBARS: Option<HashMap<String, HtmlElement>> = None;

/// Register a scrollbar element for animation
///
/// # Arguments
///
/// * `id` - Unique identifier for this scrollbar
/// * `track` - The scrollbar track element
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = registerScrollbar)]
pub fn register_scrollbar(id: String, track: JsValue) {
    let track_element = match track.dyn_into::<HtmlElement>() {
        Ok(el) => el,
        Err(_) => {
            web_sys::console::error_1(&"❌ Invalid track element for scrollbar".into());
            return;
        }
    };

    unsafe {
        if SCROLLBARS.is_none() {
            SCROLLBARS = Some(HashMap::new());
        }

        if let Some(scrollbars) = &mut SCROLLBARS {
            scrollbars.insert(id, track_element);
        }
    }
}

/// Update scrollbar width with smooth transition
///
/// # Arguments
///
/// * `id` - Unique identifier for scrollbar
/// * `width` - Target width in pixels (e.g., 4.0 or 8.0)
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = updateScrollbarWidth)]
pub fn update_scrollbar_width(id: String, width: f64) {
    unsafe {
        if let Some(scrollbars) = &SCROLLBARS {
            if let Some(track) = scrollbars.get(&id) {
                // Use StyleBuilder to set transition and width
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
}

#[cfg(not(target_arch = "wasm32"))]
pub fn register_scrollbar(_id: String, _track: JsValue) {}

#[cfg(not(target_arch = "wasm32"))]
pub fn update_scrollbar_width(_id: String, _width: f64) {}
