//! Tween hook
//!
//! Provides `UseTween` for imperative tween control within components.

use std::cell::RefCell;
use std::rc::Rc;
use std::time::Duration;

use crate::core::{AnimationEngine, AnimationOptions, PropertyTarget, Tween, TweenId};
use crate::provider::try_use_animation_config;

#[derive(Clone)]
pub struct UseTween {
    engine: Rc<AnimationEngine>,
    tween_id: RefCell<Option<TweenId>>,
}

impl UseTween {
    fn new() -> Self {
        let engine = Rc::new(AnimationEngine::new());
        Self {
            engine,
            tween_id: RefCell::new(None),
        }
    }

    pub fn tween_with_config(&self, mut options: AnimationOptions) -> Tween {
        if let Some(ctx) = try_use_animation_config() {
            let cfg = ctx.get();
            if cfg.duration_scale != 1.0 {
                options.duration =
                    Duration::from_millis(cfg.scale_duration(options.duration.as_millis() as u64));
            }
            if !cfg.enabled || cfg.reduced_motion {
                options.duration = Duration::ZERO;
            }
        }
        self.create_tween_internal(options)
    }

    fn create_tween_internal(&self, options: AnimationOptions) -> Tween {
        let tween = Tween::new(TweenId::default(), options);
        let mut tweens = self.engine.tweens.borrow_mut();
        let id = tweens.insert(tween);
        *self.tween_id.borrow_mut() = Some(id);
        drop(tweens);
        self.engine
            .get_tween(id)
            .unwrap_or_else(|| Tween::new(TweenId::default(), AnimationOptions::default()))
    }

    /// Returns a snapshot of the tween's current progress. Read-only.
    /// Mutations to the returned Tween do NOT affect the engine's copy.
    /// Use methods like `add_target`, `play`, `pause` on `UseTween` instead.
    pub fn tween(&self, options: AnimationOptions) -> Tween {
        let tween = self.create_tween_internal(options);
        // Return a snapshot for read access only
        tween
    }

    /// Add a property target to the tween. Operates directly on the engine's copy.
    pub fn add_target(&self, target: PropertyTarget) -> &Self {
        if let Some(id) = *self.tween_id.borrow() {
            self.engine.with_tween_mut(id, |tween| {
                tween.add_target(target);
            });
        }
        self
    }

    pub fn play(&self) {
        if let Some(id) = *self.tween_id.borrow() {
            self.engine.play(id);
        }
    }

    pub fn pause(&self) {
        if let Some(id) = *self.tween_id.borrow() {
            self.engine.pause(id);
        }
    }

    pub fn restart(&self) {
        if let Some(id) = *self.tween_id.borrow() {
            self.engine.restart(id);
        }
    }

    pub fn reverse(&self) {
        if let Some(id) = *self.tween_id.borrow() {
            self.engine.reverse(id);
        }
    }

    pub fn seek(&self, time: Duration) {
        if let Some(id) = *self.tween_id.borrow() {
            self.engine.seek(id, time);
        }
    }

    pub fn kill(&self) {
        if let Some(id) = *self.tween_id.borrow() {
            self.engine.kill(id);
        }
    }

    /// Get current progress of the managed tween (read from engine).
    pub fn progress(&self) -> f64 {
        let id = *self.tween_id.borrow();
        id.and_then(|id| self.engine.get_tween(id).map(|t| t.progress()))
            .unwrap_or(0.0)
    }

    /// Check if the managed tween is running.
    pub fn is_running(&self) -> bool {
        let id = *self.tween_id.borrow();
        id.and_then(|id| self.engine.get_tween(id).map(|t| t.is_running()))
            .unwrap_or(false)
    }

    /// Check if the managed tween is completed.
    pub fn is_completed(&self) -> bool {
        let id = *self.tween_id.borrow();
        id.and_then(|id| self.engine.get_tween(id).map(|t| t.is_completed()))
            .unwrap_or(false)
    }
}

#[must_use]
pub fn use_animation_engine() -> AnimationEngine {
    AnimationEngine::new()
}

#[must_use]
pub fn use_tween() -> UseTween {
    UseTween::new()
}
