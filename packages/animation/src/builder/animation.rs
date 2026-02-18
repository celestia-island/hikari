//! Enhanced animation builder for advanced, dynamic animations
//!
//! Provides a high-level builder that combines StylesBuilder and ClassesBuilder
//! with support for dynamic values computed at runtime, state machine support,
//! and continuous loop animations.
//!
//! # Features
//!
//! - Control multiple DOM elements simultaneously
//! - Dynamic values computed from AnimationContext
//! - State machine support with AnimationState
//! - Continuous loop animations with delta time
//! - Automatic lifecycle management
//! - Type-safe CSS properties
//!
//! # Example
//!
//! ```ignore
//! use animation::{AnimationBuilder, AnimationContext, AnimationState};
//! use animation::style::CssProperty;
//! use std::collections::HashMap;
//!
//! // Continuous animation with state
//! let mut elements = HashMap::new();
//! elements.insert("background".to_string(), background_element);
//!
//! let mut state = AnimationState::new();
//! state.set_f64("angle", 0.0);
//!
//! AnimationBuilder::new(&elements)
//!     .add_stateful_style("background", CssProperty::BackgroundPosition, |ctx, state| {
//!         // Update angle based on delta time for smooth rotation
//!         state.add_f64("angle", ctx.delta_seconds() * 60.0); // 60 degrees per second
//!         
//!         let angle = state.get_f64("angle", 0.0);
//!         let x = 50.0 + 10.0 * angle.cos();
//!         let y = 50.0 + 10.0 * angle.sin();
//!         
//!         format!("{:.1}% {:.1}%", x, y)
//!     })
//!     .start_continuous_animation();
//! ```

use std::{cell::RefCell, collections::HashMap, rc::Rc};

use wasm_bindgen::{closure::Closure, JsCast, JsValue};
use web_sys::HtmlElement;

#[cfg(target_arch = "wasm32")]
use crate::global_manager::global_animation_manager;

use super::super::{
    context::AnimationContext,
    state::AnimationState as StructAnimationState,
    style::{CssProperty, StyleBuilder},
};

use super::action::AnimationAction;
use super::value::DynamicValue;

/// Enhanced builder for creating complex animations
///
/// Combines StyleBuilder and ClassesBuilder functionality with
/// support for dynamic values, state machine, and continuous animations.
/// Can control multiple DOM elements simultaneously by name.
pub struct AnimationBuilder<'a> {
    /// Map of element names to their DOM references
    elements: &'a HashMap<String, JsValue>,
    /// Accumulated animation actions per element
    actions: HashMap<String, Vec<AnimationAction>>,
    /// Initial animation state
    initial_state: StructAnimationState,
}

impl<'a> AnimationBuilder<'a> {
    /// Create a new AnimationBuilder for given elements
    ///
    /// # Arguments
    ///
    /// * `elements` - Map of element names to DOM element references
    pub fn new(elements: &'a HashMap<String, JsValue>) -> Self {
        Self {
            elements,
            actions: HashMap::new(),
            initial_state: StructAnimationState::new(),
        }
    }

    /// Create a new AnimationBuilder with initial state
    ///
    /// # Arguments
    ///
    /// * `elements` - Map of element names to DOM element references
    /// * `initial_state` - Initial animation state
    pub fn new_with_state(
        elements: &'a HashMap<String, JsValue>,
        initial_state: StructAnimationState,
    ) -> Self {
        Self {
            elements,
            actions: HashMap::new(),
            initial_state,
        }
    }

    /// Add a static CSS style property to an element
    ///
    /// # Arguments
    ///
    /// * `element_name` - Name of element to animate
    /// * `property` - CSS property to set
    /// * `value` - Static value for property
    pub fn add_style(
        mut self,
        element_name: &str,
        property: CssProperty,
        value: impl Into<String>,
    ) -> Self {
        self.actions
            .entry(element_name.to_string())
            .or_default()
            .push(AnimationAction::style_static(property, value));
        self
    }

    /// Add a dynamic CSS style property to an element
    ///
    /// The closure will be called with an AnimationContext that provides
    /// access to element dimensions, mouse position, scroll position, etc.
    ///
    /// # Arguments
    ///
    /// * `element_name` - Name of element to animate
    /// * `property` - CSS property to set
    /// * `f` - Closure that computes value dynamically
    pub fn add_style_dynamic<F>(mut self, element_name: &str, property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static,
    {
        self.actions
            .entry(element_name.to_string())
            .or_default()
            .push(AnimationAction::style_dynamic(property, f));
        self
    }

    /// Add a stateful dynamic CSS style property to an element
    ///
    /// The closure will be called with an AnimationContext and mutable AnimationState,
    /// allowing complex state machine patterns and continuous animations.
    ///
    /// # Arguments
    ///
    /// * `element_name` - Name of element to animate
    /// * `property` - CSS property to set
    /// * `f` - Closure that computes value dynamically with state
    pub fn add_stateful_style<F>(mut self, element_name: &str, property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext, &mut StructAnimationState) -> String + 'static,
    {
        self.actions
            .entry(element_name.to_string())
            .or_default()
            .push(AnimationAction::style_stateful_dynamic(property, f));
        self
    }

    /// Add a utility class to an element
    ///
    /// # Arguments
    ///
    /// * `element_name` - Name of element
    /// * `class` - Class name to add
    pub fn add_class(mut self, element_name: &str, class: impl Into<String>) -> Self {
        self.actions
            .entry(element_name.to_string())
            .or_default()
            .push(AnimationAction::class(class));
        self
    }

    /// Add multiple utility classes to an element
    ///
    /// # Arguments
    ///
    /// * `element_name` - Name of element
    /// * `classes` - Slice of class names to add
    pub fn add_classes(mut self, element_name: &str, classes: &[impl AsRef<str>]) -> Self {
        for class in classes {
            self.actions
                .entry(element_name.to_string())
                .or_default()
                .push(AnimationAction::class(class.as_ref()));
        }
        self
    }

    /// Apply all animation actions to their respective elements
    ///
    /// This applies static styles and classes immediately.
    /// Dynamic styles are evaluated once and applied.
    pub fn apply(self) {
        self.apply_internal(false)
    }

    /// Apply all animation actions with CSS transitions
    ///
    /// Applies styles and adds CSS transitions for smooth animations.
    ///
    /// # Arguments
    ///
    /// * `duration` - Transition duration (e.g., "300ms")
    /// * `easing` - Transition timing function (e.g., "ease-in-out")
    pub fn apply_with_transition(self, duration: &str, easing: &str) {
        self.apply_with_transition_internal(duration, easing, false)
    }

    /// Start a continuous animation loop using requestAnimationFrame
    ///
    /// This is ideal for animations that need to run continuously,
    /// such as rotating gradients, particle effects, or progress indicators.
    /// The animation will automatically update with delta time for smooth motion.
    ///
    /// Returns a stop function that should be called to clean up animation.
    pub fn start_continuous_animation(self) -> Box<dyn FnOnce()> {
        self.start_animation_loop()
    }

    /// Start an animation loop with manual control
    ///
    /// Similar to `start_continuous_animation` but gives more control
    /// over animation lifecycle. Useful for complex scenarios.
    ///
    /// **Performance optimizations**:
    /// - Throttled updates (60fps target, ~16.67ms between updates)
    /// - Value caching to avoid unnecessary DOM updates
    /// - Batch style updates to minimize reflows
    ///
    /// Returns a stop function that should be called to clean up animation.
    pub fn start_animation_loop(self) -> Box<dyn FnOnce()> {
        let elements = self.elements.clone();
        let actions = self.actions;
        let mut state = self.initial_state;

        let f = Rc::new(RefCell::new(None::<js_sys::Function>));
        let g = f.clone();

        let should_stop = Rc::new(RefCell::new(false));
        let should_stop_clone = should_stop.clone();

        let timing = Rc::new(RefCell::new((0.0, 0.0, 0.0)));
        const THROTTLE_MS: f64 = 16.67;

        let cached_values: Rc<RefCell<HashMap<String, HashMap<CssProperty, String>>>> =
            Rc::new(RefCell::new(HashMap::new()));

        let animation_closure = Closure::wrap(Box::new(move || {
            if *should_stop_clone.borrow() {
                return;
            }

            let window = match web_sys::window() {
                Some(w) => w,
                None => return,
            };

            let current_time = window.performance().map(|p| p.now()).unwrap_or(0.0);
            let mut timing_ref = timing.borrow_mut();
            let previous_time = timing_ref.1;
            let time_since_last_update = current_time - timing_ref.2;

            if time_since_last_update < THROTTLE_MS {
                timing_ref.1 = current_time;
                drop(timing_ref);

                if let Some(callback) = &*f.borrow() {
                    let _ =
                        web_sys::window().and_then(|w| w.request_animation_frame(callback).ok());
                }
                return;
            }

            timing_ref.0 = timing_ref.1;
            timing_ref.1 = current_time;
            timing_ref.2 = current_time;
            drop(timing_ref);

            let mut cached_ref = cached_values.borrow_mut();
            let mut needs_update = false;

            for (element_name, js_value) in &elements {
                if let Some(element_actions) = actions.get(element_name) {
                    if let Ok(element) = js_value.clone().dyn_into::<HtmlElement>() {
                        let ctx = AnimationContext::new_with_timing(
                            &element,
                            previous_time,
                            current_time,
                        );

                        let mut new_styles: Vec<(CssProperty, String)> = Vec::new();
                        let element_cache = cached_ref.entry(element_name.clone()).or_default();

                        for action in element_actions {
                            if let AnimationAction::Style(prop, value) = action {
                                if matches!(
                                    value,
                                    DynamicValue::Dynamic(_) | DynamicValue::StatefulDynamic(_)
                                ) {
                                    let new_value = value.evaluate(&ctx, &mut state);

                                    if let Some(old_value) = element_cache.get(prop) {
                                        if old_value != &new_value {
                                            new_styles.push((*prop, new_value.clone()));
                                            element_cache.insert(*prop, new_value);
                                            needs_update = true;
                                        }
                                    } else {
                                        new_styles.push((*prop, new_value.clone()));
                                        element_cache.insert(*prop, new_value);
                                        needs_update = true;
                                    }
                                }
                            }
                        }

                        if needs_update && !new_styles.is_empty() {
                            let mut builder = StyleBuilder::new(&element);
                            for (prop, value_str) in &new_styles {
                                builder = builder.add(*prop, value_str);
                            }
                            builder.apply();
                            needs_update = false;
                        }
                    }
                }
            }
            drop(cached_ref);

            if let Some(callback) = &*f.borrow() {
                let _ = web_sys::window().and_then(|w| w.request_animation_frame(callback).ok());
            }
        }) as Box<dyn FnMut()>);

        let callback: &js_sys::Function = animation_closure.as_ref().unchecked_ref();
        *g.borrow_mut() = Some(callback.clone());

        let _ = web_sys::window().and_then(|w| w.request_animation_frame(callback).ok());
        animation_closure.forget();

        let should_stop_final = should_stop.clone();
        Box::new(move || {
            *should_stop_final.borrow_mut() = true;
        })
    }

    fn apply_internal(self, _is_transition: bool) {
        for (element_name, actions) in self.actions {
            if let Some(js_value) = self.elements.get(&element_name) {
                if let Ok(element) = js_value.clone().dyn_into::<HtmlElement>() {
                    let ctx = AnimationContext::new(&element);
                    let mut state = self.initial_state.clone();
                    let builder = StyleBuilder::new(&element);
                    let mut has_style = false;

                    for action in &actions {
                        match action {
                            AnimationAction::Style(prop, value) => {
                                has_style = true;
                                let value_str = value.evaluate(&ctx, &mut state);
                                builder.clone().add(*prop, &value_str);
                            }
                            AnimationAction::Class(class) => {
                                let _ = element.class_list().add_1(class);
                            }
                        }
                    }

                    if has_style {
                        builder.apply();
                    }
                }
            }
        }
    }

    fn apply_with_transition_internal(self, duration: &str, easing: &str, _is_transition: bool) {
        for element_name in self.actions.keys() {
            if let Some(js_value) = self.elements.get(element_name) {
                if let Ok(element) = js_value.clone().dyn_into::<HtmlElement>() {
                    StyleBuilder::new(&element)
                        .add(
                            CssProperty::Transition,
                            &format!("all {} {}", duration, easing),
                        )
                        .apply();
                }
            }
        }

        self.apply();
    }
}

// ===== Backward compatibility =====

/// Create a new AnimationBuilder (backward compatibility function)
pub fn new_animation_builder(elements: &HashMap<String, JsValue>) -> AnimationBuilder<'_> {
    AnimationBuilder::new(elements)
}

/// Helper function to start animation with global manager
#[cfg(target_arch = "wasm32")]
pub fn start_animation_with_global_manager(
    elements: &HashMap<String, JsValue>,
    actions: &HashMap<String, Vec<AnimationAction>>,
    initial_state: StructAnimationState,
) -> Box<dyn FnOnce()> {
    use crate::global_manager;

    let element_name = elements
        .keys()
        .next()
        .expect("No elements to animate")
        .clone();
    let element_actions = actions.get(&element_name).expect("No actions for element");

    let js_value = elements.get(&element_name).expect("Element not found");
    let element = js_value
        .clone()
        .dyn_into::<HtmlElement>()
        .expect("Failed to convert to HtmlElement");

    web_sys::console::log_2(
        &format!(
            "🎬 Starting animation: {} with {} actions",
            element_name,
            element_actions.len()
        )
        .into(),
        &element_name.into(),
    );

    let mut state = initial_state;
    state.set_f64("rotation_speed", 2.0 * std::f64::consts::PI / 60.0);
    state.set_f64("radius_percent", 10.0);
    state.set_f64("center_x", 50.0);
    state.set_f64("center_y", 50.0);
    state.set_f64("angle", 0.0);

    let callback = global_manager::create_animation_callback(
        element,
        state,
        element_actions.to_vec(),
        |ctx, state| {
            let rotation_speed = state.get_f64("rotation_speed", 0.0);
            let delta_seconds = ctx.delta_seconds();
            state.add_f64("angle", rotation_speed * delta_seconds);

            let mut angle = state.get_f64("angle", 0.0);
            if angle > 2.0 * std::f64::consts::PI {
                angle -= 2.0 * std::f64::consts::PI;
                state.set_f64("angle", angle);
            }

            let radius = state.get_f64("radius_percent", 10.0);
            let center_x = state.get_f64("center_x", 50.0);
            let center_y = state.get_f64("center_y", 50.0);

            let x = center_x + radius * angle.cos();
            let y = center_y + radius * angle.sin();
            web_sys::console::log_1(
                &format!("Animation progress: x={:.1}%, y={:.1}%", x, y).into(),
            );
        },
    );

    let animation_name = format!("bg_anim_{:?}", std::time::Instant::now());
    global_animation_manager().register(animation_name.clone(), callback);

    let log_msg = format!(
        "✅ Animation {} registered with global manager",
        animation_name
    );
    web_sys::console::log_2(&log_msg.into(), &animation_name.clone().into());

    let animation_name_final = animation_name;
    Box::new(move || {
        let stop_msg = format!("🛑 Stopping animation: {}", animation_name_final);
        web_sys::console::log_2(&stop_msg.into(), &animation_name_final.clone().into());
        global_animation_manager().unregister(&animation_name_final);
    })
}

#[cfg(not(target_arch = "wasm32"))]
pub fn start_animation_with_global_manager(
    _elements: &HashMap<String, JsValue>,
    _actions: &HashMap<String, Vec<AnimationAction>>,
    _initial_state: StructAnimationState,
) -> Box<dyn FnOnce()> {
    Box::new(|| {
        web_sys::console::log_1(&"Animation not available on this platform".into());
    })
}
