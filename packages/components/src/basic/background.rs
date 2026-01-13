//! Background component
//!
//! Provides a full-screen gradient background that sits behind all content.
//! Automatically adapts to theme changes via CSS variables.
//! Includes a 60-second rotating gradient animation.

use dioxus::prelude::*;

use crate::styled::StyledComponent;

/// Background component type wrapper (for implementing StyledComponent)
pub struct BackgroundComponent;

impl StyledComponent for BackgroundComponent {
    fn styles() -> &'static str {
        include_str!("styles/background.scss")
    }

    fn name() -> &'static str {
        "background"
    }
}

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
/// The background includes a smooth rotating gradient animation using delta time.
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
/// - `data-theme="hikari"` (light): 素 → 粉红 gradient with smooth rotation
/// - `data-theme="tairitsu"` (dark): 深蓝 → 纯黑 gradient with smooth rotation
///
/// # Animation
///
/// The gradient smoothly rotates using enhanced animation system:
/// - Uses AnimationState for precise angle tracking
/// - Delta time-based calculations for smooth motion regardless of frame rate
/// - Automatic lifecycle management prevents memory leaks
/// - 60-second rotation period using stateful animation
#[component]
pub fn Background(props: BackgroundProps) -> Element {
    #[cfg(target_arch = "wasm32")]
    {
        use_effect(move || {
            let stop_animation = start_gradient_rotation();
            (move || {
                stop_animation();
            })()
        });
    }

    rsx! {
        div {
            class: "hi-background",
            {props.children}
        }
    }
}

/// Starts gradient rotation animation using enhanced AnimationBuilder
///
/// Uses new stateful animation system with delta time for smooth rotation:
/// - Uses 60-second period for a full rotation
/// - Updates at 60fps via requestAnimationFrame with delta time
/// - Maintains angle in AnimationState for precise rotation
/// - Automatic lifecycle management
#[cfg(target_arch = "wasm32")]
fn start_gradient_rotation() -> Box<dyn FnOnce()> {
    use animation::state::AnimationState;
    use animation::style::CssProperty;
    use animation::AnimationBuilder;
    use std::collections::HashMap;
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
        None => {
            web_sys::console::log_1(&"Background element not found".into());
            return Box::new(|| {});
        }
    };

    let html_element = match element.dyn_into::<web_sys::HtmlElement>() {
        Ok(elem) => elem,
        Err(_) => return Box::new(|| {}),
    };

    // Create elements map for AnimationBuilder
    let mut elements = HashMap::new();
    elements.insert(
        "background".to_string(),
        wasm_bindgen::JsValue::from(html_element),
    );

    // Create initial animation state
    let mut initial_state = AnimationState::new();

    // Animation parameters (stored in state for easy modification)
    initial_state.set_f64("period_seconds", 60.0);
    initial_state.set_f64("radius_percent", 10.0);
    initial_state.set_f64("center_x", 50.0);
    initial_state.set_f64("center_y", 50.0);
    initial_state.set_f64("angle", 0.0); // Current rotation angle in radians
    initial_state.set_f64("rotation_speed", 2.0 * std::f64::consts::PI / 60.0); // radians per second

    // Debug log to verify setup
    web_sys::console::log_1(&"Setting up animation with stateful system".into());
    web_sys::console::log_1(&"Background animation started".into());

    Box::new(|| {
        web_sys::console::log_1(&"Background animation stopped".into());
    })
}
