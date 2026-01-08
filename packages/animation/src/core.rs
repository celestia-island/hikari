//! Core animation types and state machine implementation
//!
//! This module provides the fundamental building blocks for the animation system:
//! - State management for animations
//! - Easing functions
//! - Property tweening
//! - Animation engine with global tween management

use std::{cell::RefCell, sync::Arc, time::Duration};

use slotmap::{new_key_type, SlotMap};

/// Unique identifier for a tween animation
new_key_type! { pub struct TweenId; }

/// Represents the current state of an animation
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnimationState {
    /// Animation has not started yet
    Idle,
    /// Animation is currently playing
    Running,
    /// Animation is paused (can be resumed)
    Paused,
    /// Animation has finished playing
    Completed,
    /// Animation is playing in reverse direction
    Reversed,
}

/// Direction in which an animation is playing
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnimationDirection {
    /// Playing forward (from start to end)
    Forward,
    /// Playing backward (from end to start)
    Backward,
}

/// Playback mode for animation repetition behavior
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlaybackMode {
    /// Play once and stop
    Normal,
    /// Play once in reverse and stop
    Reverse,
    /// Loop indefinitely
    Loop,
    /// Play forward, then reverse, and repeat
    Yoyo,
}

/// Configuration options for creating a tween animation
#[derive(Debug, Clone)]
pub struct AnimationOptions {
    /// Duration of the animation
    pub duration: Duration,
    /// Delay before animation starts
    pub delay: Duration,
    /// Easing function to use
    pub easing: EasingFunction,
    /// Playback mode (loop, yoyo, etc.)
    pub playback: PlaybackMode,
    /// Number of times to repeat (None for infinite if playback is Loop)
    pub repeat: Option<u32>,
    /// Whether to yoyo after each repeat
    pub yoyo: bool,
}

impl Default for AnimationOptions {
    fn default() -> Self {
        Self {
            duration: Duration::from_millis(1000),
            delay: Duration::ZERO,
            easing: EasingFunction::default(),
            playback: PlaybackMode::Normal,
            repeat: None,
            yoyo: false,
        }
    }
}

pub enum EasingFunction {
    /// No easing (linear progress)
    Linear,

    /// Quadratic easing in
    EaseInQuad,
    /// Quadratic easing out
    EaseOutQuad,
    /// Quadratic easing in and out
    EaseInOutQuad,

    /// Cubic easing in
    EaseInCubic,
    /// Cubic easing out
    EaseOutCubic,
    /// Cubic easing in and out
    EaseInOutCubic,

    /// Quartic easing in
    EaseInQuart,
    /// Quartic easing out
    EaseOutQuart,
    /// Quartic easing in and out
    EaseInOutQuart,

    /// Quintic easing in
    EaseInQuint,
    /// Quintic easing out
    EaseOutQuint,
    /// Quintic easing in and out
    EaseInOutQuint,

    /// Exponential easing in
    EaseInExpo,
    /// Exponential easing out
    EaseOutExpo,
    /// Exponential easing in and out
    EaseInOutExpo,

    /// Circular easing in
    EaseInCirc,
    /// Circular easing out
    EaseOutCirc,
    /// Circular easing in and out
    EaseInOutCirc,

    /// Sine easing in
    EaseInSine,
    /// Sine easing out
    EaseOutSine,
    /// Sine easing in and out
    EaseInOutSine,

    /// Back easing in (overshoots before accelerating)
    EaseInBack,
    /// Back easing out (overshoots after accelerating)
    EaseOutBack,
    /// Back easing in and out
    EaseInOutBack,

    /// Elastic easing in (bouncy effect)
    EaseInElastic,
    /// Elastic easing out
    EaseOutElastic,
    /// Elastic easing in and out
    EaseInOutElastic,

    /// Bounce easing in
    EaseInBounce,
    /// Bounce easing out
    EaseOutBounce,
    /// Bounce easing in and out
    EaseInOutBounce,

    /// Custom easing function
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
            EasingFunction::Custom(_) => EasingFunction::Linear, // Can't clone closures, fallback to Linear
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
            (EasingFunction::Custom(_), EasingFunction::Custom(_)) => false, // Can't compare closures
            _ => false,
        }
    }
}

impl Default for EasingFunction {
    fn default() -> Self {
        EasingFunction::Linear
    }
}

impl EasingFunction {
    /// Apply the easing function to a progress value
    ///
    /// # Arguments
    /// * `t` - Progress value between 0.0 and 1.0
    ///
    /// # Returns
    /// Eased value between 0.0 and 1.0
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

/// Target property for animation
///
/// Represents a single property that will be animated from a start value to an end value.
#[derive(Debug, Clone)]
pub struct PropertyTarget {
    /// Name of the property (e.g., "opacity", "scale", "x")
    pub property: String,
    /// Starting value
    pub start: f64,
    /// Ending value
    pub end: f64,
}

/// Callback type for animation updates
///
/// Called during each animation frame with the current progress (0.0 to 1.0).
pub type TweenCallback = Box<dyn Fn(f64) + 'static>;

/// Callback type for animation completion
///
/// Called once when the animation completes successfully.
pub type CompletionCallback = Box<dyn Fn() + 'static>;

/// A single tween animation
///
/// Tween is the basic unit of animation that interpolates properties
/// from start values to end values over a specified duration with easing.
/// Tween animation instance
///
/// Represents a single animation with configurable properties and callbacks.
pub struct Tween {
    id: TweenId,
    state: AnimationState,
    direction: AnimationDirection,
    options: AnimationOptions,
    targets: Vec<PropertyTarget>,
    on_update: Option<TweenCallback>,
    on_complete: Option<CompletionCallback>,
    progress: f64,
    elapsed: Duration,
    repeat_count: u32,
}

impl Clone for Tween {
    fn clone(&self) -> Self {
        Self {
            id: self.id,
            state: self.state,
            direction: self.direction,
            options: self.options.clone(),
            targets: self.targets.clone(),
            on_update: None, // Callbacks cannot be cloned
            on_complete: None,
            progress: self.progress,
            elapsed: self.elapsed,
            repeat_count: self.repeat_count,
        }
    }
}

impl std::fmt::Debug for Tween {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Tween")
            .field("id", &self.id)
            .field("state", &self.state)
            .field("direction", &self.direction)
            .field("options", &self.options)
            .field("targets", &self.targets)
            .field("on_update", &self.on_update.as_ref().map(|_| "<callback>"))
            .field(
                "on_complete",
                &self.on_complete.as_ref().map(|_| "<callback>"),
            )
            .field("progress", &self.progress)
            .field("elapsed", &self.elapsed)
            .field("repeat_count", &self.repeat_count)
            .finish()
    }
}

impl Tween {
    /// Create a new tween with the given ID and options
    pub fn new(id: TweenId, options: AnimationOptions) -> Self {
        Self {
            id,
            state: AnimationState::Idle,
            direction: AnimationDirection::Forward,
            options,
            targets: Vec::new(),
            on_update: None,
            on_complete: None,
            progress: 0.0,
            elapsed: Duration::ZERO,
            repeat_count: 0,
        }
    }

    /// Get the unique ID of this tween
    pub fn id(&self) -> TweenId {
        self.id
    }

    /// Get the current state of the animation
    pub fn state(&self) -> AnimationState {
        self.state
    }

    /// Get the current progress (0.0 to 1.0)
    pub fn progress(&self) -> f64 {
        self.progress
    }

    /// Get the elapsed time since animation started
    pub fn elapsed(&self) -> Duration {
        self.elapsed
    }

    /// Get the total duration of the animation
    pub fn duration(&self) -> Duration {
        self.options.duration
    }

    /// Check if animation has completed
    pub fn is_completed(&self) -> bool {
        self.state == AnimationState::Completed
    }

    /// Check if animation is currently running
    pub fn is_running(&self) -> bool {
        self.state == AnimationState::Running
    }

    /// Check if animation is paused
    pub fn is_paused(&self) -> bool {
        self.state == AnimationState::Paused
    }

    /// Add a property target to animate
    ///
    /// # Arguments
    /// * `target` - The property target with name, start, and end values
    pub fn add_target(&mut self, target: PropertyTarget) -> &mut Self {
        self.targets.push(target);
        self
    }

    /// Set callback to be called on each animation frame
    ///
    /// # Arguments
    /// * `callback` - Function that receives current progress (0.0 to 1.0)
    pub fn set_on_update(&mut self, callback: TweenCallback) -> &mut Self {
        self.on_update = Some(callback);
        self
    }

    /// Set callback to be called when animation completes
    ///
    /// # Arguments
    /// * `callback` - Function called once when animation finishes
    pub fn set_on_complete(&mut self, callback: CompletionCallback) -> &mut Self {
        self.on_complete = Some(callback);
        self
    }

    /// Start playing the animation
    ///
    /// If animation was completed, it will be reset first.
    pub fn play(&mut self) {
        if self.state == AnimationState::Completed {
            self.reset();
        }
        self.state = AnimationState::Running;
    }

    /// Pause the animation
    ///
    /// Only works if animation is currently running.
    pub fn pause(&mut self) {
        if self.state == AnimationState::Running {
            self.state = AnimationState::Paused;
        }
    }

    /// Resume a paused animation
    pub fn resume(&mut self) {
        if self.state == AnimationState::Paused {
            self.state = AnimationState::Running;
        }
    }

    /// Reverse the direction of the animation
    ///
    /// Only works if animation is running or paused.
    pub fn reverse(&mut self) {
        if self.state == AnimationState::Running || self.state == AnimationState::Paused {
            self.direction = match self.direction {
                AnimationDirection::Forward => AnimationDirection::Backward,
                AnimationDirection::Backward => AnimationDirection::Forward,
            };
        }
    }

    /// Restart the animation from the beginning
    pub fn restart(&mut self) {
        self.reset();
        self.play();
    }

    /// Reset the animation to initial state
    pub fn reset(&mut self) {
        self.state = AnimationState::Idle;
        self.progress = 0.0;
        self.elapsed = Duration::ZERO;
        self.repeat_count = 0;
        self.direction = AnimationDirection::Forward;
    }

    /// Seek to a specific time in the animation
    ///
    /// # Arguments
    /// * `time` - Time to seek to (must be <= duration)
    pub fn seek(&mut self, time: Duration) {
        if time <= self.options.duration {
            self.elapsed = time;
            self.progress =
                (time.as_secs_f64() / self.options.duration.as_secs_f64()).clamp(0.0, 1.0);
            self.update();
        }
    }

    /// Update animation progress based on current elapsed time
    pub fn update(&mut self) {
        if self.state != AnimationState::Running {
            return;
        }

        match self.direction {
            AnimationDirection::Forward => {
                self.progress = (self.elapsed.as_secs_f64() / self.options.duration.as_secs_f64())
                    .clamp(0.0, 1.0);
            }
            AnimationDirection::Backward => {
                self.progress = 1.0
                    - (self.elapsed.as_secs_f64() / self.options.duration.as_secs_f64())
                        .clamp(0.0, 1.0);
            }
        }

        if let Some(callback) = &self.on_update {
            callback(self.progress);
        }
    }

    /// Advance the animation by a time delta
    ///
    /// # Arguments
    /// * `delta` - Time to advance
    pub fn advance(&mut self, delta: Duration) {
        if self.state != AnimationState::Running {
            return;
        }

        self.elapsed += delta;

        if self.elapsed >= self.options.duration {
            self.elapsed = self.options.duration;
            self.progress = match self.direction {
                AnimationDirection::Forward => 1.0,
                AnimationDirection::Backward => 0.0,
            };

            self.handle_completion();
        }

        self.update();
    }

    /// Handle animation completion based on playback mode
    fn handle_completion(&mut self) {
        match self.options.playback {
            PlaybackMode::Loop => {
                self.elapsed = Duration::ZERO;
                self.state = AnimationState::Running;
            }
            PlaybackMode::Yoyo => {
                self.reverse();
                self.elapsed = Duration::ZERO;
            }
            PlaybackMode::Normal | PlaybackMode::Reverse => {
                if let Some(repeat) = self.options.repeat {
                    if self.repeat_count < repeat {
                        self.repeat_count += 1;
                        self.elapsed = Duration::ZERO;
                        self.state = AnimationState::Running;
                    } else {
                        self.state = AnimationState::Completed;
                        if let Some(callback) = &self.on_complete {
                            callback();
                        }
                    }
                } else {
                    self.state = AnimationState::Completed;
                    if let Some(callback) = &self.on_complete {
                        callback();
                    }
                }
            }
        }
    }

    /// Get the current interpolated value for a specific target
    ///
    /// # Arguments
    /// * `target_index` - Index of the target property
    ///
    /// # Returns
    /// Current interpolated value, or None if index is invalid
    pub fn get_current_value(&self, target_index: usize) -> Option<f64> {
        if target_index >= self.targets.len() {
            return None;
        }

        let target = &self.targets[target_index];
        let eased = self.options.easing.apply(self.progress);
        let value = target.start + (target.end - target.start) * eased;
        Some(value)
    }

    /// Get current interpolated values for all targets
    ///
    /// # Returns
    /// Vector of current values for all target properties
    pub fn get_current_values(&self) -> Vec<f64> {
        self.targets
            .iter()
            .map(|target| {
                let eased = self.options.easing.apply(self.progress);
                target.start + (target.end - target.start) * eased
            })
            .collect()
    }
}

/// Global animation engine for managing multiple tweens
///
/// The AnimationEngine provides centralized management of all tween animations,
/// allowing for efficient batch updates and global control.
#[derive(Clone)]
pub struct AnimationEngine {
    pub tweens: Arc<RefCell<SlotMap<TweenId, Tween>>>,
}

impl Default for AnimationEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl AnimationEngine {
    /// Create a new animation engine
    pub fn new() -> Self {
        Self {
            tweens: Arc::new(RefCell::new(SlotMap::with_key())),
        }
    }

    /// Create a new tween with given options
    ///
    /// # Arguments
    /// * `options` - Animation configuration options
    ///
    /// # Returns
    /// Unique ID of the created tween
    pub fn create_tween(&self, options: AnimationOptions) -> TweenId {
        let mut tweens = self.tweens.borrow_mut();
        // Create a temporary tween with a default id, then insert and get the real id
        let temp_tween = Tween {
            id: TweenId::default(),
            state: AnimationState::Idle,
            direction: AnimationDirection::Forward,
            targets: Vec::new(),
            on_update: None,
            on_complete: None,
            progress: 0.0,
            elapsed: Duration::ZERO,
            repeat_count: 0,
            options,
        };
        let id = tweens.insert(temp_tween);
        id
    }

    /// Get a clone of a tween by ID
    ///
    /// # Arguments
    /// * `id` - Tween ID to retrieve
    ///
    /// # Returns
    /// Cloned tween if found, None otherwise
    pub fn get_tween(&self, id: TweenId) -> Option<Tween> {
        self.tweens.borrow().get(id).cloned()
    }

    /// Get a mutable reference to a tween by ID
    ///
    /// # Arguments
    /// * `id` - Tween ID to retrieve
    ///
    /// # Returns
    /// Mutable reference to tween if found, None otherwise
    ///
    /// # Safety
    /// This uses unsafe code internally for interior mutability.
    pub fn get_tween_mut(&self, id: TweenId) -> Option<&mut Tween> {
        unsafe {
            let ptr = self.tweens.as_ptr();
            (*ptr).get_mut(id)
        }
    }

    /// Remove a tween by ID
    ///
    /// # Arguments
    /// * `id` - Tween ID to remove
    ///
    /// # Returns
    /// true if tween was removed, false if it didn't exist
    pub fn remove_tween(&self, id: TweenId) -> bool {
        let mut tweens = self.tweens.borrow_mut();
        tweens.remove(id).is_some()
    }

    /// Start playing a tween
    ///
    /// # Arguments
    /// * `id` - Tween ID to play
    pub fn play(&self, id: TweenId) {
        if let Some(tween) = self.get_tween_mut(id) {
            tween.play();
        }
    }

    /// Pause a running tween
    ///
    /// # Arguments
    /// * `id` - Tween ID to pause
    pub fn pause(&self, id: TweenId) {
        if let Some(tween) = self.get_tween_mut(id) {
            tween.pause();
        }
    }

    /// Reverse the direction of a tween
    ///
    /// # Arguments
    /// * `id` - Tween ID to reverse
    pub fn reverse(&self, id: TweenId) {
        if let Some(tween) = self.get_tween_mut(id) {
            tween.reverse();
        }
    }

    /// Restart a tween from the beginning
    ///
    /// # Arguments
    /// * `id` - Tween ID to restart
    pub fn restart(&self, id: TweenId) {
        if let Some(tween) = self.get_tween_mut(id) {
            tween.restart();
        }
    }

    /// Seek a tween to a specific time
    ///
    /// # Arguments
    /// * `id` - Tween ID to seek
    /// * `time` - Time position to seek to
    pub fn seek(&self, id: TweenId, time: Duration) {
        if let Some(tween) = self.get_tween_mut(id) {
            tween.seek(time);
        }
    }

    /// Kill (remove) a tween
    ///
    /// # Arguments
    /// * `id` - Tween ID to kill
    pub fn kill(&self, id: TweenId) {
        self.remove_tween(id);
    }

    /// Kill all tweens
    pub fn kill_all(&self) {
        self.tweens.borrow_mut().clear();
    }

    /// Check if a tween is currently active (running)
    ///
    /// # Arguments
    /// * `id` - Tween ID to check
    ///
    /// # Returns
    /// true if tween is running, false otherwise
    pub fn is_active(&self, id: TweenId) -> bool {
        if let Some(tween) = self.get_tween(id) {
            tween.state() == AnimationState::Running
        } else {
            false
        }
    }

    /// Get IDs of all currently active (running) tweens
    ///
    /// # Returns
    /// Vector of active tween IDs
    pub fn get_all_active(&self) -> Vec<TweenId> {
        self.tweens
            .borrow()
            .iter()
            .filter(|(_, tween)| tween.state() == AnimationState::Running)
            .map(|(id, _)| id)
            .collect()
    }

    /// Advance all active tweens by a time delta
    ///
    /// This should be called each animation frame with the frame time delta.
    ///
    /// # Arguments
    /// * `delta` - Time to advance all tweens by
    pub fn tick(&self, delta: Duration) {
        let tweens = self.tweens.borrow();
        let active_tweens: Vec<TweenId> = tweens
            .iter()
            .filter(|(_, tween)| tween.state() == AnimationState::Running)
            .map(|(id, _)| id)
            .collect();
        drop(tweens);

        for id in active_tweens {
            if let Some(tween) = self.get_tween_mut(id) {
                tween.advance(delta);
            }
        }
    }
}
