// animation/src/glow.rs
// Unified glow animation system with mouse-following effect

#![allow(unused_imports)]

use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::closure::Closure;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use web_sys::{HtmlElement, MouseEvent};

use super::style::StyleBuilder;

#[allow(unused_imports)]
use js_sys;

/// Glow effect configuration
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
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
#[allow(dead_code)]
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

/// Track registered glow element IDs to avoid duplicates
#[cfg(target_arch = "wasm32")]
static mut REGISTERED_GLOW_IDS: Option<std::collections::HashSet<String>> = None;

/// Store global mouse position
#[cfg(target_arch = "wasm32")]
static mut MOUSE_POSITION: Option<(f64, f64)> = None;

/// Store global animation loop state
#[cfg(target_arch = "wasm32")]
static mut ANIMATION_CALLBACK: Option<js_sys::Function> = None;

/// Store global mouse tracking closure
#[cfg(target_arch = "wasm32")]
static mut MOUSEMOVE_CLOSURE: Option<Closure<dyn FnMut(MouseEvent)>> = None;

/// Initialize glow effects automatically on DOM load
///
/// This function automatically finds all elements with `data-glow` attribute
/// and sets up mouse-following glow effect for them.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = autoInitGlow)]
pub fn auto_init_glow() {
    let window = match web_sys::window() {
        Some(w) => w,
        None => return,
    };

    let document = match window.document() {
        Some(d) => d,
        None => return,
    };

    // Use requestAnimationFrame to ensure DOM is fully rendered
    let window_clone = window.clone();
    let document_clone = document.clone();

    let callback = Closure::wrap(Box::new(move || {
        do_init_glow(&window_clone, &document_clone);
    }) as Box<dyn FnMut()>);

    let callback_ref = callback.as_ref().unchecked_ref::<js_sys::Function>();
    let _ = window.request_animation_frame(callback_ref);
    callback.forget();
}

/// Internal function to initialize glow effects
#[cfg(target_arch = "wasm32")]
fn do_init_glow(_window: &web_sys::Window, document: &web_sys::Document) {
    // Find all glow containers
    let containers = match document.query_selector_all("[data-glow]") {
        Ok(els) => els,
        Err(_) => return,
    };

    for i in 0..containers.length() {
        if let Some(container) = containers.get(i) {
            let id = format!("glow-{}", i);
            register_glow(id, container.into(), None);
        }
    }

    // Setup MutationObserver to auto-initialize new glow elements
    setup_mutation_observer();
}

/// Setup MutationObserver to detect new glow elements
#[cfg(target_arch = "wasm32")]
fn setup_mutation_observer() {
    let window = match web_sys::window() {
        Some(w) => w,
        None => return,
    };
    let document = match window.document() {
        Some(d) => d,
        None => return,
    };

    let observer_config = web_sys::MutationObserverInit::new();
    observer_config.set_child_list(true);
    observer_config.set_subtree(true);

    let document_clone = document.clone();

    let callback = Closure::wrap(Box::new(move |mutations: js_sys::Array| {
        if mutations.length() > 0 {
            if let Ok(containers) = document_clone.query_selector_all("[data-glow]") {
                let count = containers.length();

                for i in 0..count {
                    if let Some(container) = containers.get(i) {
                        let id = format!("glow-mut-{}", i);
                        register_glow(id, container.into(), None);
                    }
                }
            }
        }
    }) as Box<dyn FnMut(js_sys::Array)>);

    if let Ok(observer) = web_sys::MutationObserver::new(callback.as_ref().unchecked_ref()) {
        let _ = observer.observe_with_options(&document.body().unwrap(), &observer_config);
        callback.forget();
    }
}

/// Register a glow element for animation
///
/// # Arguments
///
/// * `id` - Unique identifier for this glow element
/// * `element` - The glow container element
/// * `config` - Optional glow configuration
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = registerGlow)]
pub fn register_glow(_id: String, element: JsValue, config: Option<JsValue>) {
    let glow_element = match element.dyn_into::<HtmlElement>() {
        Ok(el) => el,
        Err(_) => return,
    };

    let glow_config = if let Some(config_val) = config {
        serde_wasm_bindgen::from_value::<GlowConfig>(config_val).unwrap_or_default()
    } else {
        GlowConfig::default()
    };

    unsafe {
        // Initialize glow elements storage
        if GLOW_ELEMENTS.is_none() {
            GLOW_ELEMENTS = Some(Vec::new());
        }
        if REGISTERED_GLOW_IDS.is_none() {
            REGISTERED_GLOW_IDS = Some(std::collections::HashSet::new());
        }

        // Initialize animation loop if not already running
        if ANIMATION_CALLBACK.is_none() {
            setup_global_mouse_tracking(glow_config.clone());
            start_animation_loop(glow_config);
        }

        // Check if already registered
        if let Some(registered_ids) = &mut REGISTERED_GLOW_IDS {
            if registered_ids.contains(&_id) {
                return;
            }
            registered_ids.insert(_id.clone());
        }

        if let Some(elements) = &mut GLOW_ELEMENTS {
            let element_id = elements.len();

            // Setup mouse enter/leave events
            let mouseenter_closure = Closure::wrap(Box::new(move || {
                if let Some(glow_els) = &mut GLOW_ELEMENTS {
                    if let Some(glow_el) = glow_els.get_mut(element_id) {
                        glow_el.is_hovering = true;
                        glow_el.fade_start_time =
                            Some(web_sys::window().unwrap().performance().unwrap().now());
                    }
                }
            }) as Box<dyn FnMut()>);

            let mouseleave_closure = Closure::wrap(Box::new(move || {
                if let Some(glow_els) = &mut GLOW_ELEMENTS {
                    if let Some(glow_el) = glow_els.get_mut(element_id) {
                        glow_el.is_hovering = false;
                        glow_el.fade_start_time =
                            Some(web_sys::window().unwrap().performance().unwrap().now());
                    }
                }
            }) as Box<dyn FnMut()>);

            glow_element
                .add_event_listener_with_callback(
                    "mouseenter",
                    mouseenter_closure.as_ref().unchecked_ref(),
                )
                .unwrap();
            mouseenter_closure.forget();

            glow_element
                .add_event_listener_with_callback(
                    "mouseleave",
                    mouseleave_closure.as_ref().unchecked_ref(),
                )
                .unwrap();
            mouseleave_closure.forget();

            elements.push(GlowElement {
                element: glow_element.clone(),
                target_opacity: 0.0,
                current_opacity: 0.0,
                is_hovering: false,
                fade_start_time: None,
            });
        }
    }
}

/// Setup global mouse tracking
#[cfg(target_arch = "wasm32")]
fn setup_global_mouse_tracking(_config: GlowConfig) {
    let window = match web_sys::window() {
        Some(w) => w,
        None => return,
    };

    let mousemove_closure = Closure::wrap(Box::new(move |event: MouseEvent| unsafe {
        MOUSE_POSITION = Some((event.client_x() as f64, event.client_y() as f64));
    }) as Box<dyn FnMut(_)>);

    window
        .add_event_listener_with_callback("mousemove", mousemove_closure.as_ref().unchecked_ref())
        .unwrap();

    unsafe {
        MOUSEMOVE_CLOSURE = Some(mousemove_closure);
    }
}

/// Start animation loop for all glow elements
#[cfg(target_arch = "wasm32")]
fn start_animation_loop(config: GlowConfig) {
    let radius = config.radius;
    let max_opacity = config.max_opacity;
    let fade_duration = config.fade_duration;

    let f = Rc::new(RefCell::new(None::<js_sys::Function>));
    let g = f.clone();

    let animation_closure = Closure::wrap(Box::new(move || {
        unsafe {
            let (mouse_x, mouse_y) = MOUSE_POSITION.unwrap_or((0.0, 0.0));
            let current_time = web_sys::window().unwrap().performance().unwrap().now();

            if let Some(elements) = &mut GLOW_ELEMENTS {
                for element in elements {
                    update_glow(
                        element,
                        mouse_x,
                        mouse_y,
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
            let _ = web_sys::window().map(|w| w.request_animation_frame(callback));
        }
    }) as Box<dyn FnMut()>);

    let callback: &js_sys::Function = animation_closure.as_ref().unchecked_ref();
    *g.borrow_mut() = Some(callback.clone());
    let _ = web_sys::window().map(|w| w.request_animation_frame(callback));

    unsafe {
        ANIMATION_CALLBACK = Some(callback.clone());
    }

    animation_closure.forget();
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

    if element.is_hovering {
        let target = if dist < radius {
            ((radius - dist) / radius * max_opacity).max(0.0).min(1.0)
        } else {
            0.0
        };
        element.target_opacity = target;
    } else {
        element.target_opacity = 0.0;
    }

    if let Some(fade_start_time) = element.fade_start_time {
        let elapsed = current_time - fade_start_time;
        let fade_progress = (elapsed / fade_duration).min(1.0);

        if element.is_hovering {
            element.current_opacity =
                element.current_opacity + (element.target_opacity - element.current_opacity) * 0.1;
        } else {
            element.current_opacity = element.current_opacity * (1.0 - fade_progress).max(0.0);

            if element.current_opacity <= 0.001 {
                element.fade_start_time = None;
            }
        }
    } else if element.is_hovering {
        element.current_opacity = element.target_opacity;
    } else {
        element.current_opacity = 0.0;
    }

    if element.current_opacity > 0.001 {
        let x = mouse_x - rect.left();
        let y = mouse_y - rect.top();
        let percent_x = (x / rect.width() * 100.0).min(100.0).max(0.0);
        let percent_y = (y / rect.height() * 100.0).min(100.0).max(0.0);

        // Use StyleBuilder for consistency with AnimationBuilder architecture
        if let Some(html_element) = element.element.dyn_ref::<HtmlElement>() {
            StyleBuilder::new(html_element)
                .add_custom("--glow-x", &format!("{}%", percent_x))
                .add_custom("--glow-y", &format!("{}%", percent_y))
                .add_custom("--glow-opacity", &format!("{}", element.current_opacity))
                .apply();
        }
    } else {
        if let Some(html_element) = element.element.dyn_ref::<HtmlElement>() {
            StyleBuilder::new(html_element)
                .add_custom("--glow-opacity", "0")
                .apply();
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub fn register_glow(_id: String, _element: JsValue, _config: Option<JsValue>) {}
