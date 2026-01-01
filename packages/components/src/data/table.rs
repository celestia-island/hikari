// hikari-components/src/data/table.rs
// Table component with Arknights + FUI styling

use dioxus::prelude::*;
pub use super::column::{ColumnDef, ColumnAlign};

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
    let size_class = match props.size {
        TableSize::Small => "hikari-table-sm",
        TableSize::Medium => "hikari-table-md",
        TableSize::Large => "hikari-table-lg",
    };

    let bordered_class = if props.bordered {
        "hikari-table-bordered"
    } else {
        ""
    };

    let striped_class = if props.striped {
        "hikari-table-striped"
    } else {
        ""
    };

    let hoverable_class = if props.hoverable {
        "hikari-table-hover"
    } else {
        ""
    };

    // Determine if we should show the table or empty state
    let has_data = !props.data.is_empty();
    let has_columns = !props.columns.is_empty();
    let colspan_count = if has_columns { props.columns.len() } else { 1 };

    rsx! {
        div { class: "hikari-table-wrapper",
            table {
                class: format!(
                    "hikari-table {size_class} {bordered_class} {striped_class} {hoverable_class} {}",
                    props.class
                ),

                // Render table header if columns are defined
                if has_columns {
                    thead {
                        tr {
                            class: "hikari-table-header-row",
                            {props.columns.iter().map(|column| {
                                let align_class = match column.align {
                                    ColumnAlign::Left => "hikari-text-left",
                                    ColumnAlign::Center => "hikari-text-center",
                                    ColumnAlign::Right => "hikari-text-right",
                                };

                                let width_style = column.width.as_ref()
                                    .map_or(String::new(), |w| format!("width: {w};"));

                                let sortable_class = if column.sortable {
                                    "hikari-table-sortable"
                                } else {
                                    ""
                                };

                                rsx! {
                                    th {
                                        class: format!("hikari-table-header-cell {align_class} {sortable_class}"),
                                        style: "{width_style}",

                                        {column.title.clone()}

                                        if column.sortable {
                                            span { class: "hikari-table-sort-icon", "" }
                                        }
                                    }
                                }
                            })}
                        }
                    }
                }

                // Render table body
                tbody {
                    class: "hikari-table-body",

                    if has_data {
                        {props.data.iter().enumerate().map(|(row_index, row)| {
                            rsx! {
                                tr {
                                    class: "hikari-table-row",
                                    key: "{row_index}",

                                    {row.iter().enumerate().map(|(col_index, cell)| {
                                        let align_class = if has_columns && col_index < props.columns.len() {
                                            match props.columns[col_index].align {
                                                ColumnAlign::Left => "hikari-text-left",
                                                ColumnAlign::Center => "hikari-text-center",
                                                ColumnAlign::Right => "hikari-text-right",
                                            }
                                        } else {
                                            ""
                                        };

                                        rsx! {
                                            td {
                                                class: format!("hikari-table-cell {align_class}"),
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
                            class: "hikari-table-row",
                            td {
                                class: "hikari-table-empty",
                                colspan: "{colspan_count}",
                                div { class: "hikari-table-empty-content",
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
