// hi-components/src/entry/transfer.rs
// Transfer component with Arknights + FUI styling

use hikari_icons::{Icon, MdiIcon};
use hikari_palette::classes::{ClassesBuilder, TransferClass, UtilityClass};

use crate::{prelude::*, styled::StyledComponent};

pub struct TransferComponent;

#[derive(Clone, PartialEq, Debug)]
pub struct SelectChangeEvent {
    pub list_type: usize,
    pub keys: Vec<String>,
}

#[derive(Debug)]
#[define_props]
pub struct TransferItem {
    #[default("".to_string())]
    pub item_key: String,
    #[default("".to_string())]
    pub label: String,
    #[default(false)]
    pub disabled: bool,
}

#[define_props]
pub struct TransferProps {
    pub data: Vec<TransferItem>,

    pub target_keys: Vec<String>,

    pub source_selected_keys: Vec<String>,

    pub target_selected_keys: Vec<String>,

    pub titles: Option<[String; 2]>,

    pub show_search: bool,

    pub one_way: bool,

    pub disabled: bool,

    pub class: String,

    pub on_select_change: Option<EventHandler<SelectChangeEvent>>,

    pub on_change: Option<EventHandler<Vec<String>>>,
}

///
///
///
///
#[component]
pub fn Transfer(props: TransferProps) -> Element {
    let titles = props
        .titles
        .unwrap_or(["Source".to_string(), "Target".to_string()]);

    let data_source = props.data.clone();
    let target_keys_source = props.target_keys.clone();

    let source_items = use_memo(move || {
        data_source
            .iter()
            .filter(|item| !target_keys_source.contains(&item.item_key))
            .cloned()
            .collect::<Vec<_>>()
    })
    .read();

    let data_target = props.data.clone();
    let target_keys_target = props.target_keys.clone();

    let target_items = use_memo(move || {
        data_target
            .iter()
            .filter(|item| target_keys_target.contains(&item.item_key))
            .cloned()
            .collect::<Vec<_>>()
    })
    .read();

    let handle_to_target = {
        let source_selected = props.source_selected_keys.clone();
        let current_target = props.target_keys.clone();
        let data_clone = props.data.clone();
        let on_change_cb = props.on_change.clone();

        move |_| {
            let mut new_target = current_target.clone();
            new_target.extend(source_selected.iter().cloned());
            new_target.sort_by(|a, b| {
                data_clone
                    .iter()
                    .position(|d| &d.item_key == a)
                    .cmp(&data_clone.iter().position(|d| &d.item_key == b))
            });

            if let Some(handler) = on_change_cb.as_ref() {
                handler.call(new_target);
            }
        }
    };

    let handle_to_source = {
        let target_selected = props.target_selected_keys.clone();
        let current_target = props.target_keys.clone();
        let on_change_cb = props.on_change.clone();

        move |_| {
            let new_target: Vec<String> = current_target
                .iter()
                .filter(|key| !target_selected.contains(key))
                .cloned()
                .collect();

            if let Some(handler) = on_change_cb.as_ref() {
                handler.call(new_target);
            }
        }
    };

    let on_select_change_for_source = props.on_select_change.clone();
    let handle_source_select = EventHandler::new(move |keys: Vec<String>| {
        if let Some(handler) = on_select_change_for_source.as_ref() {
            handler.call(SelectChangeEvent { list_type: 0, keys });
        }
    });

    let on_select_change_for_target = props.on_select_change.clone();
    let handle_target_select = EventHandler::new(move |keys: Vec<String>| {
        if let Some(handler) = on_select_change_for_target.as_ref() {
            handler.call(SelectChangeEvent { list_type: 1, keys });
        }
    });

    let container_classes = ClassesBuilder::new()
        .add(TransferClass::Transfer)
        .add_raw(&props.class)
        .build();

    rsx! {
        div { class: container_classes,

            TransferPanel {
                title: Some(titles[0].clone()),
                items: Some(source_items.clone()),
                selected_keys: Some(props.source_selected_keys.clone()),
                show_search: Some(props.show_search),
                on_select: Some(handle_source_select),
            }

            div { class: TransferClass::Operations.as_class(),
                button {
                    class: TransferClass::Operation.as_class(),
                    disabled: props.source_selected_keys.is_empty() || props.disabled,
                    onclick: handle_to_target,

                    Icon { icon: MdiIcon::ChevronRight, size: 16 }
                }

                if !props.one_way {
                    button {
                        class: TransferClass::Operation.as_class(),
                        disabled: props.target_selected_keys.is_empty() || props.disabled,
                        onclick: handle_to_source,

                        Icon { icon: MdiIcon::ChevronLeft, size: 16 }
                    }
                }
            }

            TransferPanel {
                title: Some(titles[1].clone()),
                items: Some(target_items.clone()),
                selected_keys: Some(props.target_selected_keys.clone()),
                show_search: Some(props.show_search),
                on_select: Some(handle_target_select),
            }
        }
    }
}

#[component]
fn TransferPanel(
    #[props(default)] title: Option<String>,
    #[props(default)] items: Option<Vec<TransferItem>>,
    #[props(default)] selected_keys: Option<Vec<String>>,
    #[props(default)] show_search: Option<bool>,
    #[props(default)] on_select: Option<EventHandler<Vec<String>>>,
) -> Element {
    let title = title.unwrap_or_default();
    let items = items.unwrap_or_default();
    let selected_keys = selected_keys.unwrap_or_default();
    let show_search = show_search.unwrap_or(false);
    let on_select = on_select.unwrap_or_else(|| EventHandler::new(|_| {}));

    let search_text = use_signal(String::new);
    let all_selected = use_signal(|| false);

    // Clone items for use_memo since items is needed later for empty check
    let items_for_memo = items.clone();
    // Clone for use_memo
    let search_text_for_memo = search_text.clone();
    let filtered_items = use_memo(move || {
        let search = search_text_for_memo.get().to_lowercase();
        items_for_memo
            .iter()
            .filter(|item| {
                search.is_empty()
                    || item.label.to_lowercase().contains(&search)
                    || item.item_key.to_lowercase().contains(&search)
            })
            .cloned()
            .collect::<Vec<_>>()
    })
    .read();

    // Clone for handle_toggle_all
    let on_select_for_toggle = on_select.clone();
    let filtered_items_for_toggle = filtered_items.clone();
    let handle_toggle_all = move |_| {
        if all_selected.get() {
            on_select_for_toggle.call(Vec::new());
        } else {
            let all_keys: Vec<String> = filtered_items_for_toggle
                .iter()
                .filter(|item| !item.disabled)
                .map(|item| item.item_key.clone())
                .collect();
            on_select_for_toggle.call(all_keys);
        }
    };

    // Clone for handle_search
    let search_text_for_handler = search_text.clone();
    let handle_search = move |e: InputEvent| {
        search_text_for_handler.set(e.data.clone());
    };

    // Clone for display in input value
    let search_text_value = search_text.get();

    let all_keys: Vec<String> = filtered_items
        .iter()
        .filter(|item| !item.disabled)
        .map(|item| item.item_key.clone())
        .collect();

    let is_all_selected =
        !all_keys.is_empty() && all_keys.iter().all(|k| selected_keys.contains(k));

    // Use filtered_items directly (already computed)
    let display_items = filtered_items.clone();

    // Pre-compute item list nodes outside rsx! to avoid let statements inside for loop
    let item_nodes: Vec<VNode> = display_items
        .iter()
        .map(|item| {
            let item_key = item.item_key.clone();
            let label = item.label.clone();
            let item_disabled = item.disabled;
            let is_selected = selected_keys.contains(&item.item_key);
            let selected_keys_clone = selected_keys.clone();
            let on_select_clone = on_select.clone();

            rsx! {
                li {
                    key: item_key.clone(),
                    class: ClassesBuilder::new()
                        .add(TransferClass::PanelItem)
                        .add_if(TransferClass::PanelItemSelected, || is_selected)
                        .add_if(TransferClass::PanelItemDisabled, || item_disabled)
                        .build(),

                    onclick: move |_| {
                        if !item_disabled {
                            let mut new_selection = selected_keys_clone.clone();
                            if let Some(pos) = new_selection.iter().position(|k| k == &item_key) {
                                new_selection.remove(pos);
                            } else {
                                new_selection.push(item_key.clone());
                            }
                            on_select_clone.call(new_selection);
                        }
                    },

                    input {
                        class: TransferClass::ItemCheckbox.as_class(),
                        r#type: "checkbox",
                        checked: is_selected,
                        disabled: item_disabled,
                    }

                    span { class: TransferClass::ItemLabel.as_class(), "{label}" }
                }
            }
        })
        .collect();

    // Pre-compute search section
    let search_section = if show_search {
        rsx! {
            div { class: TransferClass::PanelSearch.as_class(),
                input {
                    class: TransferClass::PanelInput.as_class(),
                    r#type: "text",
                    placeholder: "Search...",
                    value: "{search_text_value}",
                    oninput: handle_search,
                }
            }
        }
    } else {
        VNode::empty()
    };

    // Pre-compute empty state - use items directly since filtered_items is already computed
    let empty_state = if items.is_empty() {
        rsx! {
            li { class: TransferClass::PanelEmpty.as_class(), "No items" }
        }
    } else {
        VNode::empty()
    };

    // Combine item nodes with empty state into a single Vec
    let mut list_children = item_nodes;
    if items.is_empty() {
        list_children.push(empty_state);
    }

    rsx! {
        div { class: TransferClass::Panel.as_class(),
            div { class: TransferClass::PanelHeader.as_class(),
                input {
                    class: TransferClass::PanelCheckbox.as_class(),
                    r#type: "checkbox",
                    checked: is_all_selected,
                    onchange: handle_toggle_all,
                }
                span { class: TransferClass::PanelTitle.as_class(), "{title}" }
                span { class: TransferClass::PanelCount.as_class(), "{items.len()}" }
            }

            {search_section}

            ul { class: TransferClass::PanelList.as_class(), ..list_children }
        }
    }
}

impl StyledComponent for TransferComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/components/transfer.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "transfer"
    }
}
