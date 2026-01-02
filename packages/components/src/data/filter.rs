// hikari-components/src/data/filter.rs
// Filter component with Arknights + FUI styling

use dioxus::prelude::*;
use crate::styled::StyledComponent;

/// Filter component wrapper (for StyledComponent)
pub struct FilterComponent;

#[derive(Clone, PartialEq, Debug)]
pub struct FilterOption {
    pub label: String,
    pub value: String,
}

impl FilterOption {
    pub fn new(label: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            value: value.into(),
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct FilterProps {
    pub column: String,

    #[props(default)]
    pub filters: Vec<FilterOption>,

    #[props(default)]
    pub selected_values: Vec<String>,

    #[props(default)]
    pub class: String,

    pub on_filter_change: Option<EventHandler<Vec<String>>>,
}

impl Default for FilterProps {
    fn default() -> Self {
        Self {
            column: String::default(),
            filters: Vec::default(),
            selected_values: Vec::default(),
            class: String::default(),
            on_filter_change: None,
        }
    }
}

#[component]
pub fn Filter(props: FilterProps) -> Element {
    let mut is_open = use_signal(|| false);
    let mut selected = use_signal(|| props.selected_values.clone());

    let active_count = selected().len();

    let handle_toggle = move |_| {
        is_open.set(!is_open());
    };

    let mut handle_select = move |value: String| {
        let mut current = selected();
        if let Some(pos) = current.iter().position(|v| v == &value) {
            current.remove(pos);
        } else {
            current.push(value);
        }
        selected.set(current.clone());

        if let Some(handler) = props.on_filter_change.as_ref() {
            handler.call(current);
        }
    };

    let handle_clear = move |_| {
        selected.set(Vec::new());

        if let Some(handler) = props.on_filter_change.as_ref() {
            handler.call(Vec::new());
        }
    };

    let is_selected = move |value: &str| -> bool {
        selected().iter().any(|v| v == value)
    };

    let close_dropdown = move |_| {
        is_open.set(false);
    };

    rsx! {
        div { class: format!("hikari-filter {}", props.class),

            div { class: "hikari-filter-container",
                button {
                    class: if active_count > 0 {
                        "hikari-filter-trigger hikari-filter-active"
                    } else {
                        "hikari-filter-trigger"
                    },
                    onclick: handle_toggle,

                    svg {
                        xmlns: "http://www.w3.org/2000/svg",
                        class: "hikari-filter-icon",
                        fill: "none",
                        view_box: "0 0 24 24",
                        stroke_width: 2,
                        stroke: "currentColor",
                        path {
                            stroke_linecap: "round",
                            stroke_linejoin: "round",
                            d: "M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
                        }
                    }

                    if active_count > 0 {
                        span { class: "hikari-filter-badge",
                            "{active_count}"
                        }
                    }

                    svg {
                        xmlns: "http://www.w3.org/2000/svg",
                        class: "hikari-filter-dropdown-icon",
                        fill: "none",
                        view_box: "0 0 24 24",
                        stroke_width: 2,
                        stroke: "currentColor",
                        path { stroke_linecap: "round", stroke_linejoin: "round", d: "M19.5 8.25l-7.5 7.5-7.5-7.5" }
                    }
                }
            }

            if is_open() {
                div { class: "hikari-filter-dropdown",
                    onclick: close_dropdown,

                    div { class: "hikari-filter-header",
                        span { class: "hikari-filter-title",
                            "{props.column}"
                        }

                        if active_count > 0 {
                            button {
                                class: "hikari-filter-clear-btn",
                                onclick: handle_clear,
                                "Clear"
                            }
                        }
                    }

                    div { class: "hikari-filter-options",
                        {props.filters.iter().map(|option| {
                            let opt_value = option.value.clone();
                            let label_text = option.label.clone();
                            let checked = is_selected(&option.value);

                            rsx! {
                                label {
                                    class: "hikari-filter-option",
                                    onclick: move |_| handle_select(opt_value.clone()),

                                    input {
                                        class: "hikari-filter-checkbox",
                                        r#type: "checkbox",
                                        checked: checked,
                                    }

                                    span { class: "hikari-filter-label",
                                        "{label_text}"
                                    }
                                }
                            }
                        })}
                    }

                    div { class: "hikari-filter-footer",
                        span { class: "hikari-filter-hint",
                            if active_count > 0 {
                                "{active_count} selected"
                            } else {
                                "Select options"
                            }
                        }
                    }
                }
            }
        }
    }
}

impl StyledComponent for FilterComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/filter.css"))
    }

    fn name() -> &'static str {
        "filter"
    }
}
