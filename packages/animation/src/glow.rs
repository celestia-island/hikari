// animation/src/glow.rs
// Unified glow animation system with mouse-following effect

#![allow(dead_code)]

use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::closure::Closure;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsCast;
use web_sys::{HtmlElement, MouseEvent, Window};

/// Glow effect configuration
#[derive(Clone, Debug)]
pub struct GlowConfig {
    /// Detection radius in pixels (default: 300)
    pub radius: f64,
    /// Maximum opacity (default: 0.8)
    pub max_opacity: f64,
    /// Animation throttle in ms (default: 16 = ~60fps)
    pub throttle_ms: f64,
    /// Fade in/out duration in ms (default: 300)
    pub fade_duration: f64,
}

impl Default for GlowConfig {
    fn default() -> Self {
        Self {
            radius: 300.0,
            max_opacity: 0.8,
            throttle_ms: 16.0,
            fade_duration: 300.0,
        }
    }
}

/// Glow element state with fade in/out animation
#[derive(Clone, Debug)]
struct GlowElement {
    element: HtmlElement,
    target_opacity: f64,
    current_opacity: f64,
    is_hovering: bool,
    fade_start_time: Option<f64>,
}

/// Store global glow elements for dynamic updates
#[cfg(target_arch = "wasm32")]
static mut GLOW_ELEMENTS: Option<Vec<GlowElement>> = None;

/// Store global animation loop state
#[cfg(target_arch = "wasm32")]
static mut ANIMATION_CALLBACK: Option<js_sys::Function> = None;

/// Initialize all glow effects on the page
///
/// This function finds all elements with `data-glow` attribute
/// and sets up mouse-following glow effect for them.
/// Uses MutationObserver to detect new glow elements added to the DOM.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = initGlow)]
pub fn init_glow() {
    web_sys::console::log_1(&"✨ init_glow called".into());
    web_sys::console::log_1(&"🔍 Starting glow initialization...".into());

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

    // Debug: Print total element count
    if let Ok(body) = document.query_selector("body") {
        if let Some(body) = body {
            if let Ok(all_elements) = body.query_selector_all("*") {
                web_sys::console::log_1(
                    &format!("📊 Total DOM elements: {}", all_elements.length()).into(),
                );
            }
        }
    }

    // Find all glow containers
    let containers = match document.query_selector_all("[data-glow]") {
        Ok(els) => els,
        Err(e) => {
            web_sys::console::error_1(&format!("❌ Failed to query glow elements: {:?}", e).into());
            return;
        }
    };

    web_sys::console::log_1(&format!("🎯 Found {} glow elements", containers.length()).into());

    let mut glow_elements = Vec::new();
    for i in 0..containers.length() {
        if let Some(container) = containers.get(i) {
            if let Some(element) = container.dyn_ref::<HtmlElement>() {
                let classes = element.class_list();
                let class_list = (0..classes.length())
                    .filter_map(|i| classes.item(i))
                    .collect::<Vec<_>>()
                    .join(" ");
                let data_attr = element.get_attribute("data-glow");
                let outer_html = element.outer_html().chars().take(200).collect::<String>();
                web_sys::console::log_2(
                    &format!(
                        "✅ Registered glow element: {:?} (data-glow={:?})",
                        element.tag_name(),
                        data_attr
                    )
                    .into(),
                    &format!("  Classes: {}\n  HTML: {}...", class_list, outer_html).into(),
                );

                let element_clone = element.clone();
                let element_id = glow_elements.len();

                // Setup mouse enter/leave events
                let mouseenter_closure = Closure::wrap(Box::new(move || unsafe {
                    if let Some(elements) = &mut GLOW_ELEMENTS {
                        if let Some(glow_el) = elements.get_mut(element_id) {
                            glow_el.is_hovering = true;
                            glow_el.fade_start_time =
                                Some(web_sys::window().unwrap().performance().unwrap().now());
                        }
                    }
                }) as Box<dyn FnMut()>);

                let mouseleave_closure = Closure::wrap(Box::new(move || unsafe {
                    if let Some(elements) = &mut GLOW_ELEMENTS {
                        if let Some(glow_el) = elements.get_mut(element_id) {
                            glow_el.is_hovering = false;
                            glow_el.fade_start_time =
                                Some(web_sys::window().unwrap().performance().unwrap().now());
                        }
                    }
                }) as Box<dyn FnMut()>);

                element
                    .add_event_listener_with_callback(
                        "mouseenter",
                        mouseenter_closure.as_ref().unchecked_ref(),
                    )
                    .unwrap();
                element
                    .add_event_listener_with_callback(
                        "mouseleave",
                        mouseleave_closure.as_ref().unchecked_ref(),
                    )
                    .unwrap();

                mouseenter_closure.forget();
                mouseleave_closure.forget();

                glow_elements.push(GlowElement {
                    element: element_clone,
                    target_opacity: 0.0,
                    current_opacity: 0.0,
                    is_hovering: false,
                    fade_start_time: None,
                });
            }
        }
    }

    // Update global glow elements (even if empty)
    let glow_count = glow_elements.len();
    unsafe {
        GLOW_ELEMENTS = Some(glow_elements);
    }

    if glow_count == 0 {
        web_sys::console::warn_1(&"⚠️  No glow elements found with [data-glow] attribute!".into());
    } else {
        web_sys::console::log_1(
            &format!(
                "✅ Found {} glow elements, starting animation loop",
                glow_count
            )
            .into(),
        );
    }

    // Start animation loop if not already running
    if unsafe { ANIMATION_CALLBACK.is_none() } {
        setup_glow_animation_loop(window.clone(), &GlowConfig::default());
    }

    // Set up MutationObserver to detect new glow elements
    setup_mutation_observer(window, document);
}

/// Setup MutationObserver to detect new glow elements
#[cfg(target_arch = "wasm32")]
fn setup_mutation_observer(_window: Window, document: web_sys::Document) {
    let observer_config = web_sys::MutationObserverInit::new();
    observer_config.set_child_list(true);
    observer_config.set_subtree(true);

    let document_clone = document.clone();

    let callback = Closure::wrap(Box::new(move |mutations: js_sys::Array| {
        web_sys::console::log_1(
            &format!(
                "🔔 MutationObserver triggered: {} mutation(s)",
                mutations.length()
            )
            .into(),
        );

        // Rescan for glow elements
        if let Ok(containers) = document_clone.query_selector_all("[data-glow]") {
            let count = containers.length();
            web_sys::console::log_1(
                &format!("🔍 Rescanning glow elements... Found: {}", count).into(),
            );

            let mut glow_elements = Vec::new();
            for i in 0..count {
                if let Some(container) = containers.get(i) {
                    if let Some(element) = container.dyn_ref::<HtmlElement>() {
                        let element_clone = element.clone();
                        let element_id = glow_elements.len();

                        // Setup mouse enter/leave events
                        let mouseenter_closure = Closure::wrap(Box::new(move || unsafe {
                            if let Some(elements) = &mut GLOW_ELEMENTS {
                                if let Some(glow_el) = elements.get_mut(element_id) {
                                    glow_el.is_hovering = true;
                                    glow_el.fade_start_time = Some(
                                        web_sys::window().unwrap().performance().unwrap().now(),
                                    );
                                }
                            }
                        })
                            as Box<dyn FnMut()>);

                        let mouseleave_closure = Closure::wrap(Box::new(move || unsafe {
                            if let Some(elements) = &mut GLOW_ELEMENTS {
                                if let Some(glow_el) = elements.get_mut(element_id) {
                                    glow_el.is_hovering = false;
                                    glow_el.fade_start_time = Some(
                                        web_sys::window().unwrap().performance().unwrap().now(),
                                    );
                                }
                            }
                        })
                            as Box<dyn FnMut()>);

                        element
                            .add_event_listener_with_callback(
                                "mouseenter",
                                mouseenter_closure.as_ref().unchecked_ref(),
                            )
                            .unwrap();
                        element
                            .add_event_listener_with_callback(
                                "mouseleave",
                                mouseleave_closure.as_ref().unchecked_ref(),
                            )
                            .unwrap();

                        mouseenter_closure.forget();
                        mouseleave_closure.forget();

                        glow_elements.push(GlowElement {
                            element: element_clone,
                            target_opacity: 0.0,
                            current_opacity: 0.0,
                            is_hovering: false,
                            fade_start_time: None,
                        });
                    }
                }
            }

            // Update global glow elements
            unsafe {
                let previous_count = GLOW_ELEMENTS.as_ref().map_or(0, |e| e.len());
                let current_count = glow_elements.len();

                if previous_count != current_count {
                    web_sys::console::log_1(
                        &format!(
                            "🔄 Glow elements changed: {} -> {}, refreshing animation",
                            previous_count, current_count
                        )
                        .into(),
                    );
                }

                GLOW_ELEMENTS = Some(glow_elements);
            }
        }
    }) as Box<dyn FnMut(_)>);

    if let Ok(observer) = web_sys::MutationObserver::new(callback.as_ref().unchecked_ref()) {
        let _ = observer.observe_with_options(&document.body().unwrap(), &observer_config);
        web_sys::console::log_1(&"👀 MutationObserver initialized for glow elements".into());
        callback.forget();
    } else {
        web_sys::console::error_1(&"❌ Failed to create MutationObserver".into());
    }
}

/// Setup glow animation loop using requestAnimationFrame
#[cfg(target_arch = "wasm32")]
fn setup_glow_animation_loop(window: Window, config: &GlowConfig) {
    web_sys::console::log_1(&"🔄 Setting up glow animation loop".into());

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
    let radius = config.radius;
    let max_opacity = config.max_opacity;
    let fade_duration = config.fade_duration;
    let mouse_x_anim = mouse_x.clone();
    let mouse_y_anim = mouse_y.clone();
    let window_anim = window.clone();

    let f = Rc::new(RefCell::new(None::<js_sys::Function>));
    let g = f.clone();

    let animation_closure = Closure::wrap(Box::new(move || {
        let mx = *mouse_x_anim.borrow();
        let my = *mouse_y_anim.borrow();
        let current_time = window_anim.performance().unwrap().now();

        // Update all glow elements from global state
        unsafe {
            if let Some(elements) = &mut GLOW_ELEMENTS {
                for element in elements {
                    update_glow(
                        element,
                        mx,
                        my,
                        radius,
                        max_opacity,
                        fade_duration,
                        current_time,
                    );
                }
            }
        }

        // Request next frame
        if let Some(callback) = &*f.borrow() {
            let _ = window_anim.request_animation_frame(callback);
        }
    }) as Box<dyn FnMut()>);

    let callback: &js_sys::Function = animation_closure.as_ref().unchecked_ref();
    *g.borrow_mut() = Some(callback.clone());
    let _ = window.request_animation_frame(callback);

    // Store callback globally to prevent GC
    unsafe {
        ANIMATION_CALLBACK = Some(callback.clone());
    }

    animation_closure.forget();

    web_sys::console::log_1(&"✅ Glow animation loop started".into());
}

/// Update glow effect for a single element
#[cfg(target_arch = "wasm32")]
fn update_glow(
    element: &mut GlowElement,
    mouse_x: f64,
    mouse_y: f64,
    radius: f64,
    max_opacity: f64,
    fade_duration: f64,
    current_time: f64,
) {
    let rect = element.element.get_bounding_client_rect();
    let center_x = rect.left() + rect.width() / 2.0;
    let center_y = rect.top() + rect.height() / 2.0;
    let dist = ((mouse_x - center_x).powi(2) + (mouse_y - center_y).powi(2)).sqrt();

    let style = element.element.style();

    if element.is_hovering {
        // Mouse is hovering: calculate target opacity based on distance
        let target = if dist < radius {
            // Calculate opacity based on distance (closer = more opaque)
            ((radius - dist) / radius * max_opacity).max(0.0).min(1.0)
        } else {
            0.0
        };
        element.target_opacity = target;
    } else {
        // Mouse is not hovering: target is 0
        element.target_opacity = 0.0;
    }

    // Apply fade in/out animation
    if let Some(fade_start_time) = element.fade_start_time {
        let elapsed = current_time - fade_start_time;
        let fade_progress = (elapsed / fade_duration).min(1.0);

        if element.is_hovering {
            // Fade in: interpolate from current to target
            element.current_opacity =
                element.current_opacity + (element.target_opacity - element.current_opacity) * 0.1;
        } else {
            // Fade out: interpolate from current to 0
            element.current_opacity = element.current_opacity * (1.0 - fade_progress).max(0.0);

            // Reset fade start time when fully faded
            if element.current_opacity <= 0.001 {
                element.fade_start_time = None;
            }
        }
    } else if element.is_hovering {
        element.current_opacity = element.target_opacity;
    } else {
        element.current_opacity = 0.0;
    }

    // Update CSS variables
    if element.current_opacity > 0.001 {
        let x = mouse_x - rect.left();
        let y = mouse_y - rect.top();
        let percent_x = (x / rect.width() * 100.0).min(100.0).max(0.0);
        let percent_y = (y / rect.height() * 100.0).min(100.0).max(0.0);

        let _ = style.set_property("--glow-x", &format!("{}%", percent_x));
        let _ = style.set_property("--glow-y", &format!("{}%", percent_y));
        let _ = style.set_property("--glow-opacity", &format!("{}", element.current_opacity));
    } else {
        let _ = style.set_property("--glow-opacity", "0");
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub fn init_glow() {
    // No-op on non-WASM targets
}
