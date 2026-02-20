//! Animated value and transition hooks for Dioxus

use dioxus::prelude::*;
use wasm_bindgen::JsCast;

use crate::provider::try_use_animation_config;

pub fn use_animated_value<T: Clone + 'static>(initial: T) -> Signal<T> {
    use_signal(|| initial)
}

pub fn use_transition(duration_ms: u64) -> UseTransition {
    use_hook(move || UseTransition::new(duration_ms))
}

pub fn use_transition_with_config(duration_ms: u64) -> UseTransition {
    use_hook(move || {
        let scaled_duration = if let Some(ctx) = try_use_animation_config() {
            ctx.config.read().scale_duration(duration_ms)
        } else {
            duration_ms
        };
        UseTransition::new(scaled_duration)
    })
}

#[derive(Clone)]
pub struct UseTransition {
    is_visible: Signal<bool>,
    is_animating: Signal<bool>,
    duration_ms: u64,
}

impl UseTransition {
    fn new(duration_ms: u64) -> Self {
        Self {
            is_visible: Signal::new(false),
            is_animating: Signal::new(false),
            duration_ms,
        }
    }

    pub fn is_visible(&self) -> bool {
        *self.is_visible.read()
    }

    pub fn is_animating(&self) -> bool {
        *self.is_animating.read()
    }

    pub fn enter(&mut self) {
        self.is_visible.set(true);
        self.is_animating.set(true);

        let mut is_animating = self.is_animating;
        let duration_ms = self.duration_ms as i32;

        let closure = wasm_bindgen::closure::Closure::once(Box::new(move || {
            is_animating.set(false);
        }) as Box<dyn FnOnce()>);

        web_sys::window()
            .unwrap()
            .set_timeout_with_callback_and_timeout_and_arguments_0(
                closure.as_ref().unchecked_ref(),
                duration_ms,
            )
            .unwrap();
        closure.forget();
    }

    pub fn exit(&mut self) {
        self.is_animating.set(true);

        let mut is_visible = self.is_visible;
        let mut is_animating = self.is_animating;
        let duration_ms = self.duration_ms as i32;

        let closure = wasm_bindgen::closure::Closure::once(Box::new(move || {
            is_visible.set(false);
            is_animating.set(false);
        }) as Box<dyn FnOnce()>);

        web_sys::window()
            .unwrap()
            .set_timeout_with_callback_and_timeout_and_arguments_0(
                closure.as_ref().unchecked_ref(),
                duration_ms,
            )
            .unwrap();
        closure.forget();
    }

    pub fn toggle(&mut self) {
        if *self.is_visible.read() {
            self.exit();
        } else {
            self.enter();
        }
    }
}
