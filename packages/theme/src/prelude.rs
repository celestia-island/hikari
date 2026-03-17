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
};

// Re-export tairitsu hooks
pub use tairitsu_hooks::{
    use_signal,
    use_state,
    use_effect,
    use_ref,
    use_context,
    provide_context,
    use_context as consume_context,
    Context,
    UseRef,
};

// Re-export tairitsu macros
pub use tairitsu_macros::{rsx, component};

// Props derive compatibility shim
pub use tairitsu_macros::component as Props;

// Re-export hikari palette
pub use hikari_palette::*;

/// Event handler type for compatibility
pub struct EventHandler<T> {
    handler: Box<dyn FnMut(T) + 'static>,
}

impl<T: 'static> EventHandler<T> {
    pub fn new<F: FnMut(T) + 'static>(f: F) -> Self {
        Self { handler: Box::new(f) }
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

/// Callback type alias (Dioxus compatibility)
pub type Callback<T> = EventHandler<T>;

// VNode extension
impl VNode {
    /// Create an empty VNode (text node with empty string)
    pub fn empty() -> Self {
        VNode::text("")
    }
}
