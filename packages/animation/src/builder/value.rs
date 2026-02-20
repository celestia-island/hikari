//! Dynamic value types for animation system

use super::super::{context::AnimationContext, state::AnimationState as StructAnimationState};

/// Simple callback type for dynamic values
pub type AnimationCallback = dyn Fn(&AnimationContext) -> String + 'static;

/// Callback type with state access
pub type StatefulCallback =
    dyn Fn(&AnimationContext, &mut StructAnimationState) -> String + 'static;

/// Callback type without return value
pub type VoidCallback = dyn Fn(&AnimationContext) + 'static;

/// Mouse move holder type
pub type MousemoveHolder = std::rc::Rc<
    std::cell::RefCell<
        Option<wasm_bindgen::closure::Closure<dyn Fn(web_sys::MouseEvent) + 'static>>,
    >,
>;

/// Enhanced dynamic value that can be computed at runtime
///
/// Values can be either static strings or callbacks that compute
/// values based on current animation context and state.
pub enum DynamicValue {
    /// Static string value
    Static(String),
    /// Dynamic value computed from context (element-specific)
    Dynamic(Box<AnimationCallback>),
    /// Stateful dynamic value computed from context and animation state
    StatefulDynamic(Box<StatefulCallback>),
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

    /// Create a stateful dynamic value from a closure
    pub fn stateful_dynamic<F>(f: F) -> Self
    where
        F: Fn(&AnimationContext, &mut StructAnimationState) -> String + 'static,
    {
        Self::StatefulDynamic(Box::new(f))
    }

    /// Evaluate dynamic value with given context and state
    pub fn evaluate(&self, ctx: &AnimationContext, state: &mut StructAnimationState) -> String {
        match self {
            DynamicValue::Static(s) => s.clone(),
            DynamicValue::Dynamic(f) => f(ctx),
            DynamicValue::StatefulDynamic(f) => f(ctx, state),
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
