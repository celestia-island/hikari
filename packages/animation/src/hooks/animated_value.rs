//! Animated value and transition hooks
//!
//! Provides `use_animated_value` for simple animated state and
//! `use_transition` for enter/exit transitions with configurable duration.

use std::cell::RefCell;
use std::rc::Rc;

use crate::provider::try_use_animation_config;

pub fn use_animated_value<T: Clone + 'static>(initial: T) -> tairitsu_hooks::ReactiveSignal<T> {
    tairitsu_hooks::use_signal(|| initial)
}

#[derive(Clone)]
pub struct UseTransition {
    is_visible: Rc<RefCell<bool>>,
    is_animating: Rc<RefCell<bool>>,
    duration_ms: u64,
}

impl UseTransition {
    fn new(duration_ms: u64) -> Self {
        Self {
            is_visible: Rc::new(RefCell::new(false)),
            is_animating: Rc::new(RefCell::new(false)),
            duration_ms,
        }
    }

    #[must_use]
    pub fn is_visible(&self) -> bool {
        *self.is_visible.borrow()
    }

    #[must_use]
    pub fn is_animating(&self) -> bool {
        *self.is_animating.borrow()
    }

    pub fn enter(&self) {
        *self.is_visible.borrow_mut() = true;
        *self.is_animating.borrow_mut() = true;

        let is_animating = self.is_animating.clone();
        let platform = tairitsu_web::BrowserPlatform::new();
        platform.set_timeout(
            move || {
                *is_animating.borrow_mut() = false;
            },
            self.duration_ms as u32,
        );
    }

    pub fn exit(&self) {
        *self.is_animating.borrow_mut() = true;

        let is_visible = self.is_visible.clone();
        let is_animating = self.is_animating.clone();
        let platform = tairitsu_web::BrowserPlatform::new();
        platform.set_timeout(
            move || {
                *is_visible.borrow_mut() = false;
                *is_animating.borrow_mut() = false;
            },
            self.duration_ms as u32,
        );
    }

    pub fn toggle(&self) {
        if self.is_visible() {
            self.exit();
        } else {
            self.enter();
        }
    }
}

#[must_use]
pub fn use_transition(duration_ms: u64) -> UseTransition {
    UseTransition::new(duration_ms)
}

#[must_use]
pub fn use_transition_with_config(duration_ms: u64) -> UseTransition {
    let scaled_duration = try_use_animation_config().map_or(duration_ms, |ctx| {
        let cfg = ctx.get();
        if cfg.duration_scale != 1.0 {
            (duration_ms as f64 * f64::from(cfg.duration_scale)) as u64
        } else {
            duration_ms
        }
    });
    UseTransition::new(scaled_duration)
}
