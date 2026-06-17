//! Continuous animation hooks (timeout, interval)
//!
//! Provides `use_timeout` and `use_interval` for timed callbacks.
//! Uses tairitsu's Platform trait for cross-platform timer support.

use std::cell::RefCell;
use std::rc::Rc;

type TimeoutScheduler = Rc<RefCell<Option<Box<dyn FnMut()>>>>;

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
    let platform = Rc::new(RefCell::new(tairitsu_web::BrowserPlatform::new()));

    let scheduler: TimeoutScheduler = Rc::new(RefCell::new(None));
    let sched_clone = scheduler.clone();

    let tick = move || {
        callback();
        let s = sched_clone.clone();
        let p = platform.clone();
        let dur = duration_ms;
        p.borrow_mut().set_timeout(
            move || {
                let mut guard = s.borrow_mut();
                if let Some(ref mut f) = *guard {
                    f();
                }
            },
            dur as u32,
        );
    };

    *scheduler.borrow_mut() = Some(Box::new(tick));
    let mut guard = scheduler.borrow_mut();
    if let Some(ref mut f) = *guard {
        f();
    }
}
