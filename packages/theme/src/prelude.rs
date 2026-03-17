//! Compatibility prelude for theme package migration to Tairitsu

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
    Callback,
};

// Re-export tairitsu hooks
pub use tairitsu_hooks::{
    use_signal,
    use_state,
    use_effect,
    use_ref,
    use_context,
    provide_context,
    Context,
    UseRef,
};

// Re-export tairitsu macros
pub use tairitsu_macros::{rsx, component};

// Props derive compatibility shim
pub use tairitsu_macros::component as Props;

// Re-export hikari palette
pub use hikari_palette::*;

/// Event handler type alias (using tairitsu's Callback)
pub type EventHandler<T> = Callback<T, ()>;

/// Consume context helper - retrieves and clones the context value
pub fn consume_context<T: 'static + Clone>() -> T {
    use_context::<T>()
        .expect("Context not found. Make sure to call provide_context first.")
        .get()
        .clone()
}

/// Create an empty VNode (text node with empty string)
pub fn empty_vnode() -> VNode {
    VNode::Text(VText::new(""))
}
