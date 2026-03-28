//! Prefers-reduced-motion detection
//!
//! Provides functions to detect and monitor the user's system preference
//! for reduced motion.
//!
//! Note: In WASI unified environment, these functions are feature-gated
//! rather than architecture-gated, allowing the same code to work on
//! both client and server.

/// Detect system prefers-reduced-motion setting
///
/// # Platform Support
/// - With `wasm` feature: Uses browser's matchMedia API
/// - Without `wasm` feature: Always returns false
#[cfg(feature = "wasm")]
pub fn prefers_reduced_motion() -> bool {
    web_sys::window()
        .and_then(|w| w.match_media("(prefers-reduced-motion: reduce)").ok())
        .flatten()
        .map(|mql| mql.matches())
        .unwrap_or(false)
}

/// Detect system prefers-reduced-motion setting (non-WASM version)
#[cfg(not(feature = "wasm"))]
pub fn prefers_reduced_motion() -> bool {
    false
}

/// Watch for prefers-reduced-motion changes
///
/// Sets up a listener that calls the callback when the system preference changes.
///
/// # Platform Support
/// - With `wasm` feature: Uses MediaQueryList.onchange
/// - Without `wasm` feature: No-op
#[cfg(feature = "wasm")]
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

/// Watch for prefers-reduced-motion changes (non-WASM version)
#[cfg(not(feature = "wasm"))]
pub fn watch_prefers_reduced_motion(_callback: impl Fn(bool) + 'static) {
    // No-op when wasm feature is not enabled
}
