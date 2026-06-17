//! Dynamic value types for animation system

use std::rc::Rc;

use tairitsu_vdom::Platform;

use super::super::context::AnimationContext;
use super::super::state::AnimationDataStore as StructAnimationState;

pub type AnimationCallback<P> = dyn Fn(&AnimationContext<P>) -> String + 'static;

pub type StatefulCallback<P> =
    dyn Fn(&AnimationContext<P>, &mut StructAnimationState) -> String + 'static;

pub type VoidCallback<P> = dyn Fn(&AnimationContext<P>) + 'static;

/// Enhanced dynamic value that can be computed at runtime
///
/// Values can be either static strings or callbacks that compute
/// values based on current animation context and state.
///
/// Uses `Rc` for callbacks to allow cloning without losing dynamic behavior.
pub enum DynamicValue<P: Platform> {
    /// Static string value
    Static(String),
    /// Dynamic value computed from context (element-specific)
    Dynamic(Rc<AnimationCallback<P>>),
    /// Stateful dynamic value computed from context and animation state
    StatefulDynamic(Rc<StatefulCallback<P>>),
}

impl<P: Platform> Clone for DynamicValue<P> {
    fn clone(&self) -> Self {
        match self {
            Self::Static(s) => Self::Static(s.clone()),
            Self::Dynamic(f) => Self::Dynamic(Rc::clone(f)),
            Self::StatefulDynamic(f) => Self::StatefulDynamic(Rc::clone(f)),
        }
    }
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
        Self::Dynamic(Rc::new(f))
    }

    /// Create a stateful dynamic value from a closure
    pub fn stateful_dynamic<F>(f: F) -> Self
    where
        F: Fn(&AnimationContext<P>, &mut StructAnimationState) -> String + 'static,
    {
        Self::StatefulDynamic(Rc::new(f))
    }

    /// Evaluate dynamic value with given context and state
    pub fn evaluate(&self, ctx: &AnimationContext<P>, state: &mut StructAnimationState) -> String {
        match self {
            Self::Static(s) => s.clone(),
            Self::Dynamic(f) => f(ctx),
            Self::StatefulDynamic(f) => f(ctx, state),
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
