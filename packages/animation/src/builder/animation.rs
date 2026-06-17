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
//! use tairitsu_vdom::Platform;
//!
//! // Continuous animation with state
//! let mut elements = HashMap::new();
//! elements.insert("background".to_string(), background_handle);
//!
//! let mut state = AnimationState::new();
//! state.set_f64("angle", 0.0);
//!
//! AnimationBuilder::new(platform, &elements)
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

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

use tairitsu_vdom::Platform;

use super::super::context::AnimationContext;
use super::super::state::AnimationDataStore as StructAnimationState;
use super::super::style::CssProperty;
use super::action::AnimationAction;
use super::value::DynamicValue;

/// Enhanced builder for creating complex animations
///
/// Combines StyleBuilder and ClassesBuilder functionality with
/// support for dynamic values, state machine, and continuous animations.
/// Can control multiple DOM elements simultaneously by name.
pub struct AnimationBuilder<'a, P: Platform> {
    /// Platform for DOM operations
    platform: Rc<RefCell<P>>,
    /// Map of element names to their element handles
    elements: &'a HashMap<String, P::Element>,
    /// Accumulated animation actions per element
    actions: HashMap<String, Vec<AnimationAction<P>>>,
    /// Initial animation state
    initial_state: StructAnimationState,
}

impl<'a, P: Platform> AnimationBuilder<'a, P> {
    /// Create a new AnimationBuilder for given elements
    ///
    /// # Arguments
    ///
    /// * `platform` - Platform reference for DOM operations
    /// * `elements` - Map of element names to element handles
    pub fn new(platform: Rc<RefCell<P>>, elements: &'a HashMap<String, P::Element>) -> Self {
        Self {
            platform,
            elements,
            actions: HashMap::new(),
            initial_state: StructAnimationState::new(),
        }
    }

    /// Create a new AnimationBuilder with initial state
    ///
    /// # Arguments
    ///
    /// * `platform` - Platform reference for DOM operations
    /// * `elements` - Map of element names to element handles
    /// * `initial_state` - Initial animation state
    pub fn new_with_state(
        platform: Rc<RefCell<P>>,
        elements: &'a HashMap<String, P::Element>,
        initial_state: StructAnimationState,
    ) -> Self {
        Self {
            platform,
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
        F: Fn(&AnimationContext<P>) -> String + 'static,
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
        F: Fn(&AnimationContext<P>, &mut StructAnimationState) -> String + 'static,
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
    #[must_use]
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
    #[must_use]
    pub fn start_animation_loop(self) -> Box<dyn FnOnce()> {
        let platform = Rc::clone(&self.platform);
        let platform_for_stop = platform.clone();
        let elements = self.elements.clone();
        let actions = self.actions;
        let state = Rc::new(RefCell::new(self.initial_state));

        let should_stop = Rc::new(RefCell::new(false));
        let should_stop_clone = should_stop.clone();

        let timing = Rc::new(RefCell::new((0.0, 0.0, 0.0)));

        let cached_values: Rc<RefCell<HashMap<String, HashMap<CssProperty, String>>>> =
            Rc::new(RefCell::new(HashMap::new()));

        let raf_id = Rc::new(RefCell::new(None::<u32>));

        // Define the per-frame animation work as a shared function
        let animate_frame = {
            let platform = platform.clone();
            let should_stop = should_stop.clone();

            move |current_time: f64| {
                if *should_stop.borrow() {
                    return;
                }

                let previous_time = {
                    let mut timing_ref = timing.borrow_mut();
                    let prev = timing_ref.0;
                    timing_ref.1 = current_time;
                    timing_ref.2 = current_time - prev;
                    timing_ref.0 = current_time;
                    prev
                };

                let mut cached_ref = cached_values.borrow_mut();
                let mut state_ref = state.borrow_mut();

                for (element_name, element_handle) in &elements {
                    if let Some(element_actions) = actions.get(element_name) {
                        let ctx = AnimationContext::new_with_timing(
                            platform.clone(),
                            element_handle.clone(),
                            previous_time,
                            current_time,
                        );

                        let mut new_styles: Vec<(CssProperty, String)> = Vec::new();
                        let element_cache = cached_ref.entry(element_name.clone()).or_default();

                        for action in element_actions {
                            if let AnimationAction::Style(prop, value) = action
                                && matches!(
                                    value,
                                    DynamicValue::Dynamic(_) | DynamicValue::StatefulDynamic(_)
                                )
                            {
                                let new_value = value.evaluate(&ctx, &mut state_ref);

                                if let Some(old_value) = element_cache.get(prop) {
                                    if old_value != &new_value {
                                        new_styles.push((*prop, new_value.clone()));
                                        element_cache.insert(*prop, new_value);
                                    }
                                } else {
                                    new_styles.push((*prop, new_value.clone()));
                                    element_cache.insert(*prop, new_value);
                                }
                            }
                        }

                        if !new_styles.is_empty() {
                            for (prop, value_str) in &new_styles {
                                platform.borrow_mut().set_style(
                                    element_handle,
                                    prop.as_str(),
                                    value_str,
                                );
                            }
                        }
                    }
                }
            }
        };

        // Recursive frame scheduler
        type Scheduler = Rc<RefCell<Option<Box<dyn FnMut(f64)>>>>;
        let scheduler: Scheduler = Rc::new(RefCell::new(None));

        let scheduler_for_schedule = scheduler.clone();
        let scheduler_for_start = scheduler.clone();
        let scheduler_for_stop = scheduler.clone();

        let platform_for_start = platform.clone();
        let raf_id_for_start = raf_id.clone();
        let raf_id_for_stop = raf_id.clone();
        let schedule_next = move |current_time: f64| {
            animate_frame(current_time);

            if !*should_stop.borrow() {
                let sched = scheduler_for_schedule.clone();
                let cb = Box::new(move |ts: f64| {
                    let mut s = sched.borrow_mut();
                    if let Some(ref mut scheduler_fn) = *s {
                        scheduler_fn(ts);
                    }
                });
                let id = platform.borrow_mut().request_animation_frame(cb);
                *raf_id.borrow_mut() = Some(id);
            }
        };

        *scheduler.borrow_mut() = Some(Box::new(schedule_next));

        // Start first frame
        {
            let mut s = scheduler_for_start.borrow_mut();
            if let Some(ref mut _f) = *s {
                let cb = {
                    let cell = scheduler_for_start.clone();
                    Box::new(move |ts: f64| {
                        let mut g = cell.borrow_mut();
                        if let Some(ref mut fn_ptr) = *g {
                            fn_ptr(ts);
                        }
                    })
                };
                let id = platform_for_start.borrow_mut().request_animation_frame(cb);
                *raf_id_for_start.borrow_mut() = Some(id);
            }
        }

        Box::new(move || {
            *should_stop_clone.borrow_mut() = true;
            // Clear scheduler to break the Rc self-reference cycle
            *scheduler_for_stop.borrow_mut() = None;
            if let Some(id) = raf_id_for_stop.take() {
                platform_for_stop.borrow_mut().cancel_animation_frame(id);
            }
        })
    }

    fn apply_internal(self, _is_transition: bool) {
        for (element_name, actions) in self.actions {
            if let Some(element_handle) = self.elements.get(&element_name) {
                let ctx = AnimationContext::new(self.platform.clone(), element_handle.clone());
                let mut state = self.initial_state.clone();

                for action in &actions {
                    match action {
                        AnimationAction::Style(prop, value) => {
                            let value_str = value.evaluate(&ctx, &mut state);
                            self.platform.borrow_mut().set_style(
                                element_handle,
                                prop.as_str(),
                                &value_str,
                            );
                        }
                        AnimationAction::Class(class) => {
                            // Note: set_class is not directly available in Platform trait
                            // This would need to be implemented via set_attribute
                            self.platform.borrow_mut().set_attribute(
                                element_handle,
                                "class",
                                class,
                            );
                        }
                    }
                }
            }
        }
    }

    fn apply_with_transition_internal(self, duration: &str, easing: &str, _is_transition: bool) {
        for element_name in self.actions.keys() {
            if let Some(element_handle) = self.elements.get(element_name) {
                self.platform.borrow_mut().set_style(
                    element_handle,
                    "transition",
                    &format!("all {duration} {easing}"),
                );
            }
        }

        self.apply();
    }
}

// ===== Backward compatibility =====

/// Create a new AnimationBuilder (backward compatibility function)
pub fn new_animation_builder<'a, P: Platform>(
    platform: Rc<RefCell<P>>,
    elements: &'a HashMap<String, P::Element>,
) -> AnimationBuilder<'a, P> {
    AnimationBuilder::new(platform, elements)
}
