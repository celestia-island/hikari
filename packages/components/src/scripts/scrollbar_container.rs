//! Custom DOM-based scrollbar component
//!
//! Provides a manually created scrollbar that doesn't use native webkit scrollbar.
//! The scrollbar is absolutely positioned and won't affect layout.
//!
//! # Features
//! - Absolute positioned on right side
//! - No layout shift (doesn't affect content width)
//! - Smooth animations (4px → 8px) managed by hikari-animation
//! - Auto-hide when content doesn't need scrolling
//! - Drag to scroll functionality
//! - Smart width expansion on drag and scroll events
//!
//! # Animation Architecture
//! - State machine manages scrollbar width (Idle/Active/Dragging/ScrollHover)
//! - hikari-animation's scrollbar module handles width transitions
//! - requestAnimationFrame drives smooth width transitions (300ms)
//! - CSS cubic-bezier for smooth easing

#![allow(unused_imports)]

use std::{cell::RefCell, rc::Rc};

use animation::{
    TimerManager,
    style::{AttributeBuilder, CssProperty, StyleBuilder},
};
use js_sys::Date;
use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{MutationObserver, MutationObserverInit, ResizeObserver};

/// Animation state for scrollbar width transition
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ScrollbarAnimationState {
    /// Scrollbar at normal width (4px)
    Idle,
    /// Scrollbar at expanded width (8px) - mouse hover
    Active,
    /// Scrollbar at expanded width (8px) - currently dragging
    Dragging,
    /// Scrollbar at expanded width (8px) - temporarily expanded after scroll
    ScrollHover,
}

/// Animation controller for scrollbar width transitions
///
/// Manages state and animation lifecycle for hover effects.
/// Uses hikari-animation's scrollbar module for smooth transitions.
struct ScrollbarAnimator {
    state: RefCell<ScrollbarAnimationState>,
    scrollbar_id: String,
    timer_manager: TimerManager,
    scroll_hover_timer: RefCell<Option<animation::TimerId>>,
    is_mouse_over: RefCell<bool>,
}

impl ScrollbarAnimator {
    /// Create a new animator for the given track element
    fn new(track: web_sys::Element) -> Self {
        // Generate unique ID using timestamp
        let scrollbar_id = format!("scrollbar-{}", js_sys::Date::now());

        animation::register_scrollbar(scrollbar_id.clone(), track.into());

        Self {
            state: RefCell::new(ScrollbarAnimationState::Idle),
            scrollbar_id,
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
                animation::update_scrollbar_width(self.scrollbar_id.clone(), 8.0);
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
                animation::update_scrollbar_width(self.scrollbar_id.clone(), 4.0);
            }
            // Already idle, nothing to do
            ScrollbarAnimationState::Idle => {}
        }
    }

    /// Transition to dragging state
    fn start_drag(&self) {
        *self.state.borrow_mut() = ScrollbarAnimationState::Dragging;
        animation::update_scrollbar_width(self.scrollbar_id.clone(), 8.0);
    }

    /// End dragging - always return to idle state
    fn end_drag(&self) {
        *self.state.borrow_mut() = ScrollbarAnimationState::Idle;
        animation::update_scrollbar_width(self.scrollbar_id.clone(), 4.0);
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
        animation::update_scrollbar_width(self.scrollbar_id.clone(), 8.0);

        // Cancel existing scroll hover timer
        if let Some(timer_id) = self.scroll_hover_timer.borrow_mut().take() {
            self.timer_manager.clear_timeout(timer_id);
        }

        // Set new timer to restore previous state
        let animator = self.clone();
        let callback = Rc::new(move || {
            animator.restore_from_scroll_hover();
        });

        let timer_id = self
            .timer_manager
            .set_timeout(callback, std::time::Duration::from_millis(500));
        *self.scroll_hover_timer.borrow_mut() = Some(timer_id);
    }

    /// Restore state after scroll hover timer expires
    fn restore_from_scroll_hover(&self) {
        let is_over = *self.is_mouse_over.borrow();
        if is_over {
            *self.state.borrow_mut() = ScrollbarAnimationState::Active;
        } else {
            *self.state.borrow_mut() = ScrollbarAnimationState::Idle;
            animation::update_scrollbar_width(self.scrollbar_id.clone(), 4.0);
        }
    }
}

// Implement Clone for ScrollbarAnimator
impl Clone for ScrollbarAnimator {
    fn clone(&self) -> Self {
        Self {
            state: self.state.clone(),
            scrollbar_id: self.scrollbar_id.clone(),
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
        if let Some(element) = containers.get(i)
            && let Ok(container) = element.dyn_into::<web_sys::Element>()
        {
            setup_custom_scrollbar(&container, 0);
        }
    }
}

/// Initialize custom scrollbar for a single element (direct reference)
///
/// This is used by MutationObserver when we already have the element reference.
/// It checks both the class AND the actual DOM structure to handle cases where
/// Dioxus re-renders and removes the scrollbar elements but keeps the container.
fn init_single(element: &web_sys::Element) {
    // Check if already initialized AND structure is intact
    let has_container_class = has_class(element, "custom-scrollbar-container");
    let structure_ok = verify_scrollbar_structure(element);

    if !has_container_class || !structure_ok {
        // If structure is broken but class exists, save scroll position and clean up
        let saved_scroll_top = if has_container_class && !structure_ok {
            cleanup_broken_scrollbar_and_save_scroll(element)
        } else {
            0
        };

        setup_custom_scrollbar(element, saved_scroll_top);
    }
}

/// Clean up a broken scrollbar structure before re-initializing
/// Returns the saved scroll position to restore after re-initialization
fn cleanup_broken_scrollbar_and_save_scroll(container: &web_sys::Element) -> i32 {
    let mut scroll_top = 0;

    // Try to save scroll position from the existing content layer
    if let Ok(Some(content)) = container.query_selector(".custom-scrollbar-content")
        && let Some(html_el) = content.dyn_ref::<web_sys::HtmlElement>()
    {
        scroll_top = html_el.scroll_top();
    }

    let _ = container
        .class_list()
        .remove_1("custom-scrollbar-container");

    // Remove any orphaned custom-scrollbar elements
    if let Ok(Some(wrapper)) = container.query_selector(".custom-scrollbar-wrapper") {
        let wrapper_node = wrapper.dyn_into::<web_sys::Node>().ok();
        if let Some(node) = wrapper_node {
            let _ = container.remove_child(&node);
        }
    }
    if let Ok(Some(track)) = container.query_selector(".custom-scrollbar-track") {
        let track_node = track.dyn_into::<web_sys::Node>().ok();
        if let Some(node) = track_node {
            let _ = container.remove_child(&node);
        }
    }

    scroll_top
}

/// Find elements by selector
fn find_elements(selector: &str) -> Option<web_sys::NodeList> {
    let window = web_sys::window()?;
    let document = window.document()?;
    document.query_selector_all(selector).ok()
}

/// Helper: Check if element has a class
fn has_class(element: &web_sys::Element, class_name: &str) -> bool {
    element.class_list().contains(class_name)
}

/// Verify that the custom scrollbar structure is complete
/// Returns true if all required elements (wrapper, content, track, thumb) exist
fn verify_scrollbar_structure(container: &web_sys::Element) -> bool {
    // Check for wrapper
    let wrapper = match container.query_selector(".custom-scrollbar-wrapper") {
        Ok(Some(el)) => el,
        _ => return false,
    };

    // Check for content layer
    let _ = match wrapper.query_selector(".custom-scrollbar-content") {
        Ok(Some(_)) => true,
        _ => return false,
    };

    // Check for track
    let _ = match wrapper.query_selector(".custom-scrollbar-track") {
        Ok(Some(_)) => true,
        _ => return false,
    };

    // Check for thumb
    let _ = match wrapper.query_selector(".custom-scrollbar-thumb") {
        Ok(Some(_)) => true,
        _ => return false,
    };

    true
}

/// Setup custom scrollbar for a single container
/// initial_scroll_top: the scroll position to restore after setup
fn setup_custom_scrollbar(container: &web_sys::Element, initial_scroll_top: i32) {
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
    let computed_style = match window.get_computed_style(container).ok().flatten() {
        Some(s) => s,
        None => return,
    };

    let padding_top = computed_style
        .get_property_value("padding-top")
        .unwrap_or_default();
    let padding_right = computed_style
        .get_property_value("padding-right")
        .unwrap_or_default();
    let padding_bottom = computed_style
        .get_property_value("padding-bottom")
        .unwrap_or_default();

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
    let wrapper_html = match wrapper.dyn_ref::<web_sys::HtmlElement>() {
        Some(el) => el,
        None => return,
    };
    AttributeBuilder::new(wrapper_html)
        .add_data("custom-scrollbar", "wrapper")
        .apply();

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
    let content_layer_html = match content_layer.dyn_ref::<web_sys::HtmlElement>() {
        Some(el) => el,
        None => return,
    };
    AttributeBuilder::new(content_layer_html)
        .add_data("custom-scrollbar", "content")
        .apply();

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
        .add(CssProperty::PaddingLeft, "0") // No left padding for sidebar content
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
    let track_html = match track.dyn_ref::<web_sys::HtmlElement>() {
        Some(el) => el,
        None => return,
    };
    AttributeBuilder::new(track_html)
        .add_data("custom-scrollbar", "track")
        .apply();

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
        .add(CssProperty::Width, "4px") // Initial width (animated by state machine)
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
    let thumb_html = match thumb.dyn_ref::<web_sys::HtmlElement>() {
        Some(el) => el,
        None => return,
    };
    AttributeBuilder::new(thumb_html)
        .add_data("custom-scrollbar", "thumb")
        .add("tabindex", "0")
        .apply(); // Make focusable

    // Append thumb to track
    let _ = track.append_child(&thumb);

    // Build DOM structure: container > wrapper > (content_layer, track)
    let _ = wrapper.append_child(&content_layer);
    let _ = wrapper.append_child(&track);
    let _ = container.append_child(&wrapper);

    // Restore scroll position if this is a re-initialization
    if initial_scroll_top > 0
        && let Some(content_html) = content_layer.dyn_ref::<web_sys::HtmlElement>()
    {
        content_html.set_scroll_top(initial_scroll_top);
    }

    // Clone for closures
    let _wrapper_clone = wrapper.clone();
    let content_layer_clone = content_layer.clone();
    let track_clone = track.clone();
    let thumb_clone = thumb.clone();

    // Cached dimensions for drag operations (to prevent layout thrashing)
    let cached_thumb_height = std::rc::Rc::new(std::cell::RefCell::new(None::<f64>));

    // Store the last known scroll ratio (0.0 to 1.0) - continuously updated by scroll events
    // This is used by ResizeObserver to restore scroll position after content size changes
    let scroll_ratio = std::rc::Rc::new(std::cell::RefCell::new(0.0));

    // Initial update
    update_scrollbar(&content_layer_clone, &track_clone, &thumb_clone);

    // Watch scroll events (on content_layer, not container!)
    let content_layer_scroll = content_layer_clone.clone();
    let track_scroll = track_clone.clone();
    let thumb_scroll = thumb_clone.clone();
    let cached_thumb_height_scroll = cached_thumb_height.clone();
    let animator_scroll = animator.clone();
    let scroll_ratio_scroll = scroll_ratio.clone();

    let closure_scroll = Closure::wrap(Box::new(move || {
        // Update scroll ratio continuously
        if let Some(el) = content_layer_scroll.dyn_ref::<web_sys::HtmlElement>() {
            let scroll_top = el.scroll_top() as f64;
            let scroll_height = el.scroll_height() as f64;
            let client_height = el.client_height() as f64;
            let max_scroll = (scroll_height - client_height).max(1.0);
            let ratio = (scroll_top / max_scroll).min(1.0).max(0.0);
            *scroll_ratio_scroll.borrow_mut() = ratio;
        }

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

    let _ = content_layer
        .add_event_listener_with_callback("scroll", closure_scroll.as_ref().unchecked_ref());
    closure_scroll.forget();

    // Watch resize events (window resize) and content size changes (ResizeObserver)
    // We need to clone before creating closures
    let content_layer_resize = content_layer_clone.clone();
    let track_resize = track_clone.clone();
    let thumb_resize = thumb_clone.clone();

    // For ResizeObserver - clone for observer callback
    let content_layer_obs = content_layer_resize.clone();
    let track_obs = track_resize.clone();
    let thumb_obs = thumb_resize.clone();
    let scroll_ratio_obs = scroll_ratio.clone();

    // Window resize callback
    let closure_resize = Closure::wrap(Box::new(move || {
        update_scrollbar(&content_layer_resize, &track_resize, &thumb_resize);
    }) as Box<dyn FnMut()>);

    let _ =
        window.add_event_listener_with_callback("resize", closure_resize.as_ref().unchecked_ref());
    closure_resize.forget();

    // ResizeObserver callback - watches content size changes
    // This is crucial for when menu items expand/collapse
    let observer_closure = Closure::wrap(Box::new(move |_: js_sys::Array| {
        let content_html = match content_layer_obs.dyn_ref::<web_sys::HtmlElement>() {
            Some(el) => el,
            None => return,
        };

        // Use the last known scroll ratio from scroll events (more reliable than reading now)
        let scroll_percentage = *scroll_ratio_obs.borrow();

        // Update scrollbar (this updates thumb position)
        update_scrollbar(&content_layer_obs, &track_obs, &thumb_obs);

        // After size change, restore scroll position using saved ratio
        let new_scroll_height = content_html.scroll_height() as f64;
        let new_client_height = content_html.client_height() as f64;
        let new_max_scroll = (new_scroll_height - new_client_height).max(0.0);

        // Only restore if we had meaningful scroll position (>1%) and there's room to scroll
        if scroll_percentage > 0.01 && new_max_scroll > 1.0 {
            let new_scroll_top = (scroll_percentage * new_max_scroll).round() as i32;
            content_html.set_scroll_top(new_scroll_top);

            // Update thumb again to match new scroll position
            update_scrollbar(&content_layer_obs, &track_obs, &thumb_obs);
        }
    }) as Box<dyn FnMut(js_sys::Array)>);

    if let Ok(observer) = ResizeObserver::new(observer_closure.as_ref().unchecked_ref()) {
        observer.observe(&content_layer);
        observer_closure.forget();
    }

    // Setup drag functionality
    setup_drag_scroll(
        &content_layer_clone,
        &thumb_clone,
        cached_thumb_height,
        &animator,
    );

    // Setup hover animation using state machine
    let track_for_hover = track.clone();
    let track_for_click = track.clone();
    let content_for_click = content_layer.clone();
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

    // Setup track click to jump to position
    let track_click = track_for_click.clone();
    let closure_click = Closure::wrap(Box::new(move |event: web_sys::MouseEvent| {
        event.stop_propagation();

        // Calculate click position relative to track
        let track_rect = track_click.get_bounding_client_rect();

        let click_y = event.client_y() as f64 - track_rect.top();
        let track_height = track_rect.height();

        // Calculate thumb height
        let thumb_height = match track_click.query_selector(".custom-scrollbar-thumb") {
            Ok(Some(thumb_el)) => {
                let thumb_rect = thumb_el.get_bounding_client_rect();
                thumb_rect.height()
            }
            _ => 20.0,
        };

        // Calculate scroll position
        let scroll_height = content_for_click.scroll_height() as f64;
        let client_height = content_for_click.client_height() as f64;
        let max_scroll = (scroll_height - client_height).max(0.0);

        // Center thumb at click position
        let thumb_center_offset = thumb_height / 2.0;
        let click_ratio = ((click_y - thumb_center_offset) / track_height)
            .max(0.0)
            .min(1.0);
        let new_scroll_top = click_ratio * max_scroll;

        content_for_click.set_scroll_top(new_scroll_top as i32);
    }) as Box<dyn FnMut(_)>);

    let _ = track_for_click
        .add_event_listener_with_callback("click", closure_click.as_ref().unchecked_ref());
    closure_click.forget();
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

    // Update thumb height using StyleBuilder
    let thumb_html = match thumb.dyn_ref::<web_sys::HtmlElement>() {
        Some(el) => el,
        None => return,
    };

    StyleBuilder::new(thumb_html)
        .add(CssProperty::Height, &format!("{}px", ideal_thumb_height))
        .apply();

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

    StyleBuilder::new(thumb_html)
        .add(CssProperty::Top, &format!("{}px", thumb_top))
        .apply();

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

    // Update thumb style (don't update height) using StyleBuilder
    let thumb_html = match thumb.dyn_ref::<web_sys::HtmlElement>() {
        Some(el) => el,
        None => return,
    };

    StyleBuilder::new(thumb_html)
        .add(CssProperty::Top, &format!("{}px", thumb_top))
        .apply();

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
        Some(node) => node.dyn_ref::<web_sys::Element>().map(|el| el.clone()),
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
            content_layer_drag.set_scroll_top(clamped_scroll_top as i32);
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
                let _ = window_for_mouseup
                    .remove_event_listener_with_callback("mousemove", mousemove_js);
            }

            // Remove mouseup listener itself
            if let Some(mouseup) = mouseup_holder_clone.borrow_mut().take() {
                let mouseup_js: &js_sys::Function = mouseup.as_ref().unchecked_ref();
                let _ =
                    window_for_mouseup.remove_event_listener_with_callback("mouseup", mouseup_js);
            }
        }) as Box<dyn FnMut(_)>);

        // Add mouseup listener
        let mouseup_js: &js_sys::Function = mouseup_handler.as_ref().unchecked_ref();
        let _ = window.add_event_listener_with_callback("mouseup", mouseup_js);

        // Store mouseup handler for later cleanup
        *mouseup_holder.borrow_mut() = Some(mouseup_handler);
    }) as Box<dyn FnMut(_)>);

    let _ = thumb
        .add_event_listener_with_callback("mousedown", closure_mousedown.as_ref().unchecked_ref());
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

    // Sidebar components
    init(".hi-sidebar");

    // Demo app specific
    init(".sidebar-nav");
    init(".showcase-table-container");

    // VDOM ScrollbarContainer components
    init(".custom-scrollbar-content-vdom");

    // Setup MutationObserver to auto-initialize newly added elements
    // This handles route changes and dynamic DOM updates
    setup_mutation_observer();
}

/// Set up MutationObserver to watch for DOM changes and auto-initialize scrollbars
///
/// This is crucial for SPA route changes where Dioxus re-renders the DOM.
/// When new sidebar elements are added, the MutationObserver detects them
/// and initializes custom scrollbars automatically.
fn setup_mutation_observer() {
    let window = match web_sys::window() {
        Some(w) => w,
        None => return,
    };
    let document = match window.document() {
        Some(d) => d,
        None => return,
    };

    // Selectors to watch for
    let selectors = [
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
        ".custom-scrollbar-content-vdom", // VDOM ScrollbarContainer
    ];

    let observer_callback = Closure::wrap(Box::new(move |mutations: js_sys::Array| {
        // If there are any mutations, schedule rescan before next paint
        if mutations.length() > 0 {
            let selectors = selectors.to_vec();
            let callback = Closure::wrap(Box::new(move || {
                if let Some(window) = web_sys::window()
                    && let Some(document) = window.document()
                {
                    // Rescan all selectors
                    for selector in &selectors {
                        if let Ok(elements) = document.query_selector_all(selector) {
                            for i in 0..elements.length() {
                                if let Some(node) = elements.get(i)
                                    && let Ok(element) = node.dyn_into::<web_sys::Element>()
                                    && !has_class(&element, "custom-scrollbar-container")
                                {
                                    init_single(&element);
                                }
                            }
                        }
                    }
                }
            }) as Box<dyn FnMut()>);

            // Use requestAnimationFrame to run before next paint
            if let Some(window) = web_sys::window() {
                let _ = window.request_animation_frame(callback.as_ref().unchecked_ref());
            }
            callback.forget();
        }
    }) as Box<dyn FnMut(js_sys::Array)>);

    if let Ok(observer) = MutationObserver::new(observer_callback.as_ref().unchecked_ref()) {
        let options = MutationObserverInit::new();
        options.set_child_list(true);
        options.set_subtree(true);
        // Also watch for attributes and character data
        options.set_attributes(true);
        options.set_character_data(true);
        options.set_character_data_old_value(true);

        // Observe the entire body for changes
        if let Some(body) = document.body() {
            let _ = observer.observe_with_options(&body, &options);
        }
        observer_callback.forget();
    }
}
