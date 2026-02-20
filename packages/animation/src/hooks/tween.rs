//! Tween hook for Dioxus

use std::{cell::RefCell, rc::Rc, time::Duration};

use dioxus::prelude::*;

use crate::{
    core::{AnimationEngine, AnimationOptions, Tween, TweenId},
    provider::try_use_animation_config,
};

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

    pub fn tween(&self, options: AnimationOptions) -> Tween {
        let id = self.engine.create_tween(options.clone());
        *self.tween_id.borrow_mut() = Some(id);
        Tween::new(id, options)
    }

    pub fn tween_with_config(&self, mut options: AnimationOptions) -> Tween {
        if let Some(ctx) = try_use_animation_config() {
            let cfg = ctx.config.read();
            if cfg.duration_scale != 1.0 {
                options.duration =
                    Duration::from_millis(cfg.scale_duration(options.duration.as_millis() as u64));
            }
            if !cfg.enabled || cfg.reduced_motion {
                options.duration = Duration::ZERO;
            }
        }
        self.tween(options)
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
}

pub fn use_animation_engine() -> AnimationEngine {
    use_hook(AnimationEngine::new)
}

pub fn use_tween() -> UseTween {
    use_hook(UseTween::new)
}
