//! Background component
//!
//! Provides a full-screen gradient background with breathing color effects.
//! Automatically adapts to theme changes via global theme provider registry.
//! Includes a 60-second rotating gradient animation with configurable breathing.

use crate::style_builder::StyleStringBuilder;
use crate::{platform, prelude::*, styled::StyledComponent};
use hikari_palette::classes::{BackgroundClass, UtilityClass};

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
    // Animation state using CSS variables
    let animation_style = use_signal(String::new);

    use_effect(move || {
        // Start the gradient animation using platform layer
        let animation_style_clone = animation_style.clone();
        let _stop = start_gradient_animation(move |style| {
            animation_style_clone.set(style);
        });
    });

    rsx! {
        div {
            class: BackgroundClass::Background.as_class(),
            style: "{animation_style}",
            {props.children}
        }
    }
}

/// Animation state for tracking the gradient animation
struct AnimationState {
    start_time: f64,
    stopped: bool,
}

/// Starts the gradient animation for the background
///
/// Returns a cleanup function that stops the animation when called.
fn start_gradient_animation<F>(mut update_style: F) -> Box<dyn FnOnce()>
where
    F: FnMut(String) + 'static,
{
    let state = std::rc::Rc::new(std::cell::RefCell::new(AnimationState {
        start_time: platform::now_timestamp(),
        stopped: false,
    }));

    let period_ms = 60000.0;
    let radius_percent = 20.0;
    let center_x = 50.0;
    let center_y = 50.0;

    let state_clone = state.clone();

    platform::request_animation_frame_with_timestamp(move |timestamp| {
        let state_borrow = state_clone.borrow_mut();
        if state_borrow.stopped {
            return;
        }

        let elapsed = timestamp - state_borrow.start_time;
        let current_time = elapsed;

        let angle = (current_time / period_ms) * 2.0 * std::f64::consts::PI;

        let x = center_x + radius_percent * angle.cos();
        let y = center_y + radius_percent * angle.sin();

        // Default to hikari theme colors
        let breathing_progress = (current_time / 4000.0) % 2.0;
        let actual_progress = if breathing_progress > 1.0 {
            2.0 - breathing_progress
        } else {
            breathing_progress
        };

        let sin_val = (actual_progress * std::f64::consts::PI).sin();
        let saturation_factor = 1.0 + (sin_val * 0.05);
        let lightness_factor = 1.0 + (sin_val * 0.05);

        // Use CSS custom properties for theme colors
        let style = StyleStringBuilder::new()
            .add_var("bg-center-x", &format!("{:.1}%", x))
            .add_var("bg-center-y", &format!("{:.1}%", y))
            .add_var("bg-saturation-factor", &format!("{:.3}", saturation_factor))
            .add_var("bg-lightness-factor", &format!("{:.3}", lightness_factor))
            .build();

        update_style(style);
    });

    let state_final = state.clone();
    Box::new(move || {
        state_final.borrow_mut().stopped = true;
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
