//! Animation Provider component
//!
//! Provides global animation configuration to child components via context.

use dioxus::prelude::*;

use crate::config::AnimationConfig;
use crate::prefers_reduced_motion::prefers_reduced_motion;

/// Animation context for accessing configuration
#[derive(Clone)]
pub struct AnimationContext {
    /// Current configuration
    pub config: Signal<AnimationConfig>,

    /// Callback to update configuration
    pub set_config: Callback<AnimationConfig>,
}

impl AnimationContext {
    /// Get the current enabled state
    pub fn is_enabled(&self) -> bool {
        self.config.read().enabled
    }

    /// Get the current duration scale
    pub fn duration_scale(&self) -> f32 {
        self.config.read().duration_scale
    }

    /// Check if reduced motion is active
    pub fn is_reduced_motion(&self) -> bool {
        self.config.read().reduced_motion
    }

    /// Scale a duration value
    pub fn scale_duration(&self, duration_ms: u64) -> u64 {
        self.config.read().scale_duration(duration_ms)
    }

    /// Check if animations should be skipped
    pub fn should_skip(&self) -> bool {
        self.config.read().should_skip()
    }
}

/// AnimationProvider Props
#[derive(Clone, Props, PartialEq)]
pub struct AnimationProviderProps {
    /// Whether animations are enabled (default: true)
    #[props(default = true)]
    pub enabled: bool,

    /// Duration scale factor (default: 1.0)
    #[props(default = 1.0)]
    pub duration_scale: f32,

    /// Whether to respect system prefers-reduced-motion (default: true)
    /// When true and system prefers reduced motion, reduced_motion will be set to true
    #[props(default = true)]
    pub respect_reduced_motion: bool,

    /// Force reduced motion mode (overrides system detection)
    #[props(default)]
    pub force_reduced_motion: Option<bool>,

    children: Element,
}

/// AnimationProvider component
///
/// Provides global animation configuration to child components.
///
/// # Features
/// - Animation on/off switch
/// - Duration scaling
/// - prefers-reduced-motion auto-detection
/// - CSS variable injection
///
/// # Example
///
/// ```rust,no_run
/// use hikari_animation::AnimationProvider;
///
/// rsx! {
///     AnimationProvider {
///         duration_scale: 0.8,
///         respect_reduced_motion: true,
///
///         App { }
///     }
/// }
/// ```
#[component]
pub fn AnimationProvider(props: AnimationProviderProps) -> Element {
    let system_reduced = if props.respect_reduced_motion {
        prefers_reduced_motion()
    } else {
        false
    };

    let reduced_motion = props.force_reduced_motion.unwrap_or(system_reduced);

    let initial_config = AnimationConfig {
        enabled: props.enabled && !reduced_motion,
        duration_scale: if reduced_motion {
            0.0
        } else {
            props.duration_scale
        },
        reduced_motion,
    };

    let config = use_signal(|| initial_config);

    let mut config_for_callback = config;
    let set_config = Callback::new(move |new_config: AnimationConfig| {
        config_for_callback.set(new_config);
    });

    use_context_provider(move || AnimationContext { config, set_config });

    let css_vars = use_memo(move || {
        let cfg = config.read();
        format!(
            "--hi-animation-enabled: {}; --hi-animation-duration-scale: {}; --hi-animation-reduced-motion: {};",
            if cfg.enabled { 1 } else { 0 },
            cfg.duration_scale,
            if cfg.reduced_motion { 1 } else { 0 }
        )
    });

    rsx! {
        div {
            class: "hi-animation-provider",
            style: "{css_vars}",
            {props.children}
        }
    }
}

/// Hook: Get animation configuration context
///
/// # Panics
///
/// Panics if called outside of an AnimationProvider.
///
/// # Example
///
/// ```rust,no_run
/// use hikari_animation::use_animation_config;
///
/// fn MyComponent() -> Element {
///     let animation = use_animation_config();
///
///     let duration = animation.scale_duration(300);
///
///     rsx! { ... }
/// }
/// ```
pub fn use_animation_config() -> AnimationContext {
    use_context()
}

/// Hook: Try to get animation configuration context
///
/// Returns None if called outside of an AnimationProvider.
pub fn try_use_animation_config() -> Option<AnimationContext> {
    try_consume_context::<AnimationContext>()
}

/// Hook: Check if animations are enabled
pub fn use_animation_enabled() -> bool {
    use_animation_config().is_enabled()
}

/// Hook: Get current duration scale factor
pub fn use_animation_duration_scale() -> f32 {
    use_animation_config().duration_scale()
}

/// Hook: Check if reduced motion is active
pub fn use_animation_reduced_motion() -> bool {
    use_animation_config().is_reduced_motion()
}
