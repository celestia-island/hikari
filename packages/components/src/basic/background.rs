//! Background component
//!
//! Provides a full-screen gradient background with breathing color effects.
//! Automatically adapts to theme changes via global theme provider registry.
//! Includes a 60-second rotating gradient animation with configurable breathing.

use hikari_palette::classes::{BackgroundClass, UtilityClass};
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use hikari_palette::{墨色, 月白, 粉红, 靛蓝};

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use crate::style_builder::StyleBuilder;
use crate::{prelude::*, styled::StyledComponent};

pub struct BackgroundComponent;

/// Props for the Background component
#[define_props]
pub struct BackgroundProps {
    #[default]
    pub children: Element,
}

/// Background component with gradient animation
///
/// Renders a full-screen gradient background with breathing color effects.
/// The gradient automatically rotates and adjusts colors based on the current theme.
#[component]
pub fn Background(props: BackgroundProps) -> Element {
    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    {
        use_effect(move || {
            let _stop = start_gradient_animation();
        });
    }

    rsx! {
        div { class: BackgroundClass::Background.as_class(), {props.children} }
    }
}

/// Starts the gradient animation for the background
///
/// Returns a cleanup function that stops the animation when called.
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
fn start_gradient_animation() -> Box<dyn FnOnce()> {
    use std::cell::RefCell;
    use std::rc::Rc;
    use wasm_bindgen::JsCast;
    use wasm_bindgen::closure::Closure;

    let window = match web_sys::window() {
        Some(w) => w,
        None => return Box::new(|| {}),
    };

    let document = match window.document() {
        Some(doc) => doc,
        None => return Box::new(|| {}),
    };

    let background_element = match document
        .query_selector(&format!(".{}", BackgroundClass::Background.as_class()))
        .ok()
        .flatten()
    {
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
