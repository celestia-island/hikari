//! Tween animation implementation

use std::time::Duration;

use super::{
    AnimationDirection, AnimationOptions, AnimationState, CompletionCallback, PlaybackMode,
    PropertyTarget, TweenCallback, TweenId,
};

pub struct Tween {
    id: TweenId,
    state: AnimationState,
    direction: AnimationDirection,
    options: AnimationOptions,
    targets: Vec<PropertyTarget>,
    on_update: Option<TweenCallback>,
    on_complete: Option<CompletionCallback>,
    progress: f64,
    elapsed: Duration,
    repeat_count: u32,
}

impl Clone for Tween {
    fn clone(&self) -> Self {
        Self {
            id: self.id,
            state: self.state,
            direction: self.direction,
            options: self.options.clone(),
            targets: self.targets.clone(),
            on_update: self.on_update.clone(),
            on_complete: self.on_complete.clone(),
            progress: self.progress,
            elapsed: self.elapsed,
            repeat_count: self.repeat_count,
        }
    }
}

impl std::fmt::Debug for Tween {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Tween")
            .field("id", &self.id)
            .field("state", &self.state)
            .field("direction", &self.direction)
            .field("options", &self.options)
            .field("targets", &self.targets)
            .field("on_update", &self.on_update.as_ref().map(|_| "<callback>"))
            .field(
                "on_complete",
                &self.on_complete.as_ref().map(|_| "<callback>"),
            )
            .field("progress", &self.progress)
            .field("elapsed", &self.elapsed)
            .field("repeat_count", &self.repeat_count)
            .finish()
    }
}

impl Tween {
    pub(crate) fn new_for_engine(options: AnimationOptions) -> Self {
        Self {
            id: TweenId::default(),
            state: AnimationState::Idle,
            direction: AnimationDirection::Forward,
            options,
            targets: Vec::new(),
            on_update: None,
            on_complete: None,
            progress: 0.0,
            elapsed: Duration::ZERO,
            repeat_count: 0,
        }
    }

    #[must_use]
    pub fn new(id: TweenId, options: AnimationOptions) -> Self {
        Self {
            id,
            state: AnimationState::Idle,
            direction: AnimationDirection::Forward,
            options,
            targets: Vec::new(),
            on_update: None,
            on_complete: None,
            progress: 0.0,
            elapsed: Duration::ZERO,
            repeat_count: 0,
        }
    }

    #[must_use]
    pub const fn id(&self) -> TweenId {
        self.id
    }

    #[must_use]
    pub const fn state(&self) -> AnimationState {
        self.state
    }

    #[must_use]
    pub const fn progress(&self) -> f64 {
        self.progress
    }

    #[must_use]
    pub const fn elapsed(&self) -> Duration {
        self.elapsed
    }

    #[must_use]
    pub const fn duration(&self) -> Duration {
        self.options.duration
    }

    #[must_use]
    pub fn is_completed(&self) -> bool {
        self.state == AnimationState::Completed
    }

    #[must_use]
    pub fn is_running(&self) -> bool {
        self.state == AnimationState::Running
    }

    #[must_use]
    pub fn is_paused(&self) -> bool {
        self.state == AnimationState::Paused
    }

    pub fn add_target(&mut self, target: PropertyTarget) -> &mut Self {
        self.targets.push(target);
        self
    }

    pub fn set_on_update(&mut self, callback: TweenCallback) -> &mut Self {
        self.on_update = Some(callback);
        self
    }

    pub fn set_on_complete(&mut self, callback: CompletionCallback) -> &mut Self {
        self.on_complete = Some(callback);
        self
    }

    pub fn play(&mut self) {
        if self.state == AnimationState::Completed {
            self.reset();
        }
        self.state = AnimationState::Running;
    }

    pub fn pause(&mut self) {
        if self.state == AnimationState::Running {
            self.state = AnimationState::Paused;
        }
    }

    pub fn resume(&mut self) {
        if self.state == AnimationState::Paused {
            self.state = AnimationState::Running;
        }
    }

    pub fn reverse(&mut self) {
        if self.state == AnimationState::Running || self.state == AnimationState::Paused {
            self.direction = match self.direction {
                AnimationDirection::Forward => AnimationDirection::Backward,
                AnimationDirection::Backward => AnimationDirection::Forward,
            };
        }
    }

    pub fn restart(&mut self) {
        self.reset();
        self.play();
    }

    pub const fn reset(&mut self) {
        self.state = AnimationState::Idle;
        self.progress = 0.0;
        self.elapsed = Duration::ZERO;
        self.repeat_count = 0;
        self.direction = AnimationDirection::Forward;
    }

    pub fn seek(&mut self, time: Duration) {
        if time <= self.options.duration {
            self.elapsed = time;
            if self.options.duration == Duration::ZERO {
                self.progress = 0.0;
            } else {
                self.progress =
                    (time.as_secs_f64() / self.options.duration.as_secs_f64()).clamp(0.0, 1.0);
            }
            self.update();
        }
    }

    pub fn update(&mut self) {
        if self.state != AnimationState::Running {
            return;
        }

        if self.options.duration == Duration::ZERO {
            self.progress = 0.0;
            return;
        }

        match self.direction {
            AnimationDirection::Forward => {
                self.progress = (self.elapsed.as_secs_f64() / self.options.duration.as_secs_f64())
                    .clamp(0.0, 1.0);
            }
            AnimationDirection::Backward => {
                self.progress = 1.0
                    - (self.elapsed.as_secs_f64() / self.options.duration.as_secs_f64())
                        .clamp(0.0, 1.0);
            }
        }

        if let Some(callback) = &self.on_update {
            callback(self.progress);
        }
    }

    pub fn advance(&mut self, delta: Duration) {
        if self.state != AnimationState::Running {
            return;
        }

        self.elapsed += delta;

        if self.elapsed >= self.options.duration {
            self.elapsed = self.options.duration;
            self.progress = match self.direction {
                AnimationDirection::Forward => 1.0,
                AnimationDirection::Backward => 0.0,
            };

            self.handle_completion();
        }

        self.update();
    }

    fn handle_completion(&mut self) {
        match self.options.playback {
            PlaybackMode::Loop => {
                self.elapsed = Duration::ZERO;
                self.state = AnimationState::Running;
            }
            PlaybackMode::Yoyo => {
                self.reverse();
                self.elapsed = Duration::ZERO;
            }
            PlaybackMode::Normal | PlaybackMode::Reverse => {
                if let Some(repeat) = self.options.repeat {
                    if self.repeat_count < repeat {
                        self.repeat_count += 1;
                        self.elapsed = Duration::ZERO;
                        self.state = AnimationState::Running;
                    } else {
                        self.state = AnimationState::Completed;
                        if let Some(callback) = &self.on_complete {
                            callback();
                        }
                    }
                } else {
                    self.state = AnimationState::Completed;
                    if let Some(callback) = &self.on_complete {
                        callback();
                    }
                }
            }
        }
    }

    #[must_use]
    pub fn get_current_value(&self, target_index: usize) -> Option<f64> {
        if target_index >= self.targets.len() {
            return None;
        }

        let target = &self.targets[target_index];
        let eased = self.options.easing.apply(self.progress);
        let value = (target.end - target.start).mul_add(eased, target.start);
        Some(value)
    }

    #[must_use]
    pub fn get_current_values(&self) -> Vec<f64> {
        self.targets
            .iter()
            .map(|target| {
                let eased = self.options.easing.apply(self.progress);
                (target.end - target.start).mul_add(eased, target.start)
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::*;
    use crate::core::{
        AnimationDirection, AnimationOptions, EasingFunction, PlaybackMode, PropertyTarget, TweenId,
    };

    fn make_options() -> AnimationOptions {
        AnimationOptions {
            duration: Duration::from_millis(1000),
            delay: Duration::ZERO,
            easing: EasingFunction::Linear,
            playback: PlaybackMode::Normal,
            repeat: None,
        }
    }

    fn make_tween() -> Tween {
        Tween::new(TweenId::default(), make_options())
    }

    #[test]
    fn new_tween_is_idle() {
        let tween = make_tween();
        assert_eq!(tween.state(), AnimationState::Idle);
        assert!(!tween.is_running());
        assert!(!tween.is_paused());
        assert!(!tween.is_completed());
    }

    #[test]
    fn play_sets_running() {
        let mut tween = make_tween();
        tween.play();
        assert!(tween.is_running());
        assert_eq!(tween.state(), AnimationState::Running);
    }

    #[test]
    fn pause_then_resume() {
        let mut tween = make_tween();
        tween.play();
        tween.pause();
        assert!(tween.is_paused());
        tween.resume();
        assert!(tween.is_running());
    }

    #[test]
    fn pause_on_idle_is_noop() {
        let mut tween = make_tween();
        tween.pause();
        assert_eq!(tween.state(), AnimationState::Idle);
    }

    #[test]
    fn resume_on_idle_is_noop() {
        let mut tween = make_tween();
        tween.resume();
        assert_eq!(tween.state(), AnimationState::Idle);
    }

    #[test]
    fn play_after_completed_resets() {
        let mut tween = make_tween();
        tween.play();
        tween.advance(Duration::from_millis(1000));
        assert!(tween.is_completed());
        tween.play();
        assert!(tween.is_running());
        assert_eq!(tween.progress(), 0.0);
    }

    #[test]
    fn reset_clears_state() {
        let mut tween = make_tween();
        tween.play();
        tween.advance(Duration::from_millis(500));
        tween.reset();
        assert_eq!(tween.state(), AnimationState::Idle);
        assert_eq!(tween.progress(), 0.0);
        assert_eq!(tween.elapsed(), Duration::ZERO);
    }

    #[test]
    fn restart_plays_from_beginning() {
        let mut tween = make_tween();
        tween.play();
        tween.advance(Duration::from_millis(500));
        tween.restart();
        assert!(tween.is_running());
        assert_eq!(tween.progress(), 0.0);
    }

    #[test]
    fn advance_updates_elapsed_and_progress() {
        let mut tween = make_tween();
        tween.play();
        tween.advance(Duration::from_millis(250));
        assert_eq!(tween.elapsed(), Duration::from_millis(250));
        let expected = 0.25_f64;
        assert!((tween.progress() - expected).abs() < 1e-9);
    }

    #[test]
    fn advance_to_completion() {
        let mut tween = make_tween();
        tween.play();
        tween.advance(Duration::from_millis(1000));
        assert!(tween.is_completed());
        assert!((tween.progress() - 1.0).abs() < 1e-9);
    }

    #[test]
    fn advance_beyond_duration_clamps() {
        let mut tween = make_tween();
        tween.play();
        tween.advance(Duration::from_millis(2000));
        assert!(tween.is_completed());
        assert_eq!(tween.elapsed(), Duration::from_millis(1000));
    }

    #[test]
    fn advance_on_idle_is_noop() {
        let mut tween = make_tween();
        tween.advance(Duration::from_millis(500));
        assert_eq!(tween.elapsed(), Duration::ZERO);
    }

    #[test]
    fn seek_updates_progress() {
        let mut tween = make_tween();
        tween.play();
        tween.seek(Duration::from_millis(500));
        assert!((tween.progress() - 0.5).abs() < 1e-9);
    }

    #[test]
    fn seek_beyond_duration_ignored() {
        let mut tween = make_tween();
        tween.play();
        tween.seek(Duration::from_millis(2000));
        assert_eq!(tween.elapsed(), Duration::ZERO);
    }

    #[test]
    fn seek_on_non_running_updates_elapsed_but_not_state() {
        let mut tween = make_tween();
        tween.seek(Duration::from_millis(500));
        assert_eq!(tween.state(), AnimationState::Idle);
        assert_eq!(tween.elapsed(), Duration::from_millis(500));
    }

    #[test]
    fn add_target_and_get_value() {
        let mut tween = make_tween();
        tween.add_target(PropertyTarget {
            property: "opacity".into(),
            start: 0.0,
            end: 1.0,
        });
        assert_eq!(tween.get_current_value(0), Some(0.0));

        let mut tween2 = make_tween();
        tween2.play();
        tween2.seek(Duration::from_millis(500));
        tween2.add_target(PropertyTarget {
            property: "opacity".into(),
            start: 0.0,
            end: 100.0,
        });
        assert!((tween2.get_current_value(0).unwrap() - 50.0).abs() < 1e-9);
    }

    #[test]
    fn get_current_value_out_of_bounds() {
        let tween = make_tween();
        assert_eq!(tween.get_current_value(0), None);
    }

    #[test]
    fn get_current_values_empty() {
        let tween = make_tween();
        assert!(tween.get_current_values().is_empty());
    }

    #[test]
    fn get_current_values_multiple_targets() {
        let mut tween = make_tween();
        tween.play();
        tween.seek(Duration::from_millis(500));
        tween.add_target(PropertyTarget {
            property: "x".into(),
            start: 0.0,
            end: 10.0,
        });
        tween.add_target(PropertyTarget {
            property: "y".into(),
            start: 20.0,
            end: 40.0,
        });
        let vals = tween.get_current_values();
        assert!((vals[0] - 5.0).abs() < 1e-9);
        assert!((vals[1] - 30.0).abs() < 1e-9);
    }

    #[test]
    fn easing_applied_to_value() {
        let mut tween = Tween::new(
            TweenId::default(),
            AnimationOptions {
                duration: Duration::from_millis(1000),
                delay: Duration::ZERO,
                easing: EasingFunction::EaseInQuad,
                playback: PlaybackMode::Normal,
                repeat: None,
            },
        );
        tween.add_target(PropertyTarget {
            property: "x".into(),
            start: 0.0,
            end: 100.0,
        });
        tween.play();
        tween.seek(Duration::from_millis(500));
        let val = tween.get_current_value(0).unwrap();
        assert!((val - 25.0).abs() < 1e-9);
    }

    #[test]
    fn loop_playback_repeats() {
        let mut tween = Tween::new(
            TweenId::default(),
            AnimationOptions {
                duration: Duration::from_millis(100),
                delay: Duration::ZERO,
                easing: EasingFunction::Linear,
                playback: PlaybackMode::Loop,
                repeat: None,
            },
        );
        tween.play();
        tween.advance(Duration::from_millis(100));
        assert!(tween.is_running());
        assert_eq!(tween.elapsed(), Duration::ZERO);
    }

    #[test]
    fn yoyo_playback_reverses() {
        let mut tween = Tween::new(
            TweenId::default(),
            AnimationOptions {
                duration: Duration::from_millis(100),
                delay: Duration::ZERO,
                easing: EasingFunction::Linear,
                playback: PlaybackMode::Yoyo,
                repeat: None,
            },
        );
        tween.play();
        tween.advance(Duration::from_millis(100));
        assert!(tween.is_running());
    }

    #[test]
    fn repeat_finite_times() {
        let mut tween = Tween::new(
            TweenId::default(),
            AnimationOptions {
                duration: Duration::from_millis(100),
                delay: Duration::ZERO,
                easing: EasingFunction::Linear,
                playback: PlaybackMode::Normal,
                repeat: Some(2),
            },
        );
        tween.play();
        tween.advance(Duration::from_millis(100));
        assert!(tween.is_running());
        tween.advance(Duration::from_millis(100));
        assert!(tween.is_running());
        tween.advance(Duration::from_millis(100));
        assert!(tween.is_completed());
    }

    #[test]
    fn reverse_direction() {
        let mut tween = make_tween();
        tween.play();
        tween.reverse();
        assert_eq!(tween.direction, AnimationDirection::Backward);
        tween.reverse();
        assert_eq!(tween.direction, AnimationDirection::Forward);
    }

    #[test]
    fn reverse_on_idle_is_noop() {
        let mut tween = make_tween();
        tween.reverse();
        assert_eq!(tween.direction, AnimationDirection::Forward);
    }

    #[test]
    fn backward_direction_progress() {
        let mut tween = Tween::new(
            TweenId::default(),
            AnimationOptions {
                duration: Duration::from_millis(1000),
                delay: Duration::ZERO,
                easing: EasingFunction::Linear,
                playback: PlaybackMode::Normal,
                repeat: None,
            },
        );
        tween.play();
        tween.reverse();
        tween.advance(Duration::from_millis(500));
        assert!((tween.progress() - 0.5).abs() < 1e-9);
    }

    #[test]
    fn clone_preserves_callbacks() {
        let mut tween = make_tween();
        tween.set_on_update(Arc::new(|_| {}));
        tween.play();
        let cloned = tween.clone();
        assert_eq!(cloned.state(), AnimationState::Running);
        assert_eq!(cloned.progress(), 0.0);
        assert!(cloned.on_update.is_some());
    }

    #[test]
    fn duration_returns_options_duration() {
        let tween = make_tween();
        assert_eq!(tween.duration(), Duration::from_millis(1000));
    }

    #[test]
    fn on_update_callback_called_on_seek() {
        use std::sync::Mutex;
        let received: Arc<Mutex<Vec<f64>>> = Arc::new(Mutex::new(Vec::new()));
        let received_clone = received.clone();
        let mut tween = make_tween();
        tween.set_on_update(Arc::new(move |p| received_clone.lock().unwrap().push(p)));
        tween.play();
        tween.seek(Duration::from_millis(500));
        assert_eq!(received.lock().unwrap().len(), 1);
        assert!((received.lock().unwrap()[0] - 0.5).abs() < 1e-9);
    }

    #[test]
    fn on_complete_callback_called() {
        use std::sync::Arc;
        use std::sync::atomic::{AtomicBool, Ordering};
        let called = Arc::new(AtomicBool::new(false));
        let called_clone = called.clone();
        let mut tween = make_tween();
        tween.set_on_complete(Arc::new(move || called_clone.store(true, Ordering::SeqCst)));
        tween.play();
        tween.advance(Duration::from_millis(1000));
        assert!(called.load(Ordering::SeqCst));
    }

    #[test]
    fn debug_format_succeeds() {
        let tween = make_tween();
        let _ = format!("{tween:?}");
    }

    #[test]
    fn zero_duration_does_not_panic() {
        let make_opts = || AnimationOptions {
            duration: Duration::ZERO,
            ..Default::default()
        };
        let mut tween = Tween::new(TweenId::default(), make_opts());
        tween.play();
        // seek and update with zero duration should not divide by zero
        tween.seek(Duration::ZERO);
        tween.update();
        tween.advance(Duration::from_millis(100));
        // Zero-duration tweens complete immediately on first advance
        assert!(tween.progress() == 1.0);
        assert!(
            tween.is_completed(),
            "zero-duration tween should complete on first advance"
        );

        // Verify we can play a zero-duration tween repeatedly without panic
        let mut tween = Tween::new(TweenId::default(), make_opts());
        tween.play();
        tween.advance(Duration::ZERO);
        assert!(
            tween.is_completed(),
            "zero-duration tween with zero delta should also complete"
        );
    }
}
