//! Web platform implementation using web_sys
//!
//! This module provides DOM operations using web_sys directly.
//! It is compiled only for browser WASM targets (wasm32-unknown).

use tairitsu_vdom::platform::DomRect;
use wasm_bindgen::JsCast;
use web_sys::{Element, HtmlElement};

pub fn get_bounding_rect_by_class_impl(
    class_name: &str,
    start_element: &Element,
) -> Option<DomRect> {
    let mut current = Some(start_element.clone());

    while let Some(el) = current {
        if el.class_list().contains(class_name) {
            if let Some(html_el) = el.dyn_ref::<HtmlElement>() {
                let rect = html_el.get_bounding_client_rect();
                return Some(DomRect {
                    x: rect.x(),
                    y: rect.y(),
                    width: rect.width(),
                    height: rect.height(),
                });
            }
        }
        current = el.parent_element();
    }

    None
}

pub fn get_element_by_class_upward(
    class_name: &str,
    start_element: &Element,
) -> Option<HtmlElement> {
    let mut current = Some(start_element.clone());

    while let Some(el) = current {
        if el.class_list().contains(class_name) {
            return el.dyn_into::<HtmlElement>().ok();
        }
        current = el.parent_element();
    }

    None
}

pub fn log(message: &str) {
    web_sys::console::log_1(&message.into());
}

pub fn log_warn(message: &str) {
    web_sys::console::warn_1(&message.into());
}

pub fn log_error(message: &str) {
    web_sys::console::error_1(&message.into());
}

pub fn inner_width() -> i32 {
    web_sys::window()
        .and_then(|w| w.inner_width().ok())
        .and_then(|w| w.as_f64())
        .map(|w| w as i32)
        .unwrap_or(0)
}

pub fn inner_height() -> i32 {
    web_sys::window()
        .and_then(|w| w.inner_height().ok())
        .and_then(|h| h.as_f64())
        .map(|h| h as i32)
        .unwrap_or(0)
}

pub fn set_timeout(callback: impl FnOnce() + 'static, ms: i32) -> i32 {
    use wasm_bindgen::closure::Closure;

    let window = match web_sys::window() {
        Some(w) => w,
        None => return 0,
    };

    let callback = Closure::once_into_js(callback);
    window
        .set_timeout_with_callback_and_timeout_and_arguments_0(
            callback.as_ref().unchecked_ref(),
            ms,
        )
        .unwrap_or(0)
}

pub fn get_computed_style_value(element: &HtmlElement, property: &str) -> Option<String> {
    web_sys::window()
        .and_then(|w| w.get_computed_style(element).ok())
        .flatten()
        .and_then(|style| style.get_property_value(property).ok())
}

pub fn get_inline_style_value(element: &HtmlElement, property: &str) -> Option<String> {
    element.style().get_property_value(property).ok()
}

pub fn set_style_property(element: &HtmlElement, name: &str, value: &str) {
    let _ = element.style().set_property(name, value);
}

pub fn get_scroll_y() -> f64 {
    web_sys::window()
        .and_then(|w| w.scroll_y().ok())
        .unwrap_or(0.0)
}

pub fn scroll_to_with_options(top: f64, behavior: &str) {
    if let Some(window) = web_sys::window() {
        let options = web_sys::ScrollToOptions::new();
        options.set_top(top);
        options.set_behavior(match behavior {
            "smooth" => web_sys::ScrollBehavior::Smooth,
            _ => web_sys::ScrollBehavior::Auto,
        });
        window.scroll_to_with_scroll_to_options(&options);
    }
}
