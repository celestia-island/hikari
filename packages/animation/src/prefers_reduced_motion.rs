//! Prefers-reduced-motion detection
//!
//! Provides functions to detect and monitor the user's system preference
//! for reduced motion.
//!
//! In WASI unified environment, uses tairitsu's browser API access via
//! web-sys bindings.

/// Detect system prefers-reduced-motion setting
///
/// Uses browser's matchMedia API to detect the user's preference.
pub fn prefers_reduced_motion() -> bool {
    web_sys::window()
        .and_then(|w| w.match_media("(prefers-reduced-motion: reduce)").ok())
        .flatten()
        .map(|mql| mql.matches())
        .unwrap_or(false)
}

/// Watch for prefers-reduced-motion changes
///
/// Sets up a listener that calls the callback when the system preference changes.
/// Uses MediaQueryList.onchange to monitor changes.
pub fn watch_prefers_reduced_motion(callback: impl Fn(bool) + 'static) {
    use wasm_bindgen::JsCast;

    if let Some(mql) = web_sys::window()
        .and_then(|w| w.match_media("(prefers-reduced-motion: reduce)").ok())
        .flatten()
    {
        let closure: wasm_bindgen::closure::Closure<dyn FnMut()> =
            wasm_bindgen::closure::Closure::new(move || {
                callback(prefers_reduced_motion());
            });

        mql.set_onchange(Some(closure.as_ref().unchecked_ref()));
        closure.forget();
    }
}
