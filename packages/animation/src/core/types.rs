//! Basic animation types

use slotmap::new_key_type;

new_key_type! { pub struct TweenId; }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnimationState {
    Idle,
    Running,
    Paused,
    Completed,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn animation_state_equality() {
        assert_eq!(AnimationState::Running, AnimationState::Running);
        assert_ne!(AnimationState::Running, AnimationState::Idle);
        assert_ne!(AnimationState::Paused, AnimationState::Completed);
    }

    #[test]
    fn animation_state_all_variants_distinct() {
        let states = [
            AnimationState::Idle,
            AnimationState::Running,
            AnimationState::Paused,
            AnimationState::Completed,
        ];
        for i in 0..states.len() {
            for j in 0..states.len() {
                if i == j {
                    assert_eq!(states[i], states[j]);
                } else {
                    assert_ne!(states[i], states[j]);
                }
            }
        }
    }

    #[test]
    fn animation_state_copy_semantics() {
        let a = AnimationState::Running;
        let b = a;
        let c = a;
        assert_eq!(a, b);
        assert_eq!(b, c);
    }

    #[test]
    fn animation_state_debug_format() {
        assert_eq!(format!("{:?}", AnimationState::Running), "Running");
        assert_eq!(format!("{:?}", AnimationState::Idle), "Idle");
        assert_eq!(format!("{:?}", AnimationState::Paused), "Paused");
        assert_eq!(format!("{:?}", AnimationState::Completed), "Completed");
    }

    #[test]
    fn animation_direction_variants() {
        assert_eq!(AnimationDirection::Forward, AnimationDirection::Forward);
        assert_ne!(AnimationDirection::Forward, AnimationDirection::Backward);
    }

    #[test]
    fn animation_direction_debug_format() {
        assert_eq!(format!("{:?}", AnimationDirection::Forward), "Forward");
        assert_eq!(format!("{:?}", AnimationDirection::Backward), "Backward");
    }

    #[test]
    fn animation_direction_copy() {
        let a = AnimationDirection::Backward;
        let b = a;
        assert_eq!(a, b);
    }

    #[test]
    fn playback_mode_all_variants_distinct() {
        let modes = [
            PlaybackMode::Normal,
            PlaybackMode::Reverse,
            PlaybackMode::Loop,
            PlaybackMode::Yoyo,
        ];
        for i in 0..modes.len() {
            for j in 0..modes.len() {
                if i == j {
                    assert_eq!(modes[i], modes[j]);
                } else {
                    assert_ne!(modes[i], modes[j]);
                }
            }
        }
    }

    #[test]
    fn playback_mode_debug_format() {
        assert_eq!(format!("{:?}", PlaybackMode::Normal), "Normal");
        assert_eq!(format!("{:?}", PlaybackMode::Reverse), "Reverse");
        assert_eq!(format!("{:?}", PlaybackMode::Loop), "Loop");
        assert_eq!(format!("{:?}", PlaybackMode::Yoyo), "Yoyo");
    }

    #[test]
    fn playback_mode_copy() {
        let a = PlaybackMode::Yoyo;
        let b = a;
        assert_eq!(a, b);
    }
}
