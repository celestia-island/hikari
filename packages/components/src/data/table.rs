// hi-components/src/data/table.rs
// Table component with Arknights + FUI styling

use std::collections::HashMap;

use hikari_palette::classes::{ClassesBuilder, TableClass, UtilityClass};

pub use super::{
    column::{ColumnAlign, ColumnDef},
    sort::{SortConfig, SortDirection},
};
use crate::{prelude::*, styled::StyledComponent};

pub type TableFilters = HashMap<String, Vec<String>>;

pub struct TableComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TableSize {
    #[default]
    Medium,
    Small,
    Large,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TableAlign {
    #[default]
    Left,
    Center,
    Right,
}

impl From<ColumnAlign> for TableAlign {
    fn from(align: ColumnAlign) -> Self {
        match align {
            ColumnAlign::Left => TableAlign::Left,
            ColumnAlign::Center => TableAlign::Center,
            ColumnAlign::Right => TableAlign::Right,
        }
    }
}

#[define_props]
pub struct TableProps {
    pub data: Vec<Vec<String>>,
    pub columns: Vec<ColumnDef>,
    #[default(false)]
    pub bordered: bool,
    #[default(false)]
    pub striped: bool,
    #[default(false)]
    pub hoverable: bool,
    pub size: TableSize,
    pub class: String,
    #[default(String::from("No data available"))]
    pub empty_text: String,
    pub sort_column: String,
    pub sort_direction: SortDirection,
    pub on_sort_change: Option<EventHandler<SortConfig>>,
    pub filters: TableFilters,
    pub on_filter_change: Option<EventHandler<TableFilters>>,
}

///
///
///
///
///
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

    // Build table header if columns are defined
    let header_el = if has_columns {
        let columns = props.columns.clone();
        // Pre-build header cells outside rsx!
        let header_cells: Vec<Element> = columns
            .iter()
            .map(|column| {
                let align_class = match column.align {
                    ColumnAlign::Left => TableClass::TextLeft,
                    ColumnAlign::Center => TableClass::TextCenter,
                    ColumnAlign::Right => TableClass::TextRight,
                };

                let width_style = column
                    .width
                    .as_ref()
                    .map_or(String::new(), |w| format!("width: {w};"));

                let is_sorted =
                    sort_column == column.column_key && sort_direction != SortDirection::None;

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
                let sort_handler = on_sort_handler.clone();
                let is_sortable = column.sortable;
                let column_title = column.title.clone();
                let sort_icon_str = sort_icon.to_string();

                rsx! {
                    th {
                        class: cell_classes,
                        style: width_style,
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

                        "{column_title}"

                        if !sort_icon_str.is_empty() {
                            span { class: TableClass::TableSortIcon.as_class(),
                                "{sort_icon_str}"
                            }
                        }
                    }
                }
            })
            .collect();

        Some(rsx! {
            thead {
                tr {
                    class: TableClass::TableHeaderRow.as_class(),
                    ..header_cells
                }
            }
        })
    } else {
        None
    };

    // Build table body rows
    let body_content = if has_data {
        let columns = props.columns.clone();
        let row_elements: Vec<Element> = sorted_data
            .iter()
            .enumerate()
            .map(|(row_index, row)| {
                let cols = columns.clone();
                // Pre-build cell elements outside rsx!
                let cell_elements: Vec<Element> = row
                    .iter()
                    .enumerate()
                    .map(|(col_index, cell)| {
                        let align_class = if has_columns && col_index < cols.len() {
                            match cols[col_index].align {
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

                        let cell_value = cell.clone();
                        rsx! {
                            td {
                                class: cell_classes,
                                key: format!("{row_index}-{col_index}"),

                                "{cell_value}"
                            }
                        }
                    })
                    .collect();

                rsx! {
                    tr {
                        class: TableClass::TableRow.as_class(),
                        key: "{row_index}",
                        ..cell_elements
                    }
                }
            })
            .collect();

        VNode::Fragment(row_elements)
    } else {
        // Empty state
        rsx! {
            tr {
                class: TableClass::TableRow.as_class(),
                td {
                    class: TableClass::TableEmpty.as_class(),
                    colspan: colspan_count,
                    div { class: TableClass::TableEmptyContent.as_class(),
                        "{props.empty_text.clone()}"
                    }
                }
            }
        }
    };

    rsx! {
        div { class: TableClass::TableWrapper.as_class(),
            table {
                class: table_classes,

                {header_el.unwrap_or_else(VNode::empty)}

                // Render table body with sorted data
                tbody {
                    class: TableClass::TableBody.as_class(),
                    {body_content}
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

fn use_sortable_data(
    data: &[Vec<String>],
    columns: &[ColumnDef],
    sort_column: &str,
    sort_direction: SortDirection,
) -> Vec<Vec<String>> {
    sort_data(data, columns, sort_column, sort_direction)
}

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
