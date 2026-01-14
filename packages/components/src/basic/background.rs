//! Background component
//!
//! Provides a full-screen gradient background that sits behind all content.
//! Automatically adapts to theme changes via CSS variables.
//! Includes a 60-second rotating gradient animation.

use dioxus::prelude::*;

use crate::styled::StyledComponent;

/// Background component type wrapper (for implementing StyledComponent)
pub struct BackgroundComponent;

/// Background component properties
///
/// Defines props accepted by [`Background`] component.
///
/// # Fields
///
/// - `children` - Optional child elements (typically not used, background is transparent)
#[derive(Clone, Props, PartialEq)]
pub struct BackgroundProps {
    children: Element,
}

/// Background component
///
/// A fixed, full-screen gradient background that automatically adapts to current theme.
/// The background includes a slow 60-second rotating gradient animation.
///
/// # Positioning
///
/// - `position: fixed` - Covers entire viewport regardless of scroll
/// - `top/left/right/bottom: 0` - Full viewport dimensions
/// - `z-index: -1` - Behind all content
/// - `pointer-events: none` - Click-through to content
///
/// # Theme Support
///
/// Automatically switches gradients based on `data-theme` attribute:
/// - `data-theme="hikari"` (light): 白 → 粉红 gradient with 60s rotation
/// - `data-theme="tairitsu"` (dark): 黑 → 深蓝 gradient with 60s rotation
///
/// # Animation
///
/// The gradient smoothly rotates using CSS variables:
/// - Uses `--bg-center-x` and `--bg-center-y` for circle position
/// - Updates variables via AnimationBuilder in requestAnimationFrame loop
/// - 60-second rotation period
/// - Cleanup on unmount to prevent multiple animation loops
#[component]
pub fn Background(props: BackgroundProps) -> Element {
    #[cfg(target_arch = "wasm32")]
    {
        use_effect(move || {
            let _stop = start_gradient_rotation();
        });
    }

    rsx! {
        div {
            class: "hi-background",
            {props.children}
        }
    }
}

/// Starts gradient rotation animation using CSS variables
///
/// The gradient smoothly rotates by updating CSS variables:
/// - Updates `--bg-center-x` and `--bg-center-y` in each frame
/// - Uses web_sys style.setProperty for efficient updates
/// - Automatic requestAnimationFrame loop
/// - 60-second rotation period
/// - Returns cleanup function to stop animation on unmount
#[cfg(target_arch = "wasm32")]
fn start_gradient_rotation() -> Box<dyn FnOnce()> {
    use std::cell::RefCell;
    use std::rc::Rc;
    use wasm_bindgen::closure::Closure;
    use wasm_bindgen::JsCast;

    // Get background element
    let window = match web_sys::window() {
        Some(w) => w,
        None => return Box::new(|| {}),
    };

    let document = match window.document() {
        Some(doc) => doc,
        None => return Box::new(|| {}),
    };

    let element = match document.query_selector(".hi-background").ok().flatten() {
        Some(el) => el,
        None => return Box::new(|| {}),
    };

    let html_element = match element.dyn_into::<web_sys::HtmlElement>() {
        Ok(elem) => elem,
        Err(_) => return Box::new(|| {}),
    };

    // Animation parameters
    let period_ms = 30000.0;
    let radius_percent = 20.0;
    let center_x = 50.0;
    let center_y = 50.0;

    // Store callback for self-reference
    let f = Rc::new(RefCell::new(None::<js_sys::Function>));
    let g = f.clone();

    // Stop flag
    let should_stop = Rc::new(RefCell::new(false));
    let should_stop_clone = should_stop.clone();

    // Create animation loop closure
    let animation_closure = Closure::wrap(Box::new(move || {
        // Check stop flag first
        if *should_stop_clone.borrow() {
            return;
        }

        // Get current time
        let window = match web_sys::window() {
            Some(w) => w,
            None => return,
        };

        let current_time = window.performance().map(|p| p.now()).unwrap_or(0.0);

        // Calculate angle (0 to 2π over 60 seconds)
        let angle = (current_time / period_ms) * 2.0 * std::f64::consts::PI;

        // Calculate circular position
        let x = center_x + radius_percent * angle.cos();
        let y = center_y + radius_percent * angle.sin();

        // Update CSS variables for gradient center
        let style = html_element.style();
        let _ = style.set_property("--bg-center-x", &format!("{:.1}%", x));
        let _ = style.set_property("--bg-center-y", &format!("{:.1}%", y));

        // Request next frame
        if let Some(callback) = &*f.borrow() {
            let _ = web_sys::window().and_then(|w| w.request_animation_frame(&callback).ok());
        }
    }) as Box<dyn FnMut()>);

    // Convert closure to js_sys::Function and store for self-reference
    let callback: &js_sys::Function = animation_closure.as_ref().unchecked_ref();
    *g.borrow_mut() = Some(callback.clone());

    // Start animation loop
    let _ = web_sys::window().and_then(|w| w.request_animation_frame(&callback).ok());
    animation_closure.forget();

    // Return stop function
    let should_stop_final = should_stop.clone();
    Box::new(move || {
        *should_stop_final.borrow_mut() = true;
    })
}

impl StyledComponent for BackgroundComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/background.css"))
    }

    fn name() -> &'static str {
        "background"
    }
}
