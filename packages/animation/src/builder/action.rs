//! Animation action types

use tairitsu_vdom::Platform;

use super::{
    super::style::{CssProperty, StyleBuilder},
    value::DynamicValue,
};
use crate::{context::AnimationContext, state::AnimationDataStore as StructAnimationState};

/// Enhanced animation action that can be applied to an element
///
/// Actions can be either CSS styles or utility classes,
/// supporting static, dynamic, and stateful dynamic values.
pub enum AnimationAction<P: Platform> {
    /// CSS style property with value
    Style(CssProperty, DynamicValue<P>),
    /// Utility class (from palette package)
    Class(String),
}

impl<P: Platform> Clone for AnimationAction<P> {
    fn clone(&self) -> Self {
        match self {
            AnimationAction::Class(class) => AnimationAction::Class(class.clone()),
            AnimationAction::Style(prop, value) => match value {
                DynamicValue::Static(s) => {
                    AnimationAction::Style(*prop, DynamicValue::static_value(s.clone()))
                }
                DynamicValue::Dynamic(_) => {
                    AnimationAction::Style(*prop, DynamicValue::static_value(""))
                }
                DynamicValue::StatefulDynamic(_) => {
                    AnimationAction::Style(*prop, DynamicValue::static_value(""))
                }
            },
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
    for action in actions {
        match action {
            AnimationAction::Style(prop, value) => {
                let value_str = value.evaluate(ctx, state);
                let _ = platform.borrow_mut().set_style(element, prop.as_str(), &value_str);
            }
            AnimationAction::Class(class) => {
                // Use set_attribute to add class (simplified approach)
                let _ = platform.borrow_mut().set_attribute(element, "class", class);
            }
        }
    }
}
