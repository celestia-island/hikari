//! Concrete [`ScrollbarHost`] backed by the tairitsu WitPlatform.

#![cfg(target_family = "wasm")]

use std::cell::RefCell;
use std::rc::Rc;

use hikari_components::scripts::scrollbar_container::ScrollbarHost;
use tairitsu_vdom::{DomHandle, EventData, Platform};
use tairitsu_web::WitPlatform;
use tairitsu_web::wit_platform::WitElement;

thread_local! {
    static DRAG_STATE: RefCell<DragState> = RefCell::new(DragState::None);
}

fn extract_client_y(ev: &Box<dyn EventData>) -> f64 {
    ev.as_any()
        .downcast_ref::<tairitsu_vdom::MouseEvent>()
        .map(|m| m.client_y as f64)
        .unwrap_or(0.0)
}

enum DragState {
    None,
    Active {
        on_move: Rc<RefCell<dyn FnMut(f64)>>,
        on_end: Rc<RefCell<dyn FnMut()>>,
    },
}

pub(crate) struct PlatformScrollbarHost<'a> {
    platform: &'a WitPlatform,
}

impl<'a> PlatformScrollbarHost<'a> {
    pub fn new(platform: &'a WitPlatform) -> Self {
        Self { platform }
    }

    fn el(&self, h: DomHandle) -> WitElement {
        WitElement(h.get_inner_id())
    }
}

impl ScrollbarHost for PlatformScrollbarHost<'_> {
    fn query_all(&self, selector: &str) -> Vec<DomHandle> {
        self.platform
            .query_selector_all(selector)
            .iter()
            .map(|e| DomHandle::from_raw(e.0))
            .collect()
    }

    fn on_scroll(&self, el: DomHandle, mut cb: Box<dyn FnMut()>) {
        let wit_el = self.el(el);
        self.platform.add_event_listener(
            &wit_el,
            "scroll",
            Box::new(move |_ev: Box<dyn EventData>| {
                cb();
            }),
        );
    }

    fn on_mouse_enter(&self, el: DomHandle, mut cb: Box<dyn FnMut()>) {
        let wit_el = self.el(el);
        self.platform.add_event_listener(
            &wit_el,
            "mouseenter",
            Box::new(move |_ev| {
                cb();
            }),
        );
    }

    fn on_mouse_leave(&self, el: DomHandle, mut cb: Box<dyn FnMut()>) {
        let wit_el = self.el(el);
        self.platform.add_event_listener(
            &wit_el,
            "mouseleave",
            Box::new(move |_ev| {
                cb();
            }),
        );
    }

    fn setup_drag(
        &self,
        thumb: DomHandle,
        on_down: Rc<RefCell<dyn FnMut(f64)>>,
        on_move: Rc<RefCell<dyn FnMut(f64)>>,
        on_end: Rc<RefCell<dyn FnMut()>>,
    ) {
        let wit_el = self.el(thumb);

        let on_move_c = on_move.clone();
        let on_end_c = on_end.clone();

        self.platform.add_event_listener(
            &wit_el,
            "mousedown",
            Box::new(move |ev: Box<dyn EventData>| {
                let client_y = extract_client_y(&ev);
                on_down.borrow_mut()(client_y);

                DRAG_STATE.with(|ds| {
                    *ds.borrow_mut() = DragState::Active {
                        on_move: on_move_c.clone(),
                        on_end: on_end_c.clone(),
                    };
                });
            }),
        );

        setup_window_drag_listeners(self.platform);
    }

    fn on_click(&self, el: DomHandle, mut cb: Box<dyn FnMut(f64)>) {
        let wit_el = self.el(el);
        self.platform.add_event_listener(
            &wit_el,
            "click",
            Box::new(move |ev: Box<dyn EventData>| {
                let client_y = extract_client_y(&ev);
                cb(client_y);
            }),
        );
    }

    fn on_resize(&self, el: DomHandle, mut cb: Box<dyn FnMut()>) {
        let wit_el = self.el(el);
        let observer = self.platform.create_resize_observer(Box::new(move |_entries| {
            cb();
        }));
        self.platform.observe_resize(observer, &wit_el);
    }

    fn on_body_mutation(&self, mut cb: Box<dyn FnMut()>) {
        let observer = self.platform.create_mutation_observer(Box::new(move |_records| {
            cb();
        }));
        if let Some(body) = self.platform.query_selector("body") {
            self.platform.observe_mutations(
                observer,
                &body,
                Some(tairitsu_vdom::MutationObserverInit {
                    child_list: true,
                    attributes: true,
                    character_data: true,
                    subtree: true,
                    attribute_old_value: false,
                    character_data_old_value: false,
                }),
            );
        }
    }
}

fn setup_window_drag_listeners(platform: &WitPlatform) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static REGISTERED: AtomicBool = AtomicBool::new(false);

    if REGISTERED.swap(true, Ordering::SeqCst) {
        return;
    }

    if let Some(body) = platform.query_selector("body") {
        platform.add_event_listener(
            &body,
            "mousemove",
            Box::new(|ev: Box<dyn EventData>| {
                let client_y = extract_client_y(&ev);
                DRAG_STATE.with(|ds| {
                    if let DragState::Active { ref on_move, .. } = *ds.borrow() {
                        on_move.borrow_mut()(client_y);
                    }
                });
            }),
        );

        platform.add_event_listener(
            &body,
            "mouseup",
            Box::new(|_ev: Box<dyn EventData>| {
                DRAG_STATE.with(|ds| {
                    if let DragState::Active { ref on_end, .. } = *ds.borrow_mut() {
                        on_end.borrow_mut()();
                    }
                    *ds.borrow_mut() = DragState::None;
                });
            }),
        );
    }
}
