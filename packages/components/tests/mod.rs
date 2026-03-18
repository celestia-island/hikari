// Component tests - only available on browser WASM (wasm32-unknown-unknown) and native
// These tests use Tairitsu rsx! macro which requires DOM rendering support
// WASI (wasm32-wasip2) does not have DOM support

#[cfg(not(target_os = "wasi"))]
pub mod basic_components_tests;

#[cfg(not(target_os = "wasi"))]
pub mod collapse_tests;

#[cfg(not(target_os = "wasi"))]
pub mod data_components_tests;

#[cfg(not(target_os = "wasi"))]
pub mod feedback_components_tests;

#[cfg(not(target_os = "wasi"))]
pub mod feedback_layer2_tests;

#[cfg(not(target_os = "wasi"))]
pub mod feedback_remaining_tests;

#[cfg(not(target_os = "wasi"))]
pub mod form_utility_tests;

#[cfg(not(target_os = "wasi"))]
pub mod navigation_components_tests;
