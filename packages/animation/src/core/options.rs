//! Animation configuration options

use std::time::Duration;

use super::{EasingFunction, PlaybackMode};

#[derive(Debug, Clone)]
pub struct AnimationOptions {
    pub duration: Duration,
    pub delay: Duration,
    pub easing: EasingFunction,
    pub playback: PlaybackMode,
    pub repeat: Option<u32>,
    pub yoyo: bool,
}

impl Default for AnimationOptions {
    fn default() -> Self {
        Self {
            duration: Duration::from_millis(1000),
            delay: Duration::ZERO,
            easing: EasingFunction::default(),
            playback: PlaybackMode::Normal,
            repeat: None,
            yoyo: false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct PropertyTarget {
    pub property: String,
    pub start: f64,
    pub end: f64,
}

pub type TweenCallback = Box<dyn Fn(f64) + 'static>;

pub type CompletionCallback = Box<dyn Fn() + 'static>;
