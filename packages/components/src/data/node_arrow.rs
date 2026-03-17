// hi-components/src/data/node_arrow.rs
// TreeNodeArrow component - expand/collapse arrow for tree nodes

use crate::prelude::*;

use crate::basic::{Arrow, ArrowDirection};

#[derive(Clone, PartialEq, Props)]
pub struct TreeNodeArrowProps {
    #[props(default)]
    pub expanded: bool,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub onclick: Option<EventHandler<MouseEvent>>,
}

impl Default for TreeNodeArrowProps {
    fn default() -> Self {
        Self {
            expanded: false,
            disabled: false,
            class: String::new(),
            onclick: None,
        }
    }
}

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
{ "" }
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
                class: arrow_class,
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
