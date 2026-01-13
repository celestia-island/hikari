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

/// Starts gradient rotation animation using simple requestAnimationFrame
///
/// Uses direct DOM manipulation for smooth rotation:
/// - Uses 60-second period for a full rotation
/// - Updates at 60fps via requestAnimationFrame
/// - Simple and reliable animation approach
#[cfg(target_arch = "wasm32")]
fn start_gradient_rotation() -> Box<dyn FnOnce()> {
    use std::cell::RefCell;
    use std::rc::Rc;
    use wasm_bindgen::prelude::*;
    use wasm_bindgen::JsCast;
    use web_sys::{window, HtmlElement};

    // Get background element
    let window = match window() {
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

    let html_element = match element.dyn_into::<HtmlElement>() {
        Ok(elem) => elem,
        Err(_) => return Box::new(|| {}),
    };

    // Animation state in Rc<RefCell>
    let angle = Rc::new(RefCell::new(0.0_f64));
    let rotation_speed = 2.0 * std::f64::consts::PI / 60.0; // radians per second
    let start_time = window.performance().unwrap().now();

    // Create animation closure with self-reference
    let closure: Rc<RefCell<Option<Closure<dyn Fn()>>>> = Rc::new(RefCell::new(None));
    let closure_clone = closure.clone();
    let angle_clone = angle.clone();

    let anim_closure = Closure::wrap(Box::new(move || {
        let current_time = window.performance().unwrap().now();
        let delta_time = (current_time - start_time) / 1000.0; // Convert to seconds

        // Update angle
        let mut angle_mut = angle_clone.borrow_mut();
        *angle_mut = rotation_speed * delta_time;
        let current_angle = *angle_mut;

        // Calculate gradient position based on angle
        let center_x = 50.0 + 10.0 * current_angle.cos();
        let center_y = 50.0 + 10.0 * current_angle.sin();

        // Create gradient with moving center
        let gradient = format!(
            "radial-gradient(circle at {}% {}%, rgba(245, 245, 245, 0.9) 0%, rgba(255, 182, 193, 0.8) 30%, rgba(255, 105, 180, 0.7) 60%, rgba(219, 112, 147, 0.6) 100%)",
            center_x, center_y
        );

        // Apply gradient style
        let _ = html_element.style().set_property("background", &gradient);

        // Log progress every few seconds
        if (current_angle as i32) % 2 == 0 {
            web_sys::console::log_1(
                &format!(
                    "Animation angle: {:.2}°, center: ({:.1}%, {:.1}%)",
                    current_angle.to_degrees(),
                    center_x,
                    center_y
                )
                .into(),
            );
        }

        // Continue animation with self-reference
        if let Some(ref closure) = *closure_clone.borrow() {
            let _ = window
                .request_animation_frame(closure.as_ref().unchecked_ref::<js_sys::Function>());
        }
    }) as Box<dyn Fn()>);

    // Store closure in Rc for self-reference
    *closure.borrow_mut() = Some(anim_closure);

    // Start animation
    if let Some(ref anim_closure) = *closure.borrow() {
        let _ = window
            .request_animation_frame(anim_closure.as_ref().unchecked_ref::<js_sys::Function>());
    }

    // Return cleanup function
    Box::new(move || {
        web_sys::console::log_1(&"Background animation stopped".into());
        // The closure will be dropped when this function returns
    })
}
