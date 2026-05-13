//! Global animation manager — registry, debug control, and test-mode support.
//!
//! In test mode, all registered animation engines respond to global commands:
//! freeze / unfreeze / seek / step — enabling deterministic E2E visual testing
//! of animation states at arbitrary progress points.

use std::{cell::RefCell, collections::HashMap, time::Duration};

use slotmap::Key;

use crate::core::{AnimationEngine, AnimationState};

thread_local! {
    static MANAGER: RefCell<GlobalAnimManagerInner> = RefCell::new(GlobalAnimManagerInner::new());
}

struct GlobalAnimManagerInner {
    engines: HashMap<String, AnimationEngine>,
    test_mode: bool,
    frozen: bool,
}

impl GlobalAnimManagerInner {
    fn new() -> Self {
        Self {
            engines: HashMap::new(),
            test_mode: false,
            frozen: false,
        }
    }
}

pub struct GlobalAnimationManager;

impl Default for GlobalAnimationManager {
    fn default() -> Self {
        Self::new()
    }
}

impl GlobalAnimationManager {
    pub fn new() -> Self {
        Self
    }

    pub fn register(name: &str, engine: &AnimationEngine) {
        MANAGER.with(|m| {
            m.borrow_mut()
                .engines
                .insert(name.to_owned(), engine.clone());
        });
    }

    pub fn unregister(name: &str) {
        MANAGER.with(|m| {
            m.borrow_mut().engines.remove(name);
        });
    }

    pub fn pause_all() {
        MANAGER.with(|m| {
            let mgr = m.borrow();
            for engine in mgr.engines.values() {
                for id in engine.get_all_active() {
                    engine.pause(id);
                }
            }
        });
    }

    pub fn resume_all() {
        MANAGER.with(|m| {
            let mgr = m.borrow();
            for engine in mgr.engines.values() {
                for id in engine.get_all_ids() {
                    if engine.tween_state(id) == Some(AnimationState::Paused) {
                        engine.play(id);
                    }
                }
            }
        });
    }

    pub fn freeze() {
        Self::pause_all();
        MANAGER.with(|m| {
            m.borrow_mut().frozen = true;
        });
    }

    pub fn unfreeze() {
        MANAGER.with(|m| {
            m.borrow_mut().frozen = false;
        });
        Self::resume_all();
    }

    pub fn seek_all(progress: f64) {
        let progress = progress.clamp(0.0, 1.0);
        MANAGER.with(|m| {
            let mgr = m.borrow();
            for engine in mgr.engines.values() {
                for id in engine.get_all_ids() {
                    engine.seek_to_progress(id, progress);
                }
            }
        });
    }

    pub fn step_all(delta_ms: u64) {
        let delta = Duration::from_millis(delta_ms);
        MANAGER.with(|m| {
            let mgr = m.borrow();
            for engine in mgr.engines.values() {
                engine.tick(delta);
            }
        });
    }

    pub fn kill_all() {
        MANAGER.with(|m| {
            for engine in m.borrow().engines.values() {
                engine.kill_all();
            }
        });
    }

    pub fn get_state() -> AnimationDebugState {
        MANAGER.with(|m| {
            let mgr = m.borrow();
            let engines: Vec<EngineDebugInfo> = mgr
                .engines
                .iter()
                .map(|(name, engine)| {
                    let tweens: Vec<TweenDebugInfo> = engine
                        .get_all_ids()
                        .into_iter()
                        .flat_map(|id| {
                            engine.get_tween(id).map(|t| TweenDebugInfo {
                                id: id.data().as_ffi(),
                                state: format!("{:?}", t.state()),
                                progress: t.progress(),
                                duration_ms: t.duration().as_millis() as u64,
                            })
                        })
                        .collect();
                    EngineDebugInfo {
                        name: name.clone(),
                        tween_count: tweens.len(),
                        tweens,
                    }
                })
                .collect();

            AnimationDebugState {
                engine_count: engines.len(),
                test_mode: mgr.test_mode,
                frozen: mgr.frozen,
                engines,
            }
        })
    }

    pub fn set_test_mode(enabled: bool) {
        MANAGER.with(|m| {
            m.borrow_mut().test_mode = enabled;
        });
    }

    pub fn is_test_mode() -> bool {
        MANAGER.with(|m| m.borrow().test_mode)
    }

    pub fn is_frozen() -> bool {
        MANAGER.with(|m| m.borrow().frozen)
    }

    pub fn engine_count() -> usize {
        MANAGER.with(|m| m.borrow().engines.len())
    }
}

// Legacy compatibility
pub fn init_global_animation_manager() {}

pub fn global_animation_manager() -> &'static GlobalAnimationManager {
    static MANAGER: GlobalAnimationManager = GlobalAnimationManager;
    &MANAGER
}

#[derive(Debug, Clone)]
pub struct AnimationDebugState {
    pub engine_count: usize,
    pub test_mode: bool,
    pub frozen: bool,
    pub engines: Vec<EngineDebugInfo>,
}

#[derive(Debug, Clone)]
pub struct EngineDebugInfo {
    pub name: String,
    pub tween_count: usize,
    pub tweens: Vec<TweenDebugInfo>,
}

#[derive(Debug, Clone)]
pub struct TweenDebugInfo {
    pub id: u64,
    pub state: String,
    pub progress: f64,
    pub duration_ms: u64,
}
