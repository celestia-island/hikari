//! Custom DOM-based scrollbar component
//!
//! Provides a manually created scrollbar that doesn't use native webkit scrollbar.
//! The scrollbar is absolutely positioned and won't affect layout.
//!
//! # Features
//! - Absolute positioned on right side
//! - No layout shift (doesn't affect content width)
//! - Smooth animations (2px → 4px) managed by hikari-animation
//! - Auto-hide when content doesn't need scrolling
//! - Drag to scroll functionality
//! - Smart width expansion on drag and scroll events
//!
//! # Animation Architecture
//! - State machine manages scrollbar width (Idle/Active/Dragging/ScrollHover)
//! - hikari-animation's scrollbar module handles width transitions
//! - requestAnimationFrame drives smooth width transitions (300ms)
//! - CSS cubic-bezier for smooth easing

// WASM-specific implementation
#[cfg(target_arch = "wasm32")]
mod wasm_impl {
    use std::{cell::RefCell, rc::Rc};

    use hikari_animation::{
        TimerManager,
        style::{AttributeBuilder, CssProperty, StyleBuilder},
    };
    use js_sys::Date;
    use wasm_bindgen::{JsCast, prelude::*};
    use web_sys::{MutationObserver, MutationObserverInit, ResizeObserver};

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    enum ScrollbarAnimationState {
        Idle,
        Active,
        Dragging,
        ScrollHover,
    }

    ///
    struct ScrollbarAnimator {
        state: RefCell<ScrollbarAnimationState>,
        scrollbar_id: String,
        timer_manager: TimerManager,
        scroll_hover_timer: RefCell<Option<crate::animation::TimerId>>,
        is_mouse_over: RefCell<bool>,
    }

    impl ScrollbarAnimator {
        fn new(track: web_sys::Element) -> Self {
            // Generate unique ID using timestamp
            let scrollbar_id = format!("scrollbar-{}", js_sys::Date::now());

            hikari_animation::register_scrollbar(scrollbar_id.clone(), track.into());

            Self {
                state: RefCell::new(ScrollbarAnimationState::Idle),
                scrollbar_id,
                timer_manager: TimerManager::new(),
                scroll_hover_timer: RefCell::new(None),
                is_mouse_over: RefCell::new(false),
            }
        }

        fn activate(&self) {
            let current_state = *self.state.borrow();
            *self.is_mouse_over.borrow_mut() = true;

            match current_state {
                ScrollbarAnimationState::Dragging => {}
                ScrollbarAnimationState::Idle | ScrollbarAnimationState::ScrollHover => {
                    *self.state.borrow_mut() = ScrollbarAnimationState::Active;
                    hikari_animation::update_scrollbar_width(self.scrollbar_id.clone(), 8.0);
                }
                ScrollbarAnimationState::Active => {}
            }
        }

        fn deactivate(&self) {
            let current_state = *self.state.borrow();
            *self.is_mouse_over.borrow_mut() = false;

            match current_state {
                ScrollbarAnimationState::Dragging | ScrollbarAnimationState::ScrollHover => {}
                ScrollbarAnimationState::Active => {
                    *self.state.borrow_mut() = ScrollbarAnimationState::Idle;
                    hikari_animation::update_scrollbar_width(self.scrollbar_id.clone(), 4.0);
                }
                ScrollbarAnimationState::Idle => {}
            }
        }

        fn start_drag(&self) {
            *self.state.borrow_mut() = ScrollbarAnimationState::Dragging;
            hikari_animation::update_scrollbar_width(self.scrollbar_id.clone(), 8.0);
        }

        fn end_drag(&self) {
            *self.state.borrow_mut() = ScrollbarAnimationState::Idle;
            hikari_animation::update_scrollbar_width(self.scrollbar_id.clone(), 4.0);
        }

        fn trigger_scroll_hover(&self) {
            let current_state = *self.state.borrow();

            if current_state == ScrollbarAnimationState::Dragging {
                return;
            }

            *self.state.borrow_mut() = ScrollbarAnimationState::ScrollHover;
            hikari_animation::update_scrollbar_width(self.scrollbar_id.clone(), 8.0);

            if let Some(timer_id) = self.scroll_hover_timer.borrow_mut().take() {
                self.timer_manager.clear_timeout(timer_id);
            }

            let animator = self.clone();
            let callback = Rc::new(move || {
                animator.restore_from_scroll_hover();
            });

            let timer_id = self
                .timer_manager
                .set_timeout(callback, std::time::Duration::from_millis(500));
            *self.scroll_hover_timer.borrow_mut() = Some(timer_id);
        }

        fn restore_from_scroll_hover(&self) {
            let is_over = *self.is_mouse_over.borrow();
            if is_over {
                *self.state.borrow_mut() = ScrollbarAnimationState::Active;
            } else {
                *self.state.borrow_mut() = ScrollbarAnimationState::Idle;
                hikari_animation::update_scrollbar_width(self.scrollbar_id.clone(), 4.0);
            }
        }
    }

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

    #[wasm_bindgen(js_name = initScrollbarContainer)]
    pub fn init(container_selector: &str) {
        let containers = match find_elements(container_selector) {
            Some(els) => els,
            None => return,
        };

        for i in 0..containers.length() {
            if let Some(element) = containers.get(i)
                && let Ok(container) = element.dyn_into::<web_sys::Element>()
            {
                setup_custom_scrollbar(&container, 0);
            }
        }
    }

    fn init_single(element: &web_sys::Element) {
        let has_container_class = has_class(element, "custom-scrollbar-container");
        let structure_ok = verify_scrollbar_structure(element);

        if !has_container_class || !structure_ok {
            let saved_scroll_top = if has_container_class && !structure_ok {
                cleanup_broken_scrollbar_and_save_scroll(element)
            } else {
                0
            };

            setup_custom_scrollbar(element, saved_scroll_top);
        }
    }

    fn cleanup_broken_scrollbar_and_save_scroll(container: &web_sys::Element) -> i32 {
        let mut scroll_top = 0;

        if let Ok(Some(content)) = container.query_selector(".custom-scrollbar-content")
            && let Some(html_el) = content.dyn_ref::<web_sys::HtmlElement>()
        {
            scroll_top = html_el.scroll_top();
        }

        let _ = container.class_list().remove_1("custom-scrollbar-container");

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

    fn find_elements(selector: &str) -> Option<web_sys::NodeList> {
        let window = web_sys::window()?;
        let document = window.document()?;
        document.query_selector_all(selector).ok()
    }

    fn has_class(element: &web_sys::Element, class_name: &str) -> bool {
        element.class_list().contains(class_name)
    }

    fn verify_scrollbar_structure(container: &web_sys::Element) -> bool {
        let wrapper = match container.query_selector(".custom-scrollbar-wrapper") {
            Ok(Some(el)) => el,
            _ => return false,
        };

        let _ = match wrapper.query_selector(".custom-scrollbar-content") {
            Ok(Some(_)) => true,
            _ => return false,
        };

        let _ = match wrapper.query_selector(".custom-scrollbar-track") {
            Ok(Some(_)) => true,
            _ => return false,
        };

        let _ = match wrapper.query_selector(".custom-scrollbar-thumb") {
            Ok(Some(_)) => true,
            _ => return false,
        };

        true
    }

    fn setup_custom_scrollbar(container: &web_sys::Element, initial_scroll_top: i32) {
        let window = match web_sys::window() {
            Some(w) => w,
            None => return,
        };
        let document = match window.document() {
            Some(d) => d,
            None => return,
        };

        let _ = container.class_list().add_1("custom-scrollbar-container");

        let container_html = match container.dyn_ref::<web_sys::HtmlElement>() {
            Some(el) => el,
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

        StyleBuilder::new(container_html)
            .add(CssProperty::Position, "relative")
            .add(CssProperty::Padding, "0")
            .apply();

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

        let content_html = match content_layer.dyn_ref::<web_sys::HtmlElement>() {
            Some(el) => el,
            None => return,
        };
        StyleBuilder::new(content_html)
            .add(CssProperty::Display, "flex")
            .add(CssProperty::FlexDirection, "column")
            .add(CssProperty::Flex, "1")
            .add(CssProperty::MinWidth, "0")
            .add(CssProperty::OverflowY, "auto")
            .add(CssProperty::OverflowX, "hidden")
            .add(CssProperty::PaddingTop, &padding_top)
            .add(CssProperty::PaddingRight, &padding_right)
            .add(CssProperty::PaddingBottom, &padding_bottom)
            .add(CssProperty::PaddingLeft, "0")
            .apply();

        while let Some(child) = container.first_child() {
            let _ = content_layer.append_child(&child);
        }

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

        let track_html = match track.dyn_ref::<web_sys::HtmlElement>() {
            Some(el) => el,
            None => return,
        };
        StyleBuilder::new(track_html)
            .add(CssProperty::Position, "absolute")
            .add(CssProperty::Top, "0")
            .add(CssProperty::Right, "0")
            .add(CssProperty::Bottom, "0")
            .add(CssProperty::Width, "4px")
            .apply();

        let animator = Rc::new(ScrollbarAnimator::new(track.clone()));
        let animator_for_events = animator.clone();

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
            .apply();

        let _ = track.append_child(&thumb);

        let _ = wrapper.append_child(&content_layer);
        let _ = wrapper.append_child(&track);
        let _ = container.append_child(&wrapper);

        if initial_scroll_top > 0
            && let Some(content_html) = content_layer.dyn_ref::<web_sys::HtmlElement>()
        {
            content_html.set_scroll_top(initial_scroll_top);
        }

        let content_layer_clone = content_layer.clone();
        let track_clone = track.clone();
        let thumb_clone = thumb.clone();
        let cached_thumb_height = std::rc::Rc::new(std::cell::RefCell::new(None::<f64>));
        let scroll_ratio = std::rc::Rc::new(std::cell::RefCell::new(0.0));

        update_scrollbar(&content_layer_clone, &track_clone, &thumb_clone);

        // Event listeners setup (simplified)
        let content_layer_scroll = content_layer_clone.clone();
        let track_scroll = track_clone.clone();
        let thumb_scroll = thumb_clone.clone();
        let cached_thumb_height_scroll = cached_thumb_height.clone();
        let animator_scroll = animator.clone();
        let scroll_ratio_scroll = scroll_ratio.clone();

        let closure_scroll = Closure::wrap(Box::new(move || {
            if let Some(el) = content_layer_scroll.dyn_ref::<web_sys::HtmlElement>() {
                let scroll_top = el.scroll_top() as f64;
                let scroll_height = el.scroll_height() as f64;
                let client_height = el.client_height() as f64;
                let max_scroll = (scroll_height - client_height).max(1.0);
                let ratio = (scroll_top / max_scroll).clamp(0.0, 1.0);
                *scroll_ratio_scroll.borrow_mut() = ratio;
            }

            animator_scroll.trigger_scroll_hover();

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

        // Resize observer setup (simplified)
        let content_layer_resize = content_layer_clone.clone();
        let track_resize = track_clone.clone();
        let thumb_resize = thumb_clone.clone();

        let closure_resize = Closure::wrap(Box::new(move || {
            update_scrollbar(&content_layer_resize, &track_resize, &thumb_resize);
        }) as Box<dyn FnMut()>);

        let _ = window.add_event_listener_with_callback("resize", closure_resize.as_ref().unchecked_ref());
        closure_resize.forget();

        // Hover animation setup
        let closure_mouseenter = Closure::wrap(Box::new(move || {
            animator_for_events.activate();
        }) as Box<dyn FnMut()>);

        let _ = track.add_event_listener_with_callback(
            "mouseenter",
            closure_mouseenter.as_ref().unchecked_ref(),
        );
        closure_mouseenter.forget();

        let track_for_hover = track.clone();
        let closure_mouseleave = Closure::wrap(Box::new(move || {
            animator.deactivate();
        }) as Box<dyn FnMut()>);

        let _ = track_for_hover.add_event_listener_with_callback(
            "mouseleave",
            closure_mouseleave.as_ref().unchecked_ref(),
        );
        closure_mouseleave.forget();
    }

    fn update_scrollbar(
        content_layer: &web_sys::Element,
        track: &web_sys::Element,
        thumb: &web_sys::Element,
    ) {
        let scroll_top = content_layer.scroll_top() as f64;
        let scroll_height = content_layer.scroll_height() as f64;
        let client_height = content_layer.client_height() as f64;
        let track_height = track.client_height() as f64;

        let ideal_thumb_height = if scroll_height > client_height {
            (client_height / scroll_height) * client_height
        } else {
            0.0
        };

        let thumb_html = match thumb.dyn_ref::<web_sys::HtmlElement>() {
            Some(el) => el,
            None => return,
        };

        StyleBuilder::new(thumb_html)
            .add(CssProperty::Height, &format!("{}px", ideal_thumb_height))
            .apply();

        let actual_thumb_height = thumb.client_height() as f64;
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

        let track_class_list = track.class_list();
        if ideal_thumb_height < client_height && ideal_thumb_height > 0.0 {
            let _ = track_class_list.remove_1("custom-scrollbar-hidden");
        } else {
            let _ = track_class_list.add_1("custom-scrollbar-hidden");
        }
    }

    fn update_scrollbar_with_cached_height(
        content_layer: &web_sys::Element,
        track: &web_sys::Element,
        thumb: &web_sys::Element,
        cached_thumb_height: f64,
    ) {
        let scroll_top = content_layer.scroll_top() as f64;
        let scroll_height = content_layer.scroll_height() as f64;
        let client_height = content_layer.client_height() as f64;
        let track_height = track.client_height() as f64;
        let thumb_movable_range = track_height - cached_thumb_height;
        let max_scroll = scroll_height - client_height;
        let thumb_top = if max_scroll > 0.0 && thumb_movable_range > 0.0 {
            (scroll_top / max_scroll) * thumb_movable_range
        } else {
            0.0
        };

        let thumb_html = match thumb.dyn_ref::<web_sys::HtmlElement>() {
            Some(el) => el,
            None => return,
        };

        StyleBuilder::new(thumb_html)
            .add(CssProperty::Top, &format!("{}px", thumb_top))
            .apply();

        let track_class_list = track.class_list();
        if cached_thumb_height < client_height && cached_thumb_height > 0.0 {
            let _ = track_class_list.remove_1("custom-scrollbar-hidden");
        } else {
            let _ = track_class_list.add_1("custom-scrollbar-hidden");
        }
    }

    #[wasm_bindgen(js_name = initAllScrollbarContainers)]
    pub fn init_all() {
        init(".hi-aside-content");
        init(".hi-layout-aside-content");
        init(".hi-layout-content");
        init(".hi-layout-scrollable");
        init(".hi-tree-virtual");
        init(".hi-tabs-nav");
        init(".hi-table-container");
        init(".hi-sidebar");
        init(".sidebar-nav");
        init(".showcase-table-container");
        init(".custom-scrollbar-content-vdom");
    }
}

// Non-WASM stub implementations
#[cfg(not(target_arch = "wasm32"))]
pub fn init(_container_selector: &str) {
    // No-op on non-WASM platforms
}

#[cfg(not(target_arch = "wasm32"))]
pub fn init_all() {
    // No-op on non-WASM platforms
}

// Re-export WASM functions when available
#[cfg(target_arch = "wasm32")]
pub use wasm_impl::{init, init_all};
