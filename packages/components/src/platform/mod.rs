use std::sync::Mutex;

use tairitsu_vdom::platform::DomRect;

mod wit;
pub use wit::*;

static PLATFORM: Mutex<Option<HikariPlatform>> = Mutex::new(None);

pub fn init(platform: HikariPlatform) {
    let mut guard = PLATFORM.lock().unwrap();
    *guard = Some(platform);
}

fn with_platform<F, R>(f: F) -> Option<R>
where
    F: FnOnce(&HikariPlatform) -> R,
{
    let guard = PLATFORM.lock().unwrap();
    guard.as_ref().map(f)
}

#[allow(clippy::type_complexity)]
pub struct HikariPlatform {
    pub inner_width: Box<dyn Fn() -> i32 + Send + Sync>,
    pub inner_height: Box<dyn Fn() -> i32 + Send + Sync>,

    pub set_timeout: Box<dyn Fn(Box<dyn FnOnce()>, i32) -> i32 + Send + Sync>,
    pub get_scroll_y: Box<dyn Fn() -> f64 + Send + Sync>,
    pub scroll_to: Box<dyn Fn(f64, &str) + Send + Sync>,
    pub on_resize: Box<dyn Fn(Box<dyn FnMut(i32, i32)>) + Send + Sync>,
    pub on_scroll: Box<dyn Fn(Box<dyn FnMut(f64, f64)>) + Send + Sync>,
    pub prefers_dark_mode: Box<dyn Fn() -> bool + Send + Sync>,
    pub request_animation_frame: Box<dyn Fn(Box<dyn FnOnce(f64)>) -> u32 + Send + Sync>,
    pub request_animation_frame_with_timestamp:
        Box<dyn Fn(Box<dyn FnOnce(f64)>) -> i32 + Send + Sync>,

    pub copy_to_clipboard: Box<dyn Fn(&str) -> bool + Send + Sync>,

    pub element_from_point: Box<dyn Fn(i32, i32) -> Option<u64> + Send + Sync>,
    pub get_target_element_from_event: Box<dyn Fn(i32, i32) -> Option<u64> + Send + Sync>,
    pub element_closest: Box<dyn Fn(u64, &str) -> Option<u64> + Send + Sync>,
    pub get_bounding_client_rect: Box<dyn Fn(u64) -> Option<DomRect> + Send + Sync>,
    pub get_scroll_top_from_point: Box<dyn Fn(i32, i32) -> f64 + Send + Sync>,

    pub query_selector: Box<dyn Fn(&str) -> Option<u64> + Send + Sync>,
    pub query_selector_all: Box<dyn Fn(&str) -> Vec<u64> + Send + Sync>,
    pub get_element_by_id: Box<dyn Fn(&str) -> Option<u64> + Send + Sync>,
    pub get_element_rect_by_id: Box<dyn Fn(&str) -> Option<DomRect> + Send + Sync>,
    pub get_scroll_top_by_selector: Box<dyn Fn(&str) -> f64 + Send + Sync>,
    pub get_bounding_rect_by_class: Box<dyn Fn(&str, u64) -> Option<DomRect> + Send + Sync>,

    pub create_resize_observer: Box<dyn Fn(Box<dyn FnMut()>) -> u64 + Send + Sync>,
    pub observe_resize: Box<dyn Fn(u64, u64) + Send + Sync>,
    pub disconnect_resize: Box<dyn Fn(u64) + Send + Sync>,
    pub create_mutation_observer: Box<dyn Fn(Box<dyn FnMut()>) -> u64 + Send + Sync>,
    pub observe_mutations_element:
        Box<dyn Fn(u64, u64, bool, bool, bool, Option<bool>) + Send + Sync>,
    pub disconnect_mutation: Box<dyn Fn(u64) + Send + Sync>,

    pub draw_qrcode_on_canvas:
        Box<dyn Fn(&str, &[Vec<bool>], usize, &str, &str) -> bool + Send + Sync>,

    pub get_contenteditable_state: Box<dyn Fn(u64) -> Option<ContentEditableState> + Send + Sync>,
    pub set_content_editable: Box<dyn Fn(u64, bool) + Send + Sync>,
    pub exec_command: Box<dyn Fn(&str, Option<&str>) -> bool + Send + Sync>,
    pub get_selection_start: Box<dyn Fn(u64) -> Option<u32> + Send + Sync>,
    pub get_selection_end: Box<dyn Fn(u64) -> Option<u32> + Send + Sync>,
    pub get_inner_html: Box<dyn Fn(u64) -> String + Send + Sync>,
    pub set_inner_html: Box<dyn Fn(u64, &str) + Send + Sync>,

    pub request_fullscreen: Box<dyn Fn(u64) + Send + Sync>,
    pub get_element_scroll_top: Box<dyn Fn(u64) -> f64 + Send + Sync>,
    pub set_element_scroll_top: Box<dyn Fn(u64, f64) + Send + Sync>,

    pub video_play: Box<dyn Fn(u64) + Send + Sync>,
    pub video_pause: Box<dyn Fn(u64) + Send + Sync>,
    pub video_get_current_time: Box<dyn Fn(u64) -> f64 + Send + Sync>,
    pub video_get_duration: Box<dyn Fn(u64) -> f64 + Send + Sync>,
    pub video_seek: Box<dyn Fn(u64, f64) + Send + Sync>,
    pub video_set_muted: Box<dyn Fn(u64, bool) + Send + Sync>,
    pub video_set_volume: Box<dyn Fn(u64, f64) + Send + Sync>,

    pub create_audio_context: Box<dyn Fn() -> u64 + Send + Sync>,
    pub create_analyser_node: Box<dyn Fn(u64) -> u64 + Send + Sync>,
    pub create_media_element_source: Box<dyn Fn(u64, u64) -> u64 + Send + Sync>,
    pub analyser_get_frequency_data: Box<dyn Fn(u64) -> Vec<f32> + Send + Sync>,
    pub analyser_get_time_domain_data: Box<dyn Fn(u64) -> Vec<f32> + Send + Sync>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ContentEditableState {
    pub editable: bool,
    pub focused: bool,
}
