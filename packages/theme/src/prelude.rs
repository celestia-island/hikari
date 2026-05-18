//! Compatibility prelude for theme package migration to Tairitsu

// Re-export tairitsu core types
// Re-export hikari palette
pub use hikari_palette::*;
// Re-export tairitsu hooks
pub use tairitsu_hooks::{
    Context, UseRef, provide_context, use_context, use_effect, use_ref, use_signal, use_state,
};
// Props derive compatibility shim
pub use tairitsu_macros::component as Props;
// Re-export tairitsu macros
pub use tairitsu_macros::{component, rsx};
pub use tairitsu_vdom::{
    Callback, ChangeEvent, Classes, EventData, FocusEvent, InputEvent, KeyboardEvent, MouseEvent,
    Signal, Style, VElement, VNode, VNode as Element, VText, batch, create_effect,
};

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
