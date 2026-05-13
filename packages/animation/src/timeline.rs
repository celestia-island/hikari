//! Timeline system for orchestrating multiple animations
//!
//! This module provides a timeline system that allows sequencing and
//! coordinating multiple tween animations with precise timing control.

use std::{cell::RefCell, rc::Rc, time::Duration};

use slotmap::SlotMap;

use crate::core::{AnimationState, Tween, TweenId};

/// State of a timeline
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimelineState {
    /// Timeline has not started
    Idle,
    /// Timeline is currently playing
    Playing,
    /// Timeline is paused (can be resumed)
    Paused,
    /// Timeline has finished playing
    Completed,
}

/// A tween within a timeline with timing information
#[derive(Debug, Clone)]
pub struct TimelineTween {
    /// Unique ID of the tween
    pub id: TweenId,
    /// Time at which this tween starts
    pub start_time: Duration,
    /// The tween animation
    pub tween: Tween,
}

/// Timeline for orchestrating multiple tweens
///
/// A timeline manages multiple tween animations, allowing them to be
/// scheduled at specific times and played together or in sequence.
#[derive(Clone)]
pub struct Timeline {
    tweens: Rc<RefCell<SlotMap<TweenId, TimelineTween>>>,
    state: TimelineState,
    current_time: Duration,
    total_duration: Duration,
    playback_rate: f64,
    repeat: Option<u32>,
    yoyo: bool,
    repeat_count: u32,
    direction: crate::core::AnimationDirection,
}

impl Default for Timeline {
    fn default() -> Self {
        Self::new()
    }
}

impl Timeline {
    /// Create a new timeline
    pub fn new() -> Self {
        Self {
            tweens: Rc::new(RefCell::new(SlotMap::with_key())),
            state: TimelineState::Idle,
            current_time: Duration::ZERO,
            total_duration: Duration::ZERO,
            playback_rate: 1.0,
            repeat: None,
            yoyo: false,
            repeat_count: 0,
            direction: crate::core::AnimationDirection::Forward,
        }
    }

    /// Get the current state of the timeline
    pub fn state(&self) -> TimelineState {
        self.state
    }

    /// Get the current playback time
    pub fn current_time(&self) -> Duration {
        self.current_time
    }

    /// Get the total duration of the timeline
    pub fn total_duration(&self) -> Duration {
        self.total_duration
    }

    /// Get the current progress (0.0 to 1.0)
    pub fn progress(&self) -> f64 {
        if self.total_duration == Duration::ZERO {
            0.0
        } else {
            self.current_time.as_secs_f64() / self.total_duration.as_secs_f64()
        }
    }

    /// Get the playback rate (speed multiplier)
    pub fn playback_rate(&self) -> f64 {
        self.playback_rate
    }

    /// Set the playback rate
    ///
    /// # Arguments
    /// * `rate` - Playback rate (0.0 to 10.0)
    pub fn set_playback_rate(&mut self, rate: f64) {
        self.playback_rate = rate.clamp(0.0, 10.0);
    }

    /// Set the number of repeats
    ///
    /// # Arguments
    /// * `count` - Number of times to repeat (None for infinite)
    pub fn set_repeat(&mut self, count: Option<u32>) {
        self.repeat = count;
    }

    /// Enable or disable yoyo (reverse after each repeat)
    ///
    /// # Arguments
    /// * `enabled` - Whether to enable yoyo
    pub fn set_yoyo(&mut self, enabled: bool) {
        self.yoyo = enabled;
    }

    /// Add a tween at a specific start time
    ///
    /// # Arguments
    /// * `tween` - The tween to add
    /// * `start_time` - Time at which the tween should start
    ///
    /// # Returns
    /// ID of the added tween
    pub fn add_tween(&mut self, tween: Tween, start_time: Duration) -> TweenId {
        let mut tweens = self.tweens.borrow_mut();
        let end_time = start_time + tween.duration();
        if end_time > self.total_duration {
            self.total_duration = end_time;
        }
        let timeline_tween = TimelineTween {
            id: tween.id(),
            start_time,
            tween,
        };
        tweens.insert(timeline_tween)
    }

    /// Add a tween at the current timeline time
    ///
    /// # Arguments
    /// * `tween` - The tween to add
    ///
    /// # Returns
    /// ID of the added tween
    pub fn add_tween_at(&mut self, tween: Tween) -> TweenId {
        let start_time = self.current_time;
        self.add_tween(tween, start_time)
    }

    /// Remove a tween from the timeline
    ///
    /// # Arguments
    /// * `id` - ID of the tween to remove
    ///
    /// # Returns
    /// true if the tween was removed, false otherwise
    pub fn remove_tween(&mut self, id: TweenId) -> bool {
        self.tweens.borrow_mut().remove(id).is_some()
    }

    /// Clear all tweens and reset the timeline
    pub fn clear(&mut self) {
        self.tweens.borrow_mut().clear();
        self.current_time = Duration::ZERO;
        self.total_duration = Duration::ZERO;
        self.repeat_count = 0;
        self.state = TimelineState::Idle;
    }

    /// Start playing the timeline
    pub fn play(&mut self) {
        if self.state == TimelineState::Completed {
            self.restart();
        }
        self.state = TimelineState::Playing;
    }

    /// Pause the timeline
    pub fn pause(&mut self) {
        if self.state == TimelineState::Playing {
            self.state = TimelineState::Paused;
        }
    }

    /// Resume a paused timeline
    pub fn resume(&mut self) {
        if self.state == TimelineState::Paused {
            self.state = TimelineState::Playing;
        }
    }

    /// Stop the timeline and reset to beginning
    pub fn stop(&mut self) {
        self.state = TimelineState::Idle;
        self.current_time = Duration::ZERO;
    }

    /// Restart the timeline from the beginning
    pub fn restart(&mut self) {
        self.current_time = Duration::ZERO;
        self.repeat_count = 0;
        self.state = TimelineState::Playing;

        let mut tweens = self.tweens.borrow_mut();
        for (_, timeline_tween) in tweens.iter_mut() {
            timeline_tween.tween.reset();
        }
    }

    /// Reverse the playback direction
    pub fn reverse(&mut self) {
        self.direction = match self.direction {
            crate::core::AnimationDirection::Forward => crate::core::AnimationDirection::Backward,
            crate::core::AnimationDirection::Backward => crate::core::AnimationDirection::Forward,
        };
    }

    /// Seek to a specific time in the timeline
    ///
    /// # Arguments
    /// * `time` - Time to seek to
    pub fn seek(&mut self, time: Duration) {
        let target_time = time.clamp(Duration::ZERO, self.total_duration);
        self.current_time = target_time;
        self.update_tweens_at_time();
    }

    /// Seek to a specific progress (0.0 to 1.0)
    ///
    /// # Arguments
    /// * `progress` - Progress value to seek to
    pub fn seek_to_progress(&mut self, progress: f64) {
        let clamped = progress.clamp(0.0, 1.0);
        let time = Duration::from_secs_f64(clamped * self.total_duration.as_secs_f64());
        self.seek(time);
    }

    /// Advance the timeline by a time delta
    ///
    /// # Arguments
    /// * `delta` - Time to advance
    pub fn tick(&mut self, delta: Duration) {
        if self.state != TimelineState::Playing {
            return;
        }

        let adjusted_delta = Duration::from_secs_f64(delta.as_secs_f64() * self.playback_rate);

        match self.direction {
            crate::core::AnimationDirection::Forward => {
                self.current_time += adjusted_delta;
                if self.current_time >= self.total_duration {
                    self.handle_completion();
                }
            }
            crate::core::AnimationDirection::Backward => {
                if self.current_time > adjusted_delta {
                    self.current_time -= adjusted_delta;
                } else {
                    self.current_time = Duration::ZERO;
                    self.handle_completion();
                }
            }
        }

        self.update_tweens_at_time();
    }

    /// Update all tweens to match current timeline time
    fn update_tweens_at_time(&mut self) {
        let tweens = self.tweens.borrow();
        let mut updates: Vec<(TweenId, Duration)> = Vec::new();

        for (id, timeline_tween) in tweens.iter() {
            let tween_local_time = if self.current_time >= timeline_tween.start_time {
                self.current_time - timeline_tween.start_time
            } else {
                Duration::ZERO
            };

            if tween_local_time <= timeline_tween.tween.duration() {
                updates.push((id, tween_local_time));
            }
        }

        drop(tweens);

        let mut tweens = self.tweens.borrow_mut();
        for (id, local_time) in updates {
            if let Some(timeline_tween) = tweens.get_mut(id) {
                if timeline_tween.tween.state() == AnimationState::Idle {
                    timeline_tween.tween.play();
                }
                timeline_tween.tween.seek(local_time);
            }
        }
    }

    /// Handle timeline completion based on repeat settings
    fn handle_completion(&mut self) {
        if let Some(count) = self.repeat {
            if self.repeat_count < count {
                self.repeat_count += 1;
                if self.yoyo {
                    self.reverse();
                }
                self.current_time = Duration::ZERO;
            } else {
                self.state = TimelineState::Completed;
            }
        } else if self.yoyo {
            self.reverse();
            self.current_time = Duration::ZERO;
        } else {
            self.state = TimelineState::Completed;
        }
    }

    /// Get IDs of all currently active tweens
    ///
    /// # Returns
    /// Vector of active tween IDs
    pub fn get_active_tweens(&self) -> Vec<TweenId> {
        let tweens = self.tweens.borrow();
        tweens
            .iter()
            .filter(|(_, timeline_tween)| {
                let tween_end = timeline_tween.start_time + timeline_tween.tween.duration();
                self.current_time >= timeline_tween.start_time && self.current_time < tween_end
            })
            .map(|(id, _)| id)
            .collect()
    }

    /// Check if timeline is currently playing
    pub fn is_playing(&self) -> bool {
        self.state == TimelineState::Playing
    }

    /// Check if timeline is paused
    pub fn is_paused(&self) -> bool {
        self.state == TimelineState::Paused
    }

    /// Check if timeline has completed
    pub fn is_completed(&self) -> bool {
        self.state == TimelineState::Completed
    }
}
