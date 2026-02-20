//! Animation frame hook for Dioxus

#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;
#[cfg(target_arch = "wasm32")]
use std::rc::Rc;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

#[cfg(target_arch = "wasm32")]
pub fn use_animation_frame(callback: impl Fn(f64) + 'static) {
    let callback = Rc::new(callback);

    let closure: Rc<RefCell<Option<wasm_bindgen::closure::Closure<dyn FnMut()>>>> =
        Rc::new(RefCell::new(None));

    let closure_ref = closure.clone();
    *closure.borrow_mut() = Some(wasm_bindgen::closure::Closure::wrap(Box::new({
        let callback = callback.clone();
        let window = web_sys::window().unwrap();
        let performance = window.performance().unwrap();
        let mut start_time: Option<f64> = None;

        move || {
            let current_time = performance.now();

            if let Some(start) = start_time {
                let elapsed = (current_time - start) / 1000.0;
                callback(elapsed);
            } else {
                start_time = Some(current_time);
            }

            if let Some(inner) = &*closure_ref.borrow() {
                window
                    .request_animation_frame(inner.as_ref().unchecked_ref())
                    .unwrap();
            }
        }
    })
        as Box<dyn FnMut()>));

    let borrowed = closure.borrow();
    let init = borrowed.as_ref().unwrap();
    web_sys::window()
        .unwrap()
        .request_animation_frame(init.as_ref().unchecked_ref())
        .unwrap();
}

#[cfg(not(target_arch = "wasm32"))]
pub fn use_animation_frame(_callback: impl Fn(f64) + 'static) {}
