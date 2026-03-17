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
    // Use tairitsu's Callback and EventHandler (which implement Clone)
    Callback,
    EventHandler,
    // Key type for keyboard events
    Key,
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
    // Dioxus compatibility alias
    provide_context as use_context_provider,
    // Context type from tairitsu
    Context,
    UseRef,
    use_animation,
    use_simple_animation,
    AnimationConfig,
    AnimationDirection,
    AnimationState,
    EasingFunction,
    // Dioxus compatibility
    use_memo,
    use_callback,
};

// Re-export tairitsu macros
pub use tairitsu_macros::{rsx, component, Props};

pub use tairitsu_macros::component as derive_props;

/// Helper function to create an event handler
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
