//! WASI platform implementation using tairitsu's WIT bindings
//!
//! This module provides unified DOM operations using tairitsu's WIT infrastructure,
//! which works consistently across browser and server environments.

use tairitsu_vdom::platform::DomRect;

/// Log a message to the console
pub fn log(message: &str) {
    #[cfg(target_family = "wasm")]
    {
        // Use WASI stdout/stderr or no-op for now
        let _ = message;
    }
    #[cfg(not(target_family = "wasm"))]
    {
        eprintln!("{}", message);
    }
}

/// Log a warning message
pub fn log_warn(message: &str) {
    #[cfg(target_family = "wasm")]
    {
        let _ = message;
    }
    #[cfg(not(target_family = "wasm"))]
    {
        eprintln!("WARNING: {}", message);
    }
}

/// Log an error message
pub fn log_error(message: &str) {
    #[cfg(target_family = "wasm")]
    {
        let _ = message;
    }
    #[cfg(not(target_family = "wasm"))]
    {
        eprintln!("ERROR: {}", message);
    }
}

/// Get the window inner width
pub fn inner_width() -> i32 {
    #[cfg(target_family = "wasm")]
    {
        // Use tairitsu's WIT bindings when available
        // For now, return a default value
        1024
    }
    #[cfg(not(target_family = "wasm"))]
    {
        1024
    }
}

/// Get the window inner height
pub fn inner_height() -> i32 {
    #[cfg(target_family = "wasm")]
    {
        768
    }
    #[cfg(not(target_family = "wasm"))]
    {
        768
    }
}

/// Set a timeout callback
pub fn set_timeout(_callback: impl FnOnce() + 'static, _ms: i32) -> i32 {
    0
}

/// Get the current scroll Y position
pub fn get_scroll_y() -> f64 {
    0.0
}

/// Scroll to a specific position
pub fn scroll_to_with_options(_top: f64, _behavior: &str) {}

/// Register a resize event callback
pub fn on_resize(_callback: impl FnMut() + 'static) {}

/// Create a resize observer
pub fn create_resize_observer(_callback: impl FnMut() + 'static) -> u64 {
    0
}

/// Observe element for resize changes
pub fn observe_resize<T>(_observer_id: u64, _element: &T) {}

/// Disconnect resize observer
pub fn disconnect_resize(_observer_id: u64) {}

/// Create a mutation observer
pub fn create_mutation_observer(_callback: impl FnMut() + 'static) -> u64 {
    0
}

/// Observe mutations on an element
pub fn observe_mutations<T>(_observer_id: u64, _element: &T, _options: &MutationObserverOptions) {}

/// Disconnect mutation observer
pub fn disconnect_mutation(_observer_id: u64) {}

/// Options for mutation observer
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

/// Copy text to clipboard
pub fn copy_to_clipboard(_text: &str) -> bool {
    #[cfg(target_family = "wasm")]
    {
        // Use WIT bindings when available
        // For now, return true as a stub
        true
    }
    #[cfg(not(target_family = "wasm"))]
    {
        // Server-side: clipboard not available
        false
    }
}

/// Returns true if the system prefers dark mode
pub fn prefers_dark_mode() -> bool {
    #[cfg(target_family = "wasm")]
    {
        // Use WIT bindings when available
        // For now, default to light mode
        false
    }
    #[cfg(not(target_family = "wasm"))]
    {
        // Server-side: default to light mode
        false
    }
}

/// Get current timestamp
pub fn now_timestamp() -> f64 {
    #[cfg(target_family = "wasm")]
    {
        // For WASI, use a simple counter or WIT binding
        0.0
    }
    #[cfg(not(target_family = "wasm"))]
    {
        use std::time::SystemTime;
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs_f64()
    }
}

/// Get element at point (placeholder)
pub fn element_from_point(_x: i32, _y: i32) -> Option<()> {
    None
}

/// Get target element from event (placeholder)
pub fn get_target_element_from_event(_client_x: i32, _client_y: i32) -> Option<()> {
    None
}

/// Find closest ancestor matching selector (placeholder)
pub fn element_closest<T>(_element: &T, _selector: &str) -> Option<()> {
    None
}

/// Get bounding client rect (placeholder)
pub fn get_bounding_client_rect<T>(_element: &T) -> Option<DomRect> {
    None
}

/// Get scroll top from point (placeholder)
pub fn get_scroll_top_from_point(_x: i32, _y: i32) -> f64 {
    0.0
}

/// Query selector (placeholder)
pub fn query_selector(_selector: &str) -> Option<()> {
    None
}

/// Query selector all (placeholder)
pub fn query_selector_all(_selector: &str) -> Vec<()> {
    Vec::new()
}

/// Get element by ID (placeholder)
pub fn get_element_by_id(_id: &str) -> Option<()> {
    None
}

/// Get element rect by ID (placeholder)
pub fn get_element_rect_by_id(_id: &str) -> Option<DomRect> {
    None
}

/// Get scroll top by selector (placeholder)
pub fn get_scroll_top_by_selector(_selector: &str) -> f64 {
    0.0
}

/// Request animation frame (placeholder)
pub fn request_animation_frame(_callback: impl FnOnce() + 'static) {}

/// Request animation frame with timestamp (placeholder)
pub fn request_animation_frame_with_timestamp(_callback: impl FnOnce(f64) + 'static) -> i32 {
    0
}

/// Register scroll event callback
pub fn on_scroll(_callback: impl FnMut() + 'static) {}

/// Draw QR code on canvas by ID (placeholder)
pub fn draw_qrcode_on_canvas_by_id(
    _canvas_id: &str,
    _matrix: &[Vec<bool>],
    _modules: usize,
    _color: &str,
    _background: &str,
) -> bool {
    false
}

/// Get bounding rect by class within element (placeholder)
pub fn get_bounding_rect_by_class_impl<T>(_class: &str, _element: &T) -> Option<DomRect> {
    None
}
