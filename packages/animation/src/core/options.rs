//! Animation configuration options

use std::sync::Arc;
use std::time::Duration;

use super::{EasingFunction, PlaybackMode};

#[derive(Debug, Clone)]
pub struct AnimationOptions {
    pub duration: Duration,
    pub delay: Duration,
    pub easing: EasingFunction,
    pub playback: PlaybackMode,
    pub repeat: Option<u32>,
}

impl Default for AnimationOptions {
    fn default() -> Self {
        Self {
            duration: Duration::from_millis(1000),
            delay: Duration::ZERO,
            easing: EasingFunction::default(),
            playback: PlaybackMode::Normal,
            repeat: None,
        }
    }
}

pub type TweenCallback = Arc<dyn Fn(f64) + 'static>;

pub type CompletionCallback = Arc<dyn Fn() + 'static>;

/// Definition of a numeric property to animate
#[derive(Debug, Clone, PartialEq)]
pub struct PropertyTarget {
    pub property: String,
    pub start: f64,
    pub end: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_animation_options() {
        let opts = AnimationOptions::default();
        assert_eq!(opts.duration, Duration::from_millis(1000));
        assert_eq!(opts.delay, Duration::ZERO);
        assert_eq!(opts.easing, EasingFunction::default());
        assert_eq!(opts.playback, PlaybackMode::Normal);
        assert_eq!(opts.repeat, None);
    }

    #[test]
    fn animation_options_custom_duration() {
        let opts = AnimationOptions {
            duration: Duration::from_millis(500),
            ..Default::default()
        };
        assert_eq!(opts.duration, Duration::from_millis(500));
        assert_eq!(opts.delay, Duration::ZERO);
    }

    #[test]
    fn animation_options_custom_delay() {
        let opts = AnimationOptions {
            delay: Duration::from_millis(200),
            ..Default::default()
        };
        assert_eq!(opts.delay, Duration::from_millis(200));
    }

    #[test]
    fn animation_options_with_repeat() {
        let opts = AnimationOptions {
            repeat: Some(3),
            ..Default::default()
        };
        assert_eq!(opts.repeat, Some(3));
    }

    #[test]
    fn animation_options_clone_independence() {
        let opts = AnimationOptions {
            duration: Duration::from_millis(500),
            repeat: Some(2),
            ..Default::default()
        };
        let mut cloned = opts.clone();
        cloned.repeat = None;
        assert_eq!(opts.repeat, Some(2));
        assert_eq!(cloned.repeat, None);
    }

    #[test]
    fn animation_options_debug_format() {
        let opts = AnimationOptions::default();
        let debug_str = format!("{opts:?}");
        assert!(debug_str.contains("duration"));
        assert!(debug_str.contains("easing"));
        assert!(debug_str.contains("playback"));
    }

    #[test]
    fn property_target_stores_values() {
        let target = PropertyTarget {
            property: "opacity".to_string(),
            start: 0.0,
            end: 1.0,
        };
        assert_eq!(target.property, "opacity");
        assert_eq!(target.start, 0.0);
        assert_eq!(target.end, 1.0);
    }

    #[test]
    fn property_target_clone() {
        let target = PropertyTarget {
            property: "scale".to_string(),
            start: 0.5,
            end: 2.0,
        };
        let cloned = target;
        assert_eq!(cloned.property, "scale");
        assert_eq!(cloned.start, 0.5);
        assert_eq!(cloned.end, 2.0);
    }
}
