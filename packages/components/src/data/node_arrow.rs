// hi-components/src/data/node_arrow.rs
// TreeNodeArrow component - expand/collapse arrow for tree nodes

use crate::basic::{Arrow, ArrowDirection};
use dioxus::prelude::*;

/// Expand/collapse arrow for tree nodes
#[derive(Clone, PartialEq, Props)]
pub struct TreeNodeArrowProps {
    /// Whether to node is expanded
    #[props(default)]
    pub expanded: bool,

    /// Whether to node is disabled
    #[props(default)]
    pub disabled: bool,

    /// Custom classes
    #[props(default)]
    pub class: String,

    /// Click handler (when clicking specifically on arrow)
    #[props(default)]
    pub onclick: Option<EventHandler<MouseEvent>>,
}

/// TreeNodeArrow - The expand/collapse arrow indicator
#[component]
pub fn TreeNodeArrow(props: TreeNodeArrowProps) -> Element {
    if props.disabled {
        // Disabled state - show placeholder
        rsx! {
            span { class: "hi-tree-node-arrow-placeholder" }
        }
    } else {
        // Active state - show clickable arrow
        let arrow_class = format!(
            "hi-tree-node-arrow {} {}",
            if props.expanded {
                "hi-tree-node-arrow-expanded"
            } else {
                ""
            },
            props.class
        );
        let handler = props.onclick;

        // Determine arrow direction based on expanded state
        let direction = if props.expanded {
            ArrowDirection::Down
        } else {
            ArrowDirection::Right
        };

        rsx! {
            span {
                class: "{arrow_class}",
                aria_hidden: "true",
                onclick: move |e: MouseEvent| {
                    e.stop_propagation();
                    if let Some(ref h) = handler {
                        h.call(e);
                    }
                },
                Arrow {
                    direction,
                    size: 14,
                }
            }
        }
    }
}
