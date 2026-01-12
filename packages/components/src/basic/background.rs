//! Background component
//!
//! Provides a full-screen gradient background that sits behind all content.
//! Automatically adapts to theme changes via CSS variables.
//! Includes a 60-second rotating gradient animation.

use dioxus::prelude::*;

use crate::styled::StyledComponent;

#[cfg(target_arch = "wasm32")]
use animation::{
    style::{CssProperty, StyleBuilder},
    TimerManager,
};

/// Background component type wrapper (for implementing StyledComponent)
pub struct BackgroundComponent;

/// Background component properties
///
/// Defines the props accepted by [`Background`] component.
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
/// - `data-theme="hikari"` (light): 素 → 粉红 gradient with 60s rotation
/// - `data-theme="tairitsu"` (dark): 深蓝 → 纯黑 gradient with 60s rotation
///
/// # Animation
///
/// The gradient slowly rotates over 60 seconds, creating a subtle, non-static background.
/// The animation is managed by `hikari-animation`'s `TimerManager` with 60fps updates.
#[component]
pub fn Background(props: BackgroundProps) -> Element {
    #[cfg(target_arch = "wasm32")]
    {
        use_hook(|| start_gradient_rotation());
    }

    rsx! {
        div {
            class: "hi-background",
            {props.children}
        }
    }
}

/// Starts gradient rotation animation using TimerManager from hikari-animation
#[cfg(target_arch = "wasm32")]
fn start_gradient_rotation() {
    use wasm_bindgen::JsCast;

    if let Some(window) = web_sys::window() {
        if let Some(document) = window.document() {
            let timer_manager = TimerManager::new();
            let position = std::cell::RefCell::new(0.0);

            let duration = 60000.0;
            let fps = 60;
            let interval_ms = (1000.0 / fps as f64) as u64;
            let position_per_frame = 100.0 / (duration / interval_ms as f64);

            timer_manager.set_interval(
                std::rc::Rc::new(move || {
                    *position.borrow_mut() = (*position.borrow() + position_per_frame) % 100.0;
                    let current_position = *position.borrow();

                    if let Some(element) = document
                        .query_selector(".hi-background")
                        .ok()
                        .flatten()
                        .and_then(|el| el.dyn_into::<web_sys::HtmlElement>().ok())
                    {
                        StyleBuilder::new(&element)
                            .add(
                                CssProperty::BackgroundPosition,
                                &format!("{}% 50%", current_position),
                            )
                            .apply();
                    }
                }),
                std::time::Duration::from_millis(interval_ms),
            );
        }
    }
}

impl StyledComponent for BackgroundComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/background.css"))
    }

    fn name() -> &'static str {
        "background"
    }
}
