use std::sync::atomic::{AtomicBool, Ordering};

use tairitsu_vdom::platform::DomRect;

use super::ContentEditableState;

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

pub fn log(message: &str) {
    eprintln!("{}", message);
}

pub fn log_warn(message: &str) {
    eprintln!("WARNING: {}", message);
}

pub fn log_error(message: &str) {
    eprintln!("ERROR: {}", message);
}

pub fn inner_width() -> i32 {
    super::with_platform(|p| (p.inner_width)()).unwrap_or(1024)
}

pub fn inner_height() -> i32 {
    super::with_platform(|p| (p.inner_height)()).unwrap_or(768)
}

pub fn set_timeout(callback: impl FnOnce() + 'static, ms: i32) -> i32 {
    super::with_platform(|p| (p.set_timeout)(Box::new(callback), ms)).unwrap_or(0)
}

pub fn get_scroll_y() -> f64 {
    super::with_platform(|p| (p.get_scroll_y)()).unwrap_or(0.0)
}

pub fn scroll_to_with_options(top: f64, behavior: &str) {
    super::with_platform(|p| (p.scroll_to)(top, behavior));
}

pub fn on_resize(mut callback: impl FnMut() + 'static) {
    super::with_platform(|p| {
        (p.on_resize)(Box::new(move |_, _| {
            callback();
        }));
    });
}

pub fn create_resize_observer(callback: impl FnMut() + 'static) -> u64 {
    super::with_platform(|p| (p.create_resize_observer)(Box::new(callback))).unwrap_or(0)
}

pub fn observe_resize<T>(_observer_id: u64, _element: &T) {}
pub fn disconnect_resize(_observer_id: u64) {}

pub fn create_mutation_observer(callback: impl FnMut() + 'static) -> u64 {
    super::with_platform(|p| (p.create_mutation_observer)(Box::new(callback))).unwrap_or(0)
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

pub fn copy_to_clipboard(text: &str) -> bool {
    super::with_platform(|p| (p.copy_to_clipboard)(text)).unwrap_or(false)
}

pub fn prefers_dark_mode() -> bool {
    super::with_platform(|p| (p.prefers_dark_mode)()).unwrap_or(false)
}

pub fn now_timestamp() -> f64 {
    use std::time::SystemTime;
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs_f64()
}

pub fn element_from_point(x: i32, y: i32) -> Option<()> {
    super::with_platform(|p| (p.element_from_point)(x, y)).flatten().map(|_| ())
}

pub fn get_target_element_from_event(client_x: i32, client_y: i32) -> Option<()> {
    super::with_platform(|p| (p.get_target_element_from_event)(client_x, client_y))
        .flatten()
        .map(|_| ())
}

pub fn element_closest<T>(_element: &T, selector: &str) -> Option<()> {
    super::with_platform(|p| (p.element_closest)(0, selector)).flatten().map(|_| ())
}

pub fn get_bounding_client_rect<T>(_element: &T) -> Option<DomRect> {
    super::with_platform(|p| (p.get_bounding_client_rect)(0)).flatten()
}

pub fn get_scroll_top_from_point(x: i32, y: i32) -> f64 {
    super::with_platform(|p| (p.get_scroll_top_from_point)(x, y)).unwrap_or(0.0)
}

pub fn query_selector(selector: &str) -> Option<()> {
    super::with_platform(|p| (p.query_selector)(selector)).flatten().map(|_| ())
}

pub fn query_selector_all(selector: &str) -> Vec<()> {
    super::with_platform(|p| (p.query_selector_all)(selector))
        .unwrap_or_default()
        .into_iter()
        .map(|_| ())
        .collect()
}

pub fn get_element_by_id(id: &str) -> Option<()> {
    super::with_platform(|p| (p.get_element_by_id)(id)).flatten().map(|_| ())
}

pub fn get_element_rect_by_id(id: &str) -> Option<DomRect> {
    super::with_platform(|p| (p.get_element_rect_by_id)(id)).flatten()
}

pub fn get_scroll_top_by_selector(selector: &str) -> f64 {
    super::with_platform(|p| (p.get_scroll_top_by_selector)(selector)).unwrap_or(0.0)
}

pub fn request_animation_frame(callback: impl FnOnce() + 'static) {
    let mut cb: Option<Box<dyn FnOnce()>> = Some(Box::new(callback));
    let _ = tairitsu_vdom::dom_ops::request_animation_frame(Box::new(move |_| {
        if let Some(f) = cb.take() {
            f();
        }
    }));
}

pub fn request_animation_frame_with_timestamp(callback: impl FnOnce(f64) + 'static) -> i32 {
    let mut cb: Option<Box<dyn FnOnce(f64)>> = Some(Box::new(callback));
    let id = tairitsu_vdom::dom_ops::request_animation_frame(Box::new(move |ts| {
        if let Some(f) = cb.take() {
            f(ts);
        }
    }));
    id as i32
}

pub fn on_scroll(mut callback: impl FnMut() + 'static) {
    super::with_platform(|p| {
        (p.on_scroll)(Box::new(move |_, _| {
            callback();
        }));
    });
}

pub fn draw_qrcode_on_canvas_by_id(
    canvas_id: &str,
    matrix: &[Vec<bool>],
    modules: usize,
    color: &str,
    background: &str,
) -> bool {
    super::with_platform(|p| (p.draw_qrcode_on_canvas)(canvas_id, matrix, modules, color, background))
        .unwrap_or(false)
}

pub fn get_bounding_rect_by_class_impl<T>(class: &str, _element: &T) -> Option<DomRect> {
    super::with_platform(|p| (p.get_bounding_rect_by_class)(class, 0)).flatten()
}

pub fn get_contenteditable_state(element_handle: u64) -> Option<ContentEditableState> {
    super::with_platform(|p| (p.get_contenteditable_state)(element_handle)).flatten()
}

pub fn set_content_editable(element_handle: u64, editable: bool) {
    super::with_platform(|p| (p.set_content_editable)(element_handle, editable));
}

pub fn exec_command(command: &str, value: Option<&str>) -> bool {
    super::with_platform(|p| (p.exec_command)(command, value)).unwrap_or(false)
}

pub fn get_selection_start(element_handle: u64) -> Option<u32> {
    super::with_platform(|p| (p.get_selection_start)(element_handle)).flatten()
}

pub fn get_selection_end(element_handle: u64) -> Option<u32> {
    super::with_platform(|p| (p.get_selection_end)(element_handle)).flatten()
}

pub fn get_inner_html(element_handle: u64) -> String {
    super::with_platform(|p| (p.get_inner_html)(element_handle)).unwrap_or_default()
}

pub fn set_inner_html(element_handle: u64, html: &str) {
    super::with_platform(|p| (p.set_inner_html)(element_handle, html));
}

pub fn request_fullscreen(element_handle: u64) {
    super::with_platform(|p| (p.request_fullscreen)(element_handle));
}

pub fn get_element_scroll_top(element_handle: u64) -> f64 {
    super::with_platform(|p| (p.get_element_scroll_top)(element_handle)).unwrap_or(0.0)
}

pub fn set_element_scroll_top(element_handle: u64, value: f64) {
    super::with_platform(|p| (p.set_element_scroll_top)(element_handle, value));
}

pub fn video_play(element_handle: u64) {
    super::with_platform(|p| (p.video_play)(element_handle));
}

pub fn video_pause(element_handle: u64) {
    super::with_platform(|p| (p.video_pause)(element_handle));
}

pub fn video_get_current_time(element_handle: u64) -> f64 {
    super::with_platform(|p| (p.video_get_current_time)(element_handle)).unwrap_or(0.0)
}

pub fn video_get_duration(element_handle: u64) -> f64 {
    super::with_platform(|p| (p.video_get_duration)(element_handle)).unwrap_or(0.0)
}

pub fn video_seek(element_handle: u64, time: f64) {
    super::with_platform(|p| (p.video_seek)(element_handle, time));
}

pub fn video_set_muted(element_handle: u64, muted: bool) {
    super::with_platform(|p| (p.video_set_muted)(element_handle, muted));
}

pub fn video_set_volume(element_handle: u64, volume: f64) {
    super::with_platform(|p| (p.video_set_volume)(element_handle, volume));
}

pub fn create_audio_context() -> u64 {
    super::with_platform(|p| (p.create_audio_context)()).unwrap_or(0)
}

pub fn create_analyser_node(audio_context: u64) -> u64 {
    super::with_platform(|p| (p.create_analyser_node)(audio_context)).unwrap_or(0)
}

pub fn create_media_element_source(audio_context: u64, element_handle: u64) -> u64 {
    super::with_platform(|p| (p.create_media_element_source)(audio_context, element_handle)).unwrap_or(0)
}

pub fn analyser_node_get_frequency_data(analyser: u64) -> Vec<f32> {
    super::with_platform(|p| (p.analyser_get_frequency_data)(analyser)).unwrap_or_default()
}

pub fn analyser_node_get_time_domain_data(analyser: u64) -> Vec<f32> {
    super::with_platform(|p| (p.analyser_get_time_domain_data)(analyser)).unwrap_or_default()
}
