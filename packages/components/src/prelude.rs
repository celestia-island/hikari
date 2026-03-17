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
pub use tairitsu_macros::{rsx, component};

/// Placeholder for Dioxus Props derive
/// In Tairitsu, props are generated automatically by the #[component] macro
/// This macro is provided for migration compatibility only
pub use tairitsu_macros::component as derive_props;

/// Event handler wrapper (compatibility shim)
/// In Tairitsu, events are handled differently - this provides a compatibility layer
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

/// Create an event handler
pub fn event_handler<F, T>(f: F) -> EventHandler<T>
where
    F: FnMut(T) + 'static,
{
    EventHandler::new(f)
}

/// Empty element (placeholder for VNode::empty)
pub fn empty_vnode() -> VNode {
    VNode::text("")
}

/// Props attribute macro (compatibility shim)
/// In Tairitsu, use #[component] on functions instead
pub use tairitsu_macros::component as props;

/// Props derive macro alias (compatibility for #[derive(Props)])
/// Note: This doesn't actually derive anything - it's a placeholder for migration
pub use tairitsu_macros::component as Props;

// Re-export styled components
pub use crate::styled::{StyledComponent, StyleRegistry};
