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

pub fn on_resize(callback: impl FnMut() + 'static) {
    use wasm_bindgen::closure::Closure;

    let window = match web_sys::window() {
        Some(w) => w,
        None => return,
    };

    let closure = Closure::wrap(Box::new(callback) as Box<dyn FnMut()>);

    window
        .add_event_listener_with_callback("resize", closure.as_ref().unchecked_ref())
        .expect("failed to add resize listener");

    closure.forget();
}

use std::sync::atomic::{AtomicU64, Ordering};
static OBSERVER_ID_COUNTER: AtomicU64 = AtomicU64::new(1);

pub fn create_resize_observer(callback: impl FnMut() + 'static) -> u64 {
    use wasm_bindgen::closure::Closure;
    use web_sys::ResizeObserver;

    let closure = Closure::wrap(Box::new(callback) as Box<dyn FnMut()>);
    let observer = ResizeObserver::new(closure.as_ref().unchecked_ref()).unwrap();
    closure.forget();

    let id = OBSERVER_ID_COUNTER.fetch_add(1, Ordering::SeqCst);
    RESIZE_OBSERVERS.with(|map| map.borrow_mut().insert(id, observer));
    id
}

pub fn observe_resize(observer_id: u64, element: &Element) {
    RESIZE_OBSERVERS.with(|map| {
        if let Some(observer) = map.borrow().get(&observer_id) {
            observer.observe(element);
        }
    });
}

pub fn disconnect_resize(observer_id: u64) {
    RESIZE_OBSERVERS.with(|map| {
        if let Some(observer) = map.borrow().get(&observer_id) {
            observer.disconnect();
        }
        map.borrow_mut().remove(&observer_id);
    });
}

use std::cell::RefCell;
use std::collections::HashMap;

thread_local! {
    static RESIZE_OBSERVERS: RefCell<HashMap<u64, web_sys::ResizeObserver>> = RefCell::new(HashMap::new());
    static MUTATION_OBSERVERS: RefCell<HashMap<u64, web_sys::MutationObserver>> = RefCell::new(HashMap::new());
}

pub fn create_mutation_observer(callback: impl FnMut() + 'static) -> u64 {
    use wasm_bindgen::closure::Closure;
    use web_sys::MutationObserver;

    let closure = Closure::wrap(Box::new(callback) as Box<dyn FnMut()>);
    let observer = MutationObserver::new(closure.as_ref().unchecked_ref()).unwrap();
    closure.forget();

    let id = OBSERVER_ID_COUNTER.fetch_add(1, Ordering::SeqCst);
    MUTATION_OBSERVERS.with(|map| map.borrow_mut().insert(id, observer));
    id
}

pub fn observe_mutations(observer_id: u64, element: &Element, options: &MutationObserverOptions) {
    MUTATION_OBSERVERS.with(|map| {
        if let Some(observer) = map.borrow().get(&observer_id) {
            let init = web_sys::MutationObserverInit::new();
            if options.child_list {
                init.set_child_list(true);
            }
            if options.attributes {
                init.set_attributes(true);
            }
            if options.character_data {
                init.set_character_data(true);
            }
            if let Some(ref subtree) = options.subtree {
                init.set_subtree(*subtree);
            }
            observer.observe_with_options(element, &init).unwrap();
        }
    });
}

pub fn disconnect_mutation(observer_id: u64) {
    MUTATION_OBSERVERS.with(|map| {
        if let Some(observer) = map.borrow().get(&observer_id) {
            observer.disconnect();
        }
        map.borrow_mut().remove(&observer_id);
    });
}

pub struct MutationObserverOptions {
    pub child_list: bool,
    pub attributes: bool,
    pub character_data: bool,
    pub subtree: Option<bool>,
}

impl Default for MutationObserverOptions {
    fn default() -> Self {
        Self {
            child_list: true,
            attributes: false,
            character_data: false,
            subtree: Some(true),
        }
    }
}

pub fn now_timestamp() -> f64 {
    js_sys::Date::now()
}

use web_sys::HtmlCanvasElement;

pub fn get_canvas_context(canvas: &HtmlCanvasElement) -> Option<CanvasContext> {
    canvas
        .get_context("2d")
        .ok()
        .flatten()
        .map(|ctx| CanvasContext {
            inner: ctx.dyn_into::<web_sys::CanvasRenderingContext2d>().ok()?,
        })
}

pub struct CanvasContext {
    inner: web_sys::CanvasRenderingContext2d,
}

impl CanvasContext {
    pub fn set_fill_style(&self, color: &str) {
        self.inner.set_fill_style_str(color);
    }

    pub fn fill_rect(&self, x: f64, y: f64, width: f64, height: f64) {
        self.inner.fill_rect(x, y, width, height);
    }

    pub fn clear_rect(&self, x: f64, y: f64, width: f64, height: f64) {
        self.inner.clear_rect(x, y, width, height);
    }
}

pub fn draw_qrcode_on_canvas(
    canvas: &HtmlCanvasElement,
    matrix: &[Vec<bool>],
    modules: usize,
    color: &str,
    background: &str,
) {
    let Some(ctx) = get_canvas_context(canvas) else {
        return;
    };

    let canvas_size = canvas.width() as f64;
    let cell_size = canvas_size / modules as f64;
    let gap = cell_size * 0.02;
    let cell_with_gap = cell_size - gap;

    ctx.set_fill_style(background);
    ctx.fill_rect(0.0, 0.0, canvas_size, canvas_size);

    ctx.set_fill_style(color);
    for y in 0..modules {
        for x in 0..modules {
            if matrix[y][x] {
                ctx.fill_rect(
                    x as f64 * cell_size + gap / 2.0,
                    y as f64 * cell_size + gap / 2.0,
                    cell_with_gap,
                    cell_with_gap,
                );
            }
        }
    }
}

pub fn element_from_point(x: i32, y: i32) -> Option<Element> {
    web_sys::window()
        .and_then(|w| w.document())
        .and_then(|doc| doc.element_from_point(x as f64, y as f64))
}

pub fn get_target_element_from_event(client_x: i32, client_y: i32) -> Option<Element> {
    element_from_point(client_x, client_y)
}

pub fn element_closest(element: &Element, selector: &str) -> Option<Element> {
    element.closest(selector).ok().flatten()
}

pub fn get_bounding_client_rect(element: &Element) -> Option<DomRect> {
    let html_el = element.dyn_ref::<HtmlElement>()?;
    let rect = html_el.get_bounding_client_rect();
    Some(DomRect {
        x: rect.x(),
        y: rect.y(),
        width: rect.width(),
        height: rect.height(),
    })
}

pub fn get_scroll_top_from_point(x: i32, y: i32) -> f64 {
    element_from_point(x, y)
        .and_then(|el| el.dyn_ref::<HtmlElement>().map(|h| h.scroll_top() as f64))
        .unwrap_or(0.0)
}

pub fn query_selector_all(selector: &str) -> Vec<Element> {
    web_sys::window()
        .and_then(|w| w.document())
        .and_then(|doc| doc.query_selector_all(selector).ok())
        .map(|list| (0..list.length()).filter_map(|i| list.item(i)).collect())
        .unwrap_or_default()
}

pub fn get_scroll_top_by_selector(selector: &str) -> f64 {
    web_sys::window()
        .and_then(|w| w.document())
        .and_then(|doc| doc.query_selector(selector).ok().flatten())
        .and_then(|el| el.dyn_ref::<HtmlElement>().map(|h| h.scroll_top() as f64))
        .unwrap_or(0.0)
}

pub fn request_animation_frame(callback: impl FnOnce() + 'static) {
    use wasm_bindgen::closure::Closure;

    let window = match web_sys::window() {
        Some(w) => w,
        None => return,
    };

    let callback = Closure::once_into_js(callback);
    let _ = window.request_animation_frame(callback.as_ref().unchecked_ref());
}
