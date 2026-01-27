// hi-components/src/entry/transfer.rs
// Transfer component with Arknights + FUI styling

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::ClassesBuilder;

use crate::styled::StyledComponent;

/// Transfer component wrapper (for StyledComponent)
pub struct TransferComponent;

/// Event data for selection changes
#[derive(Clone, PartialEq, Debug)]
pub struct SelectChangeEvent {
    pub list_type: usize,
    pub keys: Vec<String>,
}

#[derive(Clone, PartialEq, Props, Default)]
pub struct TransferItem {
    pub item_key: String,
    pub label: String,
    #[props(default)]
    pub disabled: bool,
}

#[derive(Clone, PartialEq, Props)]
pub struct TransferProps {
    /// All available items
    pub data: Vec<TransferItem>,

    /// Currently selected keys (keys in target list)
    #[props(default)]
    pub target_keys: Vec<String>,

    /// Currently selected keys in source list
    #[props(default)]
    pub source_selected_keys: Vec<String>,

    /// Currently selected keys in target list
    #[props(default)]
    pub target_selected_keys: Vec<String>,

    /// Custom titles for source and target lists
    #[props(default)]
    pub titles: Option<[String; 2]>,

    /// Whether to show search inputs
    #[props(default)]
    pub show_search: bool,

    /// Whether to enable one-way transfer (only to target)
    #[props(default)]
    pub one_way: bool,

    /// Whether the transfer is disabled
    #[props(default)]
    pub disabled: bool,

    /// Custom classes
    #[props(default)]
    pub class: String,

    /// Callback when selection changes (list_type: 0=source, 1=target)
    pub on_select_change: Option<EventHandler<SelectChangeEvent>>,

    /// Callback when transfer changes (target keys)
    pub on_change: Option<EventHandler<Vec<String>>>,
}

/// Transfer component - Move items between two lists
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Transfer, TransferItem, SelectChangeEvent};
///
/// fn app() -> Element {
///     let mut target_keys = use_signal(|| vec!["3".to_string(), "4".to_string()]);
///     let mut source_selected = use_signal(Vec::new);
///     let mut target_selected = use_signal(Vec::new);
///
///     rsx! {
///         Transfer {
///             data: vec![
///                 TransferItem { key: "1".to_string(), label: "Item 1".to_string(), ..Default::default() },
///                 TransferItem { key: "2".to_string(), label: "Item 2".to_string(), ..Default::default() },
///                 TransferItem { key: "3".to_string(), label: "Item 3".to_string(), ..Default::default() },
///                 TransferItem { key: "4".to_string(), label: "Item 4".to_string(), ..Default::default() },
///             ],
///             target_keys: target_keys(),
///             source_selected_keys: source_selected(),
///             target_selected_keys: target_selected(),
///             titles: Some(["Source".to_string(), "Target".to_string()]),
///             on_select_change: move |event| {
///                 match event.list_type {
///                     0 => source_selected.set(event.keys),
///                     1 => target_selected.set(event.keys),
///                     _ => {}
///                 }
///             },
///             on_change: move |keys| target_keys.set(keys),
///         }
///     }
/// }
/// ```
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
    });

    let data_target = props.data.clone();
    let target_keys_target = props.target_keys.clone();

    let target_items = use_memo(move || {
        data_target
            .iter()
            .filter(|item| target_keys_target.contains(&item.item_key))
            .cloned()
            .collect::<Vec<_>>()
    });

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

    let handle_source_select = move |keys: Vec<String>| {
        if let Some(handler) = props.on_select_change.as_ref() {
            handler.call(SelectChangeEvent { list_type: 0, keys });
        }
    };

    let handle_target_select = move |keys: Vec<String>| {
        if let Some(handler) = props.on_select_change.as_ref() {
            handler.call(SelectChangeEvent { list_type: 1, keys });
        }
    };

    rsx! {
        div { class: ClassesBuilder::new()
            .add_raw("hi-transfer")
            .add_raw(&props.class)
            .build(),

            TransferPanel {
                title: titles[0].clone(),
                items: source_items(),
                selected_keys: props.source_selected_keys.clone(),
                show_search: props.show_search,
                on_select: handle_source_select,
            }

            div { class: "hi-transfer-operations",
                button {
                    class: "hi-transfer-operation",
                    disabled: props.source_selected_keys.is_empty() || props.disabled,
                    onclick: handle_to_target,

                    Icon {
                        icon: MdiIcon::ChevronRight,
                        size: 16,
                    }
                }

                if !props.one_way {
                    button {
                        class: "hi-transfer-operation",
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
                title: titles[1].clone(),
                items: target_items(),
                selected_keys: props.target_selected_keys.clone(),
                show_search: props.show_search,
                on_select: handle_target_select,
            }
        }
    }
}

#[component]
fn TransferPanel(
    title: String,
    items: Vec<TransferItem>,
    selected_keys: Vec<String>,
    show_search: bool,
    on_select: EventHandler<Vec<String>>,
) -> Element {
    let mut search_text = use_signal(String::new);
    let all_selected = use_signal(|| false);

    let filtered_items = use_memo(move || {
        let search = search_text().to_lowercase();
        items
            .iter()
            .filter(|item| {
                search.is_empty()
                    || item.label.to_lowercase().contains(&search)
                    || item.item_key.to_lowercase().contains(&search)
            })
            .cloned()
            .collect::<Vec<_>>()
    });

    let handle_toggle_all = move |_| {
        if all_selected() {
            on_select.call(Vec::new());
        } else {
            let all_keys: Vec<String> = filtered_items()
                .iter()
                .filter(|item| !item.disabled)
                .map(|item| item.item_key.clone())
                .collect();
            on_select.call(all_keys);
        }
    };

    let handle_search = move |e: Event<FormData>| {
        search_text.set(e.value());
    };

    let all_keys: Vec<String> = filtered_items()
        .iter()
        .filter(|item| !item.disabled)
        .map(|item| item.item_key.clone())
        .collect();

    let is_all_selected = all_keys.len() > 0 && all_keys.iter().all(|k| selected_keys.contains(k));

    rsx! {
        div { class: "hi-transfer-panel",
            div { class: "hi-transfer-panel-header",
                input {
                    class: "hi-transfer-panel-checkbox",
                    r#type: "checkbox",
                    checked: is_all_selected,
                    onchange: handle_toggle_all,
                }
                span { class: "hi-transfer-panel-title", "{title}" }
                span { class: "hi-transfer-panel-count",
                    "{filtered_items().len()}"
                }
            }

            if show_search {
                div { class: "hi-transfer-panel-search",
                    input {
                        class: "hi-transfer-panel-input",
                        r#type: "text",
                        placeholder: "Search...",
                        value: "{search_text()}",
                        oninput: handle_search,
                    }
                }
            }

             ul { class: "hi-transfer-panel-list",
                {filtered_items().iter().map(|item| {
                    let is_selected = selected_keys.contains(&item.item_key);
                    let item_disabled = item.disabled;
                    let on_select_clone = on_select.clone();
                    let selected_keys_clone = selected_keys.clone();
                    let item_key = item.item_key.clone();

                    rsx! {
                        li {
                            class: ClassesBuilder::new()
                                .add_raw("hi-transfer-panel-item")
                                .add_raw(if is_selected { "hi-transfer-panel-item-selected" } else { "" })
                                .add_raw(if item_disabled { "hi-transfer-panel-item-disabled" } else { "" })
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
                                class: "hi-transfer-item-checkbox",
                                r#type: "checkbox",
                                checked: is_selected,
                                disabled: item_disabled,
                            }

                            span { class: "hi-transfer-item-label",
                                "{item.label}"
                            }
                        }
                    }
                })}

                if filtered_items().is_empty() {
                    li { class: "hi-transfer-panel-empty",
                        "No items"
                    }
                }
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
