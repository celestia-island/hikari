// hi-components/src/entry/transfer.rs
// Transfer component with Arknights + FUI styling

use crate::prelude::*;
use hikari_icons::{Icon, MdiIcon};
use hikari_palette::classes::{ClassesBuilder, TransferClass, UtilityClass};

use crate::styled::StyledComponent;

pub struct TransferComponent;

#[derive(Clone, PartialEq, Debug)]
pub struct SelectChangeEvent {
    pub list_type: usize,
    pub keys: Vec<String>,
}

#[derive(Clone, PartialEq, Debug, Props, Default)]
pub struct TransferItem {
    pub item_key: String,
    pub label: String,
    #[props(default)]
    pub disabled: bool,
}

#[derive(Clone, PartialEq, Props)]
pub struct TransferProps {
    pub data: Vec<TransferItem>,

    #[props(default)]
    pub target_keys: Vec<String>,

    #[props(default)]
    pub source_selected_keys: Vec<String>,

    #[props(default)]
    pub target_selected_keys: Vec<String>,

    #[props(default)]
    pub titles: Option<[String; 2]>,

    #[props(default)]
    pub show_search: bool,

    #[props(default)]
    pub one_way: bool,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
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
    }).read();

    let data_target = props.data.clone();
    let target_keys_target = props.target_keys.clone();

    let target_items = use_memo(move || {
        data_target
            .iter()
            .filter(|item| target_keys_target.contains(&item.item_key))
            .cloned()
            .collect::<Vec<_>>()
    }).read();

    let handle_to_target = {
        let source_selected = props.source_selected_keys.clone();
        let current_target = props.target_keys.clone();
        let data_clone = props.data.clone();
        let on_change_cb = props.on_change;

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
        let on_change_cb = props.on_change;

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

    let handle_source_select = EventHandler::new(move |keys: Vec<String>| {
        if let Some(handler) = props.on_select_change.as_ref() {
            handler.call(SelectChangeEvent { list_type: 0, keys });
        }
    });

    let handle_target_select = EventHandler::new(move |keys: Vec<String>| {
        if let Some(handler) = props.on_select_change.as_ref() {
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

                    Icon {
                        icon: MdiIcon::ChevronRight,
                        size: 16,
                    }
                }

                if !props.one_way {
                    button {
                        class: TransferClass::Operation.as_class(),
                        disabled: props.target_selected_keys.is_empty() || props.disabled,
                        onclick: handle_to_source,

                    Icon {
                        icon: MdiIcon::ChevronLeft,
                        size: 16,
                    }
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
    #[props(default)]
    title: Option<String>,
    #[props(default)]
    items: Option<Vec<TransferItem>>,
    #[props(default)]
    selected_keys: Option<Vec<String>>,
    #[props(default)]
    show_search: Option<bool>,
    #[props(default)]
    on_select: Option<EventHandler<Vec<String>>>,
) -> Element {
    let title = title.unwrap_or_default();
    let items = items.unwrap_or_default();
    let selected_keys = selected_keys.unwrap_or_default();
    let show_search = show_search.unwrap_or(false);
    let on_select = on_select.unwrap_or_else(|| EventHandler::new(|_| {}));

    let mut search_text = use_signal(String::new);
    let all_selected = use_signal(|| false);

    let filtered_items = use_memo(move || {
        let search = search_text.get().to_lowercase();
        items
            .iter()
            .filter(|item| {
                search.is_empty()
                    || item.label.to_lowercase().contains(&search)
                    || item.item_key.to_lowercase().contains(&search)
            })
            .cloned()
            .collect::<Vec<_>>()
    }).read();

    let handle_toggle_all = move |_| {
        if all_selected.get() {
            on_select.call(Vec::new());
        } else {
            let all_keys: Vec<String> = filtered_items
                .iter()
                .filter(|item| !item.disabled)
                .map(|item| item.item_key.clone())
                .collect();
            on_select.call(all_keys);
        }
    };

    let handle_search = move |e: Event| {
        if let Some(form_data) = e.as_any().downcast_ref::<FormData>() {
            search_text.set(form_data.value.clone());
        }
    };

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
            let on_select_clone = on_select;

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

                    span { class: TransferClass::ItemLabel.as_class(),
                        "{label}"
                    }
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
                    value: search_text.get(),
                    oninput: handle_search,
                }
            }
        }
    } else {
        VNode::empty()
    };

    // Pre-compute empty state
    let empty_state = if items.is_empty() {
        rsx! {
            li { class: TransferClass::PanelEmpty.as_class(),
                "No items"
            }
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
                span { class: TransferClass::PanelCount.as_class(),
                    "{items.len()}"
                }
            }

            {search_section}

            ul { class: TransferClass::PanelList.as_class(),
                ..list_children
            }
        }
    }
}

impl StyledComponent for TransferComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/transfer.css"))
    }

    fn name() -> &'static str {
        "transfer"
    }
}
