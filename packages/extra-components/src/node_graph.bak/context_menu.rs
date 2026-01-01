// hikari-extra-components/src/node_graph/context_menu.rs
// Context menu component for node graph

use dioxus::prelude::*;

/// Menu item definition
#[derive(Clone, PartialEq, Debug)]
pub struct MenuItem {
    pub label: String,
    pub action: String,
    pub icon: Option<String>,
    pub disabled: bool,
    pub shortcut: Option<String>,
    pub separator: bool,
}

impl MenuItem {
    pub fn new(label: impl Into<String>, action: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            action: action.into(),
            icon: None,
            disabled: false,
            shortcut: None,
            separator: false,
        }
    }

    pub fn with_icon(mut self, icon: impl Into<String>) -> Self {
        self.icon = Some(icon.into());
        self
    }

    pub fn with_disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    pub fn with_shortcut(mut self, shortcut: impl Into<String>) -> Self {
        self.shortcut = Some(shortcut.into());
        self
    }

    pub fn separator() -> Self {
        Self {
            label: String::new(),
            action: String::new(),
            icon: None,
            disabled: false,
            shortcut: None,
            separator: true,
        }
    }
}

/// Context menu position
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct MenuPosition {
    pub x: f64,
    pub y: f64,
}

impl MenuPosition {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct ContextMenuProps {
    /// Menu position
    pub position: MenuPosition,

    /// Menu items to display
    pub items: Vec<MenuItem>,

    /// Whether the menu is visible
    #[props(default)]
    pub visible: bool,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Item click handler (returns action string)
    #[props(default)]
    pub onitemclick: Option<EventHandler<String>>,

    /// Close handler
    #[props(default)]
    pub onclose: Option<EventHandler<()>>,
}

impl Default for ContextMenuProps {
    fn default() -> Self {
        Self {
            position: Default::default(),
            items: Vec::default(),
            visible: false,
            class: String::default(),
            onitemclick: None,
            onclose: None,
        }
    }
}

/// Context menu component for node graph
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_extra_components::node_graph::{ContextMenu, MenuPosition, MenuItem};
///
/// fn app() -> Element {
///     rsx! {
///         ContextMenu {
///             position: MenuPosition { x: 100.0, y: 100.0 },
///             visible: true,
///             items: vec![
///                 MenuItem::new("Add Node", "add").with_icon("plus"),
///                 MenuItem::new("Delete", "delete").with_icon("trash"),
///                 MenuItem::separator(),
///                 MenuItem::new("Copy", "copy").with_shortcut("Ctrl+C"),
///             ],
///         }
///     }
/// }
/// ```
#[component]
pub fn ContextMenu(props: ContextMenuProps) -> Element {
    let mut focused_index = use_signal(|| 0usize);

    if !props.visible {
        return rsx! { };
    }

    // Filter out non-separator items for keyboard navigation
    let actionable_items: Vec<_> = props.items
        .iter()
        .enumerate()
        .filter(|(_, item)| !item.separator)
        .map(|(i, _)| i)
        .collect();

    let handle_item_click = move |action: String, index: usize| {
        focused_index.set(index);
        if let Some(handler) = props.onitemclick.as_ref() {
            handler.call(action);
        }
    };

    rsx! {
        div {
            class: format!("hikari-context-menu {}", props.class),
            style: format!(
                "position: absolute; left: {}px; top: {}px;",
                props.position.x,
                props.position.y
            ),
            tabindex: "0",

            // Close when clicking outside (handled by parent)
            // Keyboard navigation
            onkeydown: move |e| {
                match e.key().as_str() {
                    "ArrowDown" => {
                        let current = *focused_index.read();
                        let next = (current + 1) % actionable_items.len();
                        focused_index.set(next);
                    }
                    "ArrowUp" => {
                        let current = *focused_index.read();
                        let prev = if current == 0 {
                            actionable_items.len() - 1
                        } else {
                            current - 1
                        };
                        focused_index.set(prev);
                    }
                    "Enter" | " " => {
                        if let Some(&item_index) = actionable_items.get(*focused_index.read()) {
                            if let Some(item) = props.items.get(item_index) {
                                if !item.disabled && !item.separator {
                                    handle_item_click(item.action.clone(), *focused_index.read());
                                }
                            }
                        }
                    }
                    "Escape" => {
                        if let Some(handler) = props.onclose.as_ref() {
                            handler.call(());
                        }
                    }
                    _ => {}
                }
            },

            ul {
                class: "hikari-context-menu-list",

                for (index, item) in props.items.iter().enumerate() {
                    if item.separator {
                        // Separator
                        li {
                            class: "hikari-context-menu-separator",
                            role: "separator",
                        }
                    } else {
                        // Menu item
                        li {
                            class: if item.disabled {
                                "hikari-context-menu-item hikari-context-menu-item-disabled"
                            } else {
                                "hikari-context-menu-item"
                            },
                            role: "menuitem",
                            tabindex: "0",
                            "data-action": item.action.clone(),

                            onclick: move |_| {
                                if !item.disabled {
                                    handle_item_click(item.action.clone(), index);
                                }
                            },

                            // Icon
                            if let Some(icon) = &item.icon {
                                span {
                                    class: format!("hikari-context-menu-icon hikari-icon-{}", icon),
                                    dangerous_inner_html: icon
                                }
                            }

                            // Label
                            span {
                                class: "hikari-context-menu-label",
                                "{item.label}"
                            }

                            // Shortcut
                            if let Some(shortcut) = &item.shortcut {
                                span {
                                    class: "hikari-context-menu-shortcut",
                                    "{shortcut}"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Context menu trigger component (wrapper for right-click menus)
#[derive(Clone, PartialEq, Props)]
pub struct ContextMenuTriggerProps {
    /// Content that triggers the context menu
    pub children: Element,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Context menu open handler (returns position)
    #[props(default)]
    pub oncontextmenu: Option<EventHandler<MenuPosition>>,
}

impl Default for ContextMenuTriggerProps {
    fn default() -> Self {
        Self {
            children: VNode::empty(),
            class: String::default(),
            oncontextmenu: None,
        }
    }
}

/// Wrapper component that provides context menu trigger functionality
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_extra_components::node_graph::ContextMenuTrigger;
///
/// fn app() -> Element {
///     rsx! {
///         ContextMenuTrigger {
///             oncontextmenu: move |pos| {
///                 // Show context menu at pos
///             },
///             div { "Right-click me!" }
///         }
///     }
/// }
/// ```
#[component]
pub fn ContextMenuTrigger(props: ContextMenuTriggerProps) -> Element {
    rsx! {
        div {
            class: format!("hikari-context-menu-trigger {}", props.class),

            oncontextmenu: move |e| {
                e.prevent_default();
                e.stop_propagation();

                if let Some(handler) = props.oncontextmenu.as_ref() {
                    handler.call(MenuPosition {
                        x: e.client_x() as f64,
                        y: e.client_y() as f64,
                    });
                }
            },

            { props.children }
        }
    }
}
