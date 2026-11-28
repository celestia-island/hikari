//! Platform implementation for `wasm32-wasip2` components.
//!
//! On this target the browser is reachable only through the WIT host world
//! tairitsu-web binds (`tairitsu-browser:full`), never through `web_sys`, so
//! every free function here forwards to a [`WitPlatform`] — a unit struct, so
//! building one per call costs nothing. The element type is tairitsu-web's
//! [`WitElement`] (an opaque host handle); callers only ever pass the element a
//! `platform::` lookup handed them, so the concrete type never leaks into
//! component signatures.
//!
//! What is deliberately NOT wired:
//!   * the canvas / QR paths (`web.rs` only; no component outside this module
//!     calls them, and they take `web_sys` element types) — the by-id QR draw
//!     stays the stub's `false`;
//!   * `device_pixel_ratio` reads as `1.0` (`WitPlatform` exposes no getter yet;
//!     the tooltip's pixel-grid snap is a no-op at ratio 1).
//!
//! `now_timestamp` comes from the WASI wall clock rather than a browser API: it
//! is the same Unix-epoch milliseconds `Date::now()` returns.

use std::time::{SystemTime, UNIX_EPOCH};

use tairitsu_vdom::platform::{DomOps, LayoutOps, ObserverOps, QueryOps, ScrollOps, TimerOps};
use tairitsu_web::wit_platform::{WitElement, WitPlatform};

use super::MutationObserverOptions;

/// The platform every function here forwards to. `new()` is only `Err` off
/// wasm, where this module is not compiled.
fn platform() -> WitPlatform {
    WitPlatform::new().expect("WitPlatform exists on wasm32-wasi")
}

pub fn log(message: &str) {
    eprintln!("{message}");
}

pub fn log_warn(message: &str) {
    eprintln!("[warn] {message}");
}

pub fn log_error(message: &str) {
    eprintln!("[error] {message}");
}

pub fn inner_width() -> i32 {
    platform().inner_width()
}

pub fn inner_height() -> i32 {
    platform().inner_height()
}

pub fn set_timeout(callback: impl FnOnce() + 'static, ms: i32) -> i32 {
    platform().set_timeout(Box::new(callback), ms)
}

pub fn get_scroll_y() -> f64 {
    platform().get_scroll_y()
}

pub fn scroll_to_with_options(top: f64, behavior: &str) {
    platform().scroll_to(top, behavior);
}

pub fn on_resize(mut callback: impl FnMut() + 'static) {
    platform().on_resize(Box::new(move |_width, _height| callback()));
}

pub fn create_resize_observer(mut callback: impl FnMut() + 'static) -> u64 {
    platform().create_resize_observer(Box::new(move |_entries| callback()))
}

pub fn observe_resize(observer_id: u64, element: &WitElement) {
    platform().observe_resize(observer_id, element);
}

pub fn disconnect_resize(observer_id: u64) {
    platform().disconnect_resize(observer_id);
}

pub fn create_mutation_observer(mut callback: impl FnMut() + 'static) -> u64 {
    platform().create_mutation_observer(Box::new(move |_records| callback()))
}

pub fn observe_mutations(
    observer_id: u64,
    element: &WitElement,
    options: &MutationObserverOptions,
) {
    platform().observe_mutations(observer_id, element, Some(options.into_init()));
}

pub fn disconnect_mutation(observer_id: u64) {
    platform().disconnect_mutation(observer_id);
}

pub fn now_timestamp() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|since| since.as_millis() as f64)
        .unwrap_or(0.0)
}

/// One CSS px per device px: the tooltip's pixel-grid snap is a no-op here.
pub fn device_pixel_ratio() -> f64 {
    1.0
}

pub fn element_from_point(x: i32, y: i32) -> Option<WitElement> {
    platform().element_from_point(x, y)
}

pub fn get_target_element_from_event(client_x: i32, client_y: i32) -> Option<WitElement> {
    element_from_point(client_x, client_y)
}

pub fn element_closest(element: &WitElement, selector: &str) -> Option<WitElement> {
    platform().element_closest(element, selector)
}

pub fn get_bounding_client_rect(element: &WitElement) -> Option<tairitsu_vdom::platform::DomRect> {
    Some(platform().get_bounding_client_rect(element))
}

pub fn get_scroll_top_from_point(x: i32, y: i32) -> f64 {
    element_from_point(x, y)
        .map(|element| platform().get_element_scroll_top(&element))
        .unwrap_or(0.0)
}

pub fn query_selector(selector: &str) -> Option<WitElement> {
    platform().query_selector(selector)
}

pub fn query_selector_all(selector: &str) -> Vec<WitElement> {
    platform().query_selector_all(selector)
}

pub fn get_element_by_id(id: &str) -> Option<WitElement> {
    platform().get_element_by_id(id)
}

pub fn get_element_rect_by_id(id: &str) -> Option<tairitsu_vdom::platform::DomRect> {
    platform().get_element_rect_by_id(id)
}

pub fn get_scroll_top_by_selector(selector: &str) -> f64 {
    query_selector(selector)
        .map(|element| platform().get_element_scroll_top(&element))
        .unwrap_or(0.0)
}

pub fn request_animation_frame(callback: impl FnOnce() + 'static) {
    platform().request_animation_frame(Box::new(move |_timestamp| callback()));
}

pub fn request_animation_frame_with_timestamp(callback: impl FnOnce(f64) + 'static) -> i32 {
    platform().request_animation_frame(Box::new(callback)) as i32
}

pub fn on_scroll(mut callback: impl FnMut() + 'static) {
    platform().on_scroll(Box::new(move |_x, _y| callback()));
}

pub fn get_computed_style_value(element: &WitElement, property: &str) -> Option<String> {
    platform().get_computed_style_value(element, property)
}

pub fn get_inline_style_value(element: &WitElement, property: &str) -> Option<String> {
    platform().get_inline_style_value(element, property)
}

pub fn set_style_property(element: &WitElement, name: &str, value: &str) {
    platform().set_style(element, name, value);
}

/// Walk from `start_element` up the tree and measure the first element that
/// carries `class_name` (`web.rs`'s `get_bounding_rect_by_class`).
pub fn get_bounding_rect_by_class(
    class_name: &str,
    start_element: &WitElement,
) -> Option<tairitsu_vdom::platform::DomRect> {
    let platform = platform();
    let mut current = Some(*start_element);
    while let Some(element) = current {
        if platform.class_list_contains(&element, class_name) {
            return Some(platform.get_bounding_client_rect(&element));
        }
        current = tairitsu_web::wit_platform::get_parent_element(&platform, &element);
    }
    None
}

/// Walk from `start_element` up the tree to the first element that carries
/// `class_name` (`web.rs`'s `get_element_by_class_upward`).
pub fn get_element_by_class_upward(
    class_name: &str,
    start_element: &WitElement,
) -> Option<WitElement> {
    let platform = platform();
    let mut current = Some(*start_element);
    while let Some(element) = current {
        if platform.class_list_contains(&element, class_name) {
            return Some(element);
        }
        current = tairitsu_web::wit_platform::get_parent_element(&platform, &element);
    }
    None
}

pub fn draw_qrcode_on_canvas_by_id(
    _canvas_id: &str,
    _matrix: &[Vec<bool>],
    _modules: usize,
    _color: &str,
    _background: &str,
) -> bool {
    false
}
