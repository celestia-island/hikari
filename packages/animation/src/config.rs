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
    #[must_use]
    pub fn scale_duration(&self, duration_ms: u64) -> u64 {
        if !self.enabled || self.reduced_motion {
            return 0;
        }
        (duration_ms as f32 * self.duration_scale) as u64
    }

    /// Apply duration scaling (f64 version)
    #[must_use]
    pub fn scale_duration_f64(&self, duration_ms: f64) -> f64 {
        if !self.enabled || self.reduced_motion {
            return 0.0;
        }
        duration_ms * f64::from(self.duration_scale)
    }

    /// Check if animations should be skipped entirely
    #[must_use]
    pub const fn should_skip(&self) -> bool {
        !self.enabled || self.reduced_motion
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_values() {
        let cfg = AnimationConfig::default();
        assert!(cfg.enabled);
        assert_eq!(cfg.duration_scale, 1.0);
        assert!(!cfg.reduced_motion);
    }

    #[test]
    fn scale_duration_normal() {
        let cfg = AnimationConfig::default();
        assert_eq!(cfg.scale_duration(1000), 1000);
    }

    #[test]
    fn scale_duration_half_speed() {
        let cfg = AnimationConfig {
            duration_scale: 2.0,
            ..Default::default()
        };
        assert_eq!(cfg.scale_duration(1000), 2000);
    }

    #[test]
    fn scale_duration_double_speed() {
        let cfg = AnimationConfig {
            duration_scale: 0.5,
            ..Default::default()
        };
        assert_eq!(cfg.scale_duration(1000), 500);
    }

    #[test]
    fn scale_duration_disabled_returns_zero() {
        let cfg = AnimationConfig {
            enabled: false,
            ..Default::default()
        };
        assert_eq!(cfg.scale_duration(1000), 0);
    }

    #[test]
    fn scale_duration_reduced_motion_returns_zero() {
        let cfg = AnimationConfig {
            reduced_motion: true,
            ..Default::default()
        };
        assert_eq!(cfg.scale_duration(1000), 0);
    }

    #[test]
    fn scale_duration_zero_scale() {
        let cfg = AnimationConfig {
            duration_scale: 0.0,
            ..Default::default()
        };
        assert_eq!(cfg.scale_duration(1000), 0);
    }

    #[test]
    fn scale_duration_f64_normal() {
        let cfg = AnimationConfig::default();
        assert_eq!(cfg.scale_duration_f64(1000.0), 1000.0);
    }

    #[test]
    fn scale_duration_f64_disabled() {
        let cfg = AnimationConfig {
            enabled: false,
            ..Default::default()
        };
        assert_eq!(cfg.scale_duration_f64(1000.0), 0.0);
    }

    #[test]
    fn scale_duration_f64_reduced_motion() {
        let cfg = AnimationConfig {
            reduced_motion: true,
            ..Default::default()
        };
        assert_eq!(cfg.scale_duration_f64(1000.0), 0.0);
    }

    #[test]
    fn scale_duration_f64_custom_scale() {
        let cfg = AnimationConfig {
            duration_scale: 3.0,
            ..Default::default()
        };
        assert_eq!(cfg.scale_duration_f64(250.0), 750.0);
    }

    #[test]
    fn should_skip_default_false() {
        assert!(!AnimationConfig::default().should_skip());
    }

    #[test]
    fn should_skip_disabled() {
        let cfg = AnimationConfig {
            enabled: false,
            ..Default::default()
        };
        assert!(cfg.should_skip());
    }

    #[test]
    fn should_skip_reduced_motion() {
        let cfg = AnimationConfig {
            reduced_motion: true,
            ..Default::default()
        };
        assert!(cfg.should_skip());
    }

    #[test]
    fn should_skip_both() {
        let cfg = AnimationConfig {
            enabled: false,
            reduced_motion: true,
            ..Default::default()
        };
        assert!(cfg.should_skip());
    }

    #[test]
    fn partial_eq_same() {
        let a = AnimationConfig::default();
        let b = AnimationConfig::default();
        assert_eq!(a, b);
    }

    #[test]
    fn partial_eq_different() {
        let a = AnimationConfig::default();
        let b = AnimationConfig {
            duration_scale: 0.5,
            ..Default::default()
        };
        assert_ne!(a, b);
    }

    #[test]
    fn clone_independence() {
        let a = AnimationConfig {
            duration_scale: 2.0,
            ..Default::default()
        };
        let mut b = a;
        b.duration_scale = 1.0;
        assert_eq!(a.duration_scale, 2.0);
        assert_eq!(b.duration_scale, 1.0);
    }

    #[test]
    fn debug_format() {
        let cfg = AnimationConfig::default();
        let debug_str = format!("{cfg:?}");
        assert!(debug_str.contains("enabled"));
        assert!(debug_str.contains("duration_scale"));
        assert!(debug_str.contains("reduced_motion"));
    }

    #[test]
    fn scale_duration_zero_input() {
        let cfg = AnimationConfig::default();
        assert_eq!(cfg.scale_duration(0), 0);
    }

    #[test]
    fn scale_duration_f64_zero_input() {
        let cfg = AnimationConfig::default();
        assert_eq!(cfg.scale_duration_f64(0.0), 0.0);
    }

    #[test]
    fn scale_duration_small_truncation() {
        let cfg = AnimationConfig {
            duration_scale: 0.5,
            ..Default::default()
        };
        assert_eq!(cfg.scale_duration(1), 0);
    }

    #[test]
    fn scale_duration_large_scale_no_overflow_check() {
        let cfg = AnimationConfig {
            duration_scale: 10.0,
            ..Default::default()
        };
        let result = cfg.scale_duration(100);
        assert!(result > 100);
    }
}
