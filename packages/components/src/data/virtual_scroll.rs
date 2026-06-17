// hi-components/src/data/virtual_scroll.rs
// Virtual scroll component for large tree data sets

use hikari_palette::classes::VirtualScrollClass;
use tairitsu_style::ClassesBuilder;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct VirtualScrollComponent;

#[derive(Clone, PartialEq, Debug, Default)]
pub struct VirtualTreeNodeData {
    pub id: String,

    pub title: String,

    pub children: Vec<VirtualTreeNodeData>,

    pub disabled: bool,
}

#[derive(Clone, Debug)]
pub struct FlatItem {
    pub id: String,
    pub title: String,
    pub disabled: bool,
    pub depth: usize,
}

#[define_props]
pub struct VirtualTreeProps {
    pub data: Vec<VirtualTreeNodeData>,

    #[default("400px".to_string())]
    pub height: String,

    #[default(32)]
    pub item_height: u32,

    #[default(5)]
    pub overscan: u32,

    pub class: String,

    pub on_scroll: Option<EventHandler<f64>>,
}

#[component]
pub fn VirtualTree(props: VirtualTreeProps) -> Element {
    let scroll_position = use_signal(|| 0.0);
    let container_height = props.height.parse::<f64>().unwrap_or(400.0);

    let flattened_items = use_memo(move || {
        let mut result = Vec::new();
        fn flatten(node: &VirtualTreeNodeData, depth: usize, result: &mut Vec<FlatItem>) {
            result.push(FlatItem {
                id: node.id.clone(),
                title: node.title.clone(),
                disabled: node.disabled,
                depth,
            });
            for child in &node.children {
                flatten(child, depth + 1, result);
            }
        }
        for node in &props.data {
            flatten(node, 0, &mut result);
        }
        result
    });

    let total_height = flattened_items.read().len() as f64 * f64::from(props.item_height);

    let flattened_for_range = flattened_items.clone();
    let scroll_for_range = scroll_position.clone();
    let range = use_memo(move || {
        let scroll = scroll_for_range.get();
        let start = (scroll / f64::from(props.item_height)).floor() as usize;
        let visible_count = (container_height / f64::from(props.item_height)).ceil() as usize;
        let end =
            (start + visible_count + props.overscan as usize).min(flattened_for_range.read().len());
        let start = start.saturating_sub(props.overscan as usize);
        (start, end)
    });

    let flattened_for_visible = flattened_items.clone();
    let visible_range = range.read();
    let (vis_start, vis_end) = (visible_range.0, visible_range.1);
    let item_elements: Vec<Element> = flattened_for_visible.read()[vis_start..vis_end]
        .iter()
        .enumerate()
        .map(|(i, item)| {
            let global_idx = vis_start + i;
            let node_classes = ClassesBuilder::new()
                .add_typed(VirtualScrollClass::VirtualTree)
                .add_typed_if(VirtualScrollClass::NodeDisabled, item.disabled)
                .build();

            let item_height = props.item_height;
            let depth = item.depth;
            let title = item.title.clone();
            let id = item.id.clone();
            rsx! {
                div {
                    class: node_classes,
                    style: "position: absolute; top: {(global_idx as f64 * item_height as f64)}px; left: 0; right: 0; height: {item_height}px; padding-left: {(depth * 24)}px; display: flex; align-items: center;",
                    "data-key": id,

                    span {
                        class: "hi-tree-node-content",
                        style: "display: flex; align-items: center; gap: 8px;",
                        "{title}"
                    }
                }
            }
        })
        .collect();

    // Clone for onscroll handler
    let scroll_position_for_onscroll = scroll_position.clone();
    let on_scroll_handler = props.on_scroll.clone();

    rsx! {
        div {
            class: format!("hi-virtual-tree {}", props.class),
            style: "position: relative; overflow: hidden; height: {props.height};",

            div { style: "position: absolute; top: 0; left: 0; right: 0; height: {total_height}px; pointer-events: none;" }

            div {
                class: "hi-virtual-tree-viewport",
                style: "position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow-y: auto;",
                onscroll: move |_e: Event| {
                    use crate::platform::get_scroll_top_by_selector;
                    let scroll_top = get_scroll_top_by_selector(".hi-virtual-tree-viewport");
                    scroll_position_for_onscroll.set(scroll_top);

                    if let Some(handler) = on_scroll_handler.as_ref() {
                        handler.call(scroll_top);
                    }
                },

                div {
                    style: "position: relative; height: {total_height}px;",
                    ..item_elements,
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
