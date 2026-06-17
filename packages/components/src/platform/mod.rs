mod wit;

use std::sync::Mutex;

use tairitsu_vdom::platform::DomRect;
pub use wit::*;

static PLATFORM: Mutex<Option<HikariPlatform>> = Mutex::new(None);

pub fn init(platform: HikariPlatform) {
    let mut guard = PLATFORM.lock().unwrap_or_else(|e| e.into_inner());
    *guard = Some(platform);
}

fn with_platform<F, R>(f: F) -> Option<R>
where
    F: FnOnce(&HikariPlatform) -> R,
{
    let guard = PLATFORM.lock().unwrap_or_else(|e| e.into_inner());
    guard.as_ref().map(f)
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ContentEditableState {
    pub editable: bool,
    pub focused: bool,
}

// ── Type aliases for platform callback function pointer tables ──
// Each alias captures a specific closure signature used in the platform ops.
// Wrapping them in type aliases eliminates clippy::type_complexity.
type FnI32 = Box<dyn Fn() -> i32 + Send + Sync>;
type FnF64 = Box<dyn Fn() -> f64 + Send + Sync>;
type FnBool = Box<dyn Fn() -> bool + Send + Sync>;
type FnU64 = Box<dyn Fn() -> u64 + Send + Sync>;
type FnStrOptU64 = Box<dyn Fn(&str) -> Option<u64> + Send + Sync>;
type FnStrVecU64 = Box<dyn Fn(&str) -> Vec<u64> + Send + Sync>;
type FnStrF64 = Box<dyn Fn(&str) -> f64 + Send + Sync>;
type FnStrBool = Box<dyn Fn(&str) -> bool + Send + Sync>;
type FnStrOptRect = Box<dyn Fn(&str) -> Option<DomRect> + Send + Sync>;
type FnStrU64OptRect = Box<dyn Fn(&str, u64) -> Option<DomRect> + Send + Sync>;
type FnStrStrBool = Box<dyn Fn(&str, Option<&str>) -> bool + Send + Sync>;
type FnStrUsizeStrStrBool =
    Box<dyn Fn(&str, &[Vec<bool>], usize, &str, &str) -> bool + Send + Sync>;
type FnF64Str = Box<dyn Fn(f64, &str) + Send + Sync>;
type Fn1U64 = Box<dyn Fn(u64) + Send + Sync>;
type Fn1U64F64 = Box<dyn Fn(u64) -> f64 + Send + Sync>;
type Fn1U64U64 = Box<dyn Fn(u64) -> u64 + Send + Sync>;
type Fn1U64Str = Box<dyn Fn(u64, &str) + Send + Sync>;
type FnNestedMutI32I32 = Box<dyn Fn(Box<dyn FnMut(i32, i32)>) + Send + Sync>;
type FnNestedMutF64F64 = Box<dyn Fn(Box<dyn FnMut(f64, f64)>) + Send + Sync>;
type FnNestedMutVoidU64 = Box<dyn Fn(Box<dyn FnMut()>) -> u64 + Send + Sync>;
type FnNestedOnceVoidI32 = Box<dyn Fn(Box<dyn FnOnce()>, i32) -> i32 + Send + Sync>;
type FnNestedOnceF64U32 = Box<dyn Fn(Box<dyn FnOnce(f64)>) -> u32 + Send + Sync>;
type FnNestedOnceF64I32 = Box<dyn Fn(Box<dyn FnOnce(f64)>) -> i32 + Send + Sync>;
type FnU64U64BoolBoolBoolBool = Box<dyn Fn(u64, u64, bool, bool, bool, Option<bool>) + Send + Sync>;
type FnI32I32OptU64 = Box<dyn Fn(i32, i32) -> Option<u64> + Send + Sync>;
type FnI32I32F64 = Box<dyn Fn(i32, i32) -> f64 + Send + Sync>;
type FnU64StrOptU64 = Box<dyn Fn(u64, &str) -> Option<u64> + Send + Sync>;
type FnU64OptRect = Box<dyn Fn(u64) -> Option<DomRect> + Send + Sync>;
type FnU64F64 = Box<dyn Fn(u64, f64) + Send + Sync>;
type FnU64Bool = Box<dyn Fn(u64, bool) + Send + Sync>;
type FnU64String = Box<dyn Fn(u64) -> String + Send + Sync>;
type FnU64OptU32 = Box<dyn Fn(u64) -> Option<u32> + Send + Sync>;
type FnU64F32Vec = Box<dyn Fn(u64) -> Vec<f32> + Send + Sync>;
type FnU64U64 = Box<dyn Fn(u64, u64) + Send + Sync>;
type FnU64U64U64 = Box<dyn Fn(u64, u64) -> u64 + Send + Sync>;
type FnOptCES = Box<dyn Fn(u64) -> Option<ContentEditableState> + Send + Sync>;

pub struct ViewportOps {
    pub inner_width: FnI32,
    pub inner_height: FnI32,
    pub get_scroll_y: FnF64,
    pub scroll_to: FnF64Str,
    pub on_resize: FnNestedMutI32I32,
    pub on_scroll: FnNestedMutF64F64,
    pub prefers_dark_mode: FnBool,
}

pub struct TimerOps {
    pub set_timeout: FnNestedOnceVoidI32,
    pub request_animation_frame: FnNestedOnceF64U32,
    pub request_animation_frame_with_timestamp: FnNestedOnceF64I32,
}

pub struct DomQueryOps {
    pub element_from_point: FnI32I32OptU64,
    pub get_target_element_from_event: FnI32I32OptU64,
    pub element_closest: FnU64StrOptU64,
    pub get_bounding_client_rect: FnU64OptRect,
    pub get_scroll_top_from_point: FnI32I32F64,
    pub query_selector: FnStrOptU64,
    pub query_selector_all: FnStrVecU64,
    pub get_element_by_id: FnStrOptU64,
    pub get_element_rect_by_id: FnStrOptRect,
    pub get_scroll_top_by_selector: FnStrF64,
    pub get_bounding_rect_by_class: FnStrU64OptRect,
}

pub struct ObserverOps {
    pub create_resize_observer: FnNestedMutVoidU64,
    pub observe_resize: FnU64U64,
    pub disconnect_resize: Fn1U64,
    pub create_mutation_observer: FnNestedMutVoidU64,
    pub observe_mutations_element: FnU64U64BoolBoolBoolBool,
    pub disconnect_mutation: Fn1U64,
}

pub struct MediaOps {
    pub video_play: Fn1U64,
    pub video_pause: Fn1U64,
    pub video_get_current_time: Fn1U64F64,
    pub video_get_duration: Fn1U64F64,
    pub video_seek: FnU64F64,
    pub video_set_muted: FnU64Bool,
    pub video_set_volume: FnU64F64,
    pub create_audio_context: FnU64,
    pub create_analyser_node: Fn1U64U64,
    pub create_media_element_source: FnU64U64U64,
    pub analyser_get_frequency_data: FnU64F32Vec,
    pub analyser_get_time_domain_data: FnU64F32Vec,
}

pub struct EditableOps {
    pub get_contenteditable_state: FnOptCES,
    pub set_content_editable: FnU64Bool,
    pub exec_command: FnStrStrBool,
    pub get_selection_start: FnU64OptU32,
    pub get_selection_end: FnU64OptU32,
    pub get_inner_html: FnU64String,
    pub set_inner_html: Fn1U64Str,
}

pub struct HikariPlatform {
    pub viewport: ViewportOps,
    pub timer: TimerOps,
    pub dom: DomQueryOps,
    pub observers: ObserverOps,
    pub media: MediaOps,
    pub editable: EditableOps,

    pub copy_to_clipboard: FnStrBool,
    pub draw_qrcode_on_canvas: FnStrUsizeStrStrBool,
    pub request_fullscreen: Fn1U64,
    pub get_element_scroll_top: Fn1U64F64,
    pub set_element_scroll_top: FnU64F64,
}
