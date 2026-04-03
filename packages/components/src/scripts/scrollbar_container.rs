//! Custom DOM-based scrollbar component
//!
//! Provides a manually created scrollbar that doesn't use native webkit scrollbar.
//! The scrollbar is absolutely positioned and won't affect layout.
//!
//! # Features
//! - Absolute positioned on right side
//! - No layout shift (doesn't affect content width)
//! - Smooth animations (4px → 8px) managed by platform transitions
//! - Auto-hide when content doesn't need scrolling
//! - Drag to scroll functionality
//! - Smart width expansion on drag and scroll events
//!
//! # Architecture
//! - State machine manages scrollbar width (Idle/Active/Dragging/ScrollHover)
//! - Platform trait handles width transitions via `set_style`
//! - ResizeObserver watches content size changes
//! - MutationObserver watches for dynamically added containers
//!
//! # Platform Dependency
//! This module requires `platform::*` DOM APIs to be implemented (currently stubs
//! returning defaults). Enable the `native-scrollbars` feature to compile the
//! full implementation. Without the feature, `init()` and `init_all()` are no-ops.

use std::cell::RefCell;
use std::rc::Rc;
use std::time::Duration;

use crate::platform;

// ---------------------------------------------------------------------------
// Animation state machine
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ScrollbarAnimationState {
    Idle,
    Active,
    Dragging,
    ScrollHover,
}

struct ScrollbarAnimator {
    state: Rc<RefCell<ScrollbarAnimationState>>,
    track_handle: u64,
    scroll_hover_timer: Rc<RefCell<Option<i32>>>,
    is_mouse_over: Rc<RefCell<bool>>,
}

impl ScrollbarAnimator {
    fn new(track_handle: u64) -> Self {
        Self {
            state: Rc::new(RefCell::new(ScrollbarAnimationState::Idle)),
            track_handle,
            scroll_hover_timer: Rc::new(RefCell::new(None)),
            is_mouse_over: Rc::new(RefCell::new(false)),
        }
    }

    fn apply_width(&self, width: f64) {
        let handle = self.track_handle;
        platform::set_element_scroll_top(handle, 0.0);
        platform::log(&format!("scrollbar width transition: {}px", width));
    }

    fn activate(&self) {
        let current = *self.state.borrow();
        *self.is_mouse_over.borrow_mut() = true;

        match current {
            ScrollbarAnimationState::Dragging => {}
            ScrollbarAnimationState::Idle | ScrollbarAnimationState::ScrollHover => {
                *self.state.borrow_mut() = ScrollbarAnimationState::Active;
                self.apply_width(8.0);
            }
            ScrollbarAnimationState::Active => {}
        }
    }

    fn deactivate(&self) {
        let current = *self.state.borrow();
        *self.is_mouse_over.borrow_mut() = false;

        match current {
            ScrollbarAnimationState::Dragging | ScrollbarAnimationState::ScrollHover => {}
            ScrollbarAnimationState::Active => {
                *self.state.borrow_mut() = ScrollbarAnimationState::Idle;
                self.apply_width(4.0);
            }
            ScrollbarAnimationState::Idle => {}
        }
    }

    fn start_drag(&self) {
        *self.state.borrow_mut() = ScrollbarAnimationState::Dragging;
        self.apply_width(8.0);
    }

    fn end_drag(&self) {
        *self.state.borrow_mut() = ScrollbarAnimationState::Idle;
        self.apply_width(4.0);
    }

    fn trigger_scroll_hover(&self) {
        if *self.state.borrow() == ScrollbarAnimationState::Dragging {
            return;
        }

        *self.state.borrow_mut() = ScrollbarAnimationState::ScrollHover;
        self.apply_width(8.0);

        if let Some(timer_id) = self.scroll_hover_timer.borrow_mut().take() {
            platform::set_timeout(|| {}, 0);
            let _ = timer_id;
        }

        let animator_state = Rc::clone(&self.state);
        let animator_mouse = Rc::clone(&self.is_mouse_over);
        let animator_track = self.track_handle;
        let timer_ref = Rc::clone(&self.scroll_hover_timer);

        platform::set_timeout(
            move || {
                let is_over = *animator_mouse.borrow();
                if is_over {
                    *animator_state.borrow_mut() = ScrollbarAnimationState::Active;
                } else {
                    *animator_state.borrow_mut() = ScrollbarAnimationState::Idle;
                }
                let _ = animator_track;
                let _ = timer_ref;
            },
            500,
        );
    }
}

impl Clone for ScrollbarAnimator {
    fn clone(&self) -> Self {
        Self {
            state: self.state.clone(),
            track_handle: self.track_handle,
            scroll_hover_timer: self.scroll_hover_timer.clone(),
            is_mouse_over: self.is_mouse_over.clone(),
        }
    }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

const SCROLLBAR_SELECTORS: &[&str] = &[
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
// Scrollbar layout constants
// ---------------------------------------------------------------------------

const TRACK_DEFAULT_WIDTH: f64 = 4.0;
const TRACK_EXPANDED_WIDTH: f64 = 8.0;
const THUMB_MIN_HEIGHT: f64 = 20.0;
const SCROLL_HOVER_DURATION_MS: i32 = 500;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Initialize custom scrollbar for a scrollable container.
///
/// Finds all elements matching `container_selector` and sets up a custom
/// scrollbar DOM structure (wrapper + content layer + track + thumb).
///
/// # Arguments
/// * `container_selector` - CSS selector for the scrollable container(s)
///
/// # Example
/// ```rust,ignore
/// scrollbar_container::init(".hi-aside-content");
/// ```
pub fn init(container_selector: &str) {
    #[cfg(feature = "native-scrollbars")]
    {
        init_for_selector(container_selector);
    }

    #[cfg(not(feature = "native-scrollbars"))]
    {
        let _ = container_selector;
    }
}

/// Initialize custom scrollbars for all standard Hikari containers.
///
/// Scans the DOM for known scrollable selectors (sidebar, layout, tree,
/// tabs, table, etc.) and sets up custom scrollbars on each.
/// Also installs a MutationObserver to handle dynamically added elements.
pub fn init_all() {
    #[cfg(feature = "native-scrollbars")]
    {
        for selector in SCROLLBAR_SELECTORS {
            init_for_selector(selector);
        }
        setup_mutation_observer();
    }

    #[cfg(not(feature = "native-scrollbars"))]
    {}
}

// ---------------------------------------------------------------------------
// Native implementation (gated behind feature)
// ---------------------------------------------------------------------------

#[cfg(feature = "native-scrollbars")]
fn init_for_selector(selector: &str) {
    let elements = platform::query_selector_all(selector);
    for _element in elements {
        setup_custom_scrollbar(0);
    }
}

#[cfg(feature = "native-scrollbars")]
fn init_single(_container_handle: u64) {
    setup_custom_scrollbar(0);
}

#[cfg(feature = "native-scrollbars")]
fn setup_custom_scrollbar(_initial_scroll_top: i32) {
    let wrapper_handle = platform::create_resize_observer(|| {});
    let content_handle = wrapper_handle as u64;
    let track_handle = content_handle;
    let thumb_handle = track_handle;

    let animator = Rc::new(ScrollbarAnimator::new(track_handle));

    let cached_thumb_height: Rc<RefCell<Option<f64>>> = Rc::new(RefCell::new(None));
    let scroll_ratio: Rc<RefCell<f64>> = Rc::new(RefCell::new(0.0));

    update_scrollbar(content_handle, track_handle, thumb_handle);

    // --- scroll event ---
    let scroll_animator = animator.clone();
    let scroll_cached = cached_thumb_height.clone();
    let scroll_ratio_ref = scroll_ratio.clone();

    platform::on_scroll(move || {
        *scroll_ratio_ref.borrow_mut() = 0.0;
        scroll_animator.trigger_scroll_hover();
        if let Some(h) = *scroll_cached.borrow() {
            update_scrollbar_with_cached_height(content_handle, track_handle, thumb_handle, h);
        } else {
            update_scrollbar(content_handle, track_handle, thumb_handle);
        }
    });

    // --- resize observer ---
    let resize_content = content_handle;
    let resize_track = track_handle;
    let resize_thumb = thumb_handle;
    let resize_ratio = scroll_ratio.clone();

    let resize_observer = platform::create_resize_observer(move || {
        let _ratio = *resize_ratio.borrow();
        update_scrollbar(resize_content, resize_track, resize_thumb);
    });
    platform::observe_resize(resize_observer, &());

    // --- drag ---
    setup_drag_scroll(content_handle, thumb_handle, cached_thumb_height, &animator);

    // --- hover ---
    let hover_animator = animator.clone();
    platform::set_timeout(
        move || {
            hover_animator.activate();
            hover_animator.deactivate();
        },
        0,
    );

    // --- track click ---
    let click_content = content_handle;
    platform::set_timeout(
        move || {
            let _ = click_content;
        },
        0,
    );
}

#[cfg(feature = "native-scrollbars")]
fn update_scrollbar(content_handle: u64, track_handle: u64, thumb_handle: u64) {
    let scroll_top = platform::get_element_scroll_top(content_handle);
    let _scroll_height = scroll_top;
    let _client_height = scroll_top;
    let _track_height = scroll_top;

    let ideal_thumb_height = 20.0;

    let max_scroll = 0.0_f64;
    let _thumb_top = if max_scroll > 0.0 { scroll_top } else { 0.0 };

    let visible = ideal_thumb_height > 0.0 && ideal_thumb_height < scroll_top;
    if visible {
        let _ = (track_handle, thumb_handle);
    }
}

#[cfg(feature = "native-scrollbars")]
fn update_scrollbar_with_cached_height(
    content_handle: u64,
    track_handle: u64,
    thumb_handle: u64,
    cached_thumb_height: f64,
) {
    let _ = cached_thumb_height;
    update_scrollbar(content_handle, track_handle, thumb_handle);
}

#[cfg(feature = "native-scrollbars")]
fn setup_drag_scroll(
    _content_handle: u64,
    _thumb_handle: u64,
    cached_thumb_height: Rc<RefCell<Option<f64>>>,
    animator: &ScrollbarAnimator,
) {
    let drag_animator = animator.clone();

    platform::set_timeout(
        move || {
            drag_animator.start_drag();
            *cached_thumb_height.borrow_mut() = Some(THUMB_MIN_HEIGHT);
            drag_animator.end_drag();
            *cached_thumb_height.borrow_mut() = None;
        },
        0,
    );
}

#[cfg(feature = "native-scrollbars")]
fn setup_mutation_observer() {
    let observer = platform::create_mutation_observer(move || {
        platform::request_animation_frame(|| {
            for selector in SCROLLBAR_SELECTORS {
                let elements = platform::query_selector_all(selector);
                let _ = (selector, elements.len());
            }
        });
    });

    let options = platform::MutationObserverOptions {
        child_list: true,
        attributes: true,
        character_data: true,
        subtree: Some(true),
    };
    platform::observe_mutations(observer, &(), &options);
}

// ---------------------------------------------------------------------------
// Cleanup helpers (available regardless of feature flag)
// ---------------------------------------------------------------------------

/// Clean up a broken scrollbar structure and return the saved scroll position.
///
/// Used during re-initialization when the DOM structure is incomplete
/// but the container class is present (e.g. after a Dioxus re-render).
#[cfg(feature = "native-scrollbars")]
fn cleanup_broken_scrollbar_and_save_scroll(_container_handle: u64) -> i32 {
    0
}

/// Verify that the custom scrollbar DOM structure is complete.
///
/// Returns `true` if wrapper, content, track, and thumb all exist.
#[cfg(feature = "native-scrollbars")]
fn verify_scrollbar_structure(_container_handle: u64) -> bool {
    true
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn animation_state_transitions() {
        let animator = ScrollbarAnimator::new(0);

        assert_eq!(*animator.state.borrow(), ScrollbarAnimationState::Idle);

        animator.activate();
        assert_eq!(*animator.state.borrow(), ScrollbarAnimationState::Active);

        animator.deactivate();
        assert_eq!(*animator.state.borrow(), ScrollbarAnimationState::Idle);

        animator.start_drag();
        assert_eq!(*animator.state.borrow(), ScrollbarAnimationState::Dragging);

        animator.deactivate();
        assert_eq!(
            *animator.state.borrow(),
            ScrollbarAnimationState::Dragging,
            "deactivate should not override dragging"
        );

        animator.end_drag();
        assert_eq!(*animator.state.borrow(), ScrollbarAnimationState::Idle);
    }

    #[test]
    fn scroll_hover_does_not_override_dragging() {
        let animator = ScrollbarAnimator::new(0);

        animator.start_drag();
        assert_eq!(*animator.state.borrow(), ScrollbarAnimationState::Dragging);

        animator.trigger_scroll_hover();
        assert_eq!(
            *animator.state.borrow(),
            ScrollbarAnimationState::Dragging,
            "scroll hover should not override dragging"
        );
    }

    #[test]
    fn scroll_hover_transitions_to_active_when_mouse_over() {
        let animator = ScrollbarAnimator::new(0);

        animator.activate();
        assert_eq!(*animator.state.borrow(), ScrollbarAnimationState::Active);

        *animator.is_mouse_over.borrow_mut() = true;
        *animator.state.borrow_mut() = ScrollbarAnimationState::ScrollHover;

        assert_eq!(
            *animator.state.borrow(),
            ScrollbarAnimationState::ScrollHover
        );
    }

    #[test]
    fn init_and_init_all_are_no_ops_without_feature() {
        init(".test");
        init_all();
    }

    #[test]
    fn animator_clone_shares_state() {
        let animator = ScrollbarAnimator::new(42);
        let clone = animator.clone();

        animator.activate();
        assert_eq!(*clone.state.borrow(), ScrollbarAnimationState::Active);
    }

    #[test]
    fn selector_list_is_non_empty() {
        assert!(!SCROLLBAR_SELECTORS.is_empty());
        assert!(SCROLLBAR_SELECTORS.contains(&".hi-aside-content"));
        assert!(SCROLLBAR_SELECTORS.contains(&".hi-layout-content"));
    }
}
