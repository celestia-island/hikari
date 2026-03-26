//! Portal system for rendering content outside the normal DOM hierarchy.
//!
//! This module provides Portal and PortalProvider components that allow
//! rendering children to a specific container element in the DOM.
//!
//! # Example
//!
//! ```rust
//! use crate::components::portal::{Portal, PortalProvider};
//! use tairitsu_vdom::{VElement, VNode};
//!
//! // Wrap your app with PortalProvider
//! let app = VNode::Element(
//!     VElement::new("div")
//!         .child(PortalProvider::render(children))
//! );
//!
//! // Use Portal to render content to document.body
//! let modal = Portal::render(
//!     "my-modal",
//!     None, // container selector (None = document.body)
//!     modal_content
//! );
//! ```

use std::sync::atomic::{AtomicU64, Ordering};
use tairitsu_vdom::{VElement, VNode, VText};

/// Global counter for generating unique portal IDs
static PORTAL_ID_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Generate a unique portal ID
pub fn generate_portal_id() -> String {
    format!(
        "portal-{}",
        PORTAL_ID_COUNTER.fetch_add(1, Ordering::SeqCst)
    )
}

/// Portal container element ID (the default container in document.body)
pub const PORTAL_CONTAINER_ID: &str = "hikari-portal-container";

/// PortalProvider component that manages portal containers.
///
/// This component creates a container element in the DOM where all
/// portal content will be rendered. It should be placed at the root
/// of your application.
pub struct PortalProvider;

impl PortalProvider {
    /// Create a new PortalProvider VNode
    ///
    /// # Arguments
    ///
    /// * `children` - The child VNodes to render normally (non-portal content)
    pub fn render(children: Vec<VNode>) -> VNode {
        // Create the portal container div
        let container = VNode::Element(
            VElement::new("div")
                .attr("id", PORTAL_CONTAINER_ID)
                .style("position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 9999;"),
        );

        // Wrap children in a fragment with the portal container
        let mut all_children = children;
        all_children.push(container);

        VNode::Fragment(all_children)
    }
}

/// Portal component for rendering content outside the normal DOM hierarchy.
///
/// Portals render their children into a specific container element in the DOM,
/// allowing components like modals, dropdowns, and tooltips to break out of
/// their parent's overflow/stacking context.
pub struct Portal;

impl Portal {
    /// Create a new Portal VNode
    ///
    /// # Arguments
    ///
    /// * `id` - Unique identifier for this portal instance
    /// * `container_selector` - CSS selector for the container element
    ///   (None means use the default portal container)
    /// * `children` - The content to render in the portal
    /// * `props` - Optional portal properties
    pub fn render(
        id: impl Into<String>,
        container_selector: Option<&str>,
        children: VNode,
        props: Option<PortalProps>,
    ) -> VNode {
        let id = id.into();
        let props = props.unwrap_or_default();

        let container_class = container_selector
            .map(|_| "hi-portal hi-portal--custom")
            .unwrap_or("hi-portal");

        let mut portal_element = VElement::new("div")
            .attr("data-portal-id", &id)
            .class(container_class);

        // Add custom classes
        for class in &props.classes {
            portal_element = portal_element.class(class.as_str());
        }

        // Add inline styles
        if !props.style.is_empty() {
            portal_element = portal_element.style(props.style.as_str());
        } else {
            // Default portal styles
            let default_style = format!(
                "position: fixed; pointer-events: auto; z-index: {};",
                props.z_index
            );
            portal_element = portal_element.style(default_style.as_str());
        }

        // Add container selector if specified
        if let Some(selector) = container_selector {
            portal_element = portal_element.attr("data-portal-container", selector);
        }

        // Add children
        let portal_node = VNode::Element(portal_element.child(children));

        // Wrap with initialization script
        Self::with_init_script(id, container_selector, portal_node)
    }

    /// Create a portal positioned at specific coordinates
    ///
    /// # Arguments
    ///
    /// * `id` - Unique identifier for this portal
    /// * `x` - X coordinate in pixels
    /// * `y` - Y coordinate in pixels
    /// * `children` - The content to render
    pub fn render_at(
        id: impl Into<String>,
        x: f64,
        y: f64,
        children: VNode,
    ) -> VNode {
        let style = format!(
            "position: fixed; left: {}px; top: {}px; pointer-events: auto; z-index: 10000;",
            x, y
        );

        Self::render(
            id,
            None,
            children,
            Some(PortalProps {
                style,
                ..Default::default()
            }),
        )
    }

    /// Create a centered modal portal
    ///
    /// # Arguments
    ///
    /// * `id` - Unique identifier for this portal
    /// * `children` - The modal content
    /// * `with_overlay` - Whether to include a dimmed overlay
    pub fn render_modal(id: impl Into<String>, children: VNode, with_overlay: bool) -> VNode {
        let id = id.into();

        if with_overlay {
            // Create overlay
            let overlay = VNode::Element(
                VElement::new("div")
                    .class("hi-modal-overlay")
                    .attr("data-modal-overlay-for", &id)
                    .style("position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); z-index: 9998; pointer-events: auto;"),
            );

            // Create modal content
            let modal = VNode::Element(
                VElement::new("div")
                    .attr("data-portal-id", &id)
                    .class("hi-modal hi-portal")
                    .style("position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: auto; z-index: 9999;")
                    .child(children),
            );

            VNode::Fragment(vec![overlay, modal])
        } else {
            Self::render(
                id,
                None,
                children,
                Some(PortalProps {
                    style: "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: auto; z-index: 9999;".to_string(),
                    classes: vec!["hi-modal".to_string()],
                    ..Default::default()
                }),
            )
        }
    }

    /// Create a dropdown portal positioned relative to a trigger element
    ///
    /// # Arguments
    ///
    /// * `id` - Unique identifier for this portal
    /// * `trigger_rect` - Bounding rect of the trigger element (x, y, width, height)
    /// * `placement` - Where to position the dropdown relative to trigger
    /// * `children` - The dropdown content
    pub fn render_dropdown(
        id: impl Into<String>,
        trigger_rect: Option<(f64, f64, f64, f64)>,
        placement: Placement,
        children: VNode,
    ) -> VNode {
        let id = id.into();
        let style = if let Some((x, y, width, height)) = trigger_rect {
            match placement {
                Placement::Bottom => format!(
                    "position: fixed; left: {}px; top: {}px; pointer-events: auto; z-index: 10000;",
                    x, y + height
                ),
                Placement::Top => format!(
                    "position: fixed; left: {}px; bottom: {}px; pointer-events: auto; z-index: 10000;",
                    x, y
                ),
                Placement::Right => format!(
                    "position: fixed; left: {}px; top: {}px; pointer-events: auto; z-index: 10000;",
                    x + width, y
                ),
                Placement::Left => format!(
                    "position: fixed; right: {}px; top: {}px; pointer-events: auto; z-index: 10000;",
                    x, y
                ),
            }
        } else {
            "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: auto; z-index: 10000;".to_string()
        };

        Self::render(
            id,
            None,
            children,
            Some(PortalProps {
                style,
                classes: vec!["hi-dropdown".to_string()],
                ..Default::default()
            }),
        )
    }

    /// Create a toast notification portal
    ///
    /// # Arguments
    ///
    /// * `id` - Unique identifier for this portal
    /// * `position` - Where to position the toast
    /// * `children` - The toast content
    pub fn render_toast(id: impl Into<String>, position: ToastPosition, children: VNode) -> VNode {
        let style = match position {
            ToastPosition::TopRight => {
                "position: fixed; top: 16px; right: 16px; pointer-events: auto; z-index: 10000;"
            }
            ToastPosition::TopLeft => {
                "position: fixed; top: 16px; left: 16px; pointer-events: auto; z-index: 10000;"
            }
            ToastPosition::TopCenter => {
                "position: fixed; top: 16px; left: 50%; transform: translateX(-50%); pointer-events: auto; z-index: 10000;"
            }
            ToastPosition::BottomRight => {
                "position: fixed; bottom: 16px; right: 16px; pointer-events: auto; z-index: 10000;"
            }
            ToastPosition::BottomLeft => {
                "position: fixed; bottom: 16px; left: 16px; pointer-events: auto; z-index: 10000;"
            }
            ToastPosition::BottomCenter => {
                "position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); pointer-events: auto; z-index: 10000;"
            }
        };

        Self::render(
            id,
            None,
            children,
            Some(PortalProps {
                style: style.to_string(),
                classes: vec!["hi-toast".to_string()],
                ..Default::default()
            }),
        )
    }

    /// Wrap portal content with initialization script
    fn with_init_script(id: String, container_selector: Option<&str>, content: VNode) -> VNode {
        let container = container_selector.unwrap_or(PORTAL_CONTAINER_ID);

        // JavaScript to move the portal element to its container
        let init_script = VNode::Element(
            VElement::new("script")
                .attr("type", "module")
                .attr("data-portal-init", &id)
                .child(VNode::Text(VText::new(&format!(
                    r#"
                    (function() {{
                        const portalEl = document.querySelector('[data-portal-id="{}"]');
                        const containerEl = document.getElementById('{}') || document.body;
                        if (portalEl && containerEl && portalEl.parentElement !== containerEl) {{
                            containerEl.appendChild(portalEl);
                        }}
                    }})();
                    "#,
                    id, container
                )))),
        );

        VNode::Fragment(vec![content, init_script])
    }
}

/// Properties for portal configuration
#[derive(Debug, Clone, Default)]
pub struct PortalProps {
    /// Additional CSS classes to apply
    pub classes: Vec<String>,
    /// Inline styles to apply
    pub style: String,
    /// Z-index for the portal
    pub z_index: u32,
}

/// Placement options for positioned portals (like dropdowns)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Placement {
    Bottom,
    Top,
    Left,
    Right,
}

/// Position options for toast notifications
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToastPosition {
    TopRight,
    TopLeft,
    TopCenter,
    BottomRight,
    BottomLeft,
    BottomCenter,
}

/// Convenience function to create a simple portal
pub fn portal(id: impl Into<String>, children: VNode) -> VNode {
    Portal::render(id, None, children, None)
}

/// Convenience function to create a modal portal
pub fn modal_portal(id: impl Into<String>, children: VNode) -> VNode {
    Portal::render_modal(id, children, true)
}

/// Convenience function to create a dropdown portal
pub fn dropdown_portal(
    id: impl Into<String>,
    trigger_rect: Option<(f64, f64, f64, f64)>,
    children: VNode,
) -> VNode {
    Portal::render_dropdown(id, trigger_rect, Placement::Bottom, children)
}

/// Convenience function to create a toast portal
pub fn toast_portal(id: impl Into<String>, position: ToastPosition, children: VNode) -> VNode {
    Portal::render_toast(id, position, children)
}

/// JavaScript utilities for portal management
///
/// This module provides JavaScript bridge code for portal operations.
pub struct PortalJs;

impl PortalJs {
    /// Get the initialization script for portal management
    pub fn init_script() -> VNode {
        let script_content = format!(
            r#"
            (function() {{
                'use strict';

                // Ensure portal container exists
                function ensurePortalContainer() {{
                    let container = document.getElementById('{}');
                    if (!container) {{
                        container = document.createElement('div');
                        container.id = '{}';
                        container.style.position = 'fixed';
                        container.style.top = '0';
                        container.style.left = '0';
                        container.style.right = '0';
                        container.style.bottom = '0';
                        container.style.pointerEvents = 'none';
                        container.style.zIndex = '9999';
                        document.body.appendChild(container);
                    }}
                    return container;
                }}

                // Move all portals to their containers
                function movePortalsToContainers() {{
                    const container = ensurePortalContainer();
                    const portals = document.querySelectorAll('[data-portal-id]');
                    portals.forEach(function(portal) {{
                        const customContainer = portal.getAttribute('data-portal-container');
                        const target = customContainer
                            ? document.querySelector(customContainer)
                            : container;
                        if (target && portal.parentElement !== target) {{
                            target.appendChild(portal);
                        }}
                    }});
                }}

                // Initialize on DOM ready
                if (document.readyState === 'loading') {{
                    document.addEventListener('DOMContentLoaded', movePortalsToContainers);
                }} else {{
                    movePortalsToContainers();
                }}

                // Re-run after WASM hydration
                setTimeout(movePortalsToContainers, 100);
                setTimeout(movePortalsToContainers, 500);

                // Watch for dynamically added portals
                const observer = new MutationObserver(function(mutations) {{
                    let shouldMove = false;
                    for (const mutation of mutations) {{
                        if (mutation.addedNodes.length > 0) {{
                            for (const node of mutation.addedNodes) {{
                                if (node.nodeType === 1) {{
                                    const el = node as Element;
                                    if (el.hasAttribute && el.hasAttribute('data-portal-id')) {{
                                        shouldMove = true;
                                        break;
                                    }}
                                    if (el.querySelector && el.querySelector('[data-portal-id]')) {{
                                        shouldMove = true;
                                        break;
                                    }}
                                }}
                            }}
                        }}
                    }}
                    if (shouldMove) {{
                        movePortalsToContainers();
                    }}
                }});

                observer.observe(document.body, {{
                    childList: true,
                    subtree: true
                }});

                // Expose portal API
                window.hikariPortal = {{
                    ensureContainer: ensurePortalContainer,
                    movePortals: movePortalsToContainers,
                    getContainer: function() {{ return document.getElementById('{}'); }}
                }};
            }})();
            "#,
            PORTAL_CONTAINER_ID, PORTAL_CONTAINER_ID, PORTAL_CONTAINER_ID
        );

        VNode::Element(
            VElement::new("script")
                .attr("type", "module")
                .child(VNode::Text(VText::new(&script_content))),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_portal_id() {
        let id1 = generate_portal_id();
        let id2 = generate_portal_id();
        assert_ne!(id1, id2);
        assert!(id1.starts_with("portal-"));
        assert!(id2.starts_with("portal-"));
    }

    #[test]
    fn test_portal_props_default() {
        let props = PortalProps::default();
        assert!(props.classes.is_empty());
        assert!(props.style.is_empty());
        assert_eq!(props.z_index, 0);
    }
}
