//! Basic animation types

use slotmap::new_key_type;

new_key_type! { pub struct TweenId; }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnimationState {
    Idle,
    Running,
    Paused,
    Completed,
    Reversed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnimationDirection {
    Forward,
    Backward,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlaybackMode {
    Normal,
    Reverse,
    Loop,
    Yoyo,
}
