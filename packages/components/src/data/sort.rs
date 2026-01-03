// hikari-components/src/data/sort.rs
// Sort component with Arknights + FUI styling

use dioxus::prelude::*;

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
            SortDirection::Ascending => "hikari-sort-asc",
            SortDirection::Descending => "hikari-sort-desc",
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

impl Default for SortProps {
    fn default() -> Self {
        Self {
            column: String::default(),
            direction: Default::default(),
            columns: Vec::default(),
            class: String::default(),
            on_sort_change: None,
        }
    }
}

#[component]
pub fn Sort(props: SortProps) -> Element {
    // Clone props for use in closures
    let current_column = props.column.clone();
    let current_direction = props.direction.clone();
    let on_sort_handler = props.on_sort_change.clone();

    let handle_clear = move |_| {
        if let Some(handler) = on_sort_handler.as_ref() {
            handler.call(SortConfig {
                column: String::new(),
                direction: SortDirection::None,
            });
        }
    };

    let has_active_sort = props.direction != SortDirection::None;

    rsx! {
        div { class: format!("hikari-sort {}", props.class),

            {props.columns.iter().filter(|column| column.sortable).map(|column| {
                let column_key = column.column_key.clone();
                let is_active = props.column == column.column_key && props.direction != SortDirection::None;

                // Clone captured variables for this iteration
                let sort_column = current_column.clone();
                let sort_direction = current_direction.clone();
                let sort_handler = on_sort_handler.clone();

                rsx! {
                    button {
                        class: if is_active {
                            "hikari-sort-button hikari-sort-active"
                        } else {
                            "hikari-sort-button"
                        },
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

                        span { class: "hikari-sort-title",
                            {column.title.clone()}
                        }

                        span { class: "hikari-sort-indicator",
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
                    class: "hikari-sort-clear",
                    onclick: handle_clear,

                    span { class: "hikari-sort-clear-text", "Clear" }
                    svg {
                        xmlns: "http://www.w3.org/2000/svg",
                        class: "hikari-sort-clear-icon",
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
