//! Animation debug provider — tairitsu Context-based debug API.
//!
//! Exposes global animation control (freeze / seek / step) to components
//! and E2E tests via the tairitsu context system. When the `debug` feature
//! is enabled, also exposes `window.__HIKARI_ANIM__` for Playwright E2E.

use crate::global_manager::{AnimationDebugState, GlobalAnimationManager};

#[derive(Clone, Copy, Debug, Default)]
pub struct AnimationDebugProvider;

impl AnimationDebugProvider {
    pub fn init() {
        GlobalAnimationManager::set_test_mode(false);
    }

    pub fn freeze() {
        GlobalAnimationManager::freeze();
    }

    pub fn unfreeze() {
        GlobalAnimationManager::unfreeze();
    }

    pub fn seek_all(progress: f64) {
        GlobalAnimationManager::seek_all(progress);
    }

    pub fn step_all(delta_ms: u64) {
        GlobalAnimationManager::step_all(delta_ms);
    }

    pub fn pause_all() {
        GlobalAnimationManager::pause_all();
    }

    pub fn resume_all() {
        GlobalAnimationManager::resume_all();
    }

    pub fn kill_all() {
        GlobalAnimationManager::kill_all();
    }

    pub fn get_state() -> AnimationDebugState {
        GlobalAnimationManager::get_state()
    }

    pub fn set_test_mode(enabled: bool) {
        GlobalAnimationManager::set_test_mode(enabled);
    }

    pub fn is_test_mode() -> bool {
        GlobalAnimationManager::is_test_mode()
    }

    pub fn is_frozen() -> bool {
        GlobalAnimationManager::is_frozen()
    }
}
