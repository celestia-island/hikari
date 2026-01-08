// animation/src/spotlight.rs
// Generic mouse-following spotlight overlay (similar to Material UI Ripple)

#![allow(dead_code)]

use std::{cell::RefCell, rc::Rc, vec::Vec};

use wasm_bindgen::prelude::*;
use web_sys::{HtmlElement, MouseEvent, Window};

/// Spotlight effect configuration
#[derive(Clone, Debug)]
pub struct SpotlightConfig {
    /// Detection radius in pixels (default: 200)
    pub radius: f64,
    /// Maximum opacity (default: 0.4)
    pub max_opacity: f64,
    /// Animation throttle in ms (default: 16 = ~60fps)
    pub throttle_ms: f64,
    /// Spotlight color (default: "59, 130, 246" for blue)
    pub color: String,
    /// Enable scale effect on hover
    pub scale_on_hover: bool,
}

impl Default for SpotlightConfig {
    fn default() -> Self {
        Self {
            radius: 400.0,    // Increased from 200 - larger detection area
            max_opacity: 1.0, // Increased from 0.6 - much more visible
            throttle_ms: 16.0,
            color: "255, 255, 255".to_string(), // Changed to white - more visible on colored buttons
            scale_on_hover: false,
        }
    }
}

/// Initialize all spotlight effects on the page
///
/// This function finds all elements with `data-spotlight` attribute
/// and sets up the mouse-following spotlight effect for them.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = initSpotlights)]
pub fn init_spotlights() {
    web_sys::console::log_1(&"🔦 init_spotlights called".into());

    let window = match web_sys::window() {
        Some(w) => w,
        None => {
            web_sys::console::error_1(&"❌ Failed to get window".into());
            return;
        }
    };

    let document = match window.document() {
        Some(d) => d,
        None => {
            web_sys::console::error_1(&"❌ Failed to get document".into());
            return;
        }
    };

    // Find all spotlight containers
    let containers = match document.query_selector_all("[data-spotlight]") {
        Ok(els) => els,
        Err(e) => {
            web_sys::console::error_1(
                &format!("❌ Failed to query spotlight elements: {:?}", e).into(),
            );
            return;
        }
    };

    web_sys::console::log_1(&format!("🎯 Found {} spotlight elements", containers.length()).into());

    let mut spotlight_elements = Vec::new();
    for i in 0..containers.length() {
        if let Some(container) = containers.get(i) {
            if let Some(element) = container.dyn_ref::<HtmlElement>() {
                spotlight_elements.push(element.clone());
                web_sys::console::log_1(
                    &format!("✅ Registered spotlight element: {:?}", element.tag_name()).into(),
                );
            }
        }
    }

    if spotlight_elements.is_empty() {
        web_sys::console::warn_1(&"⚠️  No spotlight elements found!".into());
        return;
    }

    setup_spotlight_animation_loop(window, spotlight_elements, &SpotlightConfig::default());
}

/// Setup spotlight animation loop using requestAnimationFrame
#[cfg(target_arch = "wasm32")]
fn setup_spotlight_animation_loop(
    window: Window,
    elements: Vec<HtmlElement>,
    config: &SpotlightConfig,
) {
    web_sys::console::log_1(&"🔄 Setting up spotlight animation loop".into());

    // Store mouse position globally
    let mouse_x = Rc::new(RefCell::new(0_f64));
    let mouse_y = Rc::new(RefCell::new(0_f64));

    // Clone for closures
    let mouse_x_clone = mouse_x.clone();
    let mouse_y_clone = mouse_y.clone();
    let window_clone = window.clone();

    // Global mouse move listener to track cursor position
    let mousemove_closure = Closure::wrap(Box::new(move |event: MouseEvent| {
        *mouse_x_clone.borrow_mut() = event.client_x() as f64;
        *mouse_y_clone.borrow_mut() = event.client_y() as f64;
    }) as Box<dyn FnMut(_)>);

    window_clone
        .add_event_listener_with_callback("mousemove", mousemove_closure.as_ref().unchecked_ref())
        .unwrap();
    mousemove_closure.forget();

    web_sys::console::log_1(&"✅ Mouse tracking initialized".into());

    // Animation loop
    let elements_clone = elements.clone();
    let radius = config.radius;
    let max_opacity = config.max_opacity;
    let color = config.color.clone();
    let mouse_x_anim = mouse_x.clone();
    let mouse_y_anim = mouse_y.clone();
    let window_anim = window.clone();

    let f = Rc::new(RefCell::new(None::<js_sys::Function>));
    let g = f.clone();

    let animation_closure = Closure::wrap(Box::new(move || {
        let mx = *mouse_x_anim.borrow();
        let my = *mouse_y_anim.borrow();

        // Update all spotlight elements
        for element in &elements_clone {
            update_spotlight(element, mx, my, radius, max_opacity, &color);
        }

        // Request next frame
        if let Some(callback) = &*f.borrow() {
            let _ = window_anim.request_animation_frame(callback);
        }
    }) as Box<dyn FnMut()>);

    let callback: &js_sys::Function = animation_closure.as_ref().unchecked_ref();
    *g.borrow_mut() = Some(callback.clone());
    let _ = window.request_animation_frame(callback);
    animation_closure.forget();

    web_sys::console::log_1(&"✅ Spotlight animation loop started".into());
}

/// Update spotlight for a single element
#[cfg(target_arch = "wasm32")]
fn update_spotlight(
    element: &HtmlElement,
    mouse_x: f64,
    mouse_y: f64,
    radius: f64,
    max_opacity: f64,
    color: &str,
) {
    let rect = element.get_bounding_client_rect();

    // Calculate distance from element center
    let center_x = rect.left() + rect.width() / 2.0;
    let center_y = rect.top() + rect.height() / 2.0;
    let dist = ((mouse_x - center_x).powi(2) + (mouse_y - center_y).powi(2)).sqrt();

    let style = element.style();

    if dist < radius {
        // Mouse is within detection radius
        let x = mouse_x - rect.left();
        let y = mouse_y - rect.top();
        let percent_x = (x / rect.width() * 100.0).min(100.0).max(0.0);
        let percent_y = (y / rect.height() * 100.0).min(100.0).max(0.0);
        let opacity = ((radius - dist) / radius * max_opacity).max(0.0);

        // Update CSS variables
        let _ = style.set_property("--spotlight-x", &format!("{}%", percent_x));
        let _ = style.set_property("--spotlight-y", &format!("{}%", percent_y));
        let _ = style.set_property("--spotlight-opacity", &format!("{}", opacity));
    } else {
        // Mouse is outside detection radius
        let _ = style.set_property("--spotlight-opacity", "0");
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub fn init_spotlights() {
    // No-op on non-WASM targets
}
