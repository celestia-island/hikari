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
    pub fn new(config: AnimationConfig) -> Self {
        Self {
            config: Signal::new(config),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.config.get().enabled
    }

    pub fn duration_scale(&self) -> f32 {
        self.config.get().duration_scale
    }

    pub fn is_reduced_motion(&self) -> bool {
        self.config.get().reduced_motion
    }

    pub fn scale_duration(&self, duration_ms: u64) -> u64 {
        self.config.get().scale_duration(duration_ms)
    }

    pub fn should_skip(&self) -> bool {
        self.config.get().should_skip()
    }

    pub fn get(&self) -> AnimationConfig {
        self.config.get()
    }

    pub fn set(&self, config: AnimationConfig) {
        self.config.set(config);
    }
}

pub fn init_animation_provider(config: AnimationConfig) -> AnimationProviderContext {
    let ctx = AnimationProviderContext::new(config);
    provide_context(ctx.clone());
    ctx
}

pub fn use_animation_config() -> AnimationProviderContext {
    consume_context()
}

pub fn try_use_animation_config() -> Option<AnimationProviderContext> {
    use_context::<AnimationProviderContext>().map(|ctx| ctx.get().clone())
}

pub fn use_animation_enabled() -> bool {
    use_animation_config().is_enabled()
}

pub fn use_animation_duration_scale() -> f32 {
    use_animation_config().duration_scale()
}

pub fn use_animation_reduced_motion() -> bool {
    use_animation_config().is_reduced_motion()
}
