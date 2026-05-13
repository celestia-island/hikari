//! Easing functions for animations

#[derive(Default)]
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

    Custom(Box<dyn Fn(f64) -> f64>),
}

impl Clone for EasingFunction {
    fn clone(&self) -> Self {
        match self {
            EasingFunction::Linear => EasingFunction::Linear,
            EasingFunction::EaseInQuad => EasingFunction::EaseInQuad,
            EasingFunction::EaseOutQuad => EasingFunction::EaseOutQuad,
            EasingFunction::EaseInOutQuad => EasingFunction::EaseInOutQuad,
            EasingFunction::EaseInCubic => EasingFunction::EaseInCubic,
            EasingFunction::EaseOutCubic => EasingFunction::EaseOutCubic,
            EasingFunction::EaseInOutCubic => EasingFunction::EaseInOutCubic,
            EasingFunction::EaseInQuart => EasingFunction::EaseInQuart,
            EasingFunction::EaseOutQuart => EasingFunction::EaseOutQuart,
            EasingFunction::EaseInOutQuart => EasingFunction::EaseInOutQuart,
            EasingFunction::EaseInQuint => EasingFunction::EaseInQuint,
            EasingFunction::EaseOutQuint => EasingFunction::EaseOutQuint,
            EasingFunction::EaseInOutQuint => EasingFunction::EaseInOutQuint,
            EasingFunction::EaseInExpo => EasingFunction::EaseInExpo,
            EasingFunction::EaseOutExpo => EasingFunction::EaseOutExpo,
            EasingFunction::EaseInOutExpo => EasingFunction::EaseInOutExpo,
            EasingFunction::EaseInCirc => EasingFunction::EaseInCirc,
            EasingFunction::EaseOutCirc => EasingFunction::EaseOutCirc,
            EasingFunction::EaseInOutCirc => EasingFunction::EaseInOutCirc,
            EasingFunction::EaseInSine => EasingFunction::EaseInSine,
            EasingFunction::EaseOutSine => EasingFunction::EaseOutSine,
            EasingFunction::EaseInOutSine => EasingFunction::EaseInOutSine,
            EasingFunction::EaseInBack => EasingFunction::EaseInBack,
            EasingFunction::EaseOutBack => EasingFunction::EaseOutBack,
            EasingFunction::EaseInOutBack => EasingFunction::EaseInOutBack,
            EasingFunction::EaseInElastic => EasingFunction::EaseInElastic,
            EasingFunction::EaseOutElastic => EasingFunction::EaseOutElastic,
            EasingFunction::EaseInOutElastic => EasingFunction::EaseInOutElastic,
            EasingFunction::EaseInBounce => EasingFunction::EaseInBounce,
            EasingFunction::EaseOutBounce => EasingFunction::EaseOutBounce,
            EasingFunction::EaseInOutBounce => EasingFunction::EaseInOutBounce,
            EasingFunction::Custom(_) => EasingFunction::Linear,
        }
    }
}

impl std::fmt::Debug for EasingFunction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EasingFunction::Linear => write!(f, "Linear"),
            EasingFunction::EaseInQuad => write!(f, "EaseInQuad"),
            EasingFunction::EaseOutQuad => write!(f, "EaseOutQuad"),
            EasingFunction::EaseInOutQuad => write!(f, "EaseInOutQuad"),
            EasingFunction::EaseInCubic => write!(f, "EaseInCubic"),
            EasingFunction::EaseOutCubic => write!(f, "EaseOutCubic"),
            EasingFunction::EaseInOutCubic => write!(f, "EaseInOutCubic"),
            EasingFunction::EaseInQuart => write!(f, "EaseInQuart"),
            EasingFunction::EaseOutQuart => write!(f, "EaseOutQuart"),
            EasingFunction::EaseInOutQuart => write!(f, "EaseInOutQuart"),
            EasingFunction::EaseInQuint => write!(f, "EaseInQuint"),
            EasingFunction::EaseOutQuint => write!(f, "EaseOutQuint"),
            EasingFunction::EaseInOutQuint => write!(f, "EaseInOutQuint"),
            EasingFunction::EaseInExpo => write!(f, "EaseInExpo"),
            EasingFunction::EaseOutExpo => write!(f, "EaseOutExpo"),
            EasingFunction::EaseInOutExpo => write!(f, "EaseInOutExpo"),
            EasingFunction::EaseInCirc => write!(f, "EaseInCirc"),
            EasingFunction::EaseOutCirc => write!(f, "EaseOutCirc"),
            EasingFunction::EaseInOutCirc => write!(f, "EaseInOutCirc"),
            EasingFunction::EaseInSine => write!(f, "EaseInSine"),
            EasingFunction::EaseOutSine => write!(f, "EaseOutSine"),
            EasingFunction::EaseInOutSine => write!(f, "EaseInOutSine"),
            EasingFunction::EaseInBack => write!(f, "EaseInBack"),
            EasingFunction::EaseOutBack => write!(f, "EaseOutBack"),
            EasingFunction::EaseInOutBack => write!(f, "EaseInOutBack"),
            EasingFunction::EaseInElastic => write!(f, "EaseInElastic"),
            EasingFunction::EaseOutElastic => write!(f, "EaseOutElastic"),
            EasingFunction::EaseInOutElastic => write!(f, "EaseInOutElastic"),
            EasingFunction::EaseInBounce => write!(f, "EaseInBounce"),
            EasingFunction::EaseOutBounce => write!(f, "EaseOutBounce"),
            EasingFunction::EaseInOutBounce => write!(f, "EaseInOutBounce"),
            EasingFunction::Custom(_) => write!(f, "Custom(<closure>)"),
        }
    }
}

impl PartialEq for EasingFunction {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (EasingFunction::Linear, EasingFunction::Linear) => true,
            (EasingFunction::EaseInQuad, EasingFunction::EaseInQuad) => true,
            (EasingFunction::EaseOutQuad, EasingFunction::EaseOutQuad) => true,
            (EasingFunction::EaseInOutQuad, EasingFunction::EaseInOutQuad) => true,
            (EasingFunction::EaseInCubic, EasingFunction::EaseInCubic) => true,
            (EasingFunction::EaseOutCubic, EasingFunction::EaseOutCubic) => true,
            (EasingFunction::EaseInOutCubic, EasingFunction::EaseInOutCubic) => true,
            (EasingFunction::EaseInQuart, EasingFunction::EaseInQuart) => true,
            (EasingFunction::EaseOutQuart, EasingFunction::EaseOutQuart) => true,
            (EasingFunction::EaseInOutQuart, EasingFunction::EaseInOutQuart) => true,
            (EasingFunction::EaseInQuint, EasingFunction::EaseInQuint) => true,
            (EasingFunction::EaseOutQuint, EasingFunction::EaseOutQuint) => true,
            (EasingFunction::EaseInOutQuint, EasingFunction::EaseInOutQuint) => true,
            (EasingFunction::EaseInExpo, EasingFunction::EaseInExpo) => true,
            (EasingFunction::EaseOutExpo, EasingFunction::EaseOutExpo) => true,
            (EasingFunction::EaseInOutExpo, EasingFunction::EaseInOutExpo) => true,
            (EasingFunction::EaseInCirc, EasingFunction::EaseInCirc) => true,
            (EasingFunction::EaseOutCirc, EasingFunction::EaseOutCirc) => true,
            (EasingFunction::EaseInOutCirc, EasingFunction::EaseInOutCirc) => true,
            (EasingFunction::EaseInSine, EasingFunction::EaseInSine) => true,
            (EasingFunction::EaseOutSine, EasingFunction::EaseOutSine) => true,
            (EasingFunction::EaseInOutSine, EasingFunction::EaseInOutSine) => true,
            (EasingFunction::EaseInBack, EasingFunction::EaseInBack) => true,
            (EasingFunction::EaseOutBack, EasingFunction::EaseOutBack) => true,
            (EasingFunction::EaseInOutBack, EasingFunction::EaseInOutBack) => true,
            (EasingFunction::EaseInElastic, EasingFunction::EaseInElastic) => true,
            (EasingFunction::EaseOutElastic, EasingFunction::EaseOutElastic) => true,
            (EasingFunction::EaseInOutElastic, EasingFunction::EaseInOutElastic) => true,
            (EasingFunction::EaseInBounce, EasingFunction::EaseInBounce) => true,
            (EasingFunction::EaseOutBounce, EasingFunction::EaseOutBounce) => true,
            (EasingFunction::EaseInOutBounce, EasingFunction::EaseInOutBounce) => true,
            (EasingFunction::Custom(_), EasingFunction::Custom(_)) => false,
            _ => false,
        }
    }
}

impl EasingFunction {
    pub fn apply(&self, t: f64) -> f64 {
        match self {
            EasingFunction::Linear => t,
            EasingFunction::EaseInQuad => t * t,
            EasingFunction::EaseOutQuad => t * (2.0 - t),
            EasingFunction::EaseInOutQuad => {
                if t < 0.5 {
                    2.0 * t * t
                } else {
                    -1.0 + (4.0 - 2.0 * t) * t
                }
            }
            EasingFunction::EaseInCubic => t * t * t,
            EasingFunction::EaseOutCubic => {
                let t = t - 1.0;
                t * t * t + 1.0
            }
            EasingFunction::EaseInOutCubic => {
                if t < 0.5 {
                    4.0 * t * t * t
                } else {
                    let t = t * 2.0 - 2.0;
                    1.0 + t * t * t / 2.0
                }
            }
            EasingFunction::EaseInQuart => t * t * t * t,
            EasingFunction::EaseOutQuart => {
                let t = t - 1.0;
                1.0 - t * t * t * t
            }
            EasingFunction::EaseInOutQuart => {
                if t < 0.5 {
                    8.0 * t * t * t * t
                } else {
                    let t = t - 1.0;
                    1.0 - 8.0 * t * t * t * t
                }
            }
            EasingFunction::EaseInQuint => t * t * t * t * t,
            EasingFunction::EaseOutQuint => {
                let t = t - 1.0;
                t * t * t * t * t + 1.0
            }
            EasingFunction::EaseInOutQuint => {
                if t < 0.5 {
                    16.0 * t * t * t * t * t
                } else {
                    let t = t * 2.0 - 2.0;
                    1.0 + t * t * t * t * t / 2.0
                }
            }
            EasingFunction::EaseInExpo => {
                if t == 0.0 {
                    0.0
                } else {
                    2.0_f64.powf(10.0 * (t - 1.0))
                }
            }
            EasingFunction::EaseOutExpo => {
                if t == 1.0 {
                    1.0
                } else {
                    1.0 - 2.0_f64.powf(-10.0 * t)
                }
            }
            EasingFunction::EaseInOutExpo => {
                if t == 0.0 {
                    0.0
                } else if t == 1.0 {
                    1.0
                } else if t < 0.5 {
                    2.0_f64.powf(20.0 * t - 10.0) / 2.0
                } else {
                    (2.0 - 2.0_f64.powf(-20.0 * t + 10.0)) / 2.0
                }
            }
            EasingFunction::EaseInCirc => 1.0 - (1.0 - t * t).sqrt(),
            EasingFunction::EaseOutCirc => {
                let t = t - 1.0;
                (1.0 - t * t).sqrt()
            }
            EasingFunction::EaseInOutCirc => {
                if t < 0.5 {
                    (1.0 - (1.0 - 4.0 * t * t).sqrt()) / 2.0
                } else {
                    ((1.0 - (2.0 * t - 3.0) * (2.0 * t - 3.0)).sqrt() + 1.0) / 2.0
                }
            }
            EasingFunction::EaseInSine => 1.0 - (t * std::f64::consts::PI / 2.0).cos(),
            EasingFunction::EaseOutSine => (t * std::f64::consts::PI / 2.0).sin(),
            EasingFunction::EaseInOutSine => -((std::f64::consts::PI * t).cos() - 1.0) / 2.0,
            EasingFunction::EaseInBack => {
                const C1: f64 = 1.70158;
                const C3: f64 = C1 + 1.0;
                C3 * t * t * t - C1 * t * t
            }
            EasingFunction::EaseOutBack => {
                const C1: f64 = 1.70158;
                const C3: f64 = C1 + 1.0;
                1.0 + C3 * (t - 1.0).powi(3) + C1 * (t - 1.0).powi(2)
            }
            EasingFunction::EaseInOutBack => {
                const C1: f64 = 1.70158;
                const C2: f64 = C1 * 1.525;
                if t < 0.5 {
                    ((2.0 * t).powi(2) * ((C2 + 1.0) * 2.0 * t - C2)) / 2.0
                } else {
                    ((2.0 * t - 2.0).powi(2) * ((C2 + 1.0) * (t * 2.0 - 2.0) + C2) + 2.0) / 2.0
                }
            }
            EasingFunction::EaseInElastic => {
                if t == 0.0 {
                    0.0
                } else if t == 1.0 {
                    1.0
                } else {
                    -(2.0_f64.powf(10.0 * t - 10.0))
                        * ((t * 10.0 - 10.75) * 2.0 * std::f64::consts::PI / 3.0).sin()
                }
            }
            EasingFunction::EaseOutElastic => {
                if t == 0.0 {
                    0.0
                } else if t == 1.0 {
                    1.0
                } else {
                    2.0_f64.powf(-10.0 * t)
                        * ((t * 10.0 - 0.75) * 2.0 * std::f64::consts::PI / 3.0).sin()
                        + 1.0
                }
            }
            EasingFunction::EaseInOutElastic => {
                if t == 0.0 {
                    0.0
                } else if t == 1.0 {
                    1.0
                } else if t < 0.5 {
                    -(2.0_f64.powf(20.0 * t - 10.0)
                        * ((20.0 * t - 11.125) * 2.0 * std::f64::consts::PI / 4.5).sin())
                        / 2.0
                } else {
                    (2.0_f64.powf(-20.0 * t + 10.0)
                        * ((20.0 * t - 11.125) * 2.0 * std::f64::consts::PI / 4.5).sin())
                        / 2.0
                        + 1.0
                }
            }
            EasingFunction::EaseInBounce => 1.0 - EasingFunction::EaseOutBounce.apply(1.0 - t),
            EasingFunction::EaseOutBounce => {
                const N1: f64 = 7.5625;
                const D1: f64 = 2.75;

                if t < 1.0 / D1 {
                    N1 * t * t
                } else if t < 2.0 / D1 {
                    let t = t - 1.5 / D1;
                    N1 * t * t + 0.75
                } else if t < 2.5 / D1 {
                    let t = t - 2.25 / D1;
                    N1 * t * t + 0.9375
                } else {
                    let t = t - 2.625 / D1;
                    N1 * t * t + 0.984375
                }
            }
            EasingFunction::EaseInOutBounce => {
                if t < 0.5 {
                    (1.0 - EasingFunction::EaseOutBounce.apply(1.0 - 2.0 * t)) / 2.0
                } else {
                    (1.0 + EasingFunction::EaseOutBounce.apply(2.0 * t - 1.0)) / 2.0
                }
            }
            EasingFunction::Custom(f) => f(t),
        }
    }
}
