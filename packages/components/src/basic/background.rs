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
#[component]
pub fn Background(props: BackgroundProps) -> Element {
    rsx! {
        div {
            class: "hi-background",
            {props.children}
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
