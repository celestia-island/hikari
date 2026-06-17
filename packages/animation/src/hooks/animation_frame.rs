//! Animation frame hook
//!
//! Provides `use_animation_frame` for running a callback on every animation frame.
//! Uses tairitsu's Platform trait for cross-platform requestAnimationFrame support.

use std::cell::RefCell;
use std::rc::Rc;

type FrameScheduler = Rc<RefCell<Option<Box<dyn FnMut()>>>>;

pub fn use_animation_frame(callback: impl Fn(f64) + 'static) {
    let platform = Rc::new(RefCell::new(tairitsu_web::BrowserPlatform::new()));
    let callback = Rc::new(callback);

    let scheduler: FrameScheduler = Rc::new(RefCell::new(None));

    let scheduler_clone = scheduler.clone();
    let platform_clone = platform;
    let callback_clone = callback;

    let frame_cb = move || {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as f64;
        callback_clone(now / 1000.0);

        // Schedule next frame
        let sched = scheduler_clone.clone();
        let p = platform_clone.clone();
        p.borrow_mut().request_animation_frame(move || {
            let mut s = sched.borrow_mut();
            if let Some(ref mut f) = *s {
                f();
            }
        });
    };

    *scheduler.borrow_mut() = Some(Box::new(frame_cb));
    let mut s = scheduler.borrow_mut();
    if let Some(ref mut f) = *s {
        f();
    }
}
