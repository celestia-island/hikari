//! WASI platform implementation using tairitsu's WIT bindings
//!
//! This module provides unified DOM operations using tairitsu's WIT infrastructure,
//! which works consistently across browser and server environments.

use std::cell::RefCell;
use std::sync::atomic::{AtomicBool, Ordering};

use tairitsu_vdom::platform::DomRect;

static ANIMATION_FROZEN: AtomicBool = AtomicBool::new(false);

pub fn is_animation_frozen() -> bool {
    ANIMATION_FROZEN.load(Ordering::SeqCst)
}

pub fn set_animation_frozen(frozen: bool) {
    ANIMATION_FROZEN.store(frozen, Ordering::SeqCst);
}

pub fn freeze_animations() {
    set_animation_frozen(true);
}

pub fn unfreeze_animations() {
    set_animation_frozen(false);
}

/// Log a message to the console
pub fn log(message: &str) {
    // Use WASI stdout/stderr or platform logging
    eprintln!("{}", message);
}

/// Log a warning message
pub fn log_warn(message: &str) {
    eprintln!("WARNING: {}", message);
}

/// Log an error message
pub fn log_error(message: &str) {
    eprintln!("ERROR: {}", message);
}

/// Get the window inner width
pub fn inner_width() -> i32 {
    // Use tairitsu's WIT bindings when available
    // For now, return a default value
    1024
}

/// Get the window inner height
pub fn inner_height() -> i32 {
    768
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
    // Use WIT bindings when available
    // For now, return false as a stub
    false
}

/// Returns true if the system prefers dark mode
pub fn prefers_dark_mode() -> bool {
    // Use WIT bindings when available
    // For now, default to light mode
    false
}

/// Get current timestamp
pub fn now_timestamp() -> f64 {
    use std::time::SystemTime;
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs_f64()
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

/// Request animation frame
pub fn request_animation_frame(callback: impl FnOnce() + 'static) {
    let mut cb: Option<Box<dyn FnOnce()>> = Some(Box::new(callback));
    let _ = tairitsu_vdom::dom_ops::request_animation_frame(Box::new(move |_| {
        if let Some(f) = cb.take() {
            f();
        }
    }));
}

/// Request animation frame with timestamp
pub fn request_animation_frame_with_timestamp(callback: impl FnOnce(f64) + 'static) -> i32 {
    let mut cb: Option<Box<dyn FnOnce(f64)>> = Some(Box::new(callback));
    let id = tairitsu_vdom::dom_ops::request_animation_frame(Box::new(move |ts| {
        if let Some(f) = cb.take() {
            f(ts);
        }
    }));
    id as i32
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

/// ContentEditable state returned by platform
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ContentEditableState {
    pub editable: bool,
    pub focused: bool,
}

/// Get contenteditable state for element (placeholder)
pub fn get_contenteditable_state(_element_handle: u64) -> Option<ContentEditableState> {
    None
}

/// Set contenteditable attribute on element (placeholder)
pub fn set_content_editable(_element_handle: u64, _editable: bool) {}

/// Execute a document command (e.g. bold, italic) (placeholder)
pub fn exec_command(_command: &str, _value: Option<&str>) -> bool {
    false
}

/// Get selection start offset within element (placeholder)
pub fn get_selection_start(_element_handle: u64) -> Option<u32> {
    None
}

/// Get selection end offset within element (placeholder)
pub fn get_selection_end(_element_handle: u64) -> Option<u32> {
    None
}

/// Get inner HTML of element (placeholder)
pub fn get_inner_html(_element_handle: u64) -> String {
    String::new()
}

/// Set inner HTML of element (placeholder)
pub fn set_inner_html(_element_handle: u64, _html: &str) {}

/// Request fullscreen for an element (placeholder)
pub fn request_fullscreen(_element_handle: u64) {}

/// Get element scroll top (placeholder)
pub fn get_element_scroll_top(_element_handle: u64) -> f64 {
    0.0
}

/// Set element scroll top (placeholder)
pub fn set_element_scroll_top(_element_handle: u64, _value: f64) {}

/// Play video element (placeholder)
pub fn video_play(_element_handle: u64) {}

/// Pause video element (placeholder)
pub fn video_pause(_element_handle: u64) {}

/// Get video current time (placeholder)
pub fn video_get_current_time(_element_handle: u64) -> f64 {
    0.0
}

/// Get video duration (placeholder)
pub fn video_get_duration(_element_handle: u64) -> f64 {
    0.0
}

/// Seek video to time (placeholder)
pub fn video_seek(_element_handle: u64, _time: f64) {}

/// Set video muted state (placeholder)
pub fn video_set_muted(_element_handle: u64, _muted: bool) {}

/// Set video volume (placeholder)
pub fn video_set_volume(_element_handle: u64, _volume: f64) {}

/// Create an AudioContext (placeholder)
pub fn create_audio_context() -> u64 {
    0
}

/// Create an AnalyserNode (placeholder)
pub fn create_analyser_node(_audio_context: u64) -> u64 {
    0
}

/// Create a MediaElementSourceNode (placeholder)
pub fn create_media_element_source(_audio_context: u64, _element_handle: u64) -> u64 {
    0
}

/// Get frequency data from AnalyserNode (placeholder)
pub fn analyser_node_get_frequency_data(_analyser: u64) -> Vec<f32> {
    Vec::new()
}

/// Get time-domain data from AnalyserNode (placeholder)
pub fn analyser_node_get_time_domain_data(_analyser: u64) -> Vec<f32> {
    Vec::new()
}
