//! Animation engine for managing multiple tweens

use std::{cell::RefCell, rc::Rc, time::Duration};

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
    pub fn new() -> Self {
        Self {
            tweens: Rc::new(RefCell::new(SlotMap::with_key())),
        }
    }

    pub fn create_tween(&self, options: AnimationOptions) -> TweenId {
        let mut tweens = self.tweens.borrow_mut();
        let temp_tween = Tween::new_for_engine(options);
        tweens.insert(temp_tween)
    }

    pub fn get_tween(&self, id: TweenId) -> Option<Tween> {
        self.tweens.borrow().get(id).cloned()
    }

    pub fn with_tween_mut<F, R>(&self, id: TweenId, f: F) -> Option<R>
    where
        F: FnOnce(&mut Tween) -> R,
    {
        let mut tweens = self.tweens.borrow_mut();
        tweens.get_mut(id).map(f)
    }

    pub fn remove_tween(&self, id: TweenId) -> bool {
        let mut tweens = self.tweens.borrow_mut();
        tweens.remove(id).is_some()
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
        self.remove_tween(id);
    }

    pub fn kill_all(&self) {
        self.tweens.borrow_mut().clear();
    }

    pub fn is_active(&self, id: TweenId) -> bool {
        if let Some(tween) = self.get_tween(id) {
            tween.state() == AnimationState::Running
        } else {
            false
        }
    }

    pub fn get_all_active(&self) -> Vec<TweenId> {
        self.tweens
            .borrow()
            .iter()
            .filter(|(_, tween)| tween.state() == AnimationState::Running)
            .map(|(id, _)| id)
            .collect()
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
