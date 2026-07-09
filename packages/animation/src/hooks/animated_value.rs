//! Animated value and transition hooks for tairitsu components

use tairitsu_hooks::use_signal;
use tairitsu_vdom::Signal;
use wasm_bindgen::JsCast;

use crate::provider::try_use_animation_config;

pub fn use_animated_value<T: Clone + 'static>(initial: T) -> Signal<T> {
    use_signal(move || initial).inner().clone()
}

/// Create a persistent transition controller for the current component.
///
/// Uses `use_signal` so the controller is constructed once and shared across
/// re-renders (the controller is `Signal`-backed, so cloning is cheap).
pub fn use_transition(duration_ms: u64) -> UseTransition {
    use_signal(move || UseTransition::new(duration_ms)).inner().get()
}

/// Like [`use_transition`], but scales the duration by the active animation
/// configuration when one is provided via an [`AnimationProvider`](crate::AnimationProvider).
pub fn use_transition_with_config(duration_ms: u64) -> UseTransition {
    let scaled_duration = if let Some(ctx) = try_use_animation_config() {
        ctx.config.read().scale_duration(duration_ms)
    } else {
        duration_ms
    };
    use_signal(move || UseTransition::new(scaled_duration)).inner().get()
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
        self.is_visible.read()
    }

    pub fn is_animating(&self) -> bool {
        self.is_animating.read()
    }

    pub fn enter(&self) {
        self.is_visible.set(true);
        self.is_animating.set(true);

        let is_animating = self.is_animating.clone();
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

    pub fn exit(&self) {
        self.is_animating.set(true);

        let is_visible = self.is_visible.clone();
        let is_animating = self.is_animating.clone();
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

    pub fn toggle(&self) {
        if self.is_visible.read() {
            self.exit();
        } else {
            self.enter();
        }
    }
}
