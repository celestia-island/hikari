// hikari-components/src/data/selection.rs
// Selection component with Arknights + FUI styling

use dioxus::prelude::*;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SelectionType {
    #[default]
    Checkbox,
    Radio,
}

#[derive(Clone, PartialEq, Props)]
pub struct SelectionProps {
    #[props(default)]
    pub row_keys: Vec<String>,

    #[props(default)]
    pub selection_type: SelectionType,

    #[props(default = false)]
    pub fixed_column: bool,

    pub total_rows: u32,

    #[props(default)]
    pub available_keys: Vec<String>,

    #[props(default)]
    pub class: String,

    pub on_change: Option<EventHandler<Vec<String>>>,
}

impl Default for SelectionProps {
    fn default() -> Self {
        Self {
            row_keys: Vec::default(),
            selection_type: Default::default(),
            fixed_column: false,
            total_rows: 0,
            available_keys: Vec::default(),
            class: String::default(),
            on_change: None,
        }
    }
}

#[component]
pub fn Selection(props: SelectionProps) -> Element {
    let mut selected = use_signal(|| props.row_keys.clone());
    let is_all_selected = use_signal(|| false);
    let is_indeterminate = use_signal(|| false);

    use_effect(move || {
        let total_selected = selected().len();
        let total_available = props.available_keys.len() as u32;

        is_all_selected.set(total_selected > 0 && total_selected == total_available);
        is_indeterminate.set(total_selected > 0 && total_selected < total_available);
    });

    let handle_select_all = move |_| {
        let new_selection = if is_all_selected() {
            Vec::new()
        } else {
            props.available_keys.clone()
        };

        selected.set(new_selection.clone());

        if let Some(handler) = props.on_change.as_ref() {
            handler.call(new_selection);
        }
    };

    let handle_row_select = move |row_key: String| {
        let mut new_selection = selected();

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

        selected.set(new_selection.clone());

        if let Some(handler) = props.on_change.as_ref() {
            handler.call(new_selection);
        }
    };

    let is_row_selected = move |key: &str| -> bool {
        selected().iter().any(|k| k == key)
    };

    let get_input_type = || {
        match props.selection_type {
            SelectionType::Checkbox => "checkbox",
            SelectionType::Radio => "radio",
        }
    };

    rsx! {
        div { class: format!("hikari-selection {}", props.class),

            div { class: if props.fixed_column {
                "hikari-selection-column hikari-selection-fixed"
            } else {
                "hikari-selection-column"
            },

                if props.selection_type == SelectionType::Checkbox {
                    div { class: "hikari-selection-header",
                        label { class: "hikari-selection-all",
                            input {
                                class: "hikari-selection-checkbox",
                                r#type: "checkbox",
                                checked: is_all_selected(),
                                indeterminate: is_indeterminate(),
                                onchange: handle_select_all,
                            }
                        }
                    }
                }

                for key in props.available_keys.iter() {
                    let key_clone = key.clone();
                    let checked = is_row_selected(key);

                    div { class: "hikari-selection-row",
                        label { class: "hikari-selection-item",
                            input {
                                class: "hikari-selection-checkbox",
                                r#type: get_input_type(),
                                checked: checked,
                                name: if props.selection_type == SelectionType::Radio {
                                    "hikari-selection-radio-group"
                                } else {
                                    ""
                                },
                                onchange: move |_| handle_row_select(key_clone.clone()),
                            }
                        }
                    }
                }
            }
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct RowSelectionProps {
    pub row_key: String,

    #[props(default)]
    pub selected_keys: Vec<String>,

    #[props(default)]
    pub selection_type: SelectionType,

    #[props(default)]
    pub class: String,

    pub on_select: Option<EventHandler<String>>,
}

impl Default for RowSelectionProps {
    fn default() -> Self {
        Self {
            row_key: String::default(),
            selected_keys: Vec::default(),
            selection_type: Default::default(),
            class: String::default(),
            on_select: None,
        }
    }
}

#[component]
pub fn RowSelection(props: RowSelectionProps) -> Element {
    let is_selected = props.selected_keys.iter().any(|k| k == &props.row_key);

    let handle_change = move |_| {
        if let Some(handler) = props.on_select.as_ref() {
            handler.call(props.row_key.clone());
        }
    };

    let input_type = match props.selection_type {
        SelectionType::Checkbox => "checkbox",
        SelectionType::Radio => "radio",
    };

    rsx! {
        div { class: format!("hikari-row-selection {}", props.class),
            label { class: "hikari-row-selection-label",
                input {
                    class: "hikari-row-selection-input",
                    r#type: input_type,
                    checked: is_selected,
                    name: if props.selection_type == SelectionType::Radio {
                        "hikari-selection-radio-group"
                    } else {
                        ""
                    },
                    onchange: handle_change,
                }

                span {
                    class: if is_selected {
                        "hikari-row-selection-custom hikari-row-selection-checked"
                    } else {
                        "hikari-row-selection-custom"
                    },

                    if props.selection_type == SelectionType::Checkbox && is_selected {
                        svg {
                            xmlns: "http://www.w3.org/2000/svg",
                            fill: "none",
                            view_box: "0 0 24 24",
                            stroke_width: 3,
                            stroke: "currentColor",
                            path {
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                d: "M4.5 12.75l6 6 9-13.5"
                            }
                        }
                    }

                    if props.selection_type == SelectionType::Radio && is_selected {
                        span { class: "hikari-row-selection-radio-dot" }
                    }
                }
            }
        }
    }
}
