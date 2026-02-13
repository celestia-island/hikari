//! Prefers-reduced-motion detection
//!
//! Provides functions to detect and monitor the user's system preference
//! for reduced motion.

/// Detect system prefers-reduced-motion setting
///
/// # Platform Support
/// - WASM: Uses `window.matchMedia('(prefers-reduced-motion: reduce)')`
/// - Non-WASM: Always returns false
#[cfg(target_arch = "wasm32")]
pub fn prefers_reduced_motion() -> bool {
    use gloo::utils::window;

    window()
        .match_media("(prefers-reduced-motion: reduce)")
        .ok()
        .flatten()
        .map(|mql| mql.matches())
        .unwrap_or(false)
}

#[cfg(not(target_arch = "wasm32"))]
pub fn prefers_reduced_motion() -> bool {
    false
}

/// Watch for prefers-reduced-motion changes
///
/// Sets up a listener that calls the callback when the system preference changes.
///
/// # Platform Support
/// - WASM: Uses MediaQueryList.onchange
/// - Non-WASM: No-op
#[cfg(target_arch = "wasm32")]
pub fn watch_prefers_reduced_motion(callback: impl Fn(bool) + 'static) {
    use gloo::utils::window;
    use wasm_bindgen::JsCast;

    let media_query = window()
        .match_media("(prefers-reduced-motion: reduce)")
        .ok()
        .flatten();

    if let Some(mql) = media_query {
        let closure = wasm_bindgen::closure::Closure::new(move || {
            callback(prefers_reduced_motion());
        });

        mql.set_onchange(Some(closure.as_ref().unchecked_ref()));
        closure.forget();
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub fn watch_prefers_reduced_motion(_callback: impl Fn(bool) + 'static) {
    // No-op on non-WASM platforms
}
