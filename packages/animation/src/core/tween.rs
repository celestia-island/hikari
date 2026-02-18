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
            on_update: None,
            on_complete: None,
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

    pub fn id(&self) -> TweenId {
        self.id
    }

    pub fn state(&self) -> AnimationState {
        self.state
    }

    pub fn progress(&self) -> f64 {
        self.progress
    }

    pub fn elapsed(&self) -> Duration {
        self.elapsed
    }

    pub fn duration(&self) -> Duration {
        self.options.duration
    }

    pub fn is_completed(&self) -> bool {
        self.state == AnimationState::Completed
    }

    pub fn is_running(&self) -> bool {
        self.state == AnimationState::Running
    }

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

    pub fn reset(&mut self) {
        self.state = AnimationState::Idle;
        self.progress = 0.0;
        self.elapsed = Duration::ZERO;
        self.repeat_count = 0;
        self.direction = AnimationDirection::Forward;
    }

    pub fn seek(&mut self, time: Duration) {
        if time <= self.options.duration {
            self.elapsed = time;
            self.progress =
                (time.as_secs_f64() / self.options.duration.as_secs_f64()).clamp(0.0, 1.0);
            self.update();
        }
    }

    pub fn update(&mut self) {
        if self.state != AnimationState::Running {
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

    pub fn get_current_value(&self, target_index: usize) -> Option<f64> {
        if target_index >= self.targets.len() {
            return None;
        }

        let target = &self.targets[target_index];
        let eased = self.options.easing.apply(self.progress);
        let value = target.start + (target.end - target.start) * eased;
        Some(value)
    }

    pub fn get_current_values(&self) -> Vec<f64> {
        self.targets
            .iter()
            .map(|target| {
                let eased = self.options.easing.apply(self.progress);
                target.start + (target.end - target.start) * eased
            })
            .collect()
    }
}
