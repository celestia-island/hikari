//! Custom DOM-based scrollbar component
//!
//! Provides a manually created scrollbar that doesn't use native webkit scrollbar.
//! The scrollbar is absolutely positioned and won't affect layout.
//!
//! # Features
//! - Absolute positioned on the right side
//! - No layout shift (doesn't affect content width)
//! - Smooth animations (6px → 10px) managed by state machine
//! - Auto-hide when content doesn't need scrolling
//! - Drag to scroll functionality
//! - Smart width expansion on drag and scroll events
//!
//! # Animation Architecture
//! - State machine manages scrollbar width (Idle/Active/Dragging/ScrollHover)
//! - hikari-animation's TimerManager handles delayed state transitions
//! - requestAnimationFrame drives smooth width transitions
//! - Callback-based style updates ensure responsive feedback

use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use std::rc::Rc;
use std::cell::RefCell;
use js_sys::Date;
use hikari_animation::TimerManager;
use hikari_animation::style::{CssProperty, StyleBuilder};

/// Animation state for scrollbar width transition
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ScrollbarAnimationState {
    /// Scrollbar at normal width (6px)
    Idle,
    /// Scrollbar at expanded width (10px) - mouse hover
    Active,
    /// Scrollbar at expanded width (10px) - currently dragging
    Dragging,
    /// Scrollbar at expanded width (10px) - temporarily expanded after scroll
    ScrollHover,
}

impl ScrollbarAnimationState {
    /// Returns the target width for this state
    fn target_width(&self) -> f64 {
        match self {
            ScrollbarAnimationState::Idle => 6.0,
            ScrollbarAnimationState::Active => 10.0,
            ScrollbarAnimationState::Dragging => 10.0,
            ScrollbarAnimationState::ScrollHover => 10.0,
        }
    }
}

/// Animation controller for scrollbar width transitions
///
/// Manages state and animation lifecycle for hover effects.
/// Inspired by hikari-animation's state machine pattern.
struct ScrollbarAnimator {
    state: RefCell<ScrollbarAnimationState>,
    track: web_sys::Element,
    animation_handle: RefCell<Option<i32>>,  // requestAnimationFrame handle
    start_time: RefCell<Option<f64>>,  // Animation start time
    start_width: RefCell<f64>,  // Starting width
    target_width: RefCell<f64>,  // Target width
    timer_manager: TimerManager,  // For delayed state transitions
    scroll_hover_timer: RefCell<Option<hikari_animation::TimerId>>,  // Scroll hover timer
    is_mouse_over: RefCell<bool>,  // Track mouse position for drag end logic
}

impl ScrollbarAnimator {
    /// Create a new animator for the given track element
    fn new(track: web_sys::Element) -> Self {
        Self {
            state: RefCell::new(ScrollbarAnimationState::Idle),
            track,
            animation_handle: RefCell::new(None),
            start_time: RefCell::new(None),
            start_width: RefCell::new(6.0),
            target_width: RefCell::new(6.0),
            timer_manager: TimerManager::new(),
            scroll_hover_timer: RefCell::new(None),
            is_mouse_over: RefCell::new(false),
        }
    }

    /// Transition to active (hover) state
    fn activate(&self) {
        let current_state = *self.state.borrow();
        *self.is_mouse_over.borrow_mut() = true;

        match current_state {
            // Don't override dragging state
            ScrollbarAnimationState::Dragging => {}
            // For Idle and ScrollHover, transition to Active
            ScrollbarAnimationState::Idle | ScrollbarAnimationState::ScrollHover => {
                *self.state.borrow_mut() = ScrollbarAnimationState::Active;
                self.start_animation(10.0);
            }
            // Already active, nothing to do
            ScrollbarAnimationState::Active => {}
        }
    }

    /// Transition to idle (normal) state
    fn deactivate(&self) {
        let current_state = *self.state.borrow();
        *self.is_mouse_over.borrow_mut() = false;

        match current_state {
            // Don't change if dragging or in scroll hover
            ScrollbarAnimationState::Dragging | ScrollbarAnimationState::ScrollHover => {}
            // Active -> Idle
            ScrollbarAnimationState::Active => {
                *self.state.borrow_mut() = ScrollbarAnimationState::Idle;
                self.start_animation(6.0);
            }
            // Already idle, nothing to do
            ScrollbarAnimationState::Idle => {}
        }
    }

    /// Transition to dragging state
    fn start_drag(&self) {
        *self.state.borrow_mut() = ScrollbarAnimationState::Dragging;
        self.start_animation(10.0);
    }

    /// End dragging - check mouse position to determine next state
    fn end_drag(&self) {
        let is_over = *self.is_mouse_over.borrow();
        if is_over {
            *self.state.borrow_mut() = ScrollbarAnimationState::Active;
        } else {
            *self.state.borrow_mut() = ScrollbarAnimationState::Idle;
            self.start_animation(6.0);
        }
    }

    /// Trigger scroll hover state (expands for 500ms then returns to previous state)
    fn trigger_scroll_hover(&self) {
        let current_state = *self.state.borrow();

        // Don't override dragging state
        if current_state == ScrollbarAnimationState::Dragging {
            return;
        }

        // Transition to ScrollHover
        *self.state.borrow_mut() = ScrollbarAnimationState::ScrollHover;
        self.start_animation(10.0);

        // Cancel existing scroll hover timer
        if let Some(timer_id) = self.scroll_hover_timer.borrow_mut().take() {
            self.timer_manager.clear_timeout(timer_id);
        }

        // Set new timer to restore previous state
        let animator = self.clone();
        let callback = Rc::new(move || {
            animator.restore_from_scroll_hover();
        });

        let timer_id = self.timer_manager.set_timeout(
            callback,
            std::time::Duration::from_millis(500),
        );
        *self.scroll_hover_timer.borrow_mut() = Some(timer_id);
    }

    /// Restore state after scroll hover timer expires
    fn restore_from_scroll_hover(&self) {
        let is_over = *self.is_mouse_over.borrow();
        if is_over {
            *self.state.borrow_mut() = ScrollbarAnimationState::Active;
        } else {
            *self.state.borrow_mut() = ScrollbarAnimationState::Idle;
            self.start_animation(6.0);
        }
    }

    /// Start animation to target width using custom easing
    fn start_animation(&self, target: f64) {
        // Get current width from computed style
        let current_width = self.get_current_width();
        *self.start_width.borrow_mut() = current_width;
        *self.target_width.borrow_mut() = target;

        // Record start time
        *self.start_time.borrow_mut() = Some(Date::now());

        // Cancel any existing animation frame
        let window = match web_sys::window() {
            Some(w) => w,
            None => return,
        };
        if let Some(handle) = self.animation_handle.borrow_mut().take() {
            let _ = window.cancel_animation_frame(handle);
        }

        // Start new animation
        let animator_ref = self.clone();
        let closure = Closure::wrap(Box::new(move || {
            animator_ref.animate_step();
        }) as Box<dyn FnMut()>);

        let handle = window.request_animation_frame(closure.as_ref().unchecked_ref());
        if let Ok(handle) = handle {
            *self.animation_handle.borrow_mut() = Some(handle);
        }
        closure.forget();
    }

    /// Get current width from computed style
    fn get_current_width(&self) -> f64 {
        let window = match web_sys::window() {
            Some(w) => w,
            None => return 6.0,
        };
        let style = match window.get_computed_style(&self.track).ok().flatten() {
            Some(s) => s,
            None => return 6.0,
        };
        match style.get_property_value("width") {
            Ok(width) => {
                // Parse "6px" or "10px" to f64
                width.trim_end_matches("px").parse().unwrap_or(6.0)
            }
            Err(_) => 6.0,
        }
    }

    /// Animation step callback
    fn animate_step(&self) {
        let window = match web_sys::window() {
            Some(w) => w,
            None => return,
        };

        let start_time = match *self.start_time.borrow() {
            Some(t) => t,
            None => return,
        };

        const DURATION_MS: f64 = 300.0;  // Animation duration
        let elapsed = Date::now() - start_time;
        let progress = (elapsed / DURATION_MS).min(1.0);

        // Cubic ease out easing
        let eased: f64 = 1.0 - (1.0 - progress).powf(3.0);

        let start = *self.start_width.borrow();
        let target = *self.target_width.borrow();
        let current = start + (target - start) * eased;

        // Apply current width
        if let Some(el) = self.track.dyn_ref::<web_sys::HtmlElement>() {
            use hikari_animation::style::set_style;
            set_style(el, CssProperty::Width, &format!("{}px", current));
        }

        // Continue animation or stop
        if progress < 1.0 {
            let animator_ref = self.clone();
            let closure = Closure::wrap(Box::new(move || {
                animator_ref.animate_step();
            }) as Box<dyn FnMut()>);

            let handle = window.request_animation_frame(closure.as_ref().unchecked_ref());
            if let Ok(handle) = handle {
                *self.animation_handle.borrow_mut() = Some(handle);
            }
            closure.forget();
        } else {
            *self.animation_handle.borrow_mut() = None;
            *self.start_time.borrow_mut() = None;
        }
    }
}

// Implement Clone for ScrollbarAnimator
impl Clone for ScrollbarAnimator {
    fn clone(&self) -> Self {
        Self {
            state: self.state.clone(),
            track: self.track.clone(),
            animation_handle: self.animation_handle.clone(),
            start_time: self.start_time.clone(),
            start_width: self.start_width.clone(),
            target_width: self.target_width.clone(),
            timer_manager: self.timer_manager.clone(),
            scroll_hover_timer: self.scroll_hover_timer.clone(),
            is_mouse_over: self.is_mouse_over.clone(),
        }
    }
}

/// Initialize custom scrollbar for a scrollable container
///
/// # Arguments
/// * `container_selector` - CSS selector for the scrollable container
///
/// # Example
/// ```rust,ignore
/// scrollbar_container::init(".hi-aside-content");
/// ```
#[wasm_bindgen(js_name = initScrollbarContainer)]
pub fn init(container_selector: &str) {
    // Find all containers matching the selector
    let containers = match find_elements(container_selector) {
        Some(els) => els,
        None => return,
    };

    // Process each container
    for i in 0..containers.length() {
        if let Some(element) = containers.get(i) {
            if let Some(container) = element.dyn_ref::<web_sys::Element>() {
                setup_custom_scrollbar(container);
            }
        }
    }
}

/// Find elements by selector
fn find_elements(selector: &str) -> Option<web_sys::NodeList> {
    let window = web_sys::window()?;
    let document = window.document()?;
    document.query_selector_all(selector).ok()
}

/// Setup custom scrollbar for a single container
fn setup_custom_scrollbar(container: &web_sys::Element) {
    let window = match web_sys::window() {
        Some(w) => w,
        None => return,
    };
    let document = match window.document() {
        Some(d) => d,
        None => return,
    };

    // Mark container as using custom scrollbar
    let _ = container.class_list().add_1("custom-scrollbar-container");

    // IMPORTANT: Ensure container has position: relative
    let container_html = match container.dyn_ref::<web_sys::HtmlElement>() {
        Some(el) => el,
        None => return,
    };

    // Save and remove container's padding, will apply to content_layer later
    let window = match web_sys::window() {
        Some(w) => w,
        None => return,
    };
    let computed_style = match window.get_computed_style(&container).ok().flatten() {
        Some(s) => s,
        None => return,
    };

    let padding_top = computed_style.get_property_value("padding-top").unwrap_or_default();
    let padding_right = computed_style.get_property_value("padding-right").unwrap_or_default();
    let padding_bottom = computed_style.get_property_value("padding-bottom").unwrap_or_default();
    let padding_left = computed_style.get_property_value("padding-left").unwrap_or_default();

    // Set container position and remove padding
    StyleBuilder::new(container_html)
        .add(CssProperty::Position, "relative")
        .add(CssProperty::Padding, "0")
        .apply();

    // Create a wrapper layer (flex container for layout)
    let wrapper = match document.create_element("div") {
        Ok(el) => el,
        Err(_) => return,
    };
    let _ = wrapper.class_list().add_1("custom-scrollbar-wrapper");
    let _ = wrapper.set_attribute("data-custom-scrollbar", "wrapper");

    // Set wrapper to flex positioning, filling the entire container
    let wrapper_html = match wrapper.dyn_ref::<web_sys::HtmlElement>() {
        Some(el) => el,
        None => return,
    };
    StyleBuilder::new(wrapper_html)
        .add(CssProperty::Display, "flex")
        .add(CssProperty::FlexDirection, "row")
        .add(CssProperty::Width, "100%")
        .add(CssProperty::Height, "100%")
        .apply();

    // Create content layer (scrollable content)
    let content_layer = match document.create_element("div") {
        Ok(el) => el,
        Err(_) => return,
    };
    let _ = content_layer.class_list().add_1("custom-scrollbar-content");
    let _ = content_layer.set_attribute("data-custom-scrollbar", "content");

    // Set content layer to flex with overflow-y: auto
    let content_html = match content_layer.dyn_ref::<web_sys::HtmlElement>() {
        Some(el) => el,
        None => return,
    };
    StyleBuilder::new(content_html)
        .add(CssProperty::Display, "flex")
        .add(CssProperty::FlexDirection, "column")
        .add(CssProperty::Flex, "1")
        .add(CssProperty::MinWidth, "0") // Prevent flex overflow
        .add(CssProperty::OverflowY, "auto")
        .add(CssProperty::OverflowX, "hidden")
        .add(CssProperty::PaddingTop, &padding_top)
        .add(CssProperty::PaddingRight, &padding_right)
        .add(CssProperty::PaddingBottom, &padding_bottom)
        .add(CssProperty::PaddingLeft, &padding_left)
        .apply();

    // Move all children from container to content layer
    // Use while loop with first_child() to safely move all nodes
    while let Some(child) = container.first_child() {
        let _ = content_layer.append_child(&child);
    }

    // Create scrollbar track (absolute positioned, attached to container)
    let track = match document.create_element("div") {
        Ok(el) => el,
        Err(_) => return,
    };
    let _ = track.class_list().add_1("custom-scrollbar-track");
    let _ = track.set_attribute("data-custom-scrollbar", "track");

    // Set track to absolute positioning, attached to container's right edge
    let track_html = match track.dyn_ref::<web_sys::HtmlElement>() {
        Some(el) => el,
        None => return,
    };
    StyleBuilder::new(track_html)
        .add(CssProperty::Position, "absolute")
        .add(CssProperty::Top, "0")
        .add(CssProperty::Right, "0")
        .add(CssProperty::Bottom, "0")
        .add(CssProperty::Width, "6px")  // Initial width (animated by state machine)
        .apply();

    // Create animation controller for this track
    let animator = Rc::new(ScrollbarAnimator::new(track.clone()));
    let animator_for_events = animator.clone();

    // Create scrollbar thumb
    let thumb = match document.create_element("div") {
        Ok(el) => el,
        Err(_) => return,
    };
    let _ = thumb.class_list().add_1("custom-scrollbar-thumb");
    let _ = thumb.set_attribute("data-custom-scrollbar", "thumb");
    let _ = thumb.set_attribute("tabindex", "0"); // Make focusable

    // Append thumb to track
    let _ = track.append_child(&thumb);

    // Build DOM structure: container > wrapper > (content_layer, track)
    let _ = wrapper.append_child(&content_layer);
    let _ = wrapper.append_child(&track);
    let _ = container.append_child(&wrapper);

    // Clone for closures
    let wrapper_clone = wrapper.clone();
    let content_layer_clone = content_layer.clone();
    let track_clone = track.clone();
    let thumb_clone = thumb.clone();

    // Cached dimensions for drag operations (to prevent layout thrashing)
    let cached_thumb_height = std::rc::Rc::new(std::cell::RefCell::new(None::<f64>));

    // Initial update
    update_scrollbar(&content_layer_clone, &track_clone, &thumb_clone);

    // Watch scroll events (on content_layer, not container!)
    let content_layer_scroll = content_layer_clone.clone();
    let track_scroll = track_clone.clone();
    let thumb_scroll = thumb_clone.clone();
    let cached_thumb_height_scroll = cached_thumb_height.clone();
    let animator_scroll = animator.clone();

    let closure_scroll = Closure::wrap(Box::new(move || {
        // Trigger scroll hover effect (expand for 500ms)
        animator_scroll.trigger_scroll_hover();

        // Use cached thumb height if available (during drag), otherwise recalculate
        if let Some(height) = *cached_thumb_height_scroll.borrow() {
            update_scrollbar_with_cached_height(
                &content_layer_scroll,
                &track_scroll,
                &thumb_scroll,
                height,
            );
        } else {
            update_scrollbar(&content_layer_scroll, &track_scroll, &thumb_scroll);
        }
    }) as Box<dyn FnMut()>);

    let _ = content_layer.add_event_listener_with_callback(
        "scroll",
        closure_scroll.as_ref().unchecked_ref(),
    );
    closure_scroll.forget();

    // Watch resize events
    let content_layer_resize = content_layer_clone.clone();
    let track_resize = track_clone.clone();
    let thumb_resize = thumb_clone.clone();

    let closure_resize = Closure::wrap(Box::new(move || {
        update_scrollbar(&content_layer_resize, &track_resize, &thumb_resize);
    }) as Box<dyn FnMut()>);

    let _ = window.add_event_listener_with_callback(
        "resize",
        closure_resize.as_ref().unchecked_ref(),
    );
    closure_resize.forget();

    // Setup drag functionality
    setup_drag_scroll(&content_layer_clone, &thumb_clone, cached_thumb_height, &animator);

    // Setup hover animation using state machine
    let track_for_hover = track.clone();
    let closure_mouseenter = Closure::wrap(Box::new(move || {
        animator_for_events.activate();
    }) as Box<dyn FnMut()>);

    let _ = track.add_event_listener_with_callback(
        "mouseenter",
        closure_mouseenter.as_ref().unchecked_ref(),
    );
    closure_mouseenter.forget();

    let closure_mouseleave = Closure::wrap(Box::new(move || {
        animator.deactivate();
    }) as Box<dyn FnMut()>);

    let _ = track_for_hover.add_event_listener_with_callback(
        "mouseleave",
        closure_mouseleave.as_ref().unchecked_ref(),
    );
    closure_mouseleave.forget();
}

/// Update scrollbar position and size
fn update_scrollbar(
    content_layer: &web_sys::Element,
    track: &web_sys::Element,
    thumb: &web_sys::Element,
) {
    let scroll_top = content_layer.scroll_top() as f64;
    let scroll_height = content_layer.scroll_height() as f64;
    let client_height = content_layer.client_height() as f64;

    // Track height matches content layer height (controlled by flexbox)
    let track_height = track.client_height() as f64;

    // Calculate ideal thumb height based on content ratio
    let ideal_thumb_height = if scroll_height > client_height {
        (client_height / scroll_height) * client_height
    } else {
        0.0
    };

    // Update thumb height
    let thumb_style = match thumb.dyn_ref::<web_sys::HtmlElement>() {
        Some(el) => el.style(),
        None => return,
    };

    let _ = thumb_style.set_property("height", &format!("{}px", ideal_thumb_height));

    // Read actual thumb height from DOM (respects CSS min-height: 20px)
    let actual_thumb_height = thumb.client_height() as f64;

    // Calculate thumb position relative to track
    let thumb_movable_range = track_height - actual_thumb_height;

    let max_scroll = scroll_height - client_height;
    let thumb_top = if max_scroll > 0.0 && thumb_movable_range > 0.0 {
        (scroll_top / max_scroll) * thumb_movable_range
    } else {
        0.0
    };

    let _ = thumb_style.set_property("top", &format!("{}px", thumb_top));

    // Show/hide track based on whether scrolling is needed
    let track_class_list = track.class_list();
    if ideal_thumb_height < client_height && ideal_thumb_height > 0.0 {
        let _ = track_class_list.remove_1("custom-scrollbar-hidden");
    } else {
        let _ = track_class_list.add_1("custom-scrollbar-hidden");
    }
}

/// Update scrollbar position with cached thumb height (used during drag)
fn update_scrollbar_with_cached_height(
    content_layer: &web_sys::Element,
    track: &web_sys::Element,
    thumb: &web_sys::Element,
    cached_thumb_height: f64,
) {
    let scroll_top = content_layer.scroll_top() as f64;
    let scroll_height = content_layer.scroll_height() as f64;
    let client_height = content_layer.client_height() as f64;

    // Track height matches content layer height (controlled by flexbox)
    let track_height = track.client_height() as f64;

    // Calculate thumb position relative to track (using cached height)
    let thumb_movable_range = track_height - cached_thumb_height;

    let max_scroll = scroll_height - client_height;
    let thumb_top = if max_scroll > 0.0 && thumb_movable_range > 0.0 {
        (scroll_top / max_scroll) * thumb_movable_range
    } else {
        0.0
    };

    // Update thumb style (don't update height)
    let thumb_style = match thumb.dyn_ref::<web_sys::HtmlElement>() {
        Some(el) => el.style(),
        None => return,
    };

    let _ = thumb_style.set_property("top", &format!("{}px", thumb_top));

    // Show/hide track based on whether scrolling is needed
    let track_class_list = track.class_list();
    if cached_thumb_height < client_height && cached_thumb_height > 0.0 {
        let _ = track_class_list.remove_1("custom-scrollbar-hidden");
    } else {
        let _ = track_class_list.add_1("custom-scrollbar-hidden");
    }
}

/// Setup drag-to-scroll functionality
fn setup_drag_scroll(
    content_layer: &web_sys::Element,
    thumb: &web_sys::Element,
    cached_thumb_height: std::rc::Rc<std::cell::RefCell<Option<f64>>>,
    animator: &ScrollbarAnimator,
) {
    let content_layer_clone = content_layer.clone();
    let thumb_clone = thumb.clone();

    // Find the track element (parent of thumb)
    let track_element = match thumb.parent_node() {
        Some(node) => match node.dyn_ref::<web_sys::Element>() {
            Some(el) => Some(el.clone()),
            None => None,
        },
        None => None,
    };

    let track_element = match track_element {
        Some(el) => el,
        None => return,
    };

    // Mouse down on thumb
    let animator_drag = animator.clone();
    let closure_mousedown = Closure::wrap(Box::new(move |event: web_sys::MouseEvent| {
        event.prevent_default();
        event.stop_propagation();

        // Start dragging state
        animator_drag.start_drag();

        let start_y = event.client_y() as f64;
        let start_scroll_top = content_layer_clone.scroll_top() as f64;
        let content_layer_drag = content_layer_clone.clone();
        let thumb_drag = thumb_clone.clone();
        let track_drag = track_element.clone();

        // Read actual dimensions from DOM at start of drag
        // Track height equals visible area height
        let track_height = track_drag.client_height() as f64;
        let thumb_height = thumb_drag.client_height() as f64;

        // Cache thumb height
        *cached_thumb_height.borrow_mut() = Some(thumb_height);

        let cached_height_for_drag = cached_thumb_height.clone();

        // Calculate the movable range for thumb (relative to track)
        let thumb_movable_range = track_height - thumb_height;

        // Use Rc<RefCell<Option<...>>> to hold the handlers for cleanup
        let mousemove_holder: std::rc::Rc<std::cell::RefCell<Option<Closure<dyn FnMut(_)>>>> =
            std::rc::Rc::new(std::cell::RefCell::new(None));
        let mouseup_holder: std::rc::Rc<std::cell::RefCell<Option<Closure<dyn FnMut(_)>>>> =
            std::rc::Rc::new(std::cell::RefCell::new(None));

        let mousemove_holder_clone = mousemove_holder.clone();
        let mouseup_holder_clone = mouseup_holder.clone();

        // Clone for mouseup handler before moving into mousemove
        let cached_height_for_mouseup = cached_height_for_drag.clone();
        let animator_for_mouseup = animator_drag.clone();

        // Create mousemove handler
        let mousemove_handler = Closure::wrap(Box::new(move |event: web_sys::MouseEvent| {
            let current_y = event.client_y() as f64;
            let delta_y = current_y - start_y;

            // Calculate scroll delta
            // delta_y is mouse movement in pixels
            // thumb_movable_range is how many pixels the thumb can move
            // max_scroll is how many pixels the content can scroll
            let scroll_height = content_layer_drag.scroll_height() as f64;
            let client_height = content_layer_drag.client_height() as f64;
            let max_scroll = scroll_height - client_height;

            let scroll_delta = if thumb_movable_range > 0.0 {
                (delta_y / thumb_movable_range) * max_scroll
            } else {
                0.0
            };

            let new_scroll_top = start_scroll_top + scroll_delta;
            let clamped_scroll_top = new_scroll_top.max(0.0).min(max_scroll);

            // Update content_layer scroll position (scroll event will update thumb position)
            let _ = content_layer_drag.set_scroll_top(clamped_scroll_top as i32);
        }) as Box<dyn FnMut(_)>);

        let window = match web_sys::window() {
            Some(w) => w,
            None => {
                *cached_thumb_height.borrow_mut() = None;
                return;
            }
        };

        // Add mousemove listener
        let mousemove_js: &js_sys::Function = mousemove_handler.as_ref().unchecked_ref();
        let _ = window.add_event_listener_with_callback("mousemove", mousemove_js);

        // Store mousemove handler for later cleanup
        *mousemove_holder_clone.borrow_mut() = Some(mousemove_handler);

        // Create mouseup handler that will clean up
        let window_for_mouseup = window.clone();
        let mouseup_handler = Closure::wrap(Box::new(move |_event: web_sys::MouseEvent| {
            // End dragging state
            animator_for_mouseup.end_drag();

            // Clear cached thumb height (re-enable normal updates)
            *cached_height_for_mouseup.borrow_mut() = None;

            // Remove mousemove listener
            if let Some(mousemove) = mousemove_holder_clone.borrow_mut().take() {
                let mousemove_js: &js_sys::Function = mousemove.as_ref().unchecked_ref();
                let _ = window_for_mouseup.remove_event_listener_with_callback("mousemove", mousemove_js);
            }

            // Remove mouseup listener itself
            if let Some(mouseup) = mouseup_holder_clone.borrow_mut().take() {
                let mouseup_js: &js_sys::Function = mouseup.as_ref().unchecked_ref();
                let _ = window_for_mouseup.remove_event_listener_with_callback("mouseup", mouseup_js);
            }
        }) as Box<dyn FnMut(_)>);

        // Add mouseup listener
        let mouseup_js: &js_sys::Function = mouseup_handler.as_ref().unchecked_ref();
        let _ = window.add_event_listener_with_callback("mouseup", mouseup_js);

        // Store mouseup handler for later cleanup
        *mouseup_holder.borrow_mut() = Some(mouseup_handler);
    }) as Box<dyn FnMut(_)>);

    let _ = thumb.add_event_listener_with_callback(
        "mousedown",
        closure_mousedown.as_ref().unchecked_ref(),
    );
    closure_mousedown.forget();
}

/// Initialize custom scrollbar for all standard Hikari scrollable containers
///
/// This includes:
/// - Aside content areas (sidebar navigation)
/// - Layout content areas (main content)
/// - Tree components (virtual scrolling)
/// - Tabs navigation (horizontal scrolling)
/// - Table containers (horizontal scrolling)
#[wasm_bindgen(js_name = initAllScrollbarContainers)]
pub fn init_all() {
    // Aside components
    init(".hi-aside-content");
    init(".hi-layout-aside-content");

    // Layout components
    init(".hi-layout-content");
    init(".hi-layout-scrollable");

    // Data components
    init(".hi-tree-virtual");
    init(".hi-tabs-nav");
    init(".hi-table-container");

    // Demo app specific
    init(".sidebar-nav");
    init(".showcase-table-container");
}
