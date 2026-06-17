//! Timeline system for orchestrating multiple animations
//!
//! This module provides a timeline system that allows sequencing and
//! coordinating multiple tween animations with precise timing control.

use std::cell::RefCell;
use std::rc::Rc;
use std::time::Duration;

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
    yoyo_completed_backward: bool,
}

impl Default for Timeline {
    fn default() -> Self {
        Self::new()
    }
}

impl Timeline {
    /// Create a new timeline
    #[must_use]
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
            yoyo_completed_backward: false,
        }
    }

    /// Get the current state of the timeline
    #[must_use]
    pub const fn state(&self) -> TimelineState {
        self.state
    }

    /// Get the current playback time
    #[must_use]
    pub const fn current_time(&self) -> Duration {
        self.current_time
    }

    /// Get the total duration of the timeline
    #[must_use]
    pub const fn total_duration(&self) -> Duration {
        self.total_duration
    }

    /// Get the current progress (0.0 to 1.0)
    #[must_use]
    pub fn progress(&self) -> f64 {
        if self.total_duration == Duration::ZERO {
            0.0
        } else {
            self.current_time.as_secs_f64() / self.total_duration.as_secs_f64()
        }
    }

    /// Get the playback rate (speed multiplier)
    #[must_use]
    pub const fn playback_rate(&self) -> f64 {
        self.playback_rate
    }

    /// Set the playback rate
    ///
    /// # Arguments
    /// * `rate` - Playback rate (0.0 to 10.0)
    pub const fn set_playback_rate(&mut self, rate: f64) {
        self.playback_rate = rate.clamp(0.0, 10.0);
    }

    /// Set the number of repeats
    ///
    /// # Arguments
    /// * `count` - Number of times to repeat (None for infinite)
    pub const fn set_repeat(&mut self, count: Option<u32>) {
        self.repeat = count;
    }

    /// Enable or disable yoyo (reverse after each repeat)
    ///
    /// # Arguments
    /// * `enabled` - Whether to enable yoyo
    pub const fn set_yoyo(&mut self, enabled: bool) {
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
    pub const fn stop(&mut self) {
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
    pub const fn reverse(&mut self) {
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
    const fn handle_completion(&mut self) {
        if let Some(count) = self.repeat {
            if self.repeat_count < count {
                self.repeat_count += 1;
                if self.yoyo {
                    if self.yoyo_completed_backward {
                        self.yoyo_completed_backward = false;
                    } else {
                        self.reverse();
                        self.yoyo_completed_backward = true;
                    }
                }
                self.current_time = Duration::ZERO;
            } else {
                self.state = TimelineState::Completed;
            }
        } else if self.yoyo {
            if self.yoyo_completed_backward {
                self.state = TimelineState::Completed;
            } else {
                self.reverse();
                self.current_time = Duration::ZERO;
                self.yoyo_completed_backward = true;
            }
        } else {
            self.state = TimelineState::Completed;
        }
    }

    /// Get IDs of all currently active tweens
    ///
    /// # Returns
    /// Vector of active tween IDs
    #[must_use]
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
    #[must_use]
    pub fn is_playing(&self) -> bool {
        self.state == TimelineState::Playing
    }

    /// Check if timeline is paused
    #[must_use]
    pub fn is_paused(&self) -> bool {
        self.state == TimelineState::Paused
    }

    /// Check if timeline has completed
    #[must_use]
    pub fn is_completed(&self) -> bool {
        self.state == TimelineState::Completed
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::{AnimationOptions, EasingFunction, PlaybackMode, TweenId};

    fn make_options(duration_ms: u64) -> AnimationOptions {
        AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            delay: Duration::ZERO,
            easing: EasingFunction::Linear,
            playback: PlaybackMode::Normal,
            repeat: None,
        }
    }

    fn make_tween(duration_ms: u64) -> Tween {
        Tween::new(TweenId::default(), make_options(duration_ms))
    }

    #[test]
    fn new_timeline_is_idle() {
        let tl = Timeline::new();
        assert_eq!(tl.state(), TimelineState::Idle);
        assert_eq!(tl.current_time(), Duration::ZERO);
        assert_eq!(tl.total_duration(), Duration::ZERO);
        assert!(!tl.is_playing());
        assert!(!tl.is_paused());
        assert!(!tl.is_completed());
    }

    #[test]
    fn default_is_same_as_new() {
        let tl = Timeline::default();
        assert_eq!(tl.state(), TimelineState::Idle);
    }

    #[test]
    fn empty_timeline_progress_is_zero() {
        let tl = Timeline::new();
        assert_eq!(tl.progress(), 0.0);
    }

    #[test]
    fn add_tween_updates_total_duration() {
        let mut tl = Timeline::new();
        let tween = make_tween(500);
        tl.add_tween(tween, Duration::from_millis(100));
        assert_eq!(tl.total_duration(), Duration::from_millis(600));
    }

    #[test]
    fn add_multiple_tweens_max_duration() {
        let mut tl = Timeline::new();
        let t1 = make_tween(200);
        let t2 = make_tween(300);
        tl.add_tween(t1, Duration::ZERO);
        tl.add_tween(t2, Duration::from_millis(100));
        assert_eq!(tl.total_duration(), Duration::from_millis(400));
    }

    #[test]
    fn add_tween_at_current_time() {
        let mut tl = Timeline::new();
        let t1 = make_tween(200);
        tl.add_tween(t1, Duration::ZERO);
        tl.play();
        tl.tick(Duration::from_millis(50));
        let t2 = make_tween(300);
        tl.add_tween_at(t2);
        assert_eq!(tl.total_duration(), Duration::from_millis(350));
    }

    #[test]
    fn play_sets_playing() {
        let mut tl = Timeline::new();
        tl.play();
        assert!(tl.is_playing());
    }

    #[test]
    fn pause_and_resume() {
        let mut tl = Timeline::new();
        tl.play();
        tl.pause();
        assert!(tl.is_paused());
        tl.resume();
        assert!(tl.is_playing());
    }

    #[test]
    fn pause_on_idle_is_noop() {
        let mut tl = Timeline::new();
        tl.pause();
        assert_eq!(tl.state(), TimelineState::Idle);
    }

    #[test]
    fn resume_on_idle_is_noop() {
        let mut tl = Timeline::new();
        tl.resume();
        assert_eq!(tl.state(), TimelineState::Idle);
    }

    #[test]
    fn stop_resets_time() {
        let mut tl = Timeline::new();
        let tween = make_tween(500);
        tl.add_tween(tween, Duration::ZERO);
        tl.play();
        tl.tick(Duration::from_millis(200));
        tl.stop();
        assert_eq!(tl.state(), TimelineState::Idle);
        assert_eq!(tl.current_time(), Duration::ZERO);
    }

    #[test]
    fn restart_resets_and_plays() {
        let mut tl = Timeline::new();
        let tween = make_tween(500);
        tl.add_tween(tween, Duration::ZERO);
        tl.play();
        tl.tick(Duration::from_millis(300));
        tl.restart();
        assert!(tl.is_playing());
        assert_eq!(tl.current_time(), Duration::ZERO);
    }

    #[test]
    fn tick_advances_time() {
        let mut tl = Timeline::new();
        tl.add_tween(make_tween(1000), Duration::ZERO);
        tl.play();
        tl.tick(Duration::from_millis(200));
        assert_eq!(tl.current_time(), Duration::from_millis(200));
        let p = tl.progress();
        assert!((p - 0.2).abs() < 1e-9);
    }

    #[test]
    fn tick_on_idle_is_noop() {
        let mut tl = Timeline::new();
        tl.tick(Duration::from_millis(100));
        assert_eq!(tl.current_time(), Duration::ZERO);
    }

    #[test]
    fn tick_completes_at_total_duration() {
        let mut tl = Timeline::new();
        tl.add_tween(make_tween(500), Duration::ZERO);
        tl.play();
        tl.tick(Duration::from_millis(500));
        assert!(tl.is_completed());
    }

    #[test]
    fn tick_beyond_duration_completes() {
        let mut tl = Timeline::new();
        tl.add_tween(make_tween(500), Duration::ZERO);
        tl.play();
        tl.tick(Duration::from_millis(1000));
        assert!(tl.is_completed());
    }

    #[test]
    fn seek_updates_time() {
        let mut tl = Timeline::new();
        tl.add_tween(make_tween(1000), Duration::ZERO);
        tl.seek(Duration::from_millis(300));
        assert_eq!(tl.current_time(), Duration::from_millis(300));
    }

    #[test]
    fn seek_clamps_to_total_duration() {
        let mut tl = Timeline::new();
        tl.add_tween(make_tween(500), Duration::ZERO);
        tl.seek(Duration::from_millis(9999));
        assert_eq!(tl.current_time(), Duration::from_millis(500));
    }

    #[test]
    fn seek_to_progress() {
        let mut tl = Timeline::new();
        tl.add_tween(make_tween(1000), Duration::ZERO);
        tl.seek_to_progress(0.5);
        assert_eq!(tl.current_time(), Duration::from_millis(500));
    }

    #[test]
    fn seek_to_progress_clamps() {
        let mut tl = Timeline::new();
        tl.add_tween(make_tween(1000), Duration::ZERO);
        tl.seek_to_progress(-0.5);
        assert_eq!(tl.current_time(), Duration::ZERO);
        tl.seek_to_progress(2.0);
        assert_eq!(tl.current_time(), Duration::from_millis(1000));
    }

    #[test]
    fn playback_rate_affects_tick() {
        let mut tl = Timeline::new();
        tl.add_tween(make_tween(1000), Duration::ZERO);
        tl.set_playback_rate(2.0);
        tl.play();
        tl.tick(Duration::from_millis(200));
        assert_eq!(tl.current_time(), Duration::from_millis(400));
    }

    #[test]
    fn playback_rate_clamped() {
        let mut tl = Timeline::new();
        tl.set_playback_rate(100.0);
        assert_eq!(tl.playback_rate(), 10.0);
        tl.set_playback_rate(-1.0);
        assert_eq!(tl.playback_rate(), 0.0);
    }

    #[test]
    fn remove_tween() {
        let mut tl = Timeline::new();
        let tween = make_tween(500);
        let id = tl.add_tween(tween, Duration::ZERO);
        assert!(tl.remove_tween(id));
    }

    #[test]
    fn remove_nonexistent_tween() {
        let mut tl = Timeline::new();
        assert!(!tl.remove_tween(TweenId::default()));
    }

    #[test]
    fn clear_resets_timeline() {
        let mut tl = Timeline::new();
        tl.add_tween(make_tween(500), Duration::ZERO);
        tl.play();
        tl.tick(Duration::from_millis(200));
        tl.clear();
        assert_eq!(tl.state(), TimelineState::Idle);
        assert_eq!(tl.current_time(), Duration::ZERO);
        assert_eq!(tl.total_duration(), Duration::ZERO);
    }

    #[test]
    fn reverse_direction() {
        let mut tl = Timeline::new();
        tl.add_tween(make_tween(1000), Duration::ZERO);
        tl.play();
        tl.tick(Duration::from_millis(500));
        tl.reverse();
        tl.tick(Duration::from_millis(200));
        assert_eq!(tl.current_time(), Duration::from_millis(300));
    }

    #[test]
    fn repeat_finite() {
        let mut tl = Timeline::new();
        tl.add_tween(make_tween(100), Duration::ZERO);
        tl.set_repeat(Some(1));
        tl.play();
        tl.tick(Duration::from_millis(100));
        assert!(tl.is_playing());
        tl.tick(Duration::from_millis(100));
        assert!(tl.is_completed());
    }

    #[test]
    fn get_active_tweens() {
        let mut tl = Timeline::new();
        tl.add_tween(make_tween(500), Duration::ZERO);
        tl.add_tween(make_tween(500), Duration::from_millis(500));
        tl.seek(Duration::from_millis(250));
        let active = tl.get_active_tweens();
        assert_eq!(active.len(), 1);
    }

    #[test]
    fn get_active_tweens_at_boundary() {
        let mut tl = Timeline::new();
        tl.add_tween(make_tween(500), Duration::ZERO);
        tl.add_tween(make_tween(500), Duration::from_millis(500));
        tl.seek(Duration::from_millis(500));
        let active = tl.get_active_tweens();
        assert_eq!(active.len(), 1);
    }

    #[test]
    fn play_after_completed_restarts() {
        let mut tl = Timeline::new();
        tl.add_tween(make_tween(100), Duration::ZERO);
        tl.play();
        tl.tick(Duration::from_millis(100));
        assert!(tl.is_completed());
        tl.play();
        assert!(tl.is_playing());
    }

    #[test]
    fn set_yoyo() {
        let mut tl = Timeline::new();
        tl.set_yoyo(true);
    }

    #[test]
    fn set_repeat_none_means_no_repeat() {
        let mut tl = Timeline::new();
        tl.add_tween(make_tween(100), Duration::ZERO);
        tl.set_repeat(None);
        tl.play();
        tl.tick(Duration::from_millis(100));
        assert!(tl.is_completed());
    }

    #[test]
    fn timeline_state_enum() {
        assert_ne!(TimelineState::Idle, TimelineState::Playing);
        assert_ne!(TimelineState::Paused, TimelineState::Completed);
        let state = TimelineState::Idle;
        let cloned = state;
        assert_eq!(state, cloned);
    }
}
