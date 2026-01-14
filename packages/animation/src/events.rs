//! Event-driven animation system
//!
//! Provides high-level bindings between DOM events and animations,
//! supporting both continuous and state-machine-based triggers.

use std::{cell::RefCell, collections::HashMap, rc::Rc};

use wasm_bindgen::{closure::Closure, JsCast, JsValue};
use web_sys::HtmlElement;

use super::context::AnimationContext;

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
/// # Example
///
/// ```ignore
/// use animation::events::{EventDrivenAnimation, AnimationEventType, TriggerMode};
/// use animation::style::CssProperty;
/// use std::collections::HashMap;
///
/// let mut elements = HashMap::new();
/// elements.insert("button".to_string(), button_element);
///
/// EventDrivenAnimation::new(&elements, button_element)
///     .on(AnimationEventType::MouseMove { throttle_ms: 16 }, TriggerMode::Continuous)
///     .animate(|ctx| {
///         let x = ctx.mouse_x();
///         let y = ctx.mouse_y();
///         format!("translate({}px, {}px)", x * 0.1, y * 0.1)
///     });
/// ```
pub struct EventDrivenAnimation<'a> {
    elements: &'a HashMap<String, JsValue>,
    element: HtmlElement,
    closures: Vec<Closure<dyn FnMut(web_sys::MouseEvent)>>,
}

impl<'a> EventDrivenAnimation<'a> {
    /// Create a new event-driven animation
    pub fn new(elements: &'a HashMap<String, JsValue>, element: HtmlElement) -> Self {
        Self {
            elements,
            element,
            closures: Vec::new(),
        }
    }

    /// Bind an animation to mouse enter event
    pub fn on_mouse_enter<F>(mut self, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static,
    {
        let element = self.element.clone();
        let elements = self.elements.clone();
        let _trigger = AnimationTrigger::new(AnimationEventType::MouseEnter);

        let closure = Closure::wrap(Box::new(move |_event: web_sys::MouseEvent| {
            if let Ok(el) = element.clone().dyn_into::<HtmlElement>() {
                let ctx = AnimationContext::new(&el);
                let value = f(&ctx);

                for (_name, js_val) in elements.iter() {
                    if let Ok(el) = js_val.clone().dyn_into::<HtmlElement>() {
                        let _ = el.style().set_property("transform", &value);
                    }
                }
            }
        }) as Box<dyn FnMut(_)>);

        let _ = self
            .element
            .add_event_listener_with_callback("mouseenter", closure.as_ref().unchecked_ref());
        self.closures.push(closure);
        self
    }

    /// Bind an animation to mouse leave event
    pub fn on_mouse_leave<F>(mut self, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static,
    {
        let element = self.element.clone();
        let elements = self.elements.clone();

        let closure = Closure::wrap(Box::new(move |_event: web_sys::MouseEvent| {
            if let Ok(el) = element.clone().dyn_into::<HtmlElement>() {
                let ctx = AnimationContext::new(&el);
                let value = f(&ctx);

                for (_name, js_val) in elements.iter() {
                    if let Ok(el) = js_val.clone().dyn_into::<HtmlElement>() {
                        let _ = el.style().set_property("transform", &value);
                    }
                }
            }
        }) as Box<dyn FnMut(_)>);

        let _ = self
            .element
            .add_event_listener_with_callback("mouseleave", closure.as_ref().unchecked_ref());
        self.closures.push(closure);
        self
    }

    /// Bind an animation to mouse move event (with throttling)
    pub fn on_mouse_move<F>(mut self, throttle_ms: u32, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static,
    {
        let element = self.element.clone();
        let elements = self.elements.clone();
        let last_time = Rc::new(RefCell::new(0_f64));

        let closure = Closure::wrap(Box::new(move |_event: web_sys::MouseEvent| {
            let now = js_sys::Date::now();
            let mut last = last_time.borrow_mut();

            if now - *last < throttle_ms as f64 {
                return;
            }

            *last = now;

            if let Ok(el) = element.clone().dyn_into::<HtmlElement>() {
                let ctx = AnimationContext::new(&el);
                let value = f(&ctx);

                for (_name, js_val) in elements.iter() {
                    if let Ok(el) = js_val.clone().dyn_into::<HtmlElement>() {
                        let _ = el.style().set_property("transform", &value);
                        let _ = el.style().set_property("transition", "none");
                    }
                }
            }
        }) as Box<dyn FnMut(_)>);

        let _ = self
            .element
            .add_event_listener_with_callback("mousemove", closure.as_ref().unchecked_ref());
        self.closures.push(closure);
        self
    }

    /// Bind an animation to global mouse move (for parallax/follow effects)
    pub fn on_global_mouse_move<F>(mut self, throttle_ms: u32, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static,
    {
        let element = self.element.clone();
        let elements = self.elements.clone();
        let window = match web_sys::window() {
            Some(w) => w,
            None => return self,
        };
        let last_time = Rc::new(RefCell::new(0_f64));

        let closure = Closure::wrap(Box::new(move |_event: web_sys::MouseEvent| {
            let now = js_sys::Date::now();
            let mut last = last_time.borrow_mut();

            if now - *last < throttle_ms as f64 {
                return;
            }

            *last = now;

            if let Ok(el) = element.clone().dyn_into::<HtmlElement>() {
                let ctx = AnimationContext::new(&el);
                let value = f(&ctx);

                for (_name, js_val) in elements.iter() {
                    if let Ok(el) = js_val.clone().dyn_into::<HtmlElement>() {
                        let _ = el.style().set_property("transform", &value);
                        let _ = el.style().set_property("transition", "none");
                    }
                }
            }
        }) as Box<dyn FnMut(_)>);

        let _ =
            window.add_event_listener_with_callback("mousemove", closure.as_ref().unchecked_ref());
        self.closures.push(closure);
        self
    }

    /// Generic event binding with custom trigger configuration
    pub fn on<F>(mut self, trigger: AnimationTrigger, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static,
    {
        match trigger.event {
            AnimationEventType::MouseEnter => {
                let element = self.element.clone();
                let elements = self.elements.clone();

                let closure = Closure::wrap(Box::new(move |_event: web_sys::MouseEvent| {
                    if let Ok(el) = element.clone().dyn_into::<HtmlElement>() {
                        let ctx = AnimationContext::new(&el);
                        let value = f(&ctx);

                        for (_name, js_val) in elements.iter() {
                            if let Ok(el) = js_val.clone().dyn_into::<HtmlElement>() {
                                let _ = el.style().set_property("transform", &value);
                            }
                        }
                    }
                }) as Box<dyn FnMut(_)>);

                let _ = self.element.add_event_listener_with_callback(
                    "mouseenter",
                    closure.as_ref().unchecked_ref(),
                );
                self.closures.push(closure);
            }
            AnimationEventType::MouseLeave => {
                let element = self.element.clone();
                let elements = self.elements.clone();

                let closure = Closure::wrap(Box::new(move |_event: web_sys::MouseEvent| {
                    if let Ok(el) = element.clone().dyn_into::<HtmlElement>() {
                        let ctx = AnimationContext::new(&el);
                        let value = f(&ctx);

                        for (_name, js_val) in elements.iter() {
                            if let Ok(el) = js_val.clone().dyn_into::<HtmlElement>() {
                                let _ = el.style().set_property("transform", &value);
                            }
                        }
                    }
                }) as Box<dyn FnMut(_)>);

                let _ = self.element.add_event_listener_with_callback(
                    "mouseleave",
                    closure.as_ref().unchecked_ref(),
                );
                self.closures.push(closure);
            }
            AnimationEventType::MouseMove { throttle_ms } => {
                return self.on_mouse_move(throttle_ms, f);
            }
            AnimationEventType::GlobalMouseMove { throttle_ms } => {
                return self.on_global_mouse_move(throttle_ms, f);
            }
            _ => {}
        }

        self
    }

    /// Build and apply the animation system
    ///
    /// This method consumes the builder and sets up all event listeners.
    /// The closures are leaked intentionally to keep them alive for the
    /// duration of the program.
    pub fn build(mut self) {
        // Leak all closures to keep them alive
        for closure in self.closures.drain(..) {
            closure.forget();
        }
    }
}
