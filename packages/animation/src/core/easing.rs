//! Easing functions for animations

use std::sync::Arc;

#[derive(Default, Clone)]
pub enum EasingFunction {
    #[default]
    Linear,

    EaseInQuad,
    EaseOutQuad,
    EaseInOutQuad,

    EaseInCubic,
    EaseOutCubic,
    EaseInOutCubic,

    EaseInQuart,
    EaseOutQuart,
    EaseInOutQuart,

    EaseInQuint,
    EaseOutQuint,
    EaseInOutQuint,

    EaseInExpo,
    EaseOutExpo,
    EaseInOutExpo,

    EaseInCirc,
    EaseOutCirc,
    EaseInOutCirc,

    EaseInSine,
    EaseOutSine,
    EaseInOutSine,

    EaseInBack,
    EaseOutBack,
    EaseInOutBack,

    EaseInElastic,
    EaseOutElastic,
    EaseInOutElastic,

    EaseInBounce,
    EaseOutBounce,
    EaseInOutBounce,

    Custom(Arc<dyn Fn(f64) -> f64>),
}

impl PartialEq for EasingFunction {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Custom(a), Self::Custom(b)) => Arc::ptr_eq(a, b),
            _ => std::mem::discriminant(self) == std::mem::discriminant(other),
        }
    }
}

impl std::fmt::Debug for EasingFunction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Linear => write!(f, "Linear"),
            Self::EaseInQuad => write!(f, "EaseInQuad"),
            Self::EaseOutQuad => write!(f, "EaseOutQuad"),
            Self::EaseInOutQuad => write!(f, "EaseInOutQuad"),
            Self::EaseInCubic => write!(f, "EaseInCubic"),
            Self::EaseOutCubic => write!(f, "EaseOutCubic"),
            Self::EaseInOutCubic => write!(f, "EaseInOutCubic"),
            Self::EaseInQuart => write!(f, "EaseInQuart"),
            Self::EaseOutQuart => write!(f, "EaseOutQuart"),
            Self::EaseInOutQuart => write!(f, "EaseInOutQuart"),
            Self::EaseInQuint => write!(f, "EaseInQuint"),
            Self::EaseOutQuint => write!(f, "EaseOutQuint"),
            Self::EaseInOutQuint => write!(f, "EaseInOutQuint"),
            Self::EaseInExpo => write!(f, "EaseInExpo"),
            Self::EaseOutExpo => write!(f, "EaseOutExpo"),
            Self::EaseInOutExpo => write!(f, "EaseInOutExpo"),
            Self::EaseInCirc => write!(f, "EaseInCirc"),
            Self::EaseOutCirc => write!(f, "EaseOutCirc"),
            Self::EaseInOutCirc => write!(f, "EaseInOutCirc"),
            Self::EaseInSine => write!(f, "EaseInSine"),
            Self::EaseOutSine => write!(f, "EaseOutSine"),
            Self::EaseInOutSine => write!(f, "EaseInOutSine"),
            Self::EaseInBack => write!(f, "EaseInBack"),
            Self::EaseOutBack => write!(f, "EaseOutBack"),
            Self::EaseInOutBack => write!(f, "EaseInOutBack"),
            Self::EaseInElastic => write!(f, "EaseInElastic"),
            Self::EaseOutElastic => write!(f, "EaseOutElastic"),
            Self::EaseInOutElastic => write!(f, "EaseInOutElastic"),
            Self::EaseInBounce => write!(f, "EaseInBounce"),
            Self::EaseOutBounce => write!(f, "EaseOutBounce"),
            Self::EaseInOutBounce => write!(f, "EaseInOutBounce"),
            Self::Custom(_) => write!(f, "Custom(<closure>)"),
        }
    }
}

impl EasingFunction {
    #[must_use]
    pub fn apply(&self, t: f64) -> f64 {
        match self {
            Self::Linear => t,
            Self::EaseInQuad => t * t,
            Self::EaseOutQuad => t * (2.0 - t),
            Self::EaseInOutQuad => {
                if t < 0.5 {
                    2.0 * t * t
                } else {
                    2.0f64.mul_add(-t, 4.0).mul_add(t, -1.0)
                }
            }
            Self::EaseInCubic => t * t * t,
            Self::EaseOutCubic => {
                let t = t - 1.0;
                (t * t).mul_add(t, 1.0)
            }
            Self::EaseInOutCubic => {
                if t < 0.5 {
                    4.0 * t * t * t
                } else {
                    let t = t.mul_add(2.0, -2.0);
                    1.0 + t * t * t / 2.0
                }
            }
            Self::EaseInQuart => t * t * t * t,
            Self::EaseOutQuart => {
                let t = t - 1.0;
                (t * t * t).mul_add(-t, 1.0)
            }
            Self::EaseInOutQuart => {
                if t < 0.5 {
                    8.0 * t * t * t * t
                } else {
                    let t = t - 1.0;
                    (8.0 * t * t * t).mul_add(-t, 1.0)
                }
            }
            Self::EaseInQuint => t * t * t * t * t,
            Self::EaseOutQuint => {
                let t = t - 1.0;
                (t * t * t * t).mul_add(t, 1.0)
            }
            Self::EaseInOutQuint => {
                if t < 0.5 {
                    16.0 * t * t * t * t * t
                } else {
                    let t = t.mul_add(2.0, -2.0);
                    1.0 + t * t * t * t * t / 2.0
                }
            }
            Self::EaseInExpo => {
                if t == 0.0 {
                    0.0
                } else {
                    (10.0 * (t - 1.0)).exp2()
                }
            }
            Self::EaseOutExpo => {
                if t == 1.0 {
                    1.0
                } else {
                    1.0 - (-10.0 * t).exp2()
                }
            }
            Self::EaseInOutExpo => {
                if t == 0.0 {
                    0.0
                } else if t == 1.0 {
                    1.0
                } else if t < 0.5 {
                    20.0f64.mul_add(t, -10.0).exp2() / 2.0
                } else {
                    (2.0 - (-20.0f64).mul_add(t, 10.0).exp2()) / 2.0
                }
            }
            Self::EaseInCirc => 1.0 - t.mul_add(-t, 1.0).sqrt(),
            Self::EaseOutCirc => {
                let t = t - 1.0;
                (1.0 - t * t).sqrt()
            }
            Self::EaseInOutCirc => {
                if t < 0.5 {
                    (1.0 - (4.0 * t).mul_add(-t, 1.0).sqrt()) / 2.0
                } else {
                    ((-2.0f64)
                        .mul_add(t, 2.0)
                        .mul_add(-(-2.0f64).mul_add(t, 2.0), 1.0)
                        .sqrt()
                        + 1.0)
                        / 2.0
                }
            }
            Self::EaseInSine => 1.0 - (t * std::f64::consts::PI / 2.0).cos(),
            Self::EaseOutSine => (t * std::f64::consts::PI / 2.0).sin(),
            Self::EaseInOutSine => -((std::f64::consts::PI * t).cos() - 1.0) / 2.0,
            Self::EaseInBack => {
                const C1: f64 = 1.70158;
                const C3: f64 = C1 + 1.0;
                (C1 * t).mul_add(-t, C3 * t * t * t)
            }
            Self::EaseOutBack => {
                const C1: f64 = 1.70158;
                const C3: f64 = C1 + 1.0;
                C1.mul_add((t - 1.0).powi(2), C3.mul_add((t - 1.0).powi(3), 1.0))
            }
            Self::EaseInOutBack => {
                const C1: f64 = 1.70158;
                const C2: f64 = C1 * 1.525;
                if t < 0.5 {
                    ((2.0 * t).powi(2) * ((C2 + 1.0) * 2.0).mul_add(t, -C2)) / 2.0
                } else {
                    2.0f64
                        .mul_add(t, -2.0)
                        .powi(2)
                        .mul_add((C2 + 1.0).mul_add(t.mul_add(2.0, -2.0), C2), 2.0)
                        / 2.0
                }
            }
            Self::EaseInElastic => {
                if t == 0.0 {
                    0.0
                } else if t == 1.0 {
                    1.0
                } else {
                    -10.0f64.mul_add(t, -10.0).exp2()
                        * (t.mul_add(10.0, -10.75) * 2.0 * std::f64::consts::PI / 3.0).sin()
                }
            }
            Self::EaseOutElastic => {
                if t == 0.0 {
                    0.0
                } else if t == 1.0 {
                    1.0
                } else {
                    (-10.0 * t).exp2().mul_add(
                        (t.mul_add(10.0, -0.75) * 2.0 * std::f64::consts::PI / 3.0).sin(),
                        1.0,
                    )
                }
            }
            Self::EaseInOutElastic => {
                if t == 0.0 {
                    0.0
                } else if t == 1.0 {
                    1.0
                } else if t < 0.5 {
                    -(20.0f64.mul_add(t, -10.0).exp2()
                        * (20.0f64.mul_add(t, -11.125) * 2.0 * std::f64::consts::PI / 4.5).sin())
                        / 2.0
                } else {
                    ((-20.0f64).mul_add(t, 10.0).exp2()
                        * (20.0f64.mul_add(t, -11.125) * 2.0 * std::f64::consts::PI / 4.5).sin())
                        / 2.0
                        + 1.0
                }
            }
            Self::EaseInBounce => 1.0 - Self::EaseOutBounce.apply(1.0 - t),
            Self::EaseOutBounce => {
                const N1: f64 = 7.5625;
                const D1: f64 = 2.75;

                if t < 1.0 / D1 {
                    N1 * t * t
                } else if t < 2.0 / D1 {
                    let t = t - 1.5 / D1;
                    (N1 * t).mul_add(t, 0.75)
                } else if t < 2.5 / D1 {
                    let t = t - 2.25 / D1;
                    (N1 * t).mul_add(t, 0.9375)
                } else {
                    let t = t - 2.625 / D1;
                    (N1 * t).mul_add(t, 0.984375)
                }
            }
            Self::EaseInOutBounce => {
                if t < 0.5 {
                    (1.0 - Self::EaseOutBounce.apply(2.0f64.mul_add(-t, 1.0))) / 2.0
                } else {
                    (1.0 + Self::EaseOutBounce.apply(2.0f64.mul_add(t, -1.0))) / 2.0
                }
            }
            Self::Custom(f) => f(t),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::EasingFunction;

    const EPS: f64 = 1e-10;

    fn approx_eq(a: f64, b: f64) -> bool {
        (a - b).abs() < EPS
    }

    fn all_named_variants() -> Vec<EasingFunction> {
        vec![
            EasingFunction::Linear,
            EasingFunction::EaseInQuad,
            EasingFunction::EaseOutQuad,
            EasingFunction::EaseInOutQuad,
            EasingFunction::EaseInCubic,
            EasingFunction::EaseOutCubic,
            EasingFunction::EaseInOutCubic,
            EasingFunction::EaseInQuart,
            EasingFunction::EaseOutQuart,
            EasingFunction::EaseInOutQuart,
            EasingFunction::EaseInQuint,
            EasingFunction::EaseOutQuint,
            EasingFunction::EaseInOutQuint,
            EasingFunction::EaseInExpo,
            EasingFunction::EaseOutExpo,
            EasingFunction::EaseInOutExpo,
            EasingFunction::EaseInCirc,
            EasingFunction::EaseOutCirc,
            EasingFunction::EaseInOutCirc,
            EasingFunction::EaseInSine,
            EasingFunction::EaseOutSine,
            EasingFunction::EaseInOutSine,
            EasingFunction::EaseInBack,
            EasingFunction::EaseOutBack,
            EasingFunction::EaseInOutBack,
            EasingFunction::EaseInElastic,
            EasingFunction::EaseOutElastic,
            EasingFunction::EaseInOutElastic,
            EasingFunction::EaseInBounce,
            EasingFunction::EaseOutBounce,
            EasingFunction::EaseInOutBounce,
        ]
    }

    fn all_variants_including_custom() -> Vec<EasingFunction> {
        let mut v = all_named_variants();
        v.push(EasingFunction::Custom(Arc::new(|t| t * 2.0)));
        v
    }

    #[test]
    fn clone_preserves_identity_for_named_variants() {
        for variant in all_named_variants() {
            let cloned = variant.clone();
            let orig_val = variant.apply(0.5);
            let clone_val = cloned.apply(0.5);
            let equal = if orig_val.is_nan() && clone_val.is_nan() {
                true
            } else {
                approx_eq(orig_val, clone_val)
            };
            assert!(
                equal,
                "Clone produced different apply(0.5) for {variant:?}: {orig_val} vs {clone_val}"
            );
        }
    }

    #[test]
    fn clone_preserves_function_for_custom_variant() {
        let custom = EasingFunction::Custom(Arc::new(|t: f64| t * 2.0));
        let cloned = custom.clone();
        for t in [0.0, 0.25, 0.5, 0.75, 1.0] {
            assert_eq!(
                custom.apply(t),
                cloned.apply(t),
                "Custom clone mismatch at t={t}"
            );
        }
        // The cloned Custom should be equal (Arc clone shares the same pointer)
        assert_eq!(custom, cloned, "Cloned Custom should be Arc-equal");
    }

    #[test]
    fn partial_eq_reflexivity_named_variants() {
        for variant in all_named_variants() {
            assert_eq!(variant, variant, "Reflexivity failed for {variant:?}");
        }
    }

    #[test]
    fn partial_eq_custom_same_function_different_arc_not_equal() {
        let a = EasingFunction::Custom(Arc::new(|t: f64| t * 2.0));
        let b = EasingFunction::Custom(Arc::new(|t: f64| t * 2.0));
        assert_ne!(
            a, b,
            "Two separate Custom instances with identical closures must NOT be equal (different Arc pointers)"
        );
    }

    #[test]
    fn partial_eq_custom_same_arc_equal() {
        let arc: Arc<dyn Fn(f64) -> f64> = Arc::new(|t| t * 2.0);
        let a = EasingFunction::Custom(arc.clone());
        let b = EasingFunction::Custom(arc);
        assert_eq!(a, b, "Custom with same Arc should be equal");
    }

    #[test]
    fn partial_eq_symmetry() {
        let variants = all_named_variants();
        for (i, a) in variants.iter().enumerate() {
            for (j, b) in variants.iter().enumerate() {
                assert_eq!(
                    a == b,
                    b == a,
                    "Symmetry failed for indices {i} and {j}"
                );
            }
        }
    }

    #[test]
    fn boundary_values_all_variants() {
        for variant in all_variants_including_custom() {
            let at_zero = variant.apply(0.0);
            let at_one = variant.apply(1.0);
            assert!(
                approx_eq(at_zero, 0.0),
                "apply(0.0) != 0.0 for {variant:?}: got {at_zero}"
            );
            // Custom(|t| t * 2.0) gives apply(1.0) = 2.0, not 1.0, so skip boundary check for it
            if !matches!(variant, EasingFunction::Custom(_)) {
                assert!(
                    approx_eq(at_one, 1.0),
                    "apply(1.0) != 1.0 for {variant:?}: got {at_one}"
                );
            }
        }
    }

    #[test]
    fn boundary_values_custom_identity() {
        let custom = EasingFunction::Custom(Arc::new(|t: f64| t));
        assert!(
            approx_eq(custom.apply(0.0), 0.0),
            "Custom identity: apply(0.0) != 0.0"
        );
        assert!(
            approx_eq(custom.apply(1.0), 1.0),
            "Custom identity: apply(1.0) != 1.0"
        );
    }

    #[test]
    fn monotonicity_linear() {
        check_monotonic(&EasingFunction::Linear);
    }

    #[test]
    fn monotonicity_ease_in_quad() {
        check_monotonic(&EasingFunction::EaseInQuad);
    }

    #[test]
    fn monotonicity_ease_out_quad() {
        check_monotonic(&EasingFunction::EaseOutQuad);
    }

    fn check_monotonic(easing: &EasingFunction) {
        let n: usize = 10;
        let mut prev = easing.apply(0.0);
        for i in 1..=n {
            let t = i as f64 / n as f64;
            let val = easing.apply(t);
            assert!(
                val >= prev - EPS,
                "Non-monotonic for {:?}: apply({}) = {} > apply({}) = {}",
                easing,
                (i - 1) as f64 / n as f64,
                prev,
                t,
                val
            );
            prev = val;
        }
    }

    #[test]
    fn debug_format_contains_variant_name() {
        assert!(format!("{:?}", EasingFunction::Linear).contains("Linear"));
        assert!(format!("{:?}", EasingFunction::EaseInQuad).contains("EaseInQuad"));
        assert!(format!("{:?}", EasingFunction::EaseOutCubic).contains("EaseOutCubic"));
        assert!(format!("{:?}", EasingFunction::EaseInOutExpo).contains("EaseInOutExpo"));
        assert!(format!("{:?}", EasingFunction::EaseInBounce).contains("EaseInBounce"));
        assert!(format!("{:?}", EasingFunction::Custom(Arc::new(|_| 0.0))).contains("Custom"));
    }

    #[test]
    fn default_is_linear() {
        assert_eq!(EasingFunction::default(), EasingFunction::Linear);
    }

    #[test]
    fn apply_sanity_all_variants() {
        let variants = all_variants_including_custom();
        for variant in &variants {
            for &t in &[0.25, 0.5, 0.75] {
                let val = variant.apply(t);
                assert!(!val.is_nan(), "apply({t}) produced NaN for {variant:?}");
                assert!(
                    val.is_finite(),
                    "apply({t}) produced non-finite value for {variant:?}"
                );
            }
        }
    }

    #[test]
    fn linear_returns_input() {
        for t in [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0] {
            assert!(
                approx_eq(EasingFunction::Linear.apply(t), t),
                "Linear({t}) != {t}"
            );
        }
    }

    #[test]
    fn ease_in_quad_known_values() {
        assert!(approx_eq(EasingFunction::EaseInQuad.apply(0.5), 0.25));
        assert!(approx_eq(EasingFunction::EaseInQuad.apply(0.1), 0.01));
    }

    #[test]
    fn ease_out_quad_known_values() {
        assert!(approx_eq(EasingFunction::EaseOutQuad.apply(0.5), 0.75));
    }

    #[test]
    fn ease_in_cubic_known_values() {
        assert!(approx_eq(EasingFunction::EaseInCubic.apply(0.5), 0.125));
    }

    #[test]
    fn named_variants_different_from_each_other() {
        let variants = all_named_variants();
        for (i, a) in variants.iter().enumerate() {
            for (j, b) in variants.iter().enumerate() {
                if i != j {
                    assert_ne!(a, b, "Variants at index {i} and {j} should differ");
                }
            }
        }
    }
}
