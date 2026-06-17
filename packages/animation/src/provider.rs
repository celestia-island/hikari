//! Animation Provider
//!
//! Provides global animation configuration to child components via tairitsu context.

use tairitsu_hooks::{consume_context, provide_context, use_context};
use tairitsu_vdom::Signal;

use crate::config::AnimationConfig;

#[derive(Clone)]
pub struct AnimationProviderContext {
    config: Signal<AnimationConfig>,
}

impl AnimationProviderContext {
    #[must_use]
    pub fn new(config: AnimationConfig) -> Self {
        Self {
            config: Signal::new(config),
        }
    }

    #[must_use]
    pub fn is_enabled(&self) -> bool {
        self.config.get().enabled
    }

    #[must_use]
    pub fn duration_scale(&self) -> f32 {
        self.config.get().duration_scale
    }

    #[must_use]
    pub fn is_reduced_motion(&self) -> bool {
        self.config.get().reduced_motion
    }

    #[must_use]
    pub fn scale_duration(&self, duration_ms: u64) -> u64 {
        self.config.get().scale_duration(duration_ms)
    }

    #[must_use]
    pub fn should_skip(&self) -> bool {
        self.config.get().should_skip()
    }

    #[must_use]
    pub fn get(&self) -> AnimationConfig {
        self.config.get()
    }

    pub fn set(&self, config: AnimationConfig) {
        self.config.set(config);
    }
}

#[must_use]
pub fn init_animation_provider(config: AnimationConfig) -> AnimationProviderContext {
    let ctx = AnimationProviderContext::new(config);
    provide_context(ctx.clone());
    ctx
}

#[must_use]
pub fn use_animation_config() -> AnimationProviderContext {
    consume_context()
}

#[must_use]
pub fn try_use_animation_config() -> Option<AnimationProviderContext> {
    use_context::<AnimationProviderContext>().map(|ctx| ctx.get().clone())
}

#[must_use]
pub fn use_animation_enabled() -> bool {
    use_animation_config().is_enabled()
}

#[must_use]
pub fn use_animation_duration_scale() -> f32 {
    use_animation_config().duration_scale()
}

#[must_use]
pub fn use_animation_reduced_motion() -> bool {
    use_animation_config().is_reduced_motion()
}
