//! Background component
//!
//! Provides a full-screen gradient background with breathing color effects.
//! Automatically adapts to theme changes via global theme provider registry.
//! Includes a 60-second rotating gradient animation with configurable breathing.

use dioxus::prelude::*;

#[cfg(target_arch = "wasm32")]
use animation::style::StyleBuilder;

use crate::styled::StyledComponent;

#[cfg(target_arch = "wasm32")]
use palette::{墨色, 月白, 粉红, 靛蓝};

/// Background component type wrapper (for implementing StyledComponent)
pub struct BackgroundComponent;

/// Background component properties
///
/// # Fields
///
/// - `children` - Optional child elements (background is transparent)
#[derive(Clone, Props, PartialEq)]
pub struct BackgroundProps {
    children: Element,
}

/// Background component
///
/// A fixed, full-screen gradient background that automatically adapts to current theme.
/// The background includes a slow 60-second rotating gradient animation with breathing effect.
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
/// Automatically switches gradients based on theme from `use_theme()` hook:
/// - Hikari (light): 月白 → 粉红 gradient with 60s rotation and breathing
/// - Tairitsu (dark): 墨色 → 靛蓝 gradient with 60s rotation and breathing
/// - Theme changes trigger animation restart via `use_effect` dependency
///
/// # Animation
///
/// The gradient smoothly rotates and breathes:
/// - Uses StyleBuilder for efficient updates
/// - 60-second rotation period
/// - 4-second breathing cycle with ±5% saturation/lightness variation
/// - Receives theme context from use_theme() for dynamic theme support
#[component]
pub fn Background(props: BackgroundProps) -> Element {
    #[cfg(target_arch = "wasm32")]
    {
        use_effect(move || {
            let _stop = start_gradient_animation();
        });
    }

    rsx! {
        div {
            class: "hi-background",
            {props.children}
        }
    }
}

/// Starts gradient rotation and breathing animation
///
/// The gradient smoothly rotates and breathes by updating CSS variables:
/// - Updates `--bg-center-x` and `--bg-center-y` in each frame for rotation
/// - Updates `--bg-color-1` and `--bg-color-2` for breathing colors
/// - Uses StyleBuilder for efficient updates
/// - Automatic requestAnimationFrame loop
/// - 60-second rotation period
/// - 4-second breathing cycle with ±5% saturation/lightness variation
/// - Reads theme from nearest ThemeProvider via DOM (supports real-time theme switching)
/// - Returns cleanup function to stop animation on unmount
#[cfg(target_arch = "wasm32")]
fn start_gradient_animation() -> Box<dyn FnOnce()> {
    use std::cell::RefCell;
    use std::rc::Rc;
    use wasm_bindgen::closure::Closure;
    use wasm_bindgen::JsCast;

    let window = match web_sys::window() {
        Some(w) => w,
        None => return Box::new(|| {}),
    };

    let document = match window.document() {
        Some(doc) => doc,
        None => return Box::new(|| {}),
    };

    let background_element = match document.query_selector(".hi-background").ok().flatten() {
        Some(el) => el,
        None => return Box::new(|| {}),
    };

    let html_element = match background_element.dyn_into::<web_sys::HtmlElement>() {
        Ok(elem) => elem,
        Err(_) => return Box::new(|| {}),
    };

    let period_ms = 60000.0;
    let radius_percent = 20.0;
    let center_x = 50.0;
    let center_y = 50.0;

    let f = Rc::new(RefCell::new(None::<js_sys::Function>));
    let g = f.clone();

    let should_stop = Rc::new(RefCell::new(false));
    let should_stop_clone = should_stop.clone();

    let animation_closure = Closure::wrap(Box::new(move || {
        if *should_stop_clone.borrow() {
            return;
        }

        let window = match web_sys::window() {
            Some(w) => w,
            None => return,
        };

        let document = match window.document() {
            Some(doc) => doc,
            None => return,
        };

        let current_time = window.performance().map(|p| p.now()).unwrap_or(0.0);

        let angle = (current_time / period_ms) * 2.0 * std::f64::consts::PI;

        let x = center_x + radius_percent * angle.cos();
        let y = center_y + radius_percent * angle.sin();

        let theme = match document
            .query_selector(".hi-theme-provider[data-theme]")
            .ok()
            .flatten()
            .and_then(|el| el.get_attribute("data-theme"))
        {
            Some(t) => t,
            None => "hikari".to_string(),
        };

        let (color1, color2) = match theme.as_str() {
            "tairitsu" => (墨色, 靛蓝),
            _ => (月白, 粉红),
        };

        let breathing_progress = (current_time / 4000.0) % 2.0;
        let actual_progress = if breathing_progress > 1.0 {
            2.0 - breathing_progress
        } else {
            breathing_progress
        };

        let sin_val = (actual_progress * std::f64::consts::PI).sin();
        let saturation_factor = 1.0 + (sin_val * 0.05);
        let lightness_factor = 1.0 + (sin_val * 0.05);

        let breathing_color1 = color1.adjust_saturation(saturation_factor);
        let breathing_color1 = breathing_color1.adjust_lightness(lightness_factor);
        let breathing_color2 = color2.adjust_saturation(saturation_factor);
        let breathing_color2 = breathing_color2.adjust_lightness(lightness_factor);

        StyleBuilder::new(&html_element)
            .add_custom("--bg-center-x", &format!("{:.1}%", x))
            .add_custom("--bg-center-y", &format!("{:.1}%", y))
            .add_custom("--bg-color-1", &breathing_color1.hex())
            .add_custom("--bg-color-2", &breathing_color2.hex())
            .apply();

        if let Some(callback) = &*f.borrow() {
            let _ = web_sys::window().and_then(|w| w.request_animation_frame(&callback).ok());
        }
    }) as Box<dyn FnMut()>);

    let callback: &js_sys::Function = animation_closure.as_ref().unchecked_ref();
    *g.borrow_mut() = Some(callback.clone());

    let _ = web_sys::window().and_then(|w| w.request_animation_frame(&callback).ok());
    animation_closure.forget();

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
