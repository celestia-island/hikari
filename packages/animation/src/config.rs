//! Animation configuration
//!
//! Provides global animation settings that can be accessed throughout the application.

/// Global animation configuration
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct AnimationConfig {
    /// Whether animations are enabled (default: true)
    pub enabled: bool,

    /// Global animation duration scale factor
    /// - 1.0 = normal speed
    /// - 0.5 = twice as fast
    /// - 2.0 = twice as slow
    /// - 0.0 = disable all animations (equivalent to enabled = false)
    pub duration_scale: f32,

    /// Whether reduced motion mode is active
    /// When true, non-essential animations should be reduced or disabled
    pub reduced_motion: bool,
}

impl Default for AnimationConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            duration_scale: 1.0,
            reduced_motion: false,
        }
    }
}

impl AnimationConfig {
    /// Apply duration scaling
    ///
    /// Returns 0 if animations are disabled or reduced motion is active
    pub fn scale_duration(&self, duration_ms: u64) -> u64 {
        if !self.enabled || self.reduced_motion {
            return 0;
        }
        (duration_ms as f32 * self.duration_scale) as u64
    }

    /// Apply duration scaling (f64 version)
    pub fn scale_duration_f64(&self, duration_ms: f64) -> f64 {
        if !self.enabled || self.reduced_motion {
            return 0.0;
        }
        duration_ms * self.duration_scale as f64
    }

    /// Check if animations should be skipped entirely
    pub fn should_skip(&self) -> bool {
        !self.enabled || self.reduced_motion
    }
}
