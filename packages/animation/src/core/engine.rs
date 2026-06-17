//! Animation engine for managing multiple tweens

use std::cell::RefCell;
use std::rc::Rc;
use std::time::Duration;

use slotmap::SlotMap;

use super::{AnimationOptions, AnimationState, Tween, TweenId};

#[derive(Clone)]
pub struct AnimationEngine {
    pub tweens: Rc<RefCell<SlotMap<TweenId, Tween>>>,
}

impl Default for AnimationEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl AnimationEngine {
    #[must_use]
    pub fn new() -> Self {
        Self {
            tweens: Rc::new(RefCell::new(SlotMap::with_key())),
        }
    }

    #[must_use]
    pub fn create_tween(&self, options: AnimationOptions) -> TweenId {
        let mut tweens = self.tweens.borrow_mut();
        let temp_tween = Tween::new_for_engine(options);
        tweens.insert(temp_tween)
    }

    #[must_use]
    pub fn get_tween(&self, id: TweenId) -> Option<Tween> {
        self.tweens.borrow().get(id).cloned()
    }

    pub fn with_tween_mut<F, R>(&self, id: TweenId, f: F) -> Option<R>
    where
        F: FnOnce(&mut Tween) -> R,
    {
        let mut tweens = match self.tweens.try_borrow_mut() {
            Ok(borrow) => borrow,
            Err(_) => {
                return None;
            }
        };
        tweens.get_mut(id).map(f)
    }

    #[must_use]
    pub fn remove_tween(&self, id: TweenId) -> bool {
        let mut tweens = match self.tweens.try_borrow_mut() {
            Ok(borrow) => borrow,
            Err(_) => {
                return false;
            }
        };
        tweens.remove(id).is_some()
    }

    pub fn kill_all(&self) {
        let mut tweens = match self.tweens.try_borrow_mut() {
            Ok(borrow) => borrow,
            Err(_) => {
                return;
            }
        };
        tweens.clear();
    }

    pub fn play(&self, id: TweenId) {
        self.with_tween_mut(id, |tween| {
            tween.play();
        });
    }

    pub fn pause(&self, id: TweenId) {
        self.with_tween_mut(id, |tween| {
            tween.pause();
        });
    }

    pub fn reverse(&self, id: TweenId) {
        self.with_tween_mut(id, |tween| {
            tween.reverse();
        });
    }

    pub fn restart(&self, id: TweenId) {
        self.with_tween_mut(id, |tween| {
            tween.restart();
        });
    }

    pub fn seek(&self, id: TweenId, time: Duration) {
        self.with_tween_mut(id, |tween| {
            tween.seek(time);
        });
    }

    pub fn kill(&self, id: TweenId) {
        let _ = self.remove_tween(id);
    }

    #[must_use]
    pub fn is_active(&self, id: TweenId) -> bool {
        if let Some(tween) = self.get_tween(id) {
            tween.state() == AnimationState::Running
        } else {
            false
        }
    }

    #[must_use]
    pub fn get_all_active(&self) -> Vec<TweenId> {
        self.tweens
            .borrow()
            .iter()
            .filter(|(_, tween)| tween.state() == AnimationState::Running)
            .map(|(id, _)| id)
            .collect()
    }

    #[must_use]
    pub fn get_all_ids(&self) -> Vec<TweenId> {
        self.tweens.borrow().iter().map(|(id, _)| id).collect()
    }

    #[must_use]
    pub fn tween_state(&self, id: TweenId) -> Option<AnimationState> {
        self.tweens.borrow().get(id).map(|t| t.state())
    }

    pub fn seek_to_progress(&self, id: TweenId, progress: f64) {
        let progress = progress.clamp(0.0, 1.0);
        self.with_tween_mut(id, |tween| {
            let dur = tween.duration();
            tween.seek(Duration::from_secs_f64(dur.as_secs_f64() * progress));
        });
    }

    pub fn tick(&self, delta: Duration) {
        let tweens = self.tweens.borrow();
        let active_tweens: Vec<TweenId> = tweens
            .iter()
            .filter(|(_, tween)| tween.state() == AnimationState::Running)
            .map(|(id, _)| id)
            .collect();
        drop(tweens);

        for id in active_tweens {
            self.with_tween_mut(id, |tween| {
                tween.advance(delta);
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;

    #[test]
    fn new_creates_empty_engine() {
        let engine = AnimationEngine::new();
        assert!(engine.get_all_ids().is_empty());
    }

    #[test]
    fn default_equals_new() {
        let engine = AnimationEngine::default();
        assert!(engine.get_all_ids().is_empty());
    }

    #[test]
    fn create_tween_returns_valid_id() {
        let engine = AnimationEngine::new();
        let id = engine.create_tween(AnimationOptions::default());
        assert!(engine.get_tween(id).is_some());
    }

    #[test]
    fn create_tween_state_is_idle() {
        let engine = AnimationEngine::new();
        let id = engine.create_tween(AnimationOptions::default());
        assert_eq!(engine.tween_state(id), Some(AnimationState::Idle));
    }

    #[test]
    fn get_tween_invalid_id_returns_none() {
        let engine = AnimationEngine::new();
        let invalid: TweenId = TweenId::default();
        assert!(engine.get_tween(invalid).is_none());
    }

    #[test]
    fn remove_tween_existing_returns_true() {
        let engine = AnimationEngine::new();
        let id = engine.create_tween(AnimationOptions::default());
        assert!(engine.remove_tween(id));
        assert!(engine.get_tween(id).is_none());
    }

    #[test]
    fn remove_tween_nonexistent_returns_false() {
        let engine = AnimationEngine::new();
        assert!(!engine.remove_tween(TweenId::default()));
    }

    #[test]
    fn play_sets_running() {
        let engine = AnimationEngine::new();
        let id = engine.create_tween(AnimationOptions::default());
        engine.play(id);
        assert_eq!(engine.tween_state(id), Some(AnimationState::Running));
    }

    #[test]
    fn pause_sets_paused() {
        let engine = AnimationEngine::new();
        let id = engine.create_tween(AnimationOptions::default());
        engine.play(id);
        engine.pause(id);
        assert_eq!(engine.tween_state(id), Some(AnimationState::Paused));
    }

    #[test]
    fn is_active_true_for_running() {
        let engine = AnimationEngine::new();
        let id = engine.create_tween(AnimationOptions::default());
        engine.play(id);
        assert!(engine.is_active(id));
    }

    #[test]
    fn is_active_false_for_paused() {
        let engine = AnimationEngine::new();
        let id = engine.create_tween(AnimationOptions::default());
        engine.play(id);
        engine.pause(id);
        assert!(!engine.is_active(id));
    }

    #[test]
    fn is_active_false_for_nonexistent() {
        let engine = AnimationEngine::new();
        assert!(!engine.is_active(TweenId::default()));
    }

    #[test]
    fn get_all_active_returns_only_running() {
        let engine = AnimationEngine::new();
        let id1 = engine.create_tween(AnimationOptions::default());
        let id2 = engine.create_tween(AnimationOptions::default());
        engine.play(id1);
        engine.play(id2);
        engine.pause(id2);
        let active = engine.get_all_active();
        assert_eq!(active.len(), 1);
        assert!(active.contains(&id1));
    }

    #[test]
    fn kill_removes_tween() {
        let engine = AnimationEngine::new();
        let id = engine.create_tween(AnimationOptions::default());
        engine.kill(id);
        assert!(engine.get_tween(id).is_none());
    }

    #[test]
    fn kill_all_removes_all() {
        let engine = AnimationEngine::new();
        engine.create_tween(AnimationOptions::default());
        engine.create_tween(AnimationOptions::default());
        engine.create_tween(AnimationOptions::default());
        engine.kill_all();
        assert!(engine.get_all_ids().is_empty());
    }

    #[test]
    fn tween_state_returns_none_for_nonexistent() {
        let engine = AnimationEngine::new();
        assert_eq!(engine.tween_state(TweenId::default()), None);
    }

    #[test]
    fn tween_state_returns_correct_state() {
        let engine = AnimationEngine::new();
        let id = engine.create_tween(AnimationOptions::default());
        assert_eq!(engine.tween_state(id), Some(AnimationState::Idle));
        engine.play(id);
        assert_eq!(engine.tween_state(id), Some(AnimationState::Running));
        engine.pause(id);
        assert_eq!(engine.tween_state(id), Some(AnimationState::Paused));
    }

    #[test]
    fn with_tween_mut_applies_function() {
        let engine = AnimationEngine::new();
        let id = engine.create_tween(AnimationOptions::default());
        let state = engine.with_tween_mut(id, |t| t.state());
        assert_eq!(state, Some(AnimationState::Idle));
    }

    #[test]
    fn with_tween_mut_returns_none_for_invalid() {
        let engine = AnimationEngine::new();
        assert_eq!(
            engine.with_tween_mut(TweenId::default(), |t| t.state()),
            None
        );
    }

    #[test]
    fn clone_shares_tweens() {
        let engine = AnimationEngine::new();
        let id = engine.create_tween(AnimationOptions::default());
        let cloned = engine.clone();
        assert!(cloned.get_tween(id).is_some());
        cloned.kill(id);
        assert!(engine.get_tween(id).is_none());
    }

    #[test]
    fn tick_advances_active_tweens() {
        let engine = AnimationEngine::new();
        let opts = AnimationOptions {
            duration: Duration::from_millis(1000),
            ..Default::default()
        };
        let id = engine.create_tween(opts);
        engine.play(id);
        engine.tick(Duration::from_millis(250));
        let elapsed = engine.with_tween_mut(id, |t| t.elapsed());
        assert_eq!(elapsed, Some(Duration::from_millis(250)));
    }

    #[test]
    fn tick_skips_non_running() {
        let engine = AnimationEngine::new();
        let opts = AnimationOptions {
            duration: Duration::from_millis(1000),
            ..Default::default()
        };
        let id = engine.create_tween(opts);
        engine.tick(Duration::from_millis(500));
        let elapsed = engine.with_tween_mut(id, |t| t.elapsed());
        assert_eq!(elapsed, Some(Duration::ZERO));
    }

    #[test]
    fn tick_completes_tween() {
        let engine = AnimationEngine::new();
        let opts = AnimationOptions {
            duration: Duration::from_millis(100),
            ..Default::default()
        };
        let id = engine.create_tween(opts);
        engine.play(id);
        engine.tick(Duration::from_millis(200));
        assert_eq!(engine.tween_state(id), Some(AnimationState::Completed));
    }

    #[test]
    fn multiple_tweens_tick_independently() {
        let engine = AnimationEngine::new();
        let opts1 = AnimationOptions {
            duration: Duration::from_millis(100),
            ..Default::default()
        };
        let opts2 = AnimationOptions {
            duration: Duration::from_millis(200),
            ..Default::default()
        };
        let id1 = engine.create_tween(opts1);
        let id2 = engine.create_tween(opts2);
        engine.play(id1);
        engine.play(id2);
        engine.tick(Duration::from_millis(150));
        assert_eq!(engine.tween_state(id1), Some(AnimationState::Completed));
        assert_eq!(engine.tween_state(id2), Some(AnimationState::Running));
    }

    #[test]
    fn seek_to_progress_exact_halfway() {
        let engine = AnimationEngine::new();
        let opts = AnimationOptions {
            duration: Duration::from_millis(1000),
            ..Default::default()
        };
        let id = engine.create_tween(opts);
        engine.seek_to_progress(id, 0.5);
        let elapsed = engine.with_tween_mut(id, |t| t.elapsed());
        assert_eq!(elapsed, Some(Duration::from_millis(500)));
    }

    #[test]
    fn seek_to_progress_clamps_below_zero() {
        let engine = AnimationEngine::new();
        let opts = AnimationOptions {
            duration: Duration::from_millis(1000),
            ..Default::default()
        };
        let id = engine.create_tween(opts);
        engine.seek_to_progress(id, -0.5);
        let elapsed = engine.with_tween_mut(id, |t| t.elapsed());
        assert_eq!(elapsed, Some(Duration::ZERO));
    }

    #[test]
    fn seek_to_progress_clamps_above_one() {
        let engine = AnimationEngine::new();
        let opts = AnimationOptions {
            duration: Duration::from_millis(1000),
            ..Default::default()
        };
        let id = engine.create_tween(opts);
        engine.seek_to_progress(id, 1.5);
        let elapsed = engine.with_tween_mut(id, |t| t.elapsed());
        assert_eq!(elapsed, Some(Duration::from_millis(1000)));
    }

    #[test]
    fn restart_resets_elapsed() {
        let engine = AnimationEngine::new();
        let opts = AnimationOptions {
            duration: Duration::from_millis(1000),
            ..Default::default()
        };
        let id = engine.create_tween(opts);
        engine.tick(Duration::from_millis(500));
        engine.restart(id);
        let elapsed = engine.with_tween_mut(id, |t| t.elapsed());
        assert_eq!(elapsed, Some(Duration::ZERO));
    }

    #[test]
    fn restart_sets_running() {
        let engine = AnimationEngine::new();
        let id = engine.create_tween(AnimationOptions::default());
        engine.pause(id);
        engine.restart(id);
        assert_eq!(engine.tween_state(id), Some(AnimationState::Running));
    }

    #[test]
    fn get_all_ids_returns_all() {
        let engine = AnimationEngine::new();
        let id1 = engine.create_tween(AnimationOptions::default());
        let id2 = engine.create_tween(AnimationOptions::default());
        let ids = engine.get_all_ids();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&id1));
        assert!(ids.contains(&id2));
    }
}
