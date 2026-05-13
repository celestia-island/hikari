//! Dynamic value types for animation system

use super::super::{context::AnimationContext, state::AnimationDataStore as StructAnimationState};
use tairitsu_vdom::Platform;

/// Simple callback type for dynamic values
pub type AnimationCallback<P> = dyn Fn(&AnimationContext<P>) -> String + 'static;

/// Callback type with state access
pub type StatefulCallback<P> =
    dyn Fn(&AnimationContext<P>, &mut StructAnimationState) -> String + 'static;

/// Callback type without return value
pub type VoidCallback<P> = dyn Fn(&AnimationContext<P>) + 'static;

/// Enhanced dynamic value that can be computed at runtime
///
/// Values can be either static strings or callbacks that compute
/// values based on current animation context and state.
pub enum DynamicValue<P: Platform> {
    /// Static string value
    Static(String),
    /// Dynamic value computed from context (element-specific)
    Dynamic(Box<AnimationCallback<P>>),
    /// Stateful dynamic value computed from context and animation state
    StatefulDynamic(Box<StatefulCallback<P>>),
}

impl<P: Platform> DynamicValue<P> {
    /// Create a static value
    pub fn static_value(value: impl Into<String>) -> Self {
        Self::Static(value.into())
    }

    /// Create a dynamic value from a closure
    pub fn dynamic<F>(f: F) -> Self
    where
        F: Fn(&AnimationContext<P>) -> String + 'static,
    {
        Self::Dynamic(Box::new(f))
    }

    /// Create a stateful dynamic value from a closure
    pub fn stateful_dynamic<F>(f: F) -> Self
    where
        F: Fn(&AnimationContext<P>, &mut StructAnimationState) -> String + 'static,
    {
        Self::StatefulDynamic(Box::new(f))
    }

    /// Evaluate dynamic value with given context and state
    pub fn evaluate(&self, ctx: &AnimationContext<P>, state: &mut StructAnimationState) -> String {
        match self {
            DynamicValue::Static(s) => s.clone(),
            DynamicValue::Dynamic(f) => f(ctx),
            DynamicValue::StatefulDynamic(f) => f(ctx, state),
        }
    }
}

impl<P: Platform> From<String> for DynamicValue<P> {
    fn from(s: String) -> Self {
        Self::Static(s)
    }
}

impl<P: Platform> From<&str> for DynamicValue<P> {
    fn from(s: &str) -> Self {
        Self::Static(s.to_string())
    }
}
