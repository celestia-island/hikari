// hi-components/src/data/table.rs
// Table component with Arknights + FUI styling

use std::collections::HashMap;

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, TableClass, UtilityClass};

pub use super::{
    column::{ColumnAlign, ColumnDef},
    sort::{SortConfig, SortDirection},
};
use crate::styled::StyledComponent;

/// Filter state for a column: map of column key to selected values
pub type TableFilters = HashMap<String, Vec<String>>;

/// Table component wrapper (for StyledComponent)
pub struct TableComponent;

/// Table size variants
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TableSize {
    #[default]
    Medium,
    Small,
    Large,
}

/// Text alignment for table cells
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum Align {
    #[default]
    Left,
    Center,
    Right,
}

impl From<ColumnAlign> for Align {
    fn from(align: ColumnAlign) -> Self {
        match align {
            ColumnAlign::Left => Align::Left,
            ColumnAlign::Center => Align::Center,
            ColumnAlign::Right => Align::Right,
        }
    }
}

/// Table component properties
#[derive(Clone, PartialEq, Props)]
pub struct TableProps {
    /// Table data (2D array of strings)
    #[props(default)]
    pub data: Vec<Vec<String>>,

    /// Column definitions
    #[props(default)]
    pub columns: Vec<ColumnDef>,

    /// Show borders
    #[props(default)]
    pub bordered: bool,

    /// Striped rows
    #[props(default)]
    pub striped: bool,

    /// Hover effect on rows
    #[props(default)]
    pub hoverable: bool,

    /// Table size
    #[props(default)]
    pub size: TableSize,

    /// Custom CSS classes
    #[props(default)]
    pub class: String,

    /// Empty state message
    #[props(default)]
    pub empty_text: String,

    /// Current sort column key
    #[props(default)]
    pub sort_column: String,

    /// Current sort direction
    #[props(default)]
    pub sort_direction: SortDirection,

    /// Sort change callback
    #[props(default)]
    pub on_sort_change: Option<EventHandler<SortConfig>>,

    /// Active filters (column key -> selected values)
    #[props(default)]
    pub filters: TableFilters,

    /// Filter change callback
    #[props(default)]
    pub on_filter_change: Option<EventHandler<TableFilters>>,
}

impl Default for TableProps {
    fn default() -> Self {
        Self {
            data: Vec::default(),
            columns: Vec::default(),
            bordered: false,
            striped: false,
            hoverable: false,
            size: Default::default(),
            class: String::default(),
            empty_text: String::from("No data available"),
            sort_column: String::default(),
            sort_direction: SortDirection::default(),
            on_sort_change: None,
            filters: TableFilters::default(),
            on_filter_change: None,
        }
    }
}

/// Table component with Arknights + FUI styling
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Table;
/// use hikari_components::ColumnDef;
/// use hikari_components::ColumnAlign;
///
/// fn app() -> Element {
///     let columns = vec![
///         ColumnDef::new("name", "Name").sortable(true),
///         ColumnDef::new("role", "Role"),
///         ColumnDef::new("level", "Level").align(ColumnAlign::Center),
///     ];
///
///     let data = vec![
///         vec!["Amiya".to_string(), "Guard".to_string(), "6".to_string()],
///         vec!["SilverAsh".to_string(), "Guard".to_string(), "6".to_string()],
///     ];
///
///     rsx! {
///         Table {
///             columns: columns,
///             data: data,
///             bordered: true,
///             striped: true,
///             hoverable: true,
///         }
///     }
/// }
/// ```
#[component]
pub fn Table(props: TableProps) -> Element {
    // First filter data, then sort it
    let filtered_data = filter_data(&props.data, &props.columns, &props.filters);
    let sorted_data = use_sortable_data(
        &filtered_data,
        &props.columns,
        &props.sort_column,
        props.sort_direction,
    );

    let table_classes = ClassesBuilder::new()
        .add(TableClass::Table)
        .add(match props.size {
            TableSize::Small => TableClass::TableSm,
            TableSize::Medium => TableClass::TableMd,
            TableSize::Large => TableClass::TableLg,
        })
        .add_if(TableClass::TableBordered, || props.bordered)
        .add_if(TableClass::TableStriped, || props.striped)
        .add_if(TableClass::TableHover, || props.hoverable)
        .add_raw(&props.class)
        .build();

    // Clone values for use in closures
    let sort_column = props.sort_column.clone();
    let sort_direction = props.sort_direction;
    let on_sort_handler = props.on_sort_change;

    // Determine if we should show the table or empty state
    let has_data = !sorted_data.is_empty();
    let has_columns = !props.columns.is_empty();
    let colspan_count = if has_columns { props.columns.len() } else { 1 };

    rsx! {
        div { class: "{TableClass::TableWrapper.as_class()}",
            table {
                class: "{table_classes}",

                // Render table header if columns are defined
                if has_columns {
                    thead {
                        tr {
                            class: "{TableClass::TableHeaderRow.as_class()}",
                            {props.columns.iter().map(|column| {
                                let align_class = match column.align {
                                    ColumnAlign::Left => TableClass::TextLeft,
                                    ColumnAlign::Center => TableClass::TextCenter,
                                    ColumnAlign::Right => TableClass::TextRight,
                                };

                                let width_style = column.width.as_ref()
                                    .map_or(String::new(), |w| format!("width: {w};"));

                                let is_sorted = sort_column == column.column_key
                                    && sort_direction != SortDirection::None;

                                let sort_icon = if is_sorted {
                                    sort_direction.icon()
                                } else if column.sortable {
                                    "⇅"
                                } else {
                                    ""
                                };

                                let cell_classes = ClassesBuilder::new()
                                    .add(TableClass::TableHeaderCell)
                                    .add(align_class)
                                    .add_if(TableClass::TableSortable, || column.sortable)
                                    .add_if(TableClass::TableSortActive, || is_sorted)
                                    .add_raw(&column.class)
                                    .build();

                                // Clone for closure
                                let col_key = column.column_key.clone();
                                let current_sort_col = sort_column.clone();
                                let current_sort_dir = sort_direction;
                                let sort_handler = on_sort_handler;
                                let is_sortable = column.sortable;

                                rsx! {
                                    th {
                                        class: "{cell_classes}",
                                        style: "{width_style}",
                                        onclick: move |_| {
                                            if !is_sortable {
                                                return;
                                            }
                                            let new_direction = if current_sort_col == col_key {
                                                current_sort_dir.toggle()
                                            } else {
                                                SortDirection::Ascending
                                            };

                                            if let Some(handler) = sort_handler.as_ref() {
                                                handler.call(SortConfig {
                                                    column: col_key.clone(),
                                                    direction: new_direction,
                                                });
                                            }
                                        },

                                        {column.title.clone()}

                                        if !sort_icon.is_empty() {
                                            span { class: "{TableClass::TableSortIcon.as_class()}",
                                                "{sort_icon}"
                                            }
                                        }
                                    }
                                }
                            })}
                        }
                    }
                }

                // Render table body with sorted data
                tbody {
                    class: "{TableClass::TableBody.as_class()}",

                    if has_data {
                        {sorted_data.iter().enumerate().map(|(row_index, row)| {
                            rsx! {
                                tr {
                                    class: "{TableClass::TableRow.as_class()}",
                                    key: "{row_index}",

                                    {row.iter().enumerate().map(|(col_index, cell)| {
                                        let align_class = if has_columns && col_index < props.columns.len() {
                                            match props.columns[col_index].align {
                                                ColumnAlign::Left => TableClass::TextLeft,
                                                ColumnAlign::Center => TableClass::TextCenter,
                                                ColumnAlign::Right => TableClass::TextRight,
                                            }
                                        } else {
                                            TableClass::TextLeft
                                        };

                                        let cell_classes = ClassesBuilder::new()
                                            .add(TableClass::TableCell)
                                            .add(align_class)
                                            .build();

                                        rsx! {
                                            td {
                                                class: "{cell_classes}",
                                                key: "{row_index}-{col_index}",

                                                {cell.clone()}
                                            }
                                        }
                                    })}
                                }
                            }
                        })}
                    } else {
                        // Empty state
                        tr {
                            class: "{TableClass::TableRow.as_class()}",
                            td {
                                class: "{TableClass::TableEmpty.as_class()}",
                                colspan: "{colspan_count}",
                                div { class: "{TableClass::TableEmptyContent.as_class()}",
                                    {props.empty_text.clone()}
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

impl StyledComponent for TableComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/table.css"))
    }

    fn name() -> &'static str {
        "table"
    }
}

/// Sort table data based on column and direction
fn sort_data(
    data: &[Vec<String>],
    columns: &[ColumnDef],
    sort_column: &str,
    sort_direction: SortDirection,
) -> Vec<Vec<String>> {
    // Find the column index for the sort key
    let column_index = columns.iter().position(|col| col.column_key == sort_column);

    if sort_direction == SortDirection::None || column_index.is_none() {
        return data.to_vec();
    }

    let col_idx = column_index.unwrap();

    let mut sorted_data = data.to_vec();
    sorted_data.sort_by(|a, b| {
        let a_val = a.get(col_idx).map(String::as_str).unwrap_or("");
        let b_val = b.get(col_idx).map(String::as_str).unwrap_or("");

        // Try numeric comparison first
        let a_num = a_val.parse::<f64>();
        let b_num = b_val.parse::<f64>();

        match (a_num, b_num) {
            (Ok(a_n), Ok(b_n)) => {
                // Both are numbers
                a_n.partial_cmp(&b_n).unwrap_or(std::cmp::Ordering::Equal)
            }
            _ => {
                // String comparison
                a_val.cmp(b_val)
            }
        }
    });

    // Reverse for descending
    if sort_direction == SortDirection::Descending {
        sorted_data.reverse();
    }

    sorted_data
}

/// Get sorted data (memoized hook-like behavior)
fn use_sortable_data(
    data: &[Vec<String>],
    columns: &[ColumnDef],
    sort_column: &str,
    sort_direction: SortDirection,
) -> Vec<Vec<String>> {
    sort_data(data, columns, sort_column, sort_direction)
}

/// Filter table data based on active filters
fn filter_data(
    data: &[Vec<String>],
    columns: &[ColumnDef],
    filters: &TableFilters,
) -> Vec<Vec<String>> {
    if filters.is_empty() {
        return data.to_vec();
    }

    data.iter()
        .filter(|row| {
            // Row must match ALL active filters
            filters.iter().all(|(col_key, selected_values)| {
                if selected_values.is_empty() {
                    return true; // Empty filter means no restriction
                }

                // Find column index
                if let Some(col_idx) = columns.iter().position(|c| &c.column_key == col_key) {
                    // Check if row value matches any selected filter value
                    if let Some(cell_value) = row.get(col_idx) {
                        return selected_values.iter().any(|v| v == cell_value);
                    }
                }

                false // Column not found or cell value missing
            })
        })
        .cloned()
        .collect()
}
