//! Continuous animation hooks (timeout, interval) for Dioxus

#[cfg(target_arch = "wasm32")]
use dioxus::prelude::*;
#[cfg(target_arch = "wasm32")]
use std::sync::{Arc, Mutex};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

#[cfg(target_arch = "wasm32")]
pub fn use_timeout(duration_ms: u64, callback: impl Fn() + 'static) -> impl Fn() {
    let timeout_id = Arc::new(Mutex::new(Option::<i32>::None));
    let callback_arc = Arc::new(callback);
    let timeout_id_for_effect = timeout_id.clone();

    use_effect(move || {
        let window = web_sys::window().unwrap();
        if let Some(id) = *timeout_id_for_effect.lock().unwrap() {
            window.clear_timeout_with_handle(id);
        }
    });

    let trigger = move || {
        let window = web_sys::window().unwrap();

        if let Some(id) = *timeout_id.lock().unwrap() {
            window.clear_timeout_with_handle(id);
        }

        let callback_clone = callback_arc.clone();
        let closure = wasm_bindgen::closure::Closure::once(Box::new(move || {
            callback_clone();
        }) as Box<dyn FnOnce()>);

        let id = window
            .set_timeout_with_callback_and_timeout_and_arguments_0(
                closure.as_ref().unchecked_ref(),
                duration_ms as i32,
            )
            .unwrap();

        *timeout_id.lock().unwrap() = Some(id);
        closure.forget();
    };

    trigger
}

#[cfg(not(target_arch = "wasm32"))]
pub fn use_timeout(_duration_ms: u64, _callback: impl Fn() + 'static) -> impl Fn() {
    move || {}
}

#[cfg(target_arch = "wasm32")]
pub fn use_interval(duration_ms: u64, callback: impl Fn() + 'static) {
    let interval_id = Arc::new(Mutex::new(Option::<i32>::None));
    let callback_arc = Arc::new(callback);
    let interval_id_for_effect = interval_id.clone();

    use_effect(move || {
        let window = web_sys::window().unwrap();

        let callback_clone = callback_arc.clone();
        let closure = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
            callback_clone();
        }) as Box<dyn FnMut()>);

        let id = window
            .set_interval_with_callback_and_timeout_and_arguments_0(
                closure.as_ref().unchecked_ref(),
                duration_ms as i32,
            )
            .unwrap();

        *interval_id.lock().unwrap() = Some(id);
        closure.forget();

        if let Some(id) = *interval_id_for_effect.lock().unwrap() {
            window.clear_interval_with_handle(id);
        }
    });
}

#[cfg(not(target_arch = "wasm32"))]
pub fn use_interval(_duration_ms: u64, _callback: impl Fn() + 'static) {}
