//! Custom DOM-based scrollbar component
//!
//! Builds a hand-crafted scrollbar DOM structure (wrapper → content + track → thumb)
//! on top of existing scrollable containers. Uses [`DomHandle`] for all DOM
//! references and [`ScrollbarHost`] for event / observer registration so the
//! caller can provide a concrete Platform-backed implementation.

use std::cell::RefCell;
use std::rc::Rc;

use tairitsu_vdom::dom_ops::{self, DomHandle};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WIDTH_IDLE: f64 = 4.0;
const WIDTH_ACTIVE: f64 = 8.0;

const SELECTORS: &[&str] = &[
    ".hi-aside-content",
    ".hi-layout-aside-content",
    ".hi-layout-content",
    ".hi-layout-scrollable",
    ".hi-tree-virtual",
    ".hi-tabs-nav",
    ".hi-table-container",
    ".hi-sidebar",
    ".sidebar-nav",
    ".showcase-table-container",
    ".custom-scrollbar-content-vdom",
];

// ---------------------------------------------------------------------------
// ScrollbarHost
// ---------------------------------------------------------------------------

/// Abstraction over platform-specific event and observer registration.
///
/// The website app implements this using its `Platform` reference. All
/// handles are [`DomHandle`] so that raw `u64` values never leak into
/// consumer code.
pub trait ScrollbarHost {
    /// Return all elements matching `selector` (query from document root).
    fn query_all(&self, selector: &str) -> Vec<DomHandle>;

    /// Fire `cb` every time `el` scrolls.
    fn on_scroll(&self, el: DomHandle, cb: Box<dyn FnMut()>);

    /// Fire `cb` when the mouse enters `el`.
    fn on_mouse_enter(&self, el: DomHandle, cb: Box<dyn FnMut()>);

    /// Fire `cb` when the mouse leaves `el`.
    fn on_mouse_leave(&self, el: DomHandle, cb: Box<dyn FnMut()>);

    /// Set up a drag interaction on `thumb`.
    ///
    /// On mousedown the host must:
    /// 1. Call `on_down(client_y)` so the consumer can record start state.
    /// 2. Register mousemove on the window → call `on_move(current_y)`.
    /// 3. Register mouseup on the window → call `on_end()`, then unregister
    ///    both temporary listeners.
    fn setup_drag(
        &self,
        thumb: DomHandle,
        on_down: Rc<RefCell<dyn FnMut(f64)>>,
        on_move: Rc<RefCell<dyn FnMut(f64)>>,
        on_end: Rc<RefCell<dyn FnMut()>>,
    );

    /// Fire `cb(client_y)` when `el` is clicked.
    fn on_click(&self, el: DomHandle, cb: Box<dyn FnMut(f64)>);

    /// Fire `cb` when `el` is resized.
    fn on_resize(&self, el: DomHandle, cb: Box<dyn FnMut()>);

    /// Fire `cb` when the document body mutates (child-list subtree).
    fn on_body_mutation(&self, cb: Box<dyn FnMut()>);
}

// ---------------------------------------------------------------------------
// Animation state machine
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AnimState {
    Idle,
    Active,
    Dragging,
    ScrollHover,
}

struct Animator {
    state: Rc<RefCell<AnimState>>,
    track: DomHandle,
    mouse_over: Rc<RefCell<bool>>,
}

impl Animator {
    fn new(track: DomHandle) -> Self {
        Self {
            state: Rc::new(RefCell::new(AnimState::Idle)),
            track,
            mouse_over: Rc::new(RefCell::new(false)),
        }
    }

    fn set_width(&self, w: f64) {
        dom_ops::set_style(self.track, "width", &format!("{}px", w));
    }

    fn activate(&self) {
        *self.mouse_over.borrow_mut() = true;
        let mut s = self.state.borrow_mut();
        match *s {
            AnimState::Idle | AnimState::ScrollHover => {
                *s = AnimState::Active;
                drop(s);
                self.set_width(WIDTH_ACTIVE);
            }
            _ => {}
        }
    }

    fn deactivate(&self) {
        *self.mouse_over.borrow_mut() = false;
        let mut s = self.state.borrow_mut();
        if *s == AnimState::Active {
            *s = AnimState::Idle;
            drop(s);
            self.set_width(WIDTH_IDLE);
        }
    }

    fn start_drag(&self) {
        *self.state.borrow_mut() = AnimState::Dragging;
        self.set_width(WIDTH_ACTIVE);
    }

    fn end_drag(&self) {
        *self.state.borrow_mut() = AnimState::Idle;
        self.set_width(WIDTH_IDLE);
    }

    fn pulse_scroll_hover(&self) {
        if *self.state.borrow() == AnimState::Dragging {
            return;
        }
        *self.state.borrow_mut() = AnimState::ScrollHover;
        self.set_width(WIDTH_ACTIVE);
    }

    fn restore_after_scroll_hover(&self) {
        let over = *self.mouse_over.borrow();
        let new = if over { AnimState::Active } else { AnimState::Idle };
        *self.state.borrow_mut() = new;
        if !over {
            self.set_width(WIDTH_IDLE);
        }
    }
}

impl Clone for Animator {
    fn clone(&self) -> Self {
        Self {
            state: self.state.clone(),
            track: self.track,
            mouse_over: self.mouse_over.clone(),
        }
    }
}

// ---------------------------------------------------------------------------
// Thumb position update
// ---------------------------------------------------------------------------

fn update_thumb(content: DomHandle, track: DomHandle, thumb: DomHandle) {
    let st = dom_ops::get_scroll_top(content);
    let sh = dom_ops::get_scroll_height(content) as f64;
    let ch = dom_ops::get_client_height(content) as f64;
    let th = dom_ops::get_client_height(track) as f64;

    let ideal = if sh > ch { (ch / sh) * ch } else { 0.0 };
    dom_ops::set_style(thumb, "height", &format!("{}px", ideal));

    let actual = dom_ops::get_client_height(thumb) as f64;
    let movable = th - actual;
    let max = sh - ch;
    let top = if max > 0.0 && movable > 0.0 { (st / max) * movable } else { 0.0 };
    dom_ops::set_style(thumb, "top", &format!("{}px", top));

    if ideal > 0.0 && ideal < ch {
        dom_ops::class_list_remove(track, &["custom-scrollbar-hidden"]);
    } else {
        dom_ops::class_list_add(track, &["custom-scrollbar-hidden"]);
    }
}

fn update_thumb_cached(content: DomHandle, track: DomHandle, thumb: DomHandle, cached_h: f64) {
    let st = dom_ops::get_scroll_top(content);
    let sh = dom_ops::get_scroll_height(content) as f64;
    let ch = dom_ops::get_client_height(content) as f64;
    let th = dom_ops::get_client_height(track) as f64;

    let movable = th - cached_h;
    let max = sh - ch;
    let top = if max > 0.0 && movable > 0.0 { (st / max) * movable } else { 0.0 };
    dom_ops::set_style(thumb, "top", &format!("{}px", top));

    if cached_h > 0.0 && cached_h < ch {
        dom_ops::class_list_remove(track, &["custom-scrollbar-hidden"]);
    } else {
        dom_ops::class_list_add(track, &["custom-scrollbar-hidden"]);
    }
}

// ---------------------------------------------------------------------------
// DOM structure
// ---------------------------------------------------------------------------

struct ScrollbarElements {
    content: DomHandle,
    track: DomHandle,
    thumb: DomHandle,
}

fn build_dom(container: DomHandle, saved_scroll: i32) -> Option<ScrollbarElements> {
    dom_ops::class_list_add(container, &["custom-scrollbar-container"]);
    dom_ops::set_style(container, "position", "relative");
    dom_ops::set_style(container, "overflow", "hidden");

    let wrapper = dom_ops::create_element("div");
    dom_ops::class_list_add(wrapper, &["custom-scrollbar-wrapper"]);
    dom_ops::set_attribute(wrapper, "data-custom-scrollbar", "wrapper");
    for (k, v) in [("display", "flex"), ("flex-direction", "row"), ("width", "100%"), ("height", "100%")] {
        dom_ops::set_style(wrapper, k, v);
    }

    let content = dom_ops::create_element("div");
    dom_ops::class_list_add(content, &["custom-scrollbar-content"]);
    dom_ops::set_attribute(content, "data-custom-scrollbar", "content");
    for (k, v) in [("display", "flex"), ("flex-direction", "column"), ("flex", "1"), ("min-width", "0"), ("overflow-y", "auto"), ("overflow-x", "hidden")] {
        dom_ops::set_style(content, k, v);
    }

    while let Some(child) = dom_ops::first_child(container) {
        dom_ops::append_child(content, child);
    }

    let track = dom_ops::create_element("div");
    dom_ops::class_list_add(track, &["custom-scrollbar-track"]);
    dom_ops::set_attribute(track, "data-custom-scrollbar", "track");
    for (k, v) in [("position", "absolute"), ("top", "0"), ("right", "0"), ("bottom", "0"), ("width", "4px")] {
        dom_ops::set_style(track, k, v);
    }

    let thumb = dom_ops::create_element("div");
    dom_ops::class_list_add(thumb, &["custom-scrollbar-thumb"]);
    dom_ops::set_attribute(thumb, "data-custom-scrollbar", "thumb");
    dom_ops::set_attribute(thumb, "tabindex", "0");

    dom_ops::append_child(track, thumb);
    dom_ops::append_child(wrapper, content);
    dom_ops::append_child(wrapper, track);
    dom_ops::append_child(container, wrapper);

    if saved_scroll > 0 {
        dom_ops::set_scroll_top(content, saved_scroll as f64);
    }

    Some(ScrollbarElements { content, track, thumb })
}

// ---------------------------------------------------------------------------
// Per-container setup
// ---------------------------------------------------------------------------

struct DragState {
    start_y: f64,
    start_scroll_top: f64,
    thumb_h: f64,
    movable: f64,
}

fn setup_one(host: &dyn ScrollbarHost, container: DomHandle) {
    if dom_ops::class_list_contains(container, "custom-scrollbar-container") {
        if dom_ops::query_selector_on(container, ".custom-scrollbar-wrapper").is_some() {
            return;
        }
        cleanup(container);
    }

    let saved = save_scroll(container);
    let els = match build_dom(container, saved) {
        Some(e) => e,
        None => return,
    };
    let content = els.content;
    let track = els.track;
    let thumb = els.thumb;

    let animator = Animator::new(track);
    let cached_h: Rc<RefCell<Option<f64>>> = Rc::new(RefCell::new(None));
    let ratio: Rc<RefCell<f64>> = Rc::new(RefCell::new(0.0));

    update_thumb(content, track, thumb);

    // -- scroll --
    let s_anim = animator.clone();
    let s_cached = cached_h.clone();
    let s_ratio = ratio.clone();

    host.on_scroll(content, Box::new(move || {
        let st = dom_ops::get_scroll_top(content);
        let sh = dom_ops::get_scroll_height(content) as f64;
        let ch = dom_ops::get_client_height(content) as f64;
        *s_ratio.borrow_mut() = (st / (sh - ch).max(1.0)).clamp(0.0, 1.0);

        s_anim.pulse_scroll_hover();
        match *s_cached.borrow() {
            Some(h) => update_thumb_cached(content, track, thumb, h),
            None => update_thumb(content, track, thumb),
        }
    }));

    // -- resize observer --
    let r_ratio = ratio.clone();
    host.on_resize(content, Box::new(move || {
        let pct = *r_ratio.borrow();
        update_thumb(content, track, thumb);
        if pct > 0.01 {
            let sh = dom_ops::get_scroll_height(content) as f64;
            let ch = dom_ops::get_client_height(content) as f64;
            let max = (sh - ch).max(0.0);
            if max > 1.0 {
                dom_ops::set_scroll_top(content, (pct * max).round());
                update_thumb(content, track, thumb);
            }
        }
    }));

    // -- track hover --
    let enter_a = animator.clone();
    host.on_mouse_enter(track, Box::new(move || enter_a.activate()));
    let leave_a = animator.clone();
    host.on_mouse_leave(track, Box::new(move || leave_a.deactivate()));

    // -- track click --
    let clk_content = content;
    host.on_click(track, Box::new(move |client_y| {
        let tr = dom_ops::get_bounding_client_rect(track);
        let cy = client_y - tr.y;
        let th_el = dom_ops::query_selector_on(track, ".custom-scrollbar-thumb");
        let th_h = th_el.map(|e| dom_ops::get_client_height(e) as f64).unwrap_or(20.0);
        let sh = dom_ops::get_scroll_height(clk_content) as f64;
        let ch = dom_ops::get_client_height(clk_content) as f64;
        let max = (sh - ch).max(0.0);
        let r = ((cy - th_h / 8.0) / tr.height).clamp(0.0, 1.0);
        dom_ops::set_scroll_top(clk_content, r * max);
    }));

    // -- drag --
    let d_anim = animator.clone();
    let d_cached = cached_h.clone();
    let drag_st: Rc<RefCell<Option<DragState>>> = Rc::new(RefCell::new(None));

    let ds0 = drag_st.clone();
    let da0 = d_anim.clone();
    let dc0 = d_cached.clone();
    let on_down: Rc<RefCell<dyn FnMut(f64)>> = Rc::new(RefCell::new(move |start_y: f64| {
        let start_scroll = dom_ops::get_scroll_top(content);
        let thumb_h = dom_ops::get_client_height(thumb) as f64;
        let track_h = dom_ops::get_client_height(track) as f64;
        *ds0.borrow_mut() = Some(DragState {
            start_y,
            start_scroll_top: start_scroll,
            thumb_h,
            movable: track_h - thumb_h,
        });
        da0.start_drag();
        *dc0.borrow_mut() = Some(thumb_h);
    }));

    let ds1 = drag_st.clone();
    let on_move: Rc<RefCell<dyn FnMut(f64)>> = Rc::new(RefCell::new(move |current_y: f64| {
        if let Some(ds) = ds1.borrow().as_ref() {
            let dy = current_y - ds.start_y;
            let sh = dom_ops::get_scroll_height(content) as f64;
            let ch = dom_ops::get_client_height(content) as f64;
            let max = sh - ch;
            let delta = if ds.movable > 0.0 { (dy / ds.movable) * max } else { 0.0 };
            dom_ops::set_scroll_top(content, (ds.start_scroll_top + delta).clamp(0.0, max));
        }
    }));

    let ds2 = drag_st.clone();
    let da2 = d_anim;
    let dc2 = d_cached;
    let on_end: Rc<RefCell<dyn FnMut()>> = Rc::new(RefCell::new(move || {
        *ds2.borrow_mut() = None;
        da2.end_drag();
        *dc2.borrow_mut() = None;
    }));

    host.setup_drag(thumb, on_down, on_move, on_end);
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

fn save_scroll(container: DomHandle) -> i32 {
    dom_ops::query_selector_on(container, ".custom-scrollbar-content")
        .map(|c| dom_ops::get_scroll_top(c) as i32)
        .unwrap_or(0)
}

fn cleanup(container: DomHandle) {
    dom_ops::class_list_remove(container, &["custom-scrollbar-container"]);
    // Move children back from content layer
    if let Some(wrapper) = dom_ops::query_selector_on(container, ".custom-scrollbar-wrapper") {
        if let Some(content) = dom_ops::query_selector_on(wrapper, ".custom-scrollbar-content") {
            while let Some(child) = dom_ops::first_child(content) {
                dom_ops::append_child(container, child);
            }
        }
        dom_ops::remove_child(container, wrapper);
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Initialize custom scrollbars for all known Hikari scrollable containers.
pub fn init_all(host: &dyn ScrollbarHost) {
    for &sel in SELECTORS {
        for el in host.query_all(sel) {
            setup_one(host, el);
        }
    }
    host.on_body_mutation(Box::new(move || {
        // Host implementation should re-scan selectors on mutation.
    }));
}

/// Initialize a custom scrollbar for a single container.
pub fn init_element(host: &dyn ScrollbarHost, container: DomHandle) {
    setup_one(host, container);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anim_transitions() {
        let a = Animator::new(DomHandle::null());
        assert_eq!(*a.state.borrow(), AnimState::Idle);
        a.activate();
        assert_eq!(*a.state.borrow(), AnimState::Active);
        a.deactivate();
        assert_eq!(*a.state.borrow(), AnimState::Idle);
        a.start_drag();
        assert_eq!(*a.state.borrow(), AnimState::Dragging);
        a.deactivate();
        assert_eq!(*a.state.borrow(), AnimState::Dragging);
        a.end_drag();
        assert_eq!(*a.state.borrow(), AnimState::Idle);
    }

    #[test]
    fn scroll_hover_vs_dragging() {
        let a = Animator::new(DomHandle::null());
        a.start_drag();
        a.pulse_scroll_hover();
        assert_eq!(*a.state.borrow(), AnimState::Dragging);
    }

    #[test]
    fn restore_scroll_hover() {
        let a = Animator::new(DomHandle::null());
        a.pulse_scroll_hover();
        assert_eq!(*a.state.borrow(), AnimState::ScrollHover);
        a.restore_after_scroll_hover();
        assert_eq!(*a.state.borrow(), AnimState::Idle);

        a.activate();
        a.pulse_scroll_hover();
        a.restore_after_scroll_hover();
        assert_eq!(*a.state.borrow(), AnimState::Active);
    }

    #[test]
    fn clone_shares_state() {
        let a = Animator::new(DomHandle::from_raw(42));
        let c = a.clone();
        a.activate();
        assert_eq!(*c.state.borrow(), AnimState::Active);
    }

    #[test]
    fn selectors_non_empty() {
        assert!(!SELECTORS.is_empty());
    }
}
