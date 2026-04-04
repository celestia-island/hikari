// hi-components/src/data/selection.rs
// Selection component with Arknights + FUI styling

use hikari_palette::classes::SelectionClassNew;
use hikari_palette::TypedClass;
use tairitsu_style::ClassesBuilder;

use crate::{prelude::*, styled::StyledComponent};

pub struct SelectionComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SelectionType {
    #[default]
    Checkbox,
    Radio,
}

#[define_props]
pub struct SelectionProps {
    #[default]
    pub row_keys: Vec<String>,

    #[default]
    pub selection_type: SelectionType,

    #[default(false)]
    pub fixed_column: bool,

    pub total_rows: u32,

    #[default]
    pub available_keys: Vec<String>,

    #[default]
    pub class: String,

    pub on_change: Option<EventHandler<Vec<String>>>,
}

#[component]
pub fn Selection(props: SelectionProps) -> Element {
    let mut selected = use_signal(|| props.row_keys.clone());
    let mut is_all_selected = use_signal(|| false);
    let mut is_indeterminate = use_signal(|| false);

    // Clone available_keys multiple times for different closures
    let available_keys = props.available_keys.clone();
    let available_keys_for_effect = available_keys.clone();
    let available_keys_for_select_all = available_keys.clone();

    // Clone signals for use_effect
    let selected_for_effect = selected.clone();
    let is_all_selected_for_effect = is_all_selected.clone();
    let is_indeterminate_for_effect = is_indeterminate.clone();
    use_effect(move || {
        let total_selected = selected_for_effect.get().len();
        let total_available = available_keys_for_effect.len();

        is_all_selected_for_effect.set(total_selected > 0 && total_selected == total_available);
        is_indeterminate_for_effect.set(total_selected > 0 && total_selected < total_available);
    });

    // Clone signals for handle_select_all
    let selected_for_select_all = selected.clone();
    let is_all_selected_for_select_all = is_all_selected.clone();
    let on_change_for_select_all = props.on_change.clone();
    let handle_select_all = move |_| {
        let new_selection = if is_all_selected_for_select_all.get() {
            Vec::new()
        } else {
            available_keys_for_select_all.clone()
        };

        selected_for_select_all.set(new_selection.clone());

        if let Some(handler) = on_change_for_select_all.as_ref() {
            handler.call(new_selection);
        }
    };

    // Clone signals for handle_row_select
    let selected_for_row_select = selected.clone();
    let on_change_for_row_select = props.on_change.clone();
    let mut handle_row_select = move |row_key: String| {
        let mut new_selection = selected_for_row_select.get();

        match props.selection_type {
            SelectionType::Checkbox => {
                if let Some(pos) = new_selection.iter().position(|k| k == &row_key) {
                    new_selection.remove(pos);
                } else {
                    new_selection.push(row_key);
                }
            }
            SelectionType::Radio => {
                new_selection.clear();
                new_selection.push(row_key);
            }
        }

        selected_for_row_select.set(new_selection.clone());

        if let Some(handler) = on_change_for_row_select.as_ref() {
            handler.call(new_selection);
        }
    };

    // Clone signal for is_row_selected
    let selected_for_is_row = selected.clone();
    let is_row_selected =
        move |key: &str| -> bool { selected_for_is_row.get().iter().any(|k| k == key) };

    let get_input_type = || match props.selection_type {
        SelectionType::Checkbox => "checkbox",
        SelectionType::Radio => "radio",
    };

    let container_classes = ClassesBuilder::new()
        .add_typed(SelectionClassNew::RowSelection)
        .add_typed(SelectionClassNew::SelectionColumn)
        .add_typed_if(SelectionClassNew::SelectionFixed, props.fixed_column)
        .build();

    let column_classes = ClassesBuilder::new()
        .add_typed(SelectionClassNew::SelectionColumn)
        .add_typed_if(SelectionClassNew::SelectionFixed, props.fixed_column)
        .build();

    let is_checkbox_type = props.selection_type == SelectionType::Checkbox;

    // Clone is_all_selected for use in rsx! template
    let is_all_selected_for_template = is_all_selected.clone();

    // Create selection_items by creating individual handlers for each key
    let selection_items: Vec<Element> = {
        let selected_for_item = selected.clone();
        let on_change_for_item = props.on_change.clone();
        let selection_type = props.selection_type;
        available_keys.iter().map(move |key| {
            let key_clone = key.clone();
            let key_for_check = key.clone();
            let checked = selected_for_item.read().iter().any(|k| k == &key_for_check);

            let selected_for_change = selected_for_item.clone();
            let on_change_for_change = on_change_for_item.clone();
            let handle_change = move |_| {
                let mut new_selection = selected_for_change.get();

                match selection_type {
                    SelectionType::Checkbox => {
                        if let Some(pos) = new_selection.iter().position(|k| k == &key_clone) {
                            new_selection.remove(pos);
                        } else {
                            new_selection.push(key_clone.clone());
                        }
                    }
                    SelectionType::Radio => {
                        new_selection.clear();
                        new_selection.push(key_clone.clone());
                    }
                }

                selected_for_change.set(new_selection.clone());

                if let Some(handler) = on_change_for_change.as_ref() {
                    handler.call(new_selection);
                }
            };

            rsx! {
                div { class: {SelectionClassNew::SelectionRow.class_name()},
                    label { class: {SelectionClassNew::SelectionItem.class_name()},
                        input {
                            class: {SelectionClassNew::SelectionCheckbox.class_name()},
                            r#type: get_input_type(),
                            checked,
                            name: if selection_type == SelectionType::Radio { "hi-selection-radio-group" } else { "" },
                            onchange: handle_change,
                        }
                        "{key}"
                    }
                }
            }
        }).collect()
    };

    rsx! {
        div { class: {container_classes},

            div { class: {column_classes}, ..selection_items,

                if is_checkbox_type {
                    div { class: {SelectionClassNew::SelectionHeader.class_name()},
                        label { class: {SelectionClassNew::SelectionAll.class_name()},
                            input {
                                class: {SelectionClassNew::SelectionCheckbox.class_name()},
                                r#type: "checkbox",
                                checked: is_all_selected_for_template.get(),
                                onchange: handle_select_all,
                            }
                        }
                    }
                }
            }
        }
    }
}

#[define_props]
pub struct RowSelectionProps {
    pub row_key: String,

    #[default]
    pub selected_keys: Vec<String>,

    #[default]
    pub selection_type: SelectionType,

    #[default]
    pub class: String,

    pub on_select: Option<EventHandler<String>>,
}

#[component]
pub fn RowSelection(props: RowSelectionProps) -> Element {
    let is_selected = props.selected_keys.iter().any(|k| k == &props.row_key);

    let handle_change = move |_| {
        if let Some(handler) = props.on_select.as_ref() {
            handler.call(props.row_key.clone());
        }
    };

    let _input_type = match props.selection_type {
        SelectionType::Checkbox => "checkbox",
        SelectionType::Radio => "radio",
    };

    let container_classes = ClassesBuilder::new()
        .add_typed(SelectionClassNew::RowSelection)
        .add(&props.class)
        .build();

    let custom_classes = ClassesBuilder::new()
        .add_typed(SelectionClassNew::RowSelectionCustom)
        .add_typed_if(SelectionClassNew::RowSelectionChecked, is_selected)
        .build();

    let is_checkbox = props.selection_type == SelectionType::Checkbox;
    let is_radio = props.selection_type == SelectionType::Radio;
    let show_checkbox_icon = is_checkbox && is_selected;
    let show_radio_dot = is_radio && is_selected;
    let input_name = if is_radio {
        "hi-selection-radio-group"
    } else {
        ""
    };

    rsx! {
        div { class: {container_classes},
            label { class: {SelectionClassNew::RowSelectionLabel.class_name()},
                input {
                    class: {SelectionClassNew::RowSelectionInput.class_name()},
                    r#type: "checkbox",
                    checked: is_selected,
                    name: input_name,
                    onchange: handle_change,
                }

                span { class: {custom_classes},

                    if show_checkbox_icon {
                        svg {
                            xmlns: "http://www.w3.org/2000/svg",
                            fill: "none",
                            view_box: "0 0 24 24",
                            stroke_width: 3,
                            stroke: "currentColor",
                            path {
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                d: "M4.5 12.75l6 6 9-13.5",
                            }
                        }
                    }

                    if show_radio_dot {
                        span { class: {SelectionClassNew::RowSelectionRadioDot.class_name()} }
                    }
                }
            }
        }
    }
}

impl StyledComponent for SelectionComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/selection.css"))
    }

    fn name() -> &'static str {
        "selection"
    }
}
