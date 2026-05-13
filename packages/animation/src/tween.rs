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
    pub fn new() -> Self {
        Self {
            options: AnimationOptions::default(),
            targets: Vec::new(),
            on_update: None,
            on_complete: None,
            engine: None,
        }
    }

    pub fn with_engine(mut self, engine: AnimationEngine) -> Self {
        self.engine = Some(engine);
        self
    }

    pub fn duration(mut self, duration: Duration) -> Self {
        self.options.duration = duration;
        self
    }

    pub fn duration_ms(self, ms: u64) -> Self {
        self.duration(Duration::from_millis(ms))
    }

    pub fn duration_secs(self, secs: f64) -> Self {
        self.duration(Duration::from_secs_f64(secs))
    }

    pub fn delay(mut self, delay: Duration) -> Self {
        self.options.delay = delay;
        self
    }

    pub fn delay_ms(self, ms: u64) -> Self {
        self.delay(Duration::from_millis(ms))
    }

    pub fn easing(mut self, easing: crate::core::EasingFunction) -> Self {
        self.options.easing = easing;
        self
    }

    pub fn repeat(mut self, count: u32) -> Self {
        self.options.repeat = Some(count);
        self
    }

    pub fn yoyo(mut self, enabled: bool) -> Self {
        self.options.yoyo = enabled;
        self
    }

    pub fn loop_anim(mut self) -> Self {
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

    pub fn build(self) -> Tween {
        let engine = self.engine.unwrap_or_default();
        let id = engine.create_tween(self.options.clone());
        let mut tween = Tween::new(id, self.options);

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

    pub fn play(self) -> TweenId {
        let engine = self.engine.clone().unwrap_or_default();
        let id = engine.create_tween(self.options.clone());
        let mut tween = Tween::new(id, self.options.clone());

        for target in self.targets {
            tween.add_target(target);
        }

        if let Some(callback) = self.on_update {
            tween.set_on_update(callback);
        }

        if let Some(callback) = self.on_complete {
            tween.set_on_complete(callback);
        }

        tween.play();

        let mut tweens = engine.tweens.borrow_mut();
        tweens.insert(tween);

        id
    }
}

pub fn tween() -> TweenBuilder {
    TweenBuilder::new()
}

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
    pub fn new() -> Self {
        Self {
            tweens: Vec::new(),
            engine: AnimationEngine::new(),
        }
    }

    pub fn with_engine(mut self, engine: AnimationEngine) -> Self {
        self.engine = engine;
        self
    }

    #[allow(clippy::should_implement_trait)]
    pub fn add(mut self, tween: Tween) -> Self {
        self.tweens.push(tween);
        self
    }

    pub fn build(self) -> Vec<TweenId> {
        let mut ids = Vec::new();
        for mut tween in self.tweens {
            let id = tween.id();
            tween.play();
            let mut tweens = self.engine.tweens.borrow_mut();
            tweens.insert(tween);
            ids.push(id);
        }
        ids
    }

    pub fn play(self) -> Vec<TweenId> {
        self.build()
    }
}

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
    pub fn new() -> Self {
        Self {
            tweens: Vec::new(),
            engine: AnimationEngine::new(),
            delay: Duration::ZERO,
        }
    }

    pub fn with_engine(mut self, engine: AnimationEngine) -> Self {
        self.engine = engine;
        self
    }

    #[allow(clippy::should_implement_trait)]
    pub fn add(mut self, tween: Tween) -> Self {
        self.tweens.push((tween, self.delay));
        self.delay = Duration::ZERO;
        self
    }

    pub fn delay(mut self, delay: Duration) -> Self {
        self.delay = delay;
        self
    }

    pub fn delay_ms(self, ms: u64) -> Self {
        self.delay(Duration::from_millis(ms))
    }

    pub fn build(self) -> Vec<TweenId> {
        let mut ids = Vec::new();
        for (tween, delay) in self.tweens {
            let id = tween.id();
            let mut tweens = self.engine.tweens.borrow_mut();
            tweens.insert(tween);
            drop(tweens);

            std::thread::sleep(delay);
            self.engine.play(id);
            ids.push(id);
        }
        ids
    }

    pub fn play(self) -> Vec<TweenId> {
        self.build()
    }
}

pub fn sequence() -> SequenceBuilder {
    SequenceBuilder::new()
}
