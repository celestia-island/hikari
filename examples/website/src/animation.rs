//! Animation integration for Hikari website
//!
//! This module provides a clean Rust API for integrating hikari-animation
//! with Tairitsu VDOM components. It supports:
//! - CSS variable animations
//! - Event-driven animations (hover, focus, etc.)
//! - State transition animations
//! - Integration with existing glow effects

use std::collections::HashMap;

/// Animation ID for predefined animation presets
#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub enum AnimationId {
    // Hover animations
    HoverScale,
    HoverGlow,
    HoverLift,
    HoverShine,

    // Focus animations
    FocusPulse,
    FocusGlow,
    FocusBorder,

    // State transitions
    PressScale,
    PressGlow,

    // Continuous animations
    Breathing,
    Pulse,
    Shimmer,

    // Custom animation (uses data-animation-config attribute)
    Custom,
}

impl AnimationId {
    /// Parse animation ID from string
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "hover-scale" => Some(Self::HoverScale),
            "hover-glow" => Some(Self::HoverGlow),
            "hover-lift" => Some(Self::HoverLift),
            "hover-shine" => Some(Self::HoverShine),
            "focus-pulse" => Some(Self::FocusPulse),
            "focus-glow" => Some(Self::FocusGlow),
            "focus-border" => Some(Self::FocusBorder),
            "press-scale" => Some(Self::PressScale),
            "press-glow" => Some(Self::PressGlow),
            "breathing" => Some(Self::Breathing),
            "pulse" => Some(Self::Pulse),
            "shimmer" => Some(Self::Shimmer),
            "custom" => Some(Self::Custom),
            _ => None,
        }
    }

    /// Get CSS class for this animation
    pub fn css_class(&self) -> &'static str {
        match self {
            Self::HoverScale => "hikari-anim--hover-scale",
            Self::HoverGlow => "hikari-anim--hover-glow",
            Self::HoverLift => "hikari-anim--hover-lift",
            Self::HoverShine => "hikari-anim--hover-shine",
            Self::FocusPulse => "hikari-anim--focus-pulse",
            Self::FocusGlow => "hikari-anim--focus-glow",
            Self::FocusBorder => "hikari-anim--focus-border",
            Self::PressScale => "hikari-anim--press-scale",
            Self::PressGlow => "hikari-anim--press-glow",
            Self::Breathing => "hikari-anim--breathing",
            Self::Pulse => "hikari-anim--pulse",
            Self::Shimmer => "hikari-anim--shimmer",
            Self::Custom => "hikari-anim--custom",
        }
    }

    /// Get kebab-case string representation
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::HoverScale => "hover-scale",
            Self::HoverGlow => "hover-glow",
            Self::HoverLift => "hover-lift",
            Self::HoverShine => "hover-shine",
            Self::FocusPulse => "focus-pulse",
            Self::FocusGlow => "focus-glow",
            Self::FocusBorder => "focus-border",
            Self::PressScale => "press-scale",
            Self::PressGlow => "press-glow",
            Self::Breathing => "breathing",
            Self::Pulse => "pulse",
            Self::Shimmer => "shimmer",
            Self::Custom => "custom",
        }
    }
}

/// Animation configuration
#[derive(Clone, Debug)]
pub struct AnimationConfig {
    /// Animation duration in milliseconds
    pub duration_ms: u32,
    /// Easing function
    pub easing: &'static str,
    /// Delay before animation starts (ms)
    pub delay_ms: u32,
    /// Whether animation should loop
    pub infinite: bool,
    /// Custom CSS properties for the animation
    pub custom_vars: HashMap<String, String>,
}

impl Default for AnimationConfig {
    fn default() -> Self {
        Self {
            duration_ms: 300,
            easing: "ease-out",
            delay_ms: 0,
            infinite: false,
            custom_vars: HashMap::new(),
        }
    }
}

impl AnimationConfig {
    /// Create a new animation config
    pub fn new() -> Self {
        Self::default()
    }

    /// Set duration
    pub fn with_duration(mut self, duration_ms: u32) -> Self {
        self.duration_ms = duration_ms;
        self
    }

    /// Set easing
    pub fn with_easing(mut self, easing: &'static str) -> Self {
        self.easing = easing;
        self
    }

    /// Set delay
    pub fn with_delay(mut self, delay_ms: u32) -> Self {
        self.delay_ms = delay_ms;
        self
    }

    /// Make animation infinite
    pub fn infinite(mut self) -> Self {
        self.infinite = true;
        self
    }

    /// Add a custom CSS variable
    pub fn with_custom_var(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.custom_vars.insert(key.into(), value.into());
        self
    }

    /// Convert to CSS style string
    pub fn to_css_style(&self) -> String {
        let mut parts = vec![format!(
            "animation-duration: {}ms; animation-timing-function: {}; animation-delay: {}ms;",
            self.duration_ms, self.easing, self.delay_ms
        )];

        if self.infinite {
            parts.push("animation-iteration-count: infinite;".to_string());
        }

        for (key, value) in &self.custom_vars {
            parts.push(format!("--{}: {};", key, value));
        }

        parts.join(" ")
    }
}

/// Preset animation configurations
pub mod presets {
    use super::*;

    /// Hover scale animation (subtle grow effect)
    pub fn hover_scale() -> AnimationConfig {
        AnimationConfig::new()
            .with_duration(200)
            .with_easing("ease-out")
    }

    /// Hover glow animation (glow intensifies)
    pub fn hover_glow() -> AnimationConfig {
        AnimationConfig::new()
            .with_duration(300)
            .with_easing("ease-out")
            .with_custom_var("glow-intensity", "0.6")
            .with_custom_var("glow-spread", "20px")
    }

    /// Hover lift animation (translate Y with shadow)
    pub fn hover_lift() -> AnimationConfig {
        AnimationConfig::new()
            .with_duration(250)
            .with_easing("cubic-bezier(0.34, 1.56, 0.64, 1)")
    }

    /// Hover shine animation (sweeping light effect)
    pub fn hover_shine() -> AnimationConfig {
        AnimationConfig::new()
            .with_duration(600)
            .with_easing("ease-out")
    }

    /// Focus pulse animation (subtle pulse on focus)
    pub fn focus_pulse() -> AnimationConfig {
        AnimationConfig::new()
            .with_duration(400)
            .with_easing("ease-in-out")
            .infinite()
    }

    /// Focus glow animation (glow appears on focus)
    pub fn focus_glow() -> AnimationConfig {
        AnimationConfig::new()
            .with_duration(200)
            .with_easing("ease-out")
            .with_custom_var("glow-opacity", "1")
    }

    /// Press scale animation (shrink on press)
    pub fn press_scale() -> AnimationConfig {
        AnimationConfig::new()
            .with_duration(100)
            .with_easing("ease-out")
    }

    /// Breathing animation (continuous breathe effect)
    pub fn breathing() -> AnimationConfig {
        AnimationConfig::new()
            .with_duration(3000)
            .with_easing("ease-in-out")
            .infinite()
    }

    /// Pulse animation (continuous pulse)
    pub fn pulse() -> AnimationConfig {
        AnimationConfig::new()
            .with_duration(2000)
            .with_easing("ease-in-out")
            .infinite()
    }
}

/// Get animation class name for an animation ID
pub fn get_animation_class(animation_id: AnimationId) -> String {
    animation_id.css_class().to_string()
}

/// Get animation attributes for a VElement
///
/// Returns a vector of (attribute_name, attribute_value) pairs that can be
/// applied to a VElement to enable animations.
pub fn animation_attrs(animation_id: AnimationId) -> Vec<(&'static str, String)> {
    vec![("data-animation", animation_id.as_str().to_string())]
}

/// Get animation attributes with custom config
pub fn animation_attrs_with_config(
    animation_id: AnimationId,
    config: &AnimationConfig,
) -> Vec<(&'static str, String)> {
    let mut attrs = vec![("data-animation", animation_id.as_str().to_string())];

    if !config.custom_vars.is_empty() || config.duration_ms != 300 {
        attrs.push(("data-animation-config", config.to_css_style()));
    }

    attrs
}

/// Build a CSS class string with animation class
pub fn with_animation_class(base_classes: &str, animation_id: AnimationId) -> String {
    format!("{} {}", base_classes, animation_id.css_class())
}

/// Create animation style attribute from config
pub fn animation_style(config: &AnimationConfig) -> String {
    config.to_css_style()
}
