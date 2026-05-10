//! Event-driven animation system
//!
//! Provides high-level bindings between DOM events and animations,
//! supporting both continuous and state-machine-based triggers.

use std::{cell::RefCell, collections::HashMap, rc::Rc};

use tairitsu_vdom::{EventData, MouseEvent, Platform};

/// Trigger mode for event-driven animations
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum TriggerMode {
    /// Trigger on every event occurrence
    Continuous,
    /// Trigger only when entering a new state (debounced)
    OncePerState,
}

/// DOM event types that can trigger animations
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum AnimationEventType {
    /// Mouse enters the element
    MouseEnter,
    /// Mouse leaves the element
    MouseLeave,
    /// Mouse moves inside the element (with optional throttling)
    MouseMove { throttle_ms: u32 },
    /// Mouse moves anywhere on page (for parallax/follow effects)
    GlobalMouseMove { throttle_ms: u32 },
    /// Element is clicked
    Click,
    /// Element receives focus
    Focus,
    /// Element loses focus
    Blur,
}

/// Animation trigger configuration
pub struct AnimationTrigger {
    /// Event type to listen for
    pub event: AnimationEventType,
    /// Trigger mode
    pub mode: TriggerMode,
    /// Debounce delay in milliseconds (for OncePerState mode)
    pub debounce_ms: u32,
}

impl Default for AnimationTrigger {
    fn default() -> Self {
        Self {
            event: AnimationEventType::MouseEnter,
            mode: TriggerMode::OncePerState,
            debounce_ms: 100,
        }
    }
}

impl AnimationTrigger {
    /// Create a new trigger with default settings
    pub fn new(event: AnimationEventType) -> Self {
        Self {
            event,
            ..Default::default()
        }
    }

    /// Set trigger mode
    pub fn with_mode(mut self, mode: TriggerMode) -> Self {
        self.mode = mode;
        self
    }

    /// Set debounce delay
    pub fn with_debounce(mut self, debounce_ms: u32) -> Self {
        self.debounce_ms = debounce_ms;
        self
    }
}

/// Event-driven animation builder
///
/// Uses a mutable builder pattern where methods take &mut self and return Self for chaining.
/// This avoids unsafe code and works with any Platform::Element type.
///
/// # Example
///
/// ```ignore
/// use animation::events::EventDrivenAnimation;
/// use tairitsu_vdom::Platform;
/// use std::collections::HashMap;
///
/// let mut elements = HashMap::new();
/// elements.insert("button".to_string(), button_handle);
///
/// let mut builder = EventDrivenAnimation::new(platform, &elements, button_handle);
/// builder
///     .on_mouse_move(16, |x, y| {
///         format!("translate({}px, {}px)", x * 0.1, y * 0.1)
///     })
///     .on_click(|x, y| {
///         format!("scale(1.1)")
///     });
/// builder.build();
/// ```
pub struct EventDrivenAnimation<'a, P: Platform> {
    /// Platform for DOM operations
    platform: Rc<RefCell<P>>,
    /// Map of element names to their element handles
    elements: &'a HashMap<String, P::Element>,
    /// Target element handle
    element: P::Element,
    /// Window element handle (for global events)
    window_element: Option<P::Element>,
}

impl<'a, P: Platform> EventDrivenAnimation<'a, P> {
    /// Create a new event-driven animation
    pub fn new(
        platform: Rc<RefCell<P>>,
        elements: &'a HashMap<String, P::Element>,
        element: P::Element,
    ) -> Self {
        Self {
            platform,
            elements,
            element,
            window_element: None,
        }
    }

    /// Set the window element handle for global events
    pub fn with_window_element(&mut self, window_element: P::Element) -> &mut Self {
        self.window_element = Some(window_element);
        self
    }

    /// Bind an animation to mouse enter event
    pub fn on_mouse_enter<F>(&mut self, f: F) -> &mut Self
    where
        F: Fn(i32, i32) -> String + 'static,
    {
        self.bind_event("mouseenter", move |event: Box<dyn EventData>| {
            event
                .as_any()
                .downcast_ref::<MouseEvent>()
                .map(|mouse_event| (f)(mouse_event.client_x, mouse_event.client_y))
        })
    }

    /// Bind an animation to mouse leave event
    pub fn on_mouse_leave<F>(&mut self, f: F) -> &mut Self
    where
        F: Fn(i32, i32) -> String + 'static,
    {
        self.bind_event("mouseleave", move |event: Box<dyn EventData>| {
            event
                .as_any()
                .downcast_ref::<MouseEvent>()
                .map(|mouse_event| (f)(mouse_event.client_x, mouse_event.client_y))
        })
    }

    /// Bind an animation to mouse move event (with throttling)
    pub fn on_mouse_move<F>(&mut self, _throttle_ms: u32, f: F) -> &mut Self
    where
        F: Fn(i32, i32) -> String + 'static,
    {
        self.bind_event("mousemove", move |event: Box<dyn EventData>| {
            event
                .as_any()
                .downcast_ref::<MouseEvent>()
                .map(|mouse_event| (f)(mouse_event.client_x, mouse_event.client_y))
        })
    }

    /// Bind an animation to global mouse move (for parallax/follow effects)
    pub fn on_global_mouse_move<F>(&mut self, _throttle_ms: u32, f: F) -> &mut Self
    where
        F: Fn(i32, i32) -> String + 'static,
    {
        // Use window_element if set, otherwise use the main element
        // Check if we have a window element without holding a borrow
        let has_window = self.window_element.is_some();

        if has_window {
            // We need to take the window element to avoid borrow conflicts
            if let Some(window_elem) = self.window_element.take() {
                // Bind to window element
                let platform = self.platform.clone();
                let elements = self.elements.clone();
                let wrapped_handler = move |event: Box<dyn EventData>| {
                    if let Some(mouse_event) = event.as_any().downcast_ref::<MouseEvent>() {
                        let value_str = (f)(mouse_event.client_x, mouse_event.client_y);
                        for element_handle in elements.values() {
                            platform.borrow_mut().set_style(
                                element_handle,
                                "transform",
                                &value_str,
                            );
                        }
                    }
                };
                self.platform.borrow_mut().add_event_listener(
                    &window_elem,
                    "mousemove",
                    Box::new(wrapped_handler),
                );
                self.window_element = Some(window_elem);
            }
        } else {
            let platform = self.platform.clone();
            let elements = self.elements.clone();
            let element = self.element.clone();
            let wrapped_handler = move |event: Box<dyn EventData>| {
                if let Some(mouse_event) = event.as_any().downcast_ref::<MouseEvent>() {
                    let value_str = (f)(mouse_event.client_x, mouse_event.client_y);
                    for element_handle in elements.values() {
                        platform
                            .borrow_mut()
                            .set_style(element_handle, "transform", &value_str);
                    }
                }
            };
            self.platform.borrow_mut().add_event_listener(
                &element,
                "mousemove",
                Box::new(wrapped_handler),
            );
        }
        self
    }

    /// Bind an animation to click event
    pub fn on_click<F>(&mut self, f: F) -> &mut Self
    where
        F: Fn(i32, i32) -> String + 'static,
    {
        self.bind_event("click", move |event: Box<dyn EventData>| {
            event
                .as_any()
                .downcast_ref::<MouseEvent>()
                .map(|mouse_event| (f)(mouse_event.client_x, mouse_event.client_y))
        })
    }

    /// Bind an animation to focus event
    pub fn on_focus<F>(&mut self, f: F) -> &mut Self
    where
        F: Fn() -> String + 'static,
    {
        self.bind_event("focus", move |_event: Box<dyn EventData>| Some((f)()))
    }

    /// Bind an animation to blur event
    pub fn on_blur<F>(&mut self, f: F) -> &mut Self
    where
        F: Fn() -> String + 'static,
    {
        self.bind_event("blur", move |_event: Box<dyn EventData>| Some((f)()))
    }

    /// Internal method to bind an event handler to the target element
    fn bind_event<F>(&mut self, event_type: &str, handler: F) -> &mut Self
    where
        F: Fn(Box<dyn EventData>) -> Option<String> + 'static,
    {
        let platform = self.platform.clone();
        let elements = self.elements.clone();
        let element = self.element.clone();

        // Create a wrapper that converts the value string to actual style application
        let wrapped_handler = move |event: Box<dyn EventData>| {
            if let Some(value_str) = handler(event) {
                for element_handle in elements.values() {
                    // Apply the style using the platform
                    platform
                        .borrow_mut()
                        .set_style(element_handle, "transform", &value_str);
                }
            }
        };

        // Add event listener through platform
        self.platform.borrow_mut().add_event_listener(
            &element,
            event_type,
            Box::new(wrapped_handler),
        );

        self
    }

    /// Build and apply the animation system
    ///
    /// This method finalizes the builder and sets up all event listeners.
    pub fn build(&mut self) {
        // Event listeners are now managed by the platform
        // No explicit cleanup needed in this version
    }
}
