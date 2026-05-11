//! Continuous animation hooks (timeout, interval)
//!
//! Provides `use_timeout` and `use_interval` for timed callbacks.
//! Uses tairitsu's Platform trait for cross-platform timer support.

use std::{cell::RefCell, rc::Rc};

pub fn use_timeout(duration_ms: u64, callback: impl Fn() + Clone + 'static) -> impl Fn() {
    let fired = Rc::new(RefCell::new(false));

    move || {
        if *fired.borrow() {
            return;
        }
        *fired.borrow_mut() = true;

        let cb = callback.clone();
        let platform = tairitsu_web::BrowserPlatform::new();
        platform.set_timeout(cb, duration_ms as u32);
    }
}

pub fn use_interval(duration_ms: u64, callback: impl Fn() + 'static) {
    let callback = Rc::new(callback);

    let platform = tairitsu_web::BrowserPlatform::new();
    platform.set_timeout(
        {
            let cb = callback.clone();
            let dur = duration_ms;
            move || {
                cb();
                let cb2 = callback.clone();
                let platform = tairitsu_web::BrowserPlatform::new();
                platform.set_timeout(
                    move || {
                        cb2();
                    },
                    dur as u32,
                );
            }
        },
        duration_ms as u32,
    );
}
