//! Compatibility layer for migrating from Dioxus to Tairitsu
//!
//! This module provides type aliases and re-exports to ease the migration process.

// Re-export tairitsu core types
pub use tairitsu_vdom::{
    VNode as Element,
    VNode,
    VElement,
    VText,
    Classes,
    Style,
    Signal,
    batch,
    create_effect,
    EventData,
    MouseEvent,
    KeyboardEvent,
    InputEvent,
    FocusEvent,
    ChangeEvent,
    ElementHandle,
    EventHandle,
};

// Re-export tairitsu hooks
pub use tairitsu_hooks::{
    use_signal,
    use_state,
    use_effect,
    use_ref,
    use_context,
    provide_context,
    // consume_context is use_context in tairitsu
    use_context as consume_context,
    // Context type from tairitsu
    Context,
    UseRef,
    use_animation,
    use_simple_animation,
    AnimationConfig,
    AnimationDirection,
    AnimationState,
    EasingFunction,
};

// Re-export tairitsu macros
pub use tairitsu_macros::{rsx, component, Props};

pub use tairitsu_macros::component as derive_props;

pub struct EventHandler<T> {
    handler: Box<dyn FnMut(T) + 'static>,
}

impl<T: 'static> EventHandler<T> {
    pub fn new<F: FnMut(T) + 'static>(f: F) -> Self {
        Self { handler: Box::new(f) }
    }

    pub fn call(&mut self, event: T) {
        (self.handler)(event)
    }
}

impl<T> std::ops::Deref for EventHandler<T> {
    type Target = Box<dyn FnMut(T) + 'static>;

    fn deref(&self) -> &Self::Target {
        &self.handler
    }
}

impl<T> std::ops::DerefMut for EventHandler<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.handler
    }
}

pub fn event_handler<F, T>(f: F) -> EventHandler<T>
where
    F: FnMut(T) + 'static,
{
    EventHandler::new(f)
}

pub fn empty_vnode() -> VNode {
    VNode::Text(VText::new(""))
}

// Re-export styled components
pub use crate::styled::{StyledComponent, StyleRegistry};
