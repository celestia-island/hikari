//! Portal examples for Modal and Drawer components.
//!
//! This module demonstrates how to use the portal system for rendering
//! modals, drawers, and other overlay components.

use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

use crate::components::portal::{
    dropdown_portal, modal_portal, portal, toast_portal, Portal, PortalProps, ToastPosition,
};

/// Example: Simple Modal with Portal
///
/// This function demonstrates creating a basic modal that renders
/// outside the normal DOM hierarchy using the portal system.
pub fn example_modal() -> VNode {
    let modal_id = "example-modal";
    let modal_content = rsx! {
        div {
            class: "hi-modal-content",
            style: "background: white; border-radius: 8px; padding: 24px; min-width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);",
            div {
                class: "hi-modal-header",
                style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;",
                h2 { style: "margin: 0; font-size: 20px;", "Example Modal" }
                button {
                    class: "hi-modal-close",
                    style: "background: none; border: none; font-size: 24px; cursor: pointer;",
                    "data-modal-close": modal_id,
                    "×"
                }
            }
            div {
                class: "hi-modal-body",
                style: "margin-bottom: 16px;",
                p { style: "margin: 0 0 12px 0;", "This modal is rendered using the portal system." }
                p { style: "margin: 0;", "It breaks out of the parent hierarchy and renders directly to the portal container." }
            }
            div {
                class: "hi-modal-footer",
                style: "display: flex; justify-content: flex-end; gap: 8px;",
                button {
                    class: "hi-button hi-button-secondary",
                    style: "padding: 8px 16px; border-radius: 4px; cursor: pointer;",
                    "data-modal-close": modal_id,
                    "Cancel"
                }
                button {
                    class: "hi-button hi-button-primary",
                    style: "padding: 8px 16px; border-radius: 4px; cursor: pointer;",
                    "data-modal-close": modal_id,
                    "Confirm"
                }
            }
        }
    };

    modal_portal(modal_id, modal_content)
}

/// Example: Dropdown with Portal
///
/// This function demonstrates creating a dropdown menu that positions
/// itself relative to a trigger element using the portal system.
pub fn example_dropdown() -> VNode {
    let dropdown_id = "example-dropdown";
    let trigger_rect: Option<(f64, f64, f64, f64)> = Some((100.0, 100.0, 120.0, 40.0));

    let dropdown_content = rsx! {
        div {
            class: "hi-dropdown-menu",
            style: "background: white; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); min-width: 200px; overflow: hidden;",
            div {
                class: "hi-menu-item",
                style: "padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0;",
                "Option 1"
            }
            div {
                class: "hi-menu-item",
                style: "padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0;",
                "Option 2"
            }
            div {
                class: "hi-menu-item",
                style: "padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0;",
                "Option 3"
            }
            div {
                class: "hi-menu-divider",
                style: "height: 1px; background: #f0f0f0; margin: 4px 0;"
            }
            div {
                class: "hi-menu-item hi-menu-item--danger",
                style: "padding: 12px 16px; cursor: pointer; color: #ef4444;",
                "Delete"
            }
        }
    };

    dropdown_portal(dropdown_id, trigger_rect, dropdown_content)
}

/// Example: Toast Notification with Portal
///
/// This function demonstrates creating toast notifications that appear
/// at specific positions in the viewport.
pub fn example_toast() -> VNode {
    let toast_id = "example-toast";

    let toast_content = rsx! {
        div {
            class: "hi-toast-content",
            style: "background: #333; color: white; padding: 12px 16px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 12px; min-width: 300px;",
            div {
                class: "hi-toast-icon",
                style: "flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; background: #10b981; display: flex; align-items: center; justify-content: center;",
                "✓"
            }
            div {
                class: "hi-toast-message",
                style: "flex: 1;",
                div {
                    class: "hi-toast-title",
                    style: "font-weight: 600; margin-bottom: 2px;",
                    "Success"
                }
                div {
                    class: "hi-toast-description",
                    style: "font-size: 14px; opacity: 0.9;",
                    "Your changes have been saved."
                }
            }
            button {
                class: "hi-toast-close",
                style: "background: none; border: none; color: white; cursor: pointer; opacity: 0.7;",
                "data-toast-close": toast_id,
                "×"
            }
        }
    };

    toast_portal(toast_id, ToastPosition::TopRight, toast_content)
}

/// Example: Drawer (Sidebar Panel) with Portal
///
/// This function demonstrates creating a drawer panel that slides in
/// from the side of the viewport.
pub fn example_drawer() -> VNode {
    let drawer_id = "example-drawer";

    let drawer_content = rsx! {
        div {
            class: "hi-drawer-overlay",
            style: "position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9998;",
            "data-drawer-overlay": drawer_id,
        }
        div {
            class: "hi-drawer-panel hi-drawer-panel--right",
            style: "position: fixed; top: 0; right: 0; bottom: 0; width: 320px; background: white; z-index: 9999; box-shadow: -4px 0 16px rgba(0,0,0,0.1);",
            "data-drawer-id": drawer_id,
            div {
                class: "hi-drawer-header",
                style: "padding: 20px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;",
                h3 { style: "margin: 0; font-size: 18px;", "Settings" }
                button {
                    class: "hi-drawer-close",
                    style: "background: none; border: none; font-size: 24px; cursor: pointer;",
                    "data-drawer-close": drawer_id,
                    "×"
                }
            }
            div {
                class: "hi-drawer-body",
                style: "padding: 20px; overflow-y: auto;",
                div {
                    class: "hi-drawer-section",
                    style: "margin-bottom: 24px;",
                    h4 { style: "margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #666;", "Appearance" }
                    div {
                        class: "hi-form-field",
                        style: "margin-bottom: 16px;",
                        label { style: "display: block; margin-bottom: 6px; font-size: 14px;", "Theme" }
                        select {
                            style: "width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;",
                            option { "Light" }
                            option { "Dark" }
                            option { "Auto" }
                        }
                    }
                }
                div {
                    class: "hi-drawer-section",
                    h4 { style: "margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #666;", "Notifications" }
                    div {
                        class: "hi-form-field",
                        style: "margin-bottom: 16px;",
                        label {
                            style: "display: flex; align-items: center; gap: 8px; cursor: pointer;",
                            input {
                                r#type: "checkbox",
                                style: "cursor: pointer;",
                            }
                            "Enable notifications"
                        }
                    }
                }
            }
        }
    };

    portal(drawer_id, drawer_content)
}

/// Example: Popover with Portal
///
/// This function demonstrates creating a popover that positions
/// itself relative to content.
pub fn example_popover() -> VNode {
    let popover_id = "example-popover";
    let trigger_rect: Option<(f64, f64, f64, f64)> = Some((200.0, 200.0, 100.0, 32.0));

    let popover_content = rsx! {
        div {
            class: "hi-popover-content",
            style: "background: white; border-radius: 8px; padding: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); max-width: 300px;",
            h4 { style: "margin: 0 0 8px 0; font-size: 16px;", "Popover Title" }
            p { style: "margin: 0 0 12px 0; font-size: 14px; line-height: 1.5;", "This is a popover rendered through the portal system. It can contain any content you need." }
            a {
                href: "#",
                style: "color: #0066cc; text-decoration: none; font-size: 14px;",
                "Learn more →"
            }
        }
    };

    // Position popover above the trigger
    let style = if let Some((x, y, _width, _height)) = trigger_rect {
        format!(
            "position: fixed; left: {}px; bottom: {}px; pointer-events: auto; z-index: 10000;",
            x, y
        )
    } else {
        "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: auto; z-index: 10000;".to_string()
    };

    Portal::render(
        popover_id,
        None,
        popover_content,
        Some(PortalProps {
            style,
            classes: vec!["hi-popover".to_string()],
            ..Default::default()
        }),
    )
}

/// Example: Tooltip with Portal
///
/// This function demonstrates creating a simple tooltip.
pub fn example_tooltip() -> VNode {
    let tooltip_id = "example-tooltip";

    let tooltip_content = rsx! {
        div {
            class: "hi-tooltip-content",
            style: "background: #333; color: white; padding: 6px 10px; border-radius: 4px; font-size: 14px; white-space: nowrap;",
            "This is a tooltip"
        }
    };

    let style =
        "position: fixed; left: 50%; top: 50%; pointer-events: none; z-index: 10001;".to_string();

    Portal::render(
        tooltip_id,
        None,
        tooltip_content,
        Some(PortalProps {
            style,
            classes: vec!["hi-tooltip".to_string()],
            z_index: 10001,
        }),
    )
}

/// Example: Confirmation Dialog with Portal
///
/// This function demonstrates creating a confirmation dialog.
pub fn example_confirm_dialog() -> VNode {
    let dialog_id = "confirm-dialog";

    let dialog_content = rsx! {
        div {
            class: "hi-confirm-dialog",
            style: "background: white; border-radius: 12px; padding: 24px; min-width: 400px; box-shadow: 0 12px 48px rgba(0,0,0,0.25);",
            div {
                class: "hi-confirm-icon",
                style: "width: 48px; height: 48px; border-radius: 50%; background: #fee2e2; color: #ef4444; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 24px;",
                "!"
            }
            h3 {
                class: "hi-confirm-title",
                style: "margin: 0 0 8px 0; font-size: 20px; text-align: center;",
                "Confirm Action"
            }
            p {
                class: "hi-confirm-message",
                style: "margin: 0 0 24px 0; text-align: center; color: #666;",
                "Are you sure you want to proceed? This action cannot be undone."
            }
            div {
                class: "hi-confirm-actions",
                style: "display: flex; gap: 12px; justify-content: center;",
                button {
                    class: "hi-button hi-button-secondary",
                    style: "padding: 10px 20px; border-radius: 6px; cursor: pointer;",
                    "data-confirm-cancel": dialog_id,
                    "Cancel"
                }
                button {
                    class: "hi-button hi-button-danger",
                    style: "padding: 10px 20px; border-radius: 6px; cursor: pointer; background: #ef4444; color: white; border: none;",
                    "data-confirm-action": dialog_id,
                    "Confirm"
                }
            }
        }
    };

    modal_portal(dialog_id, dialog_content)
}

/// Example: Multiple Portals
///
/// This function demonstrates rendering multiple portals simultaneously.
pub fn example_multiple_portals() -> VNode {
    VNode::Fragment(vec![example_modal(), example_toast(), example_dropdown()])
}

/// Example: Interactive Demo Page
///
/// This creates a demo page showing all portal examples with buttons
/// to trigger each portal type.
pub fn portal_demo_page() -> VNode {
    rsx! {
        div {
            class: "portal-demo-page",
            style: "padding: 40px; max-width: 1200px; margin: 0 auto;",
            div {
                class: "demo-header",
                style: "margin-bottom: 40px; text-align: center;",
                h1 { style: "margin: 0 0 12px 0; font-size: 36px;", "Portal System Examples" }
                p { style: "margin: 0; color: #666; font-size: 18px;", "Demonstrating the portal rendering system for overlays" }
            }
            div {
                class: "demo-grid",
                style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;",
                // Modal Example
                div {
                    class: "demo-card",
                    style: "border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px;",
                    h3 { style: "margin: 0 0 12px 0; font-size: 18px;", "Modal" }
                    p { style: "margin: 0 0 16px 0; color: #666;", "A centered dialog with overlay backdrop" }
                    button {
                        class: "hi-button hi-button-primary",
                        style: "padding: 10px 20px; border-radius: 6px; cursor: pointer;",
                        "data-portal-trigger": "modal",
                        "Open Modal"
                    }
                }
                // Drawer Example
                div {
                    class: "demo-card",
                    style: "border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px;",
                    h3 { style: "margin: 0 0 12px 0; font-size: 18px;", "Drawer" }
                    p { style: "margin: 0 0 16px 0; color: #666;", "A slide-in panel from the right" }
                    button {
                        class: "hi-button hi-button-primary",
                        style: "padding: 10px 20px; border-radius: 6px; cursor: pointer;",
                        "data-portal-trigger": "drawer",
                        "Open Drawer"
                    }
                }
                // Dropdown Example
                div {
                    class: "demo-card",
                    style: "border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px;",
                    h3 { style: "margin: 0 0 12px 0; font-size: 18px;", "Dropdown" }
                    p { style: "margin: 0 0 16px 0; color: #666;", "A menu positioned below trigger" }
                    button {
                        class: "hi-button hi-button-primary",
                        style: "padding: 10px 20px; border-radius: 6px; cursor: pointer;",
                        "data-portal-trigger": "dropdown",
                        "Open Dropdown"
                    }
                }
                // Toast Example
                div {
                    class: "demo-card",
                    style: "border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px;",
                    h3 { style: "margin: 0 0 12px 0; font-size: 18px;", "Toast" }
                    p { style: "margin: 0 0 16px 0; color: #666;", "A notification in the corner" }
                    button {
                        class: "hi-button hi-button-primary",
                        style: "padding: 10px 20px; border-radius: 6px; cursor: pointer;",
                        "data-portal-trigger": "toast",
                        "Show Toast"
                    }
                }
                // Popover Example
                div {
                    class: "demo-card",
                    style: "border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px;",
                    h3 { style: "margin: 0 0 12px 0; font-size: 18px;", "Popover" }
                    p { style: "margin: 0 0 16px 0; color: #666;", "A positioned info bubble" }
                    button {
                        class: "hi-button hi-button-primary",
                        style: "padding: 10px 20px; border-radius: 6px; cursor: pointer;",
                        "data-portal-trigger": "popover",
                        "Show Popover"
                    }
                }
                // Confirm Dialog Example
                div {
                    class: "demo-card",
                    style: "border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px;",
                    h3 { style: "margin: 0 0 12px 0; font-size: 18px;", "Confirm Dialog" }
                    p { style: "margin: 0 0 16px 0; color: #666;", "A confirmation before action" }
                    button {
                        class: "hi-button hi-button-danger",
                        style: "padding: 10px 20px; border-radius: 6px; cursor: pointer; background: #ef4444; color: white; border: none;",
                        "data-portal-trigger": "confirm",
                        "Delete Item"
                    }
                }
            }
            // Code examples section
            div {
                class: "code-examples",
                style: "margin-top: 48px;",
                h2 { style: "margin: 0 0 24px 0; font-size: 28px;", "Usage Examples" }
                div {
                    class: "code-example",
                    style: "margin-bottom: 32px;",
                    h3 { style: "margin: 0 0 12px 0; font-size: 18px;", "Modal" }
                    pre {
                        style: "background: #f5f5f5; padding: 16px; border-radius: 8px; overflow-x: auto;",
                        code { style: "font-family: monospace; font-size: 14px;",
"use crate::components::portal::modal_portal;

let modal = modal_portal(
    \"my-modal\",
    modal_content
);
"
                        }
                    }
                }
                div {
                    class: "code-example",
                    style: "margin-bottom: 32px;",
                    h3 { style: "margin: 0 0 12px 0; font-size: 18px;", "Dropdown" }
                    pre {
                        style: "background: #f5f5f5; padding: 16px; border-radius: 8px; overflow-x: auto;",
                        code { style: "font-family: monospace; font-size: 14px;",
"use crate::components::portal::dropdown_portal;

let dropdown = dropdown_portal(
    \"my-dropdown\",
    Some((x, y, width, height)), // trigger rect
    dropdown_content
);
"
                        }
                    }
                }
                div {
                    class: "code-example",
                    style: "margin-bottom: 32px;",
                    h3 { style: "margin: 0 0 12px 0; font-size: 18px;", "Toast" }
                    pre {
                        style: "background: #f5f5f5; padding: 16px; border-radius: 8px; overflow-x: auto;",
                        code { style: "font-family: monospace; font-size: 14px;",
"use crate::components::portal::{toast_portal, ToastPosition};

let toast = toast_portal(
    \"my-toast\",
    ToastPosition::TopRight,
    toast_content
);
"
                        }
                    }
                }
            }
        }
    }
}
