//! Animation frame hook
//!
//! Provides `use_animation_frame` for running a callback on every animation frame.
//! Uses tairitsu's Platform trait for cross-platform requestAnimationFrame support.

pub fn use_animation_frame(callback: impl Fn(f64) + 'static) {
    let platform = tairitsu_web::BrowserPlatform::new();
    platform.request_animation_frame(move || {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as f64;
        callback(now / 1000.0);
    });
}
