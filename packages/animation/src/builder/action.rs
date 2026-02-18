//! Animation action types

use super::super::style::{CssProperty, StyleBuilder};
use super::value::DynamicValue;
use crate::context::AnimationContext;
use crate::state::AnimationState as StructAnimationState;
use wasm_bindgen::JsCast;
use web_sys::HtmlElement;

/// Enhanced animation action that can be applied to an element
///
/// Actions can be either CSS styles or utility classes,
/// supporting static, dynamic, and stateful dynamic values.
pub enum AnimationAction {
    /// CSS style property with value
    Style(CssProperty, DynamicValue),
    /// Utility class (from palette package)
    Class(String),
}

impl Clone for AnimationAction {
    fn clone(&self) -> Self {
        match self {
            AnimationAction::Class(class) => AnimationAction::Class(class.clone()),
            AnimationAction::Style(prop, value) => match value {
                DynamicValue::Static(s) => {
                    AnimationAction::Style(*prop, DynamicValue::Static(s.clone()))
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

    /// Create a style action with a stateful dynamic value
    pub fn style_stateful_dynamic<F>(property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext, &mut StructAnimationState) -> String + 'static,
    {
        Self::Style(property, DynamicValue::stateful_dynamic(f))
    }

    /// Create a class action
    pub fn class(class: impl Into<String>) -> Self {
        Self::Class(class.into())
    }
}

/// Apply actions to an element
pub fn apply_actions(
    element: &HtmlElement,
    actions: &[AnimationAction],
    ctx: &AnimationContext,
    state: &mut StructAnimationState,
) {
    let builder = StyleBuilder::new(element);
    let mut has_style = false;

    for action in actions {
        match action {
            AnimationAction::Style(prop, value) => {
                has_style = true;
                let value_str = value.evaluate(ctx, state);
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

/// Get HtmlElement from JsValue
pub fn get_html_element(js_value: &wasm_bindgen::JsValue) -> Option<HtmlElement> {
    js_value.clone().dyn_into::<HtmlElement>().ok()
}
