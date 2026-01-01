// hikari-components/src/data/sort.rs
// Sort component with Arknights + FUI styling

use dioxus::prelude::*;
pub use super::column::ColumnDef;

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
    let handle_sort = move |column_key: String| {
        let new_direction = if props.column == column_key {
            props.direction.toggle()
        } else {
            SortDirection::Ascending
        };

        let config = SortConfig {
            column: column_key.clone(),
            direction: new_direction,
        };

        if let Some(handler) = props.on_sort_change.as_ref() {
            handler.call(config);
        }
    };

    let handle_clear = move |_| {
        if let Some(handler) = props.on_sort_change.as_ref() {
            handler.call(SortConfig {
                column: String::new(),
                direction: SortDirection::None,
            });
        }
    };

    let has_active_sort = props.direction != SortDirection::None;

    rsx! {
        div { class: format!("hikari-sort {}", props.class),

            for column in props.columns.iter() {
                if column.sortable {
                    let col_key = column.column_key.clone();
                    let is_active = props.column == column.column_key && props.direction != SortDirection::None;

                    button {
                        class: if is_active {
                            "hikari-sort-button hikari-sort-active"
                        } else {
                            "hikari-sort-button"
                        },
                        onclick: move |_| handle_sort(col_key.clone()),

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
            }

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
