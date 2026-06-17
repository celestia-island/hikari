//! Easing function utilities and helpers
//!
//! This module provides convenient functions to create and configure easing functions,
//! including custom bezier curves, and preset animations.
//!
//! For standard easing curves, use [`EasingFunction`] enum variants directly:
//! - `EasingFunction::Linear`
//! - `EasingFunction::EaseInQuad` / `EaseOutQuad` / `EaseInOutQuad`
//! - `EasingFunction::EaseInCubic` / `EaseOutCubic` / `EaseInOutCubic`
//! - ...etc (see [`EasingFunction`] for all variants)

use std::sync::Arc;

use crate::core::EasingFunction;

pub fn custom(f: fn(f64) -> f64) -> EasingFunction {
    EasingFunction::Custom(Arc::new(f))
}

/// Create a cubic bezier easing function
///
/// # Arguments
/// * `x1`, `y1` - First control point
/// * `x2`, `y2` - Second control point
///
/// # Returns
/// Easing function that follows the bezier curve
#[must_use]
pub fn bezier(x1: f64, y1: f64, x2: f64, y2: f64) -> EasingFunction {
    EasingFunction::Custom(Arc::new(move |t| cubic_bezier(t, x1, y1, x2, y2)))
}

fn cubic_bezier(t: f64, x1: f64, y1: f64, x2: f64, y2: f64) -> f64 {
    if x1 == y1 && x2 == y2 {
        return t;
    }

    let sample_curve_x = |t: f64| -> f64 {
        3.0f64.mul_add(
            x1,
            6.0f64
                .mul_add(-x1, 3.0 * x2)
                .mul_add(t, 3.0f64.mul_add(x1, 3.0f64.mul_add(-x2, 1.0)) * t * t),
        ) * t
    };

    let sample_curve_y = |t: f64| -> f64 {
        3.0f64.mul_add(
            y1,
            6.0f64
                .mul_add(-y1, 3.0 * y2)
                .mul_add(t, 3.0f64.mul_add(y1, 3.0f64.mul_add(-y2, 1.0)) * t * t),
        ) * t
    };

    let sample_curve_derivative_x = |t: f64| -> f64 {
        3.0f64.mul_add(
            x1,
            2.0f64.mul_add(
                6.0f64.mul_add(-x1, 3.0 * x2),
                3.0 * 3.0f64.mul_add(x1, 3.0f64.mul_add(-x2, 1.0)) * t,
            ) * t,
        )
    };

    let solve_curve_x = |x: f64| -> f64 {
        let mut t2 = x;
        for _ in 0..8 {
            let x2 = sample_curve_x(t2) - x;
            let d2 = sample_curve_derivative_x(t2);
            if x2.abs() < 1e-7 {
                break;
            }
            if d2.abs() < 1e-7 {
                break;
            }
            t2 -= x2 / d2;
        }
        t2
    };

    sample_curve_y(solve_curve_x(t))
}

/// Create a stepped easing function
///
/// # Arguments
/// * `n` - Number of steps
/// * `start` - Whether to start at the first step immediately
///
/// # Returns
/// Easing function that jumps between discrete steps
#[must_use]
pub fn steps(n: u32, start: bool) -> EasingFunction {
    EasingFunction::Custom(Arc::new(move |t| {
        if t <= 0.0 {
            return 0.0;
        }
        if t >= 1.0 {
            return 1.0;
        }
        let step = if start {
            (t * f64::from(n)).ceil() / f64::from(n)
        } else {
            (t * f64::from(n)).floor() / f64::from(n)
        };
        step.clamp(0.0, 1.0)
    }))
}

/// Create a power easing function
///
/// # Arguments
/// * `p` - Power exponent
///
/// # Returns
/// Easing function with t^p curve
#[must_use]
pub fn power(p: f64) -> EasingFunction {
    EasingFunction::Custom(Arc::new(move |t| t.powf(p)))
}

/// Create an elastic easing function
///
/// # Arguments
/// * `amplitude` - Amplitude of the elastic effect
/// * `period` - Period of the elastic effect
///
/// # Returns
/// Easing function with elastic bounce
#[must_use]
pub fn elastic(amplitude: f64, period: f64) -> EasingFunction {
    EasingFunction::Custom(Arc::new(move |t| {
        if t == 0.0 || t == 1.0 {
            t
        } else {
            let s = period / (2.0 * std::f64::consts::PI) * 1.0_f64.asin();
            (amplitude * (-10.0 * t).exp2())
                .mul_add(((t - s) * 2.0 * std::f64::consts::PI / period).sin(), 1.0)
        }
    }))
}

/// Create a bounce easing function
///
/// # Arguments
/// * `amplitude` - Amplitude of the bounce
///
/// # Returns
/// Easing function with bouncing effect
#[must_use]
pub fn bounce(amplitude: f64) -> EasingFunction {
    EasingFunction::Custom(Arc::new(move |t| {
        if t < 1.0 / 2.75 {
            amplitude * t * t
        } else if t < 2.0 / 2.75 {
            let t = t - 1.5 / 2.75;
            (amplitude * t).mul_add(t, 0.75)
        } else if t < 2.5 / 2.75 {
            let t = t - 2.25 / 2.75;
            (amplitude * t).mul_add(t, 0.9375)
        } else {
            let t = t - 2.625 / 2.75;
            (amplitude * t).mul_add(t, 0.984375)
        }
    }))
}

/// Create an overshoot easing function
///
/// # Arguments
/// * `tension` - Amount of overshoot
///
/// # Returns
/// Easing function that overshoots the target
#[must_use]
pub fn overshoot(tension: f64) -> EasingFunction {
    EasingFunction::Custom(Arc::new(move |t| {
        if t == 0.0 {
            0.0
        } else if t == 1.0 {
            1.0
        } else {
            let s = tension + 1.0;
            (tension * t).mul_add(-t, s * t * t * t)
        }
    }))
}

/// Create an anticipate easing function
///
/// # Arguments
/// * `tension` - Amount of anticipation
///
/// # Returns
/// Easing function that anticipates the movement
#[must_use]
pub fn anticipate(tension: f64) -> EasingFunction {
    EasingFunction::Custom(Arc::new(move |t| {
        let t = t.clamp(0.0, 1.0);
        let s = (tension * t).mul_add(-t, (tension + 1.0) * t * t * t);
        s.clamp(0.0, 1.0)
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_custom() {
        let f = custom(|t| t * 2.0);
        assert!((f.apply(0.5) - 1.0).abs() < 1e-6);
        assert!((f.apply(0.0) - 0.0).abs() < 1e-6);
        assert!((f.apply(1.0) - 2.0).abs() < 1e-6);
    }

    #[test]
    fn test_bezier_linear() {
        let f = bezier(0.0, 0.0, 1.0, 1.0);
        for t in [0.0, 0.25, 0.5, 0.75, 1.0] {
            assert!(
                (f.apply(t) - t).abs() < 1e-6,
                "bezier linear at t={}: expected {}, got {}",
                t,
                t,
                f.apply(t)
            );
        }
    }

    #[test]
    fn test_bezier_ease() {
        let f = bezier(0.25, 0.1, 0.25, 1.0);
        assert!((f.apply(0.0) - 0.0).abs() < 1e-6);
        assert!((f.apply(1.0) - 1.0).abs() < 1e-6);
        let mid = f.apply(0.5);
        assert!(
            (0.0..=1.5).contains(&mid),
            "bezier ease at t=0.5 should be in reasonable range, got {mid}"
        );
    }

    #[test]
    fn test_steps_start_true() {
        let f = steps(4, true);
        assert!((f.apply(0.0) - 0.0).abs() < 1e-6);
        assert!((f.apply(1.0) - 1.0).abs() < 1e-6);
        assert!((f.apply(0.1) - 0.25).abs() < 1e-6);
        assert!((f.apply(0.25) - 0.25).abs() < 1e-6);
        assert!((f.apply(0.3) - 0.5).abs() < 1e-6);
        assert!((f.apply(0.6) - 0.75).abs() < 1e-6);
        assert!((f.apply(0.85) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_steps_start_false() {
        let f = steps(4, false);
        assert!((f.apply(0.0) - 0.0).abs() < 1e-6);
        assert!((f.apply(1.0) - 1.0).abs() < 1e-6);
        assert!((f.apply(0.1) - 0.0).abs() < 1e-6);
        assert!((f.apply(0.25) - 0.25).abs() < 1e-6);
        assert!((f.apply(0.4) - 0.25).abs() < 1e-6);
        assert!((f.apply(0.5) - 0.5).abs() < 1e-6);
        assert!((f.apply(0.75) - 0.75).abs() < 1e-6);
        assert!((f.apply(0.9) - 0.75).abs() < 1e-6);
    }

    #[test]
    fn test_power_2_matches_ease_in_quad() {
        let f = power(2.0);
        for t in [0.0, 0.25, 0.5, 0.75, 1.0] {
            let expected = t * t;
            assert!(
                (f.apply(t) - expected).abs() < 1e-6,
                "power(2) at t={}: expected {}, got {}",
                t,
                expected,
                f.apply(t)
            );
        }
    }

    #[test]
    fn test_power_3_matches_ease_in_cubic() {
        let f = power(3.0);
        for t in [0.0, 0.25, 0.5, 0.75, 1.0] {
            let expected = t * t * t;
            assert!(
                (f.apply(t) - expected).abs() < 1e-6,
                "power(3) at t={}: expected {}, got {}",
                t,
                expected,
                f.apply(t)
            );
        }
    }

    #[test]
    fn test_elastic_boundary_and_midrange() {
        let f = elastic(1.0, 0.3);
        assert!((f.apply(0.0) - 0.0).abs() < 1e-6);
        assert!((f.apply(1.0) - 1.0).abs() < 1e-6);
        let mid = f.apply(0.5);
        assert!(
            mid.is_finite(),
            "elastic mid-range should be finite, got {mid}"
        );
    }

    #[test]
    fn test_bounce_boundary_and_range() {
        let f = bounce(7.5625);
        assert!((f.apply(0.0) - 0.0).abs() < 1e-6);
        assert!(
            (f.apply(1.0) - 7.5625_f64 * (1.0_f64 - 2.625 / 2.75).powi(2) - 0.984375).abs() < 1e-6
        );
        for t in [0.1, 0.3, 0.5, 0.7, 0.9] {
            let v = f.apply(t);
            assert!(
                v.is_finite() && v >= 0.0,
                "bounce({t}) = {v} should be finite and non-negative"
            );
        }
    }

    #[test]
    fn test_overshoot_boundary_and_midrange() {
        let f = overshoot(1.70158);
        assert!((f.apply(0.0) - 0.0).abs() < 1e-6);
        assert!((f.apply(1.0) - 1.0).abs() < 1e-6);
        let mid = f.apply(0.5);
        assert!(
            mid < 0.0,
            "overshoot at t=0.5 should undershoot below 0, got {mid}"
        );
        assert!(mid.is_finite());
    }

    #[test]
    fn test_anticipate_boundary_and_validity() {
        let f = anticipate(2.0);
        assert!((f.apply(0.0) - 0.0).abs() < 1e-6);
        assert!((f.apply(1.0) - 1.0).abs() < 1e-6);
        for t in [0.25, 0.5, 0.75] {
            let v = f.apply(t);
            assert!(
                v.is_finite() && !v.is_nan(),
                "anticipate({t}) produced invalid value: {v}"
            );
        }
    }

    #[test]
    fn test_cubic_bezier_linear_shortcut() {
        assert!((cubic_bezier(0.5, 0.3, 0.3, 0.7, 0.7) - 0.5).abs() < 1e-6);
        assert!((cubic_bezier(0.0, 1.0, 1.0, 2.0, 2.0) - 0.0).abs() < 1e-6);
        assert!((cubic_bezier(1.0, 1.0, 1.0, 2.0, 2.0) - 1.0).abs() < 1e-6);
    }
}
