//! Stub platform implementation for non-browser targets
//!
//! This module provides no-op implementations for SSR and other non-browser targets.

pub fn log(_message: &str) {}

pub fn log_warn(_message: &str) {}

pub fn log_error(_message: &str) {}

pub fn inner_width() -> i32 {
    1024
}

pub fn inner_height() -> i32 {
    768
}

pub fn set_timeout(_callback: impl FnOnce() + 'static, _ms: i32) -> i32 {
    0
}

pub fn get_scroll_y() -> f64 {
    0.0
}

pub fn scroll_to_with_options(_top: f64, _behavior: &str) {}

pub fn on_resize(_callback: impl FnMut() + 'static) {}

pub fn create_resize_observer(_callback: impl FnMut() + 'static) -> u64 {
    0
}

pub fn observe_resize<T>(_observer_id: u64, _element: &T) {}

pub fn disconnect_resize(_observer_id: u64) {}

pub fn create_mutation_observer(_callback: impl FnMut() + 'static) -> u64 {
    0
}

pub fn observe_mutations<T>(_observer_id: u64, _element: &T, _options: &MutationObserverOptions) {}

pub fn disconnect_mutation(_observer_id: u64) {}

pub struct MutationObserverOptions {
    pub child_list: bool,
    pub attributes: bool,
    pub character_data: bool,
    pub subtree: Option<bool>,
}

impl Default for MutationObserverOptions {
    fn default() -> Self {
        Self {
            child_list: true,
            attributes: false,
            character_data: false,
            subtree: Some(true),
        }
    }
}

pub fn now_timestamp() -> f64 {
    0.0
}
