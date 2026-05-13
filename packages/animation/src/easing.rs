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

use crate::core::EasingFunction;

/// Create a custom easing function
///
/// # Arguments
/// * `f` - Function that takes progress (0.0-1.0) and returns eased value
pub fn custom(f: fn(f64) -> f64) -> EasingFunction {
    EasingFunction::Custom(Box::new(f))
}

/// Create a cubic bezier easing function
///
/// # Arguments
/// * `x1`, `y1` - First control point
/// * `x2`, `y2` - Second control point
///
/// # Returns
/// Easing function that follows the bezier curve
pub fn bezier(x1: f64, y1: f64, x2: f64, y2: f64) -> EasingFunction {
    EasingFunction::Custom(Box::new(move |t| cubic_bezier(t, x1, y1, x2, y2)))
}

fn cubic_bezier(t: f64, x1: f64, y1: f64, x2: f64, y2: f64) -> f64 {
    if x1 == y1 && x2 == y2 {
        return t;
    }

    let sample_curve_x = |t: f64| -> f64 {
        ((1.0 - 3.0 * x2 + 3.0 * x1) * t * t + (3.0 * x2 - 6.0 * x1) * t + 3.0 * x1) * t
    };

    let sample_curve_y = |t: f64| -> f64 {
        ((1.0 - 3.0 * y2 + 3.0 * y1) * t * t + (3.0 * y2 - 6.0 * y1) * t + 3.0 * y1) * t
    };

    let sample_curve_derivative_x = |t: f64| -> f64 {
        (3.0 * (1.0 - 3.0 * x2 + 3.0 * x1) * t + 2.0 * (3.0 * x2 - 6.0 * x1)) * t + 3.0 * x1
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
pub fn steps(n: u32, start: bool) -> EasingFunction {
    EasingFunction::Custom(Box::new(move |t| {
        if t <= 0.0 {
            return 0.0;
        }
        if t >= 1.0 {
            return 1.0;
        }
        let step = if start {
            (t * n as f64).ceil() / n as f64
        } else {
            (t * n as f64).floor() / n as f64
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
pub fn power(p: f64) -> EasingFunction {
    EasingFunction::Custom(Box::new(move |t| t.powf(p)))
}

/// Create an elastic easing function
///
/// # Arguments
/// * `amplitude` - Amplitude of the elastic effect
/// * `period` - Period of the elastic effect
///
/// # Returns
/// Easing function with elastic bounce
pub fn elastic(amplitude: f64, period: f64) -> EasingFunction {
    EasingFunction::Custom(Box::new(move |t| {
        if t == 0.0 || t == 1.0 {
            t
        } else {
            let s = period / (2.0 * std::f64::consts::PI) * 1.0_f64.asin();
            amplitude
                * 2.0_f64.powf(-10.0 * t)
                * ((t - s) * 2.0 * std::f64::consts::PI / period).sin()
                + 1.0
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
pub fn bounce(amplitude: f64) -> EasingFunction {
    EasingFunction::Custom(Box::new(move |t| {
        if t < 1.0 / 2.75 {
            amplitude * t * t
        } else if t < 2.0 / 2.75 {
            let t = t - 1.5 / 2.75;
            amplitude * t * t + 0.75
        } else if t < 2.5 / 2.75 {
            let t = t - 2.25 / 2.75;
            amplitude * t * t + 0.9375
        } else {
            let t = t - 2.625 / 2.75;
            amplitude * t * t + 0.984375
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
pub fn overshoot(tension: f64) -> EasingFunction {
    EasingFunction::Custom(Box::new(move |t| {
        if t == 0.0 {
            0.0
        } else if t == 1.0 {
            1.0
        } else {
            let s = tension + 1.0;
            s * t * t * t - tension * t * t
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
pub fn anticipate(tension: f64) -> EasingFunction {
    EasingFunction::Custom(Box::new(move |t| {
        let s = tension * t * t * (2.0 * t - tension - 2.0);
        if s.abs() > 1.0 {
            1.0
        } else if s < 0.0 {
            0.0
        } else {
            s
        }
    }))
}
