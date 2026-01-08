//! Animation builder for advanced, dynamic animations
//!
//! Provides a high-level builder that combines StylesBuilder and ClassesBuilder
//! with support for dynamic values computed at runtime.
//!
//! # Features
//!
//! - Control multiple DOM elements simultaneously
//! - Dynamic values computed from AnimationContext
//! - Automatic transition management
//! - Type-safe CSS properties
//!
//! # Example
//!
//! ```ignore
//! use animation::{AnimationBuilder, AnimationContext};
//! use animation::style::CssProperty;
//! use std::collections::HashMap;
//!
//! // Single element animation
//! let mut elements = HashMap::new();
//! elements.insert("button".to_string(), button_element.clone());
//!
//! // Static animation
//! AnimationBuilder::new(&elements)
//!     .add_style("button", CssProperty::Width, "100px")
//!     .add_class("button", "hi-flex")
//!     .apply();
//!
//! // Dynamic animation - element follows mouse
//! AnimationBuilder::new(&elements)
//!     .add_style_dynamic("button", CssProperty::Transform, |ctx| {
//!         let x = ctx.mouse_x();
//!         let y = ctx.mouse_y();
//!         format!("translate({}px, {}px)", x, y)
//!     })
//!     .apply_with_transition("300ms", "ease-in-out");
//!
//! // Multi-element animation
//! let mut elements = HashMap::new();
//! elements.insert("button".to_string(), button_element);
//! elements.insert("icon".to_string(), icon_element);
//!
//! AnimationBuilder::new(&elements)
//!     .add_style("button", CssProperty::Opacity, "0.8")
//!     .add_style_dynamic("icon", CssProperty::Transform, |ctx| {
//!         let scale = 1.0 + (ctx.distance_from_center() / 500.0).min(0.3);
//!         format!("scale({})", scale)
//!     })
//!     .add_class("button", "hi-flex")
//!     .apply();
//! ```

use std::collections::HashMap;

use wasm_bindgen::{closure::Closure, JsCast, JsValue};
use web_sys::{Element, HtmlElement};

use super::{
    context::AnimationContext,
    style::{CssProperty, StyleBuilder},
};

/// Dynamic value that can be computed at runtime
///
/// Values can be either static strings or closures that compute
/// values based on the current animation context.
pub enum DynamicValue {
    /// Static string value
    Static(String),
    /// Dynamic value computed from context (element-specific)
    Dynamic(Box<dyn Fn(&AnimationContext) -> String + 'static>),
}

impl DynamicValue {
    /// Create a static value
    pub fn static_value(value: impl Into<String>) -> Self {
        Self::Static(value.into())
    }

    /// Create a dynamic value from a closure
    pub fn dynamic<F>(f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static,
    {
        Self::Dynamic(Box::new(f))
    }

    /// Evaluate the dynamic value with the given context
    pub fn evaluate(&self, ctx: &AnimationContext) -> String {
        match self {
            DynamicValue::Static(s) => s.clone(),
            DynamicValue::Dynamic(f) => f(ctx),
        }
    }
}

impl From<String> for DynamicValue {
    fn from(s: String) -> Self {
        Self::Static(s)
    }
}

impl From<&str> for DynamicValue {
    fn from(s: &str) -> Self {
        Self::Static(s.to_string())
    }
}

/// Animation action that can be applied to an element
///
/// Actions can be either CSS styles or utility classes,
/// supporting both static and dynamic values.
pub enum AnimationAction {
    /// CSS style property with value
    Style(CssProperty, DynamicValue),
    /// Utility class (from palette package)
    Class(String),
}

// Manual Clone implementation
// Static values can be cloned, dynamic closures cannot
impl Clone for AnimationAction {
    fn clone(&self) -> Self {
        match self {
            AnimationAction::Class(class) => AnimationAction::Class(class.clone()),
            AnimationAction::Style(prop, value) => {
                match value {
                    DynamicValue::Static(s) => {
                        AnimationAction::Style(*prop, DynamicValue::Static(s.clone()))
                    }
                    // Dynamic closures cannot be cloned - create placeholder
                    DynamicValue::Dynamic(_) => {
                        AnimationAction::Style(*prop, DynamicValue::static_value(""))
                    }
                }
            }
        }
    }
}

impl AnimationAction {
    /// Create a style action with a static value
    pub fn style_static(property: CssProperty, value: impl Into<String>) -> Self {
        Self::Style(property, DynamicValue::static_value(value))
    }

    /// Create a style action with a dynamic value
    pub fn style_dynamic<F>(property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static,
    {
        Self::Style(property, DynamicValue::dynamic(f))
    }

    /// Create a class action
    pub fn class(class: impl Into<String>) -> Self {
        Self::Class(class.into())
    }
}

/// Builder for creating complex animations
///
/// Combines StyleBuilder and ClassesBuilder functionality with
/// support for dynamic values computed at runtime.
/// Can control multiple DOM elements simultaneously by name.
///
/// # Example
///
/// ```ignore
/// use animation::AnimationBuilder;
/// use animation::style::CssProperty;
/// use std::collections::HashMap;
///
/// // Single element animation
/// let mut elements = HashMap::new();
/// elements.insert("button".to_string(), button_element);
///
/// AnimationBuilder::new(&elements)
///     .add_style("button", CssProperty::Width, "100px")
///     .add_class("button", "hi-flex")
///     .apply();
///
/// // Multi-element animation with dynamic values
/// AnimationBuilder::new(&elements)
///     .add_style("button", CssProperty::Transform, |ctx| {
///         let scale = 1.0 + (ctx.distance_from_center() / 500.0).min(0.3);
///         format!("scale({})", scale)
///     })
///     .add_style("icon", CssProperty::Transform, |ctx| {
///         let angle = ctx.angle_from_center();
///         format!("rotate({}rad)", angle)
///     })
///     .apply_with_transition("300ms", "ease-in-out");
/// ```
pub struct AnimationBuilder<'a> {
    /// Map of element names to their DOM references
    elements: &'a HashMap<String, JsValue>,
    /// Accumulated animation actions per element
    actions: HashMap<String, Vec<AnimationAction>>,
}

impl<'a> AnimationBuilder<'a> {
    /// Create a new AnimationBuilder for the given elements
    ///
    /// # Arguments
    ///
    /// * `elements` - Map of element names to DOM element references
    pub fn new(elements: &'a HashMap<String, JsValue>) -> Self {
        Self {
            elements,
            actions: HashMap::new(),
        }
    }

    /// Add a static CSS style property to an element
    ///
    /// # Arguments
    ///
    /// * `element_name` - Name of the element to animate
    /// * `property` - CSS property to set
    /// * `value` - Static value for the property
    pub fn add_style(
        mut self,
        element_name: &str,
        property: CssProperty,
        value: impl Into<String>,
    ) -> Self {
        self.actions
            .entry(element_name.to_string())
            .or_insert_with(Vec::new)
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
    /// * `element_name` - Name of the element to animate
    /// * `property` - CSS property to set
    /// * `f` - Closure that computes the value dynamically
    pub fn add_style_dynamic<F>(mut self, element_name: &str, property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static,
    {
        self.actions
            .entry(element_name.to_string())
            .or_insert_with(Vec::new)
            .push(AnimationAction::style_dynamic(property, f));
        self
    }

    /// Add a utility class to an element
    ///
    /// # Arguments
    ///
    /// * `element_name` - Name of the element
    /// * `class` - Class name to add
    pub fn add_class(mut self, element_name: &str, class: impl Into<String>) -> Self {
        self.actions
            .entry(element_name.to_string())
            .or_insert_with(Vec::new)
            .push(AnimationAction::class(class));
        self
    }

    /// Add multiple utility classes to an element
    ///
    /// # Arguments
    ///
    /// * `element_name` - Name of the element
    /// * `classes` - Slice of class names to add
    pub fn add_classes(mut self, element_name: &str, classes: &[impl AsRef<str>]) -> Self {
        for class in classes {
            self.actions
                .entry(element_name.to_string())
                .or_insert_with(Vec::new)
                .push(AnimationAction::class(class.as_ref()));
        }
        self
    }

    /// Apply all animation actions to their respective elements
    ///
    /// This evaluates any dynamic values and applies all styles and classes
    /// to the target elements.
    pub fn apply(self) {
        for (element_name, actions) in &self.actions {
            if let Some(js_value) = self.elements.get(element_name) {
                // Try to convert to HtmlElement
                if let Ok(element) = js_value.clone().dyn_into::<HtmlElement>() {
                    self.apply_to_element(&element, actions);
                }
            }
        }
    }

    /// Apply animation actions with automatic transition
    ///
    /// Adds a CSS transition to smoothly animate to the new states.
    ///
    /// # Arguments
    ///
    /// * `duration` - Transition duration (e.g., "300ms")
    /// * `easing` - Transition timing function (e.g., "ease-in-out")
    pub fn apply_with_transition(self, duration: &str, easing: &str) {
        for (element_name, actions) in &self.actions {
            if let Some(js_value) = self.elements.get(element_name) {
                if let Ok(element) = js_value.clone().dyn_into::<HtmlElement>() {
                    // First, apply the transition property
                    let transition_value = format!("all {} {}", duration, easing);
                    StyleBuilder::new(&element)
                        .add(CssProperty::Transition, &transition_value)
                        .apply();

                    // Then apply all the actions (without cloning)
                    self.apply_to_element(&element, actions);
                }
            }
        }
    }

    /// Apply actions to a single element
    fn apply_to_element(&self, element: &HtmlElement, actions: &[AnimationAction]) {
        let ctx = AnimationContext::new(element);

        // Separate styles and classes
        let mut styles: Vec<(CssProperty, String)> = Vec::new();
        let mut classes: Vec<String> = Vec::new();

        for action in actions {
            match action {
                AnimationAction::Style(prop, value) => {
                    styles.push((*prop, value.evaluate(&ctx)));
                }
                AnimationAction::Class(class) => {
                    classes.push(class.clone());
                }
            }
        }

        // Apply styles using StyleBuilder
        if !styles.is_empty() {
            let style_refs: Vec<(CssProperty, &str)> =
                styles.iter().map(|(p, v)| (*p, v.as_str())).collect();
            StyleBuilder::new(element).add_all(&style_refs).apply();
        }

        // Apply classes
        let elem = element.clone().dyn_into::<Element>().unwrap();
        for class in classes {
            let _ = elem.class_list().add_1(&class);
        }
    }
}

/// Animation manager for tracking and controlling animations
pub struct AnimationManager {
    animations: HashMap<String, Vec<AnimationAction>>,
}

impl AnimationManager {
    /// Create a new animation manager
    pub fn new() -> Self {
        Self {
            animations: HashMap::new(),
        }
    }

    /// Register animation actions for a named animation
    ///
    /// # Arguments
    ///
    /// * `name` - Animation name
    /// * `actions` - Animation actions (can apply to multiple elements)
    pub fn register(&mut self, name: impl Into<String>, actions: Vec<AnimationAction>) {
        self.animations.insert(name.into(), actions);
    }

    /// Apply a registered animation by name
    ///
    /// # Arguments
    ///
    /// * `name` - Animation name to apply
    /// * `elements` - Map of element names to DOM elements
    ///
    /// # Returns
    ///
    /// true if animation was found and applied, false otherwise
    pub fn apply(&self, name: &str, elements: &HashMap<String, JsValue>) -> bool {
        if let Some(actions) = self.animations.get(name) {
            let mut builder = AnimationBuilder::new(elements);
            for action in actions {
                match action {
                    AnimationAction::Style(prop, value) => {
                        // Apply to all elements (broadcast)
                        for element_name in elements.keys() {
                            let elem_value = &elements[element_name];
                            if let Ok(elem) = elem_value.clone().dyn_into::<HtmlElement>() {
                                let evaluated = value.evaluate(&AnimationContext::new(&elem));
                                builder = builder.add_style(element_name, *prop, evaluated);
                            }
                        }
                    }
                    AnimationAction::Class(class) => {
                        // Apply to all elements
                        for element_name in elements.keys() {
                            builder = builder.add_class(element_name, class);
                        }
                    }
                }
            }
            builder.apply();
            true
        } else {
            false
        }
    }
}

impl Default for AnimationManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_arch = "wasm32")]
    #[test]
    fn test_animation_action_creation() {
        let action = AnimationAction::style_static(CssProperty::Width, "100px");
        match action {
            AnimationAction::Style(prop, _) => assert_eq!(prop, CssProperty::Width),
            _ => panic!("Expected Style action"),
        }

        let action = AnimationAction::class("test-class");
        match action {
            AnimationAction::Class(c) => assert_eq!(c, "test-class"),
            _ => panic!("Expected Class action"),
        }
    }
}

// ===== Debounced Animation Builder =====

/// Debounced animation builder for throttling animation updates
///
/// Prevents excessive animation updates by debouncing rapid triggers.
/// Animations are only applied after a period of inactivity (default 500ms).
///
/// # Features
///
/// - Automatic debouncing with configurable delay
/// - Updates pending animations on each trigger
/// - Applies only the latest animation state after debounce period
/// - Per-element independent debouncing
///
/// # Example
///
/// ```ignore
/// use animation::AnimationBuilderDebounced;
/// use animation::style::CssProperty;
/// use std::collections::HashMap;
///
/// let mut elements = HashMap::new();
/// elements.insert("button".to_string(), button_element);
///
/// // Create debounced builder with 500ms delay
/// let mut debounced = AnimationBuilderDebounced::new(&elements, 500);
///
/// // These rapid updates will be debounced
/// debounced.add_style("button", CssProperty::Opacity, "0.5");
/// debounced.add_style("button", CssProperty::Transform, "scale(1.1)");
/// // Only the last state will be applied after 500ms
/// ```
#[cfg(target_arch = "wasm32")]
pub struct AnimationBuilderDebounced<'a> {
    /// Elements to animate
    elements: &'a HashMap<String, JsValue>,
    /// Pending animation actions per element
    pending_actions: HashMap<String, Vec<AnimationAction>>,
    /// Debounce delay in milliseconds
    debounce_ms: u32,
    /// Active timeout handles per element
    timeout_handles: HashMap<String, i32>,
}

#[cfg(target_arch = "wasm32")]
impl<'a> AnimationBuilderDebounced<'a> {
    /// Create a new debounced animation builder
    ///
    /// # Arguments
    ///
    /// * `elements` - Map of element names to DOM element references
    /// * `debounce_ms` - Debounce delay in milliseconds (default 500)
    pub fn new(elements: &'a HashMap<String, JsValue>, debounce_ms: u32) -> Self {
        Self {
            elements,
            pending_actions: HashMap::new(),
            debounce_ms,
            timeout_handles: HashMap::new(),
        }
    }

    /// Add a static CSS style property to an element (debounced)
    ///
    /// # Arguments
    ///
    /// * `element_name` - Name of the element to animate
    /// * `property` - CSS property to set
    /// * `value` - Static value for the property
    pub fn add_style(
        &mut self,
        element_name: &str,
        property: CssProperty,
        value: impl Into<String>,
    ) -> &mut Self {
        let action = AnimationAction::style_static(property, value);
        self.pending_actions
            .entry(element_name.to_string())
            .or_insert_with(Vec::new)
            .push(action);
        self.schedule_apply(element_name);
        self
    }

    /// Add a dynamic CSS style property to an element (debounced)
    ///
    /// # Arguments
    ///
    /// * `element_name` - Name of the element to animate
    /// * `property` - CSS property to set
    /// * `f` - Closure that computes the value dynamically
    pub fn add_style_dynamic<F>(
        &mut self,
        element_name: &str,
        property: CssProperty,
        f: F,
    ) -> &mut Self
    where
        F: Fn(&AnimationContext) -> String + 'static,
    {
        let action = AnimationAction::style_dynamic(property, f);
        self.pending_actions
            .entry(element_name.to_string())
            .or_insert_with(Vec::new)
            .push(action);
        self.schedule_apply(element_name);
        self
    }

    /// Add a utility class to an element (debounced)
    ///
    /// # Arguments
    ///
    /// * `element_name` - Name of the element
    /// * `class` - Class name to add
    pub fn add_class(&mut self, element_name: &str, class: impl Into<String>) -> &mut Self {
        let action = AnimationAction::class(class);
        self.pending_actions
            .entry(element_name.to_string())
            .or_insert_with(Vec::new)
            .push(action);
        self.schedule_apply(element_name);
        self
    }

    /// Add multiple utility classes to an element (debounced)
    ///
    /// # Arguments
    ///
    /// * `element_name` - Name of the element
    /// * `classes` - Slice of class names to add
    pub fn add_classes(&mut self, element_name: &str, classes: &[impl AsRef<str>]) -> &mut Self {
        for class in classes {
            let action = AnimationAction::class(class.as_ref());
            self.pending_actions
                .entry(element_name.to_string())
                .or_insert_with(Vec::new)
                .push(action);
        }
        self.schedule_apply(element_name);
        self
    }

    /// Schedule applying animations for an element after debounce delay
    fn schedule_apply(&mut self, element_name: &str) {
        let window = match web_sys::window() {
            Some(w) => w,
            None => return,
        };

        // Clear any existing timeout for this element
        if let Some(handle) = self.timeout_handles.remove(element_name) {
            let _ = window.clear_timeout_with_handle(handle);
        }

        // Clone necessary data for the closure
        let element_name = element_name.to_string();
        let element_name_for_closure = element_name.clone();
        let element_name_for_timeout = element_name.clone();
        let elements = self.elements.clone();
        let pending_actions = self.pending_actions.clone();
        let debounce_ms = self.debounce_ms;

        // Set new timeout
        let closure = Closure::once(move || {
            if let Some(actions) = pending_actions.get(&element_name_for_closure) {
                if let Some(js_value) = elements.get(&element_name_for_closure) {
                    if let Ok(element) = js_value.clone().dyn_into::<HtmlElement>() {
                        // Apply all pending actions
                        apply_actions_to_element(&element, actions);
                    }
                }
            }
        });

        let result = window.set_timeout_with_callback_and_timeout_and_arguments_0(
            closure.as_ref().unchecked_ref(),
            debounce_ms as i32,
        );

        match result {
            Ok(handle) => {
                self.timeout_handles
                    .insert(element_name_for_timeout, handle);
                closure.forget();
            }
            Err(_) => {
                // Timeout failed, apply immediately
                if let Some(actions) = self.pending_actions.get(&element_name) {
                    if let Some(js_value) = self.elements.get(&element_name) {
                        if let Ok(element) = js_value.clone().dyn_into::<HtmlElement>() {
                            apply_actions_to_element(&element, actions);
                        }
                    }
                }
            }
        }
    }

    /// Immediately flush all pending animations (bypasses debounce)
    pub fn flush(&mut self) {
        let element_names: Vec<String> = self.pending_actions.keys().cloned().collect();

        for element_name in element_names {
            // Clear any pending timeout
            if let Some(window) = web_sys::window() {
                if let Some(handle) = self.timeout_handles.remove(&element_name) {
                    let _ = window.clear_timeout_with_handle(handle);
                }
            }

            // Apply pending actions immediately
            if let Some(actions) = self.pending_actions.remove(&element_name) {
                if let Some(js_value) = self.elements.get(&element_name) {
                    if let Ok(element) = js_value.clone().dyn_into::<HtmlElement>() {
                        apply_actions_to_element(&element, &actions);
                    }
                }
            }
        }
    }

    /// Cancel all pending animations
    pub fn cancel_all(&mut self) {
        if let Some(window) = web_sys::window() {
            for handle in self.timeout_handles.values() {
                let _ = window.clear_timeout_with_handle(*handle);
            }
        }
        self.timeout_handles.clear();
        self.pending_actions.clear();
    }
}

/// Apply animation actions to an element (shared helper)
#[cfg(target_arch = "wasm32")]
fn apply_actions_to_element(element: &HtmlElement, actions: &[AnimationAction]) {
    let ctx = AnimationContext::new(element);

    // Separate styles and classes
    let mut styles: Vec<(CssProperty, String)> = Vec::new();
    let mut classes: Vec<String> = Vec::new();

    for action in actions {
        match action {
            AnimationAction::Style(prop, value) => {
                styles.push((*prop, value.evaluate(&ctx)));
            }
            AnimationAction::Class(class) => {
                classes.push(class.clone());
            }
        }
    }

    // Apply styles using StyleBuilder
    if !styles.is_empty() {
        let style_refs: Vec<(CssProperty, &str)> =
            styles.iter().map(|(p, v)| (*p, v.as_str())).collect();
        StyleBuilder::new(element).add_all(&style_refs).apply();
    }

    // Apply classes
    let elem = element.clone().dyn_into::<web_sys::Element>().unwrap();
    for class in classes {
        let _ = elem.class_list().add_1(&class);
    }
}
