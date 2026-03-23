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
