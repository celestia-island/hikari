// hi-components/src/data/sort.rs
// Sort component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, SortClass, UtilityClass};

pub use super::column::ColumnDef;
use crate::styled::StyledComponent;

/// Sort component wrapper (for StyledComponent)
pub struct SortComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SortDirection {
    #[default]
    None,
    Ascending,
    Descending,
}

impl SortDirection {
    pub fn toggle(&self) -> Self {
        match self {
            SortDirection::None => SortDirection::Ascending,
            SortDirection::Ascending => SortDirection::Descending,
            SortDirection::Descending => SortDirection::None,
        }
    }

    pub fn icon(&self) -> &'static str {
        match self {
            SortDirection::None => "⇅",
            SortDirection::Ascending => "↑",
            SortDirection::Descending => "↓",
        }
    }

    /// Get CSS class for sort direction
    pub fn class(&self) -> &'static str {
        match self {
            SortDirection::None => "",
            SortDirection::Ascending => "hi-sort-asc",
            SortDirection::Descending => "hi-sort-desc",
        }
    }
}

#[derive(Clone, PartialEq, Debug, Default)]
pub struct SortConfig {
    pub column: String,
    pub direction: SortDirection,
}

impl SortConfig {
    pub fn new(column: impl Into<String>, direction: SortDirection) -> Self {
        Self {
            column: column.into(),
            direction,
        }
    }
}

#[derive(Clone, PartialEq, Props)]
#[derive(Default)]
pub struct SortProps {
    #[props(default)]
    pub column: String,

    #[props(default)]
    pub direction: SortDirection,

    #[props(default)]
    pub columns: Vec<ColumnDef>,

    #[props(default)]
    pub class: String,

    pub on_sort_change: Option<EventHandler<SortConfig>>,
}


#[component]
pub fn Sort(props: SortProps) -> Element {
    // Clone props for use in closures
    let current_column = props.column.clone();
    let current_direction = props.direction;
    let on_sort_handler = props.on_sort_change;

    let handle_clear = move |_| {
        if let Some(handler) = on_sort_handler.as_ref() {
            handler.call(SortConfig {
                column: String::new(),
                direction: SortDirection::None,
            });
        }
    };

    let has_active_sort = props.direction != SortDirection::None;

    let container_classes = ClassesBuilder::new()
        .add(SortClass::Sort)
        .add_raw(&props.class)
        .build();

    rsx! {
        div { class: "{container_classes}",

            {props.columns.iter().filter(|column| column.sortable).map(|column| {
                let column_key = column.column_key.clone();
                let is_active = props.column == column.column_key && props.direction != SortDirection::None;

                // Clone captured variables for this iteration
                let sort_column = current_column.clone();
                let sort_direction = current_direction;
                let sort_handler = on_sort_handler;

                let button_classes = ClassesBuilder::new()
                    .add(SortClass::SortButton)
                    .add_if(SortClass::SortActive, || is_active)
                    .build();

                rsx! {
                    button {
                        class: "{button_classes}",
                        onclick: move |_| {
                            let new_direction = if sort_column == column_key {
                                sort_direction.toggle()
                            } else {
                                SortDirection::Ascending
                            };

                            if let Some(handler) = sort_handler.as_ref() {
                                handler.call(SortConfig {
                                    column: column_key.clone(),
                                    direction: new_direction,
                                });
                            }
                        },

                        span { class: "{SortClass::SortTitle.as_class()}",
                            {column.title.clone()}
                        }

                        span { class: "{SortClass::SortIndicator.as_class()}",
                            {if is_active {
                                props.direction.icon()
                            } else {
                                "⇅"
                            }}
                        }
                    }
                }
            })}

            if has_active_sort {
                button {
                    class: "{SortClass::SortClear.as_class()}",
                    onclick: handle_clear,

                    span { class: "{SortClass::SortClearText.as_class()}", "Clear" }
                    svg {
                        xmlns: "http://www.w3.org/2000/svg",
                        class: "{SortClass::SortClearIcon.as_class()}",
                        fill: "none",
                        view_box: "0 0 24 24",
                        stroke_width: 2,
                        stroke: "currentColor",
                        path { stroke_linecap: "round", stroke_linejoin: "round", d: "M6 18L18 6M6 6l12 12" }
                    }
                }
            }
        }
    }
}

impl StyledComponent for SortComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/sort.css"))
    }

    fn name() -> &'static str {
        "sort"
    }
}
