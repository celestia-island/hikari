//! Tween builder utilities and convenience functions
//!
//! This module provides fluent builders for creating tweens,
//! as well as parallel and sequential animation composition.

use std::time::Duration;

use crate::core::{
    AnimationEngine, AnimationOptions, CompletionCallback, PropertyTarget, Tween, TweenCallback,
    TweenId,
};

/// Builder for creating tweens with fluent API
pub struct TweenBuilder {
    options: AnimationOptions,
    targets: Vec<PropertyTarget>,
    on_update: Option<TweenCallback>,
    on_complete: Option<CompletionCallback>,
    engine: Option<AnimationEngine>,
}

impl Default for TweenBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl TweenBuilder {
    #[must_use]
    pub fn new() -> Self {
        Self {
            options: AnimationOptions::default(),
            targets: Vec::new(),
            on_update: None,
            on_complete: None,
            engine: None,
        }
    }

    #[must_use]
    pub fn with_engine(mut self, engine: AnimationEngine) -> Self {
        self.engine = Some(engine);
        self
    }

    #[must_use]
    pub const fn duration(mut self, duration: Duration) -> Self {
        self.options.duration = duration;
        self
    }

    #[must_use]
    pub const fn duration_ms(self, ms: u64) -> Self {
        self.duration(Duration::from_millis(ms))
    }

    #[must_use]
    pub fn duration_secs(self, secs: f64) -> Self {
        self.duration(Duration::from_secs_f64(secs))
    }

    #[must_use]
    pub const fn delay(mut self, delay: Duration) -> Self {
        self.options.delay = delay;
        self
    }

    #[must_use]
    pub const fn delay_ms(self, ms: u64) -> Self {
        self.delay(Duration::from_millis(ms))
    }

    #[must_use]
    pub fn easing(mut self, easing: crate::core::EasingFunction) -> Self {
        self.options.easing = easing;
        self
    }

    #[must_use]
    pub const fn repeat(mut self, count: u32) -> Self {
        self.options.repeat = Some(count);
        self
    }

    #[must_use]
    pub const fn loop_anim(mut self) -> Self {
        self.options.playback = crate::core::PlaybackMode::Loop;
        self
    }

    pub fn to<T: Into<f64>>(mut self, property: &str, end: T) -> Self {
        let target = PropertyTarget {
            property: property.to_string(),
            start: 0.0,
            end: end.into(),
        };
        self.targets.push(target);
        self
    }

    pub fn from_to<T: Into<f64>>(mut self, property: &str, start: T, end: T) -> Self {
        let target = PropertyTarget {
            property: property.to_string(),
            start: start.into(),
            end: end.into(),
        };
        self.targets.push(target);
        self
    }

    pub fn on_update(mut self, callback: TweenCallback) -> Self {
        self.on_update = Some(callback);
        self
    }

    pub fn on_complete(mut self, callback: CompletionCallback) -> Self {
        self.on_complete = Some(callback);
        self
    }

    #[must_use]
    pub fn build(self) -> Tween {
        let mut tween = Tween::new(TweenId::default(), self.options);

        for target in self.targets {
            tween.add_target(target);
        }

        if let Some(callback) = self.on_update {
            tween.set_on_update(callback);
        }

        if let Some(callback) = self.on_complete {
            tween.set_on_complete(callback);
        }

        tween
    }

    #[must_use]
    pub fn play(self) -> Option<TweenId> {
        let engine = self.engine.clone()?;
        let mut tween = self.build();
        tween.play();

        let id = engine.tweens.borrow_mut().insert(tween);
        Some(id)
    }
}

#[must_use]
pub fn tween() -> TweenBuilder {
    TweenBuilder::new()
}

#[must_use]
pub fn tween_with(engine: AnimationEngine) -> TweenBuilder {
    TweenBuilder::new().with_engine(engine)
}

pub trait TweenBuilderExt {
    fn fade_in(duration_ms: u64) -> TweenBuilder;
    fn fade_out(duration_ms: u64) -> TweenBuilder;
    fn scale_in(duration_ms: u64) -> TweenBuilder;
    fn scale_out(duration_ms: u64) -> TweenBuilder;
    fn slide_in_x(duration_ms: u64, distance: f64) -> TweenBuilder;
    fn slide_out_x(duration_ms: u64, distance: f64) -> TweenBuilder;
    fn slide_in_y(duration_ms: u64, distance: f64) -> TweenBuilder;
    fn slide_out_y(duration_ms: u64, distance: f64) -> TweenBuilder;
}

impl TweenBuilderExt for TweenBuilder {
    fn fade_in(duration_ms: u64) -> TweenBuilder {
        Self::new()
            .duration_ms(duration_ms)
            .to("opacity", 1.0)
            .easing(crate::core::EasingFunction::EaseOutQuad)
    }

    fn fade_out(duration_ms: u64) -> TweenBuilder {
        Self::new()
            .duration_ms(duration_ms)
            .from_to("opacity", 1.0, 0.0)
            .easing(crate::core::EasingFunction::EaseInQuad)
    }

    fn scale_in(duration_ms: u64) -> TweenBuilder {
        Self::new()
            .duration_ms(duration_ms)
            .to("scale", 1.0)
            .easing(crate::core::EasingFunction::EaseOutBack)
    }

    fn scale_out(duration_ms: u64) -> TweenBuilder {
        Self::new()
            .duration_ms(duration_ms)
            .from_to("scale", 1.0, 0.0)
            .easing(crate::core::EasingFunction::EaseInBack)
    }

    fn slide_in_x(duration_ms: u64, distance: f64) -> TweenBuilder {
        Self::new()
            .duration_ms(duration_ms)
            .from_to("x", -distance, 0.0)
            .easing(crate::core::EasingFunction::EaseOutCubic)
    }

    fn slide_out_x(duration_ms: u64, distance: f64) -> TweenBuilder {
        Self::new()
            .duration_ms(duration_ms)
            .to("x", distance)
            .easing(crate::core::EasingFunction::EaseInCubic)
    }

    fn slide_in_y(duration_ms: u64, distance: f64) -> TweenBuilder {
        Self::new()
            .duration_ms(duration_ms)
            .from_to("y", -distance, 0.0)
            .easing(crate::core::EasingFunction::EaseOutCubic)
    }

    fn slide_out_y(duration_ms: u64, distance: f64) -> TweenBuilder {
        Self::new()
            .duration_ms(duration_ms)
            .to("y", distance)
            .easing(crate::core::EasingFunction::EaseInCubic)
    }
}

pub struct ParallelBuilder {
    tweens: Vec<Tween>,
    engine: AnimationEngine,
}

impl Default for ParallelBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl ParallelBuilder {
    #[must_use]
    pub fn new() -> Self {
        Self {
            tweens: Vec::new(),
            engine: AnimationEngine::new(),
        }
    }

    #[must_use]
    pub fn with_engine(mut self, engine: AnimationEngine) -> Self {
        self.engine = engine;
        self
    }

    #[must_use]
    pub fn add_tween(mut self, tween: Tween) -> Self {
        self.tweens.push(tween);
        self
    }

    #[must_use]
    pub fn build(self) -> Vec<TweenId> {
        let mut ids = Vec::new();
        for mut tween in self.tweens {
            tween.play();
            let mut tweens = self.engine.tweens.borrow_mut();
            let id = tweens.insert(tween);
            ids.push(id);
        }
        ids
    }

    #[must_use]
    pub fn play(self) -> Vec<TweenId> {
        self.build()
    }
}

#[must_use]
pub fn parallel() -> ParallelBuilder {
    ParallelBuilder::new()
}

pub struct SequenceBuilder {
    tweens: Vec<(Tween, Duration)>,
    engine: AnimationEngine,
    delay: Duration,
}

impl Default for SequenceBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl SequenceBuilder {
    #[must_use]
    pub fn new() -> Self {
        Self {
            tweens: Vec::new(),
            engine: AnimationEngine::new(),
            delay: Duration::ZERO,
        }
    }

    #[must_use]
    pub fn with_engine(mut self, engine: AnimationEngine) -> Self {
        self.engine = engine;
        self
    }

    #[must_use]
    pub fn add_tween(mut self, tween: Tween) -> Self {
        self.tweens.push((tween, self.delay));
        self.delay = Duration::ZERO;
        self
    }

    #[must_use]
    pub const fn delay(mut self, delay: Duration) -> Self {
        self.delay = delay;
        self
    }

    #[must_use]
    pub const fn delay_ms(self, ms: u64) -> Self {
        self.delay(Duration::from_millis(ms))
    }

    #[must_use]
    pub fn build(self) -> Vec<TweenId> {
        let mut ids = Vec::new();
        let mut cumulative_delay = Duration::ZERO;
        for (mut tween, delay) in self.tweens {
            cumulative_delay += delay;
            // Set elapsed to simulate delay offset so the sequence plays in order
            if cumulative_delay > Duration::ZERO {
                tween.seek(cumulative_delay);
            }
            let mut tweens = self.engine.tweens.borrow_mut();
            let id = tweens.insert(tween);
            drop(tweens);

            self.engine.play(id);
            ids.push(id);
        }
        ids
    }

    #[must_use]
    pub fn play(self) -> Vec<TweenId> {
        self.build()
    }
}

#[must_use]
pub fn sequence() -> SequenceBuilder {
    SequenceBuilder::new()
}
