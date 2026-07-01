use std::sync::atomic::{AtomicBool, Ordering};

use tairitsu_vdom::platform::DomRect;

use super::ContentEditableState;

static ANIMATION_FROZEN: AtomicBool = AtomicBool::new(false);

/// Returns whether animations are currently frozen (paused globally).
pub fn is_animation_frozen() -> bool {
    ANIMATION_FROZEN.load(Ordering::SeqCst)
}

/// Sets the global animation frozen state.
pub fn set_animation_frozen(frozen: bool) {
    ANIMATION_FROZEN.store(frozen, Ordering::SeqCst);
}

/// Freezes all animations globally.
pub fn freeze_animations() {
    set_animation_frozen(true);
}

/// Unfreezes all animations globally.
pub fn unfreeze_animations() {
    set_animation_frozen(false);
}

/// Logs a message to the platform console.
pub fn log(message: &str) {
    eprintln!("{message}");
}

/// Logs a warning message to the platform console.
pub fn log_warn(message: &str) {
    eprintln!("WARNING: {message}");
}

/// Logs an error message to the platform console.
pub fn log_error(message: &str) {
    eprintln!("ERROR: {message}");
}

/// Returns the viewport inner width in pixels. Defaults to 1024 if unavailable.
#[must_use]
pub fn inner_width() -> i32 {
    super::with_platform(|p| (p.viewport.inner_width)()).unwrap_or(1024)
}

/// Returns the viewport inner height in pixels. Defaults to 768 if unavailable.
#[must_use]
pub fn inner_height() -> i32 {
    super::with_platform(|p| (p.viewport.inner_height)()).unwrap_or(768)
}

/// Schedules a callback after `ms` milliseconds. Returns a timeout ID (0 on failure).
pub fn set_timeout(callback: impl FnOnce() + 'static, ms: i32) -> i32 {
    super::with_platform(|p| (p.timer.set_timeout)(Box::new(callback), ms)).unwrap_or(0)
}

/// Returns the current vertical scroll position in pixels.
#[must_use]
pub fn get_scroll_y() -> f64 {
    super::with_platform(|p| (p.viewport.get_scroll_y)()).unwrap_or(0.0)
}

/// Scrolls the viewport to the given `top` position with the specified `behavior` (e.g. "smooth").
pub fn scroll_to_with_options(top: f64, behavior: &str) {
    super::with_platform(|p| (p.viewport.scroll_to)(top, behavior));
}

/// Registers a callback that fires when the viewport is resized.
pub fn on_resize(mut callback: impl FnMut() + 'static) {
    super::with_platform(|p| {
        (p.viewport.on_resize)(Box::new(move |_, _| {
            callback();
        }));
    });
}

/// Creates a ResizeObserver and returns its ID.
pub fn create_resize_observer(callback: impl FnMut() + 'static) -> u64 {
    super::with_platform(|p| (p.observers.create_resize_observer)(Box::new(callback))).unwrap_or(0)
}

/// Begins observing resize events on the given element.
pub fn observe_resize<T>(_observer_id: u64, _element: &T) {}

/// Disconnects a ResizeObserver by ID.
pub fn disconnect_resize(_observer_id: u64) {}

/// Creates a MutationObserver and returns its ID.
pub fn create_mutation_observer(callback: impl FnMut() + 'static) -> u64 {
    super::with_platform(|p| (p.observers.create_mutation_observer)(Box::new(callback)))
        .unwrap_or(0)
}

/// Begins observing mutations on the given element with the specified options.
pub fn observe_mutations<T>(_observer_id: u64, _element: &T, _options: &MutationObserverOptions) {}

/// Disconnects a MutationObserver by ID.
pub fn disconnect_mutation(_observer_id: u64) {}

/// Options for configuring a MutationObserver.
pub struct MutationObserverOptions {
    /// Whether to observe direct child additions/removals.
    pub child_list: bool,
    /// Whether to observe attribute changes.
    pub attributes: bool,
    /// Whether to observe text content changes.
    pub character_data: bool,
    /// Whether to extend observation to the entire subtree.
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

/// Copies the given text to the system clipboard. Returns `true` on success.
#[must_use]
pub fn copy_to_clipboard(text: &str) -> bool {
    super::with_platform(|p| (p.copy_to_clipboard)(text)).unwrap_or(false)
}

/// Returns whether the user prefers dark mode.
#[must_use]
pub fn prefers_dark_mode() -> bool {
    super::with_platform(|p| (p.viewport.prefers_dark_mode)()).unwrap_or(false)
}

/// Returns the current timestamp as seconds since UNIX epoch.
#[must_use]
pub fn now_timestamp() -> f64 {
    use std::time::SystemTime;
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs_f64()
}

/// Returns the topmost element at the given viewport coordinates.
#[must_use]
pub fn element_from_point(x: i32, y: i32) -> Option<()> {
    super::with_platform(|p| (p.dom.element_from_point)(x, y))
        .flatten()
        .map(|_| ())
}

/// Returns the target element from a pointer event at the given coordinates.
#[must_use]
pub fn get_target_element_from_event(client_x: i32, client_y: i32) -> Option<()> {
    super::with_platform(|p| (p.dom.get_target_element_from_event)(client_x, client_y))
        .flatten()
        .map(|_| ())
}

/// Walks up the DOM tree from the given element, returning the first ancestor matching `selector`.
pub fn element_closest<T>(_element: &T, selector: &str) -> Option<()> {
    super::with_platform(|p| (p.dom.element_closest)(0, selector))
        .flatten()
        .map(|_| ())
}

/// Returns the bounding client rect for the given element.
pub fn get_bounding_client_rect<T>(_element: &T) -> Option<DomRect> {
    super::with_platform(|p| (p.dom.get_bounding_client_rect)(0)).flatten()
}

/// Returns the scroll top offset at the given viewport coordinates.
#[must_use]
pub fn get_scroll_top_from_point(x: i32, y: i32) -> f64 {
    super::with_platform(|p| (p.dom.get_scroll_top_from_point)(x, y)).unwrap_or(0.0)
}

/// Returns the first element matching the given CSS selector.
#[must_use]
pub fn query_selector(selector: &str) -> Option<()> {
    super::with_platform(|p| (p.dom.query_selector)(selector))
        .flatten()
        .map(|_| ())
}

/// Returns all elements matching the given CSS selector.
#[must_use]
pub fn query_selector_all(selector: &str) -> Vec<()> {
    super::with_platform(|p| (p.dom.query_selector_all)(selector))
        .unwrap_or_default()
        .into_iter()
        .map(|_| ())
        .collect()
}

/// Returns the element with the given ID, if it exists.
#[must_use]
pub fn get_element_by_id(id: &str) -> Option<()> {
    super::with_platform(|p| (p.dom.get_element_by_id)(id))
        .flatten()
        .map(|_| ())
}

/// Returns the bounding rect of the element with the given ID.
#[must_use]
pub fn get_element_rect_by_id(id: &str) -> Option<DomRect> {
    super::with_platform(|p| (p.dom.get_element_rect_by_id)(id)).flatten()
}

/// Returns the scroll top of the first element matching the given selector.
#[must_use]
pub fn get_scroll_top_by_selector(selector: &str) -> f64 {
    super::with_platform(|p| (p.dom.get_scroll_top_by_selector)(selector)).unwrap_or(0.0)
}

/// Schedules a callback for the next animation frame.
pub fn request_animation_frame(callback: impl FnOnce() + 'static) {
    let mut cb: Option<Box<dyn FnOnce()>> = Some(Box::new(callback));
    let _ = tairitsu_vdom::dom_ops::request_animation_frame(Box::new(move |_| {
        if let Some(f) = cb.take() {
            f();
        }
    }));
}

/// Schedules a callback for the next animation frame, passing the DOMHighResTimeStamp.
pub fn request_animation_frame_with_timestamp(callback: impl FnOnce(f64) + 'static) -> i32 {
    let mut cb: Option<Box<dyn FnOnce(f64)>> = Some(Box::new(callback));
    let id = tairitsu_vdom::dom_ops::request_animation_frame(Box::new(move |ts| {
        if let Some(f) = cb.take() {
            f(ts);
        }
    }));
    id as i32
}

/// Registers a callback that fires on viewport scroll.
pub fn on_scroll(mut callback: impl FnMut() + 'static) {
    super::with_platform(|p| {
        (p.viewport.on_scroll)(Box::new(move |_, _| {
            callback();
        }));
    });
}

/// Draws a QR code on the canvas element with the given ID.
#[must_use]
pub fn draw_qrcode_on_canvas_by_id(
    canvas_id: &str,
    matrix: &[Vec<bool>],
    modules: usize,
    color: &str,
    background: &str,
) -> bool {
    super::with_platform(|p| {
        (p.draw_qrcode_on_canvas)(canvas_id, matrix, modules, color, background)
    })
    .unwrap_or(false)
}

/// Returns the bounding rect of the first element with the given class, ignoring the element arg.
pub fn get_bounding_rect_by_class_impl<T>(class: &str, _element: &T) -> Option<DomRect> {
    super::with_platform(|p| (p.dom.get_bounding_rect_by_class)(class, 0)).flatten()
}

/// Returns the content-editable state for the element identified by `element_handle`.
#[must_use]
pub fn get_contenteditable_state(element_handle: u64) -> Option<ContentEditableState> {
    super::with_platform(|p| (p.editable.get_contenteditable_state)(element_handle)).flatten()
}

/// Sets whether the given element is content-editable.
pub fn set_content_editable(element_handle: u64, editable: bool) {
    super::with_platform(|p| (p.editable.set_content_editable)(element_handle, editable));
}

/// Executes a document command (e.g. "bold", "italic") on the editable element.
#[must_use]
pub fn exec_command(command: &str, value: Option<&str>) -> bool {
    super::with_platform(|p| (p.editable.exec_command)(command, value)).unwrap_or(false)
}

/// Returns the selection start offset for the editable element.
#[must_use]
pub fn get_selection_start(element_handle: u64) -> Option<u32> {
    super::with_platform(|p| (p.editable.get_selection_start)(element_handle)).flatten()
}

/// Returns the selection end offset for the editable element.
#[must_use]
pub fn get_selection_end(element_handle: u64) -> Option<u32> {
    super::with_platform(|p| (p.editable.get_selection_end)(element_handle)).flatten()
}

/// Returns the inner HTML of the editable element.
#[must_use]
pub fn get_inner_html(element_handle: u64) -> String {
    super::with_platform(|p| (p.editable.get_inner_html)(element_handle)).unwrap_or_default()
}

/// Sets the inner HTML of the editable element.
pub fn set_inner_html(element_handle: u64, html: &str) {
    super::with_platform(|p| (p.editable.set_inner_html)(element_handle, html));
}

/// Requests fullscreen mode for the given element.
pub fn request_fullscreen(element_handle: u64) {
    super::with_platform(|p| (p.request_fullscreen)(element_handle));
}

/// Returns the scroll top of the given element.
#[must_use]
pub fn get_element_scroll_top(element_handle: u64) -> f64 {
    super::with_platform(|p| (p.get_element_scroll_top)(element_handle)).unwrap_or(0.0)
}

/// Sets the scroll top of the given element.
pub fn set_element_scroll_top(element_handle: u64, value: f64) {
    super::with_platform(|p| (p.set_element_scroll_top)(element_handle, value));
}

/// Starts playback of the video element.
pub fn video_play(element_handle: u64) {
    super::with_platform(|p| (p.media.video_play)(element_handle));
}

/// Pauses playback of the video element.
pub fn video_pause(element_handle: u64) {
    super::with_platform(|p| (p.media.video_pause)(element_handle));
}

/// Returns the current playback time of the video element in seconds.
#[must_use]
pub fn video_get_current_time(element_handle: u64) -> f64 {
    super::with_platform(|p| (p.media.video_get_current_time)(element_handle)).unwrap_or(0.0)
}

/// Returns the total duration of the video element in seconds.
#[must_use]
pub fn video_get_duration(element_handle: u64) -> f64 {
    super::with_platform(|p| (p.media.video_get_duration)(element_handle)).unwrap_or(0.0)
}

/// Seeks the video element to the given time in seconds.
pub fn video_seek(element_handle: u64, time: f64) {
    super::with_platform(|p| (p.media.video_seek)(element_handle, time));
}

/// Sets the muted state of the video element.
pub fn video_set_muted(element_handle: u64, muted: bool) {
    super::with_platform(|p| (p.media.video_set_muted)(element_handle, muted));
}

/// Sets the playback volume (0.0 to 1.0) of the video element.
pub fn video_set_volume(element_handle: u64, volume: f64) {
    super::with_platform(|p| (p.media.video_set_volume)(element_handle, volume));
}

/// Creates an AudioContext and returns its handle.
#[must_use]
pub fn create_audio_context() -> u64 {
    super::with_platform(|p| (p.media.create_audio_context)()).unwrap_or(0)
}

/// Creates an AnalyserNode in the given AudioContext and returns its handle.
#[must_use]
pub fn create_analyser_node(audio_context: u64) -> u64 {
    super::with_platform(|p| (p.media.create_analyser_node)(audio_context)).unwrap_or(0)
}

/// Creates a MediaElementSource linking the audio context and media element.
#[must_use]
pub fn create_media_element_source(audio_context: u64, element_handle: u64) -> u64 {
    super::with_platform(|p| (p.media.create_media_element_source)(audio_context, element_handle))
        .unwrap_or(0)
}

/// Returns frequency domain data from the analyser node.
#[must_use]
pub fn analyser_node_get_frequency_data(analyser: u64) -> Vec<f32> {
    super::with_platform(|p| (p.media.analyser_get_frequency_data)(analyser)).unwrap_or_default()
}

/// Returns time domain (waveform) data from the analyser node.
#[must_use]
pub fn analyser_node_get_time_domain_data(analyser: u64) -> Vec<f32> {
    super::with_platform(|p| (p.media.analyser_get_time_domain_data)(analyser)).unwrap_or_default()
}
