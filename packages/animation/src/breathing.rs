//! Breathing animation module
//!
//! Provides configurable breathing animations for gradients and colors.

use std::time::Duration;

use crate::core::{AnimationOptions, EasingFunction, PlaybackMode};

/// Breathing configuration
///
/// Configures parameters for breathing animations.
#[derive(Debug, Clone, PartialEq)]
pub struct BreathingConfig {
    /// Duration of one breath cycle in milliseconds
    pub duration_ms: u64,
    /// Saturation range: percentage change from base saturation (e.g., 0.05 = ±5%)
    pub saturation_range: f64,
    /// Lightness range: percentage change from base lightness (e.g., 0.05 = ±5%)
    pub lightness_range: f64,
    /// Easing function for the breath cycle
    pub easing: EasingFunction,
}

impl Default for BreathingConfig {
    fn default() -> Self {
        Self {
            duration_ms: 4000,
            saturation_range: 0.05,
            lightness_range: 0.05,
            easing: EasingFunction::EaseInOutSine,
        }
    }
}

impl BreathingConfig {
    pub fn new(duration_ms: u64, saturation_range: f64, lightness_range: f64) -> Self {
        Self {
            duration_ms,
            saturation_range,
            lightness_range,
            easing: EasingFunction::EaseInOutSine,
        }
    }

    pub fn with_easing(mut self, easing: EasingFunction) -> Self {
        self.easing = easing;
        self
    }
}

/// Breathing animation parameters
///
/// Represents the state of a breathing animation at a given time.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BreathingState {
    pub current_saturation_factor: f64,
    pub current_lightness_factor: f64,
}

impl BreathingState {
    pub fn from_progress(progress: f64, config: &BreathingConfig) -> Self {
        let eased_progress = config.easing.apply(progress);

        let saturation_factor = 1.0 + (eased_progress - 0.5) * 2.0 * config.saturation_range;
        let lightness_factor = 1.0 + (eased_progress - 0.5) * 2.0 * config.lightness_range;

        Self {
            current_saturation_factor: saturation_factor,
            current_lightness_factor: lightness_factor,
        }
    }
}

/// Create animation options for breathing animation
///
/// # Arguments
/// * `config` - Breathing configuration
///
/// # Returns
/// AnimationOptions configured for breathing
pub fn breathing_options(config: BreathingConfig) -> AnimationOptions {
    AnimationOptions {
        duration: Duration::from_millis(config.duration_ms),
        easing: config.easing,
        playback: PlaybackMode::Yoyo,
        repeat: None,
        yoyo: true,
        ..Default::default()
    }
}
