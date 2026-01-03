// hikari-components/src/data/virtual_scroll.rs
// Virtual scroll component for large tree data sets

use dioxus::prelude::*;

use crate::styled::StyledComponent;

/// VirtualScroll component wrapper (for StyledComponent)
pub struct VirtualScrollComponent;

/// Tree node data structure
#[derive(Clone, PartialEq, Debug, Default)]
pub struct VirtualTreeNodeData {
    pub id: String,

    pub title: String,

    pub children: Vec<VirtualTreeNodeData>,

    pub disabled: bool,
}

#[derive(Clone, PartialEq, Props)]
pub struct VirtualTreeProps {
    /// Full tree data
    #[props(default)]
    pub data: Vec<VirtualTreeNodeData>,

    /// Container height (e.g., "400px")
    #[props(default)]
    pub height: String,

    /// Height of each tree node
    #[props(default)]
    pub item_height: u32,

    /// Extra items to render (buffer)
    #[props(default)]
    pub overscan: u32,

    #[props(default)]
    pub class: String,

    pub on_scroll: Option<EventHandler<f64>>,
}

impl Default for VirtualTreeProps {
    fn default() -> Self {
        Self {
            data: Vec::default(),
            height: String::from("400px"),
            item_height: 32,
            overscan: 5,
            class: String::default(),
            on_scroll: None,
        }
    }
}

/// Virtual scroll tree component for large datasets
#[component]
pub fn VirtualTree(props: VirtualTreeProps) -> Element {
    let mut scroll_position = use_signal(|| 0.0);
    let container_height = props.height.parse::<f64>().unwrap_or(400.0);

    // Flatten tree data for virtual scrolling
    let flattened_items = use_memo(move || {
        let mut result = Vec::new();
        fn flatten(
            node: &VirtualTreeNodeData,
            depth: usize,
            result: &mut Vec<(VirtualTreeNodeData, usize)>,
        ) {
            result.push((node.clone(), depth));
            for child in &node.children {
                flatten(child, depth + 1, result);
            }
        }
        for node in &props.data {
            flatten(node, 0, &mut result);
        }
        result
    });

    let total_height = flattened_items.read().len() as f64 * props.item_height as f64;

    // Calculate visible range
    let range = use_memo(move || {
        let scroll = scroll_position();
        let start = (scroll / props.item_height as f64).floor() as usize;
        let visible_count = (container_height / props.item_height as f64).ceil() as usize;
        let end =
            (start + visible_count + props.overscan as usize).min(flattened_items.read().len());
        let start = start.saturating_sub(props.overscan as usize);
        (start, end)
    });

    let visible_items = use_memo(move || {
        let (start, end) = *range.read();
        flattened_items.read()[start..end].to_vec()
    });

    rsx! {
        div {
            class: format!("hikari-virtual-tree {}", props.class),
            style: "position: relative; overflow: hidden; height: {props.height};",

            div {
                style: "position: absolute; top: 0; left: 0; right: 0; height: {total_height}px; pointer-events: none;",
            }

            div {
                class: "hikari-virtual-tree-viewport",
                style: "position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow-y: auto;",
                onscroll: move |e| {
                    let scroll_top = e.scroll_top();
                    scroll_position.set(scroll_top);

                    if let Some(handler) = props.on_scroll.as_ref() {
                        handler.call(scroll_top);
                    }
                },

                div {
                    style: "position: relative; height: {total_height}px;",

                    {let items_data: Vec<_> = visible_items.read().iter().map(|(item, depth)| {
                        let idx = {
                            let items = flattened_items.read();
                            items.iter()
                                .position(|(n, _)| n.id == item.id)
                                .unwrap_or(0)
                        };
                        (item.id.clone(), item.title.clone(), item.disabled, idx, *depth)
                    }).collect();

                    items_data.into_iter().map(|(id, title, disabled, idx, depth)| {
                        rsx! {
                            div {
                                class: format!(
                                    "hikari-virtual-tree-node {}",
                                    if disabled { "hikari-tree-node-disabled" } else { "" }
                                ),
                                style: "position: absolute; top: {(idx as f64 * props.item_height as f64)}px; left: 0; right: 0; height: {props.item_height}px; padding-left: {(depth * 24)}px; display: flex; align-items: center;",
                                "data-key": "{id}",

                                span {
                                    class: "hikari-tree-node-content",
                                    style: "display: flex; align-items: center; gap: 8px;",
                                    "{title}"
                                }
                            }
                        }
                    })}
                }
            }
        }
    }
}

impl StyledComponent for VirtualScrollComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/virtual-scroll.css"))
    }

    fn name() -> &'static str {
        "virtual-scroll"
    }
}
