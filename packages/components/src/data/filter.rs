// hi-components/src/data/filter.rs
// Filter component with Arknights + FUI styling

use crate::prelude::*;
use hikari_palette::classes::{ClassesBuilder, FilterClass, UtilityClass};

use crate::styled::StyledComponent;

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

#[derive(Clone, PartialEq, Props, Default)]
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

#[component]
pub fn Filter(props: FilterProps) -> Element {
    let mut is_open = use_signal(|| false);
    let mut selected = use_signal(|| props.selected_values.clone());

    let active_count = selected.get().len();

    let is_open_for_toggle = is_open.clone();
    let handle_toggle = move |_| {
        is_open_for_toggle.set(!is_open_for_toggle.get());
    };

    let selected_for_clear = selected.clone();
    let on_filter_change_for_clear = props.on_filter_change.clone();
    let handle_clear = move |_| {
        selected_for_clear.set(Vec::new());

        if let Some(handler) = on_filter_change_for_clear.as_ref() {
            handler.call(Vec::new());
        }
    };

    let is_open_for_close = is_open.clone();
    let close_dropdown = move |_| {
        is_open_for_close.set(false);
    };

    let container_classes = ClassesBuilder::new()
        .add(FilterClass::Filter)
        .add_raw(&props.class)
        .build();

    let trigger_classes = ClassesBuilder::new()
        .add(FilterClass::FilterTrigger)
        .add_if(FilterClass::FilterActive, || active_count > 0)
        .build();

    let filter_options: Vec<Element> = {
        let selected_for_option = selected.clone();
        let on_filter_change_for_option = props.on_filter_change.clone();
        props.filters.iter().map(move |option| {
            let opt_value = option.value.clone();
            let label_text = option.label.clone();
            let checked = selected_for_option.read().iter().any(|v| v == &option.value);

            let selected_for_click = selected_for_option.clone();
            let on_filter_change_for_click = on_filter_change_for_option.clone();
            let opt_value_for_click = opt_value.clone();
            let handle_click = move |_| {
                let mut current = selected_for_click.get();
                if let Some(pos) = current.iter().position(|v| v == &opt_value_for_click) {
                    current.remove(pos);
                } else {
                    current.push(opt_value_for_click.clone());
                }
                selected_for_click.set(current.clone());

                if let Some(handler) = on_filter_change_for_click.as_ref() {
                    handler.call(current);
                }
            };

            rsx! {
                label {
                    class: FilterClass::FilterOption.as_class(),
                    onclick: handle_click,

                    input {
                        class: FilterClass::FilterCheckbox.as_class(),
                        r#type: "checkbox",
                        checked: checked,
                    }

                    span { class: FilterClass::FilterLabel.as_class(),
                        "{label_text}"
                    }
                }
            }
        }).collect()
    };

    rsx! {
        div { class: container_classes,

            div { class: FilterClass::FilterContainer.as_class(),
                button {
                    class: trigger_classes,
                    onclick: handle_toggle,

                    svg {
                        xmlns: "http://www.w3.org/2000/svg",
                        class: FilterClass::FilterIcon.as_class(),
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
                        span { class: FilterClass::FilterBadge.as_class(),
                            "{active_count}"
                        }
                    }

                    svg {
                        xmlns: "http://www.w3.org/2000/svg",
                        class: FilterClass::FilterIcon.as_class(),
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
                        span { class: FilterClass::FilterBadge.as_class(),
                            "{active_count}"
                        }
                    }

                    svg {
                        xmlns: "http://www.w3.org/2000/svg",
                        class: FilterClass::FilterDropdownIcon.as_class(),
                        fill: "none",
                        view_box: "0 0 24 24",
                        stroke_width: 2,
                        stroke: "currentColor",
                        path { stroke_linecap: "round", stroke_linejoin: "round", d: "M19.5 8.25l-7.5 7.5-7.5-7.5" }
                    }
                }
            }

            if is_open.get() {
                div { class: FilterClass::FilterDropdown.as_class(),
                    onclick: close_dropdown,

                    div { class: FilterClass::FilterHeader.as_class(),
                        span { class: FilterClass::FilterTitle.as_class(),
                            "{props.column}"
                        }

                        if active_count > 0 {
                            button {
                                class: FilterClass::FilterClearBtn.as_class(),
                                onclick: handle_clear,
                                "Clear"
                            }
                        }
                    }

                    div { class: FilterClass::FilterOptions.as_class(),
                        ..filter_options
                    }

                    div { class: FilterClass::FilterFooter.as_class(),
                        span { class: FilterClass::FilterHint.as_class(),
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

pub struct FilterComponentWrapper;
