//! Animation action types

use tairitsu_vdom::Platform;

use super::super::style::CssProperty;
use super::value::DynamicValue;
use crate::context::AnimationContext;
use crate::state::AnimationDataStore as StructAnimationState;

pub enum AnimationAction<P: Platform> {
    Style(CssProperty, DynamicValue<P>),
    Class(String),
}

impl<P: Platform> std::fmt::Debug for AnimationAction<P> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Style(prop, _) => f.debug_tuple("Style").field(prop).finish(),
            Self::Class(c) => f.debug_tuple("Class").field(c).finish(),
        }
    }
}

impl<P: Platform> Clone for AnimationAction<P> {
    fn clone(&self) -> Self {
        match self {
            Self::Style(p, v) => Self::Style(*p, v.clone()),
            Self::Class(c) => Self::Class(c.clone()),
        }
    }
}

impl<P: Platform> AnimationAction<P> {
    /// Create a style action with a static value
    pub fn style_static(property: CssProperty, value: impl Into<String>) -> Self {
        Self::Style(property, DynamicValue::static_value(value))
    }

    /// Create a style action with a dynamic value
    pub fn style_dynamic<F>(property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext<P>) -> String + 'static,
    {
        Self::Style(property, DynamicValue::dynamic(f))
    }

    /// Create a style action with a stateful dynamic value
    pub fn style_stateful_dynamic<F>(property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext<P>, &mut StructAnimationState) -> String + 'static,
    {
        Self::Style(property, DynamicValue::stateful_dynamic(f))
    }

    /// Create a class action
    pub fn class(class: impl Into<String>) -> Self {
        Self::Class(class.into())
    }
}

/// Apply actions to an element handle via Platform
pub fn apply_actions<P: Platform>(
    platform: &std::rc::Rc<std::cell::RefCell<P>>,
    element: &P::Element,
    actions: &[AnimationAction<P>],
    ctx: &AnimationContext<P>,
    state: &mut StructAnimationState,
) {
    let mut class_parts: Vec<String> = Vec::new();
    let mut pending_style_actions: Vec<(&CssProperty, &DynamicValue<P>)> = Vec::new();

    for action in actions {
        match action {
            AnimationAction::Style(prop, value) => {
                pending_style_actions.push((prop, value));
            }
            AnimationAction::Class(class) => {
                class_parts.push(class.clone());
            }
        }
    }

    if !class_parts.is_empty() {
        let class_str = class_parts.join(" ");
        platform
            .borrow_mut()
            .set_attribute(element, "class", &class_str);
    }

    for (prop, value) in pending_style_actions {
        let value_str = value.evaluate(ctx, state);
        platform
            .borrow_mut()
            .set_style(element, prop.as_str(), &value_str);
    }
}
