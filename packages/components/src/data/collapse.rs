// hi-components/src/data/collapse.rs
// Animated collapse/expand component for tree nodes

use dioxus::prelude::*;

use crate::styled::StyledComponent;
use palette::classes::{components::CollapseClass, ClassesBuilder};

/// Collapse component wrapper (for StyledComponent)
#[derive(Clone, PartialEq, Props)]
pub struct CollapseProps {
    #[props(default)]
    pub expanded: bool,

    #[props(default)]
    pub duration: u64,

    #[props(default)]
    pub animated: bool,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub children: Element,

    pub on_expand: Option<EventHandler<bool>>,
}

impl Default for CollapseProps {
    fn default() -> Self {
        Self {
            expanded: false,
            duration: 200,
            animated: true,
            class: String::default(),
            children: VNode::empty(),
            on_expand: None,
        }
    }
}

#[component]
pub fn Collapse(props: CollapseProps) -> Element {
    let mut is_expanded = use_signal(|| props.expanded);
    let content_height = use_signal(|| 0.0);

    let animation_style = if props.animated {
        format!(
            "transition: max-height {}ms ease-in-out, opacity {}ms ease-in-out;",
            props.duration, props.duration
        )
    } else {
        String::from("")
    };

    let max_height = if *is_expanded.read() {
        format!("{}px", *content_height.read())
    } else {
        String::from("0px")
    };

    let opacity = if *is_expanded.read() { "1" } else { "0" };

    let arrow_rotation = if *is_expanded.read() { "90deg" } else { "0deg" };

    let children_content = props.children.clone();

    rsx! {
        div {
            class: format!("hi-collapse {}", props.class),

            div {
                class: "hi-collapse-header",
                style: "cursor: pointer; display: flex; align-items: center; gap: 8px;",
                onclick: move |_| {
                    is_expanded.set(!is_expanded());

                    if let Some(handler) = props.on_expand.as_ref() {
                        handler.call(*is_expanded.read());
                    }
                },

                span {
                    class: "hi-collapse-arrow",
                    style: format!(
                        "display: inline-block; transition: transform {}ms ease-in-out; transform: rotate({});",
                        props.duration, arrow_rotation
                    ),
                    "›"
                }

                span {
                    class: "hi-collapse-header-content",
                    { children_content }
                }
            }

            let content_classes = ClassesBuilder::new()
                .add(CollapseClass::CollapseContent)
                .add_if(CollapseClass::Expanded, || *is_expanded.read())
                .add_if(CollapseClass::Collapsed, || !*is_expanded.read())
                .build();

            div {
                class: "{content_classes}",
                style: format!(
                    "max-height: {}; overflow: hidden; opacity: {}; {}",
                    max_height, opacity, animation_style
                ),

                div {
                    class: "hi-collapse-inner",
                    onmounted: move |e: Event<MountedData>| {
                        let _ = e;
                    },

                    { props.children }
                }
            }
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct TreeCollapseProps {
    #[props(default)]
    pub expanded: bool,

    #[props(default)]
    pub duration: u64,

    #[props(default)]
    pub animated: bool,

    #[props(default)]
    pub title: String,

    #[props(default)]
    pub icon: Option<Element>,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub children: Element,

    pub on_expand: Option<EventHandler<bool>>,
}

impl Default for TreeCollapseProps {
    fn default() -> Self {
        Self {
            expanded: false,
            duration: 200,
            animated: true,
            title: String::default(),
            icon: None,
            class: String::default(),
            children: VNode::empty(),
            on_expand: None,
        }
    }
}

#[component]
pub fn TreeCollapse(props: TreeCollapseProps) -> Element {
    let mut is_expanded = use_signal(|| props.expanded);
    let content_height = use_signal(|| 0.0);

    let animation_style = if props.animated {
        format!(
            "transition: max-height {}ms ease-in-out, opacity {}ms ease-in-out;",
            props.duration, props.duration
        )
    } else {
        String::from("")
    };

    let max_height = if *is_expanded.read() {
        format!("{}px", *content_height.read())
    } else {
        String::from("0px")
    };

    let opacity = if *is_expanded.read() { "1" } else { "0" };

    let arrow_rotation = if *is_expanded.read() { "90deg" } else { "0deg" };

    rsx! {
        div {
            class: format!("hi-tree-collapse {}", props.class),

            div {
                class: "hi-tree-node-header",
                style: "cursor: pointer; display: flex; align-items: center; gap: 8px;",
                onclick: move |_| {
                    is_expanded.set(!is_expanded());

                    if let Some(handler) = props.on_expand.as_ref() {
                        handler.call(*is_expanded.read());
                    }
                },

                span {
                    class: "hi-tree-node-arrow",
                    style: format!(
                        "display: inline-block; transition: transform {}ms ease-in-out; transform: rotate({});",
                        props.duration, arrow_rotation
                    ),
                    "›"
                }

                if let Some(icon) = props.icon {
                    span { class: "hi-tree-node-icon", { icon } }
                }

                span {
                    class: "hi-tree-node-title",
                    "{props.title}"
                }
            }

            let tree_children_classes = ClassesBuilder::new()
                .add(CollapseClass::TreeNodeChildren)
                .add_if(CollapseClass::TreeExpanded, || *is_expanded.read())
                .add_if(CollapseClass::TreeCollapsed, || !*is_expanded.read())
                .build();

            div {
                class: "{tree_children_classes}",
                style: format!(
                    "max-height: {}; overflow: hidden; opacity: {}; padding-left: 24px; {}",
                    max_height, opacity, animation_style
                ),

                div {
                    class: "hi-tree-node-children-inner",
                    onmounted: move |e: Event<MountedData>| {
                        let _ = e;
                    },

                    { props.children }
                }
            }
        }
    }
}

impl StyledComponent for CollapseComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/collapse.css"))
    }

    fn name() -> &'static str {
        "collapse"
    }
}
