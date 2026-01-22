// hi-components/src/data/collapse.rs
// Animated collapse/expand component for tree nodes

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, CollapseClass};

use crate::styled::StyledComponent;

/// Collapse component wrapper (for StyledComponent)
pub struct CollapseComponent;

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

    let _animation_style = if props.animated {
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

    let content_classes = ClassesBuilder::new()
        .add(CollapseClass::CollapseContent)
        .add_if(CollapseClass::Expanded, || *is_expanded.read())
        .build();

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

            div {
                class: "{content_classes}",
                style: format!(
                    "max-height: {}; overflow: hidden; opacity: {};",
                    max_height, opacity
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

impl StyledComponent for CollapseComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/collapse.css"))
    }

    fn name() -> &'static str {
        "collapse"
    }
}
