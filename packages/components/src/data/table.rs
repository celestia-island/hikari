// hi-components/src/data/table.rs
// Table component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, TableClass};

pub use super::column::{ColumnAlign, ColumnDef};
use crate::styled::StyledComponent;

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

    // Determine if we should show the table or empty state
    let has_data = !props.data.is_empty();
    let has_columns = !props.columns.is_empty();
    let colspan_count = if has_columns { props.columns.len() } else { 1 };

    rsx! {
        div { class: "TableClass::TableWrapper.as_class()",
            table {
                class: "{table_classes}",

                // Render table header if columns are defined
                if has_columns {
                    thead {
                        tr {
                            class: "TableClass::TableHeaderRow.as_class()",
                            {props.columns.iter().map(|column| {
                                let align_class = match column.align {
                                    ColumnAlign::Left => TableClass::TextLeft,
                                    ColumnAlign::Center => TableClass::TextCenter,
                                    ColumnAlign::Right => TableClass::TextRight,
                                };

                                let width_style = column.width.as_ref()
                                    .map_or(String::new(), |w| format!("width: {w};"));

                                let cell_classes = ClassesBuilder::new()
                                    .add(TableClass::TableHeaderCell)
                                    .add(align_class)
                                    .add_if(TableClass::TableSortable, || column.sortable)
                                    .add_raw(&column.class)
                                    .build();

                                rsx! {
                                    th {
                                        class: "{cell_classes}",
                                        style: "{width_style}",

                                        {column.title.clone()}

                                        if column.sortable {
                                            span { class: "TableClass::TableSortIcon.as_class()", "" }
                                        }
                                    }
                                }
                            })}
                        }
                    }
                }

                // Render table body
                tbody {
                    class: "TableClass::TableBody.as_class()",

                    if has_data {
                        {props.data.iter().enumerate().map(|(row_index, row)| {
                            rsx! {
                                tr {
                                    class: "TableClass::TableRow.as_class()",
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
                            class: "TableClass::TableRow.as_class()",
                            td {
                                class: "TableClass::TableEmpty.as_class()",
                                colspan: "{colspan_count}",
                                div { class: "TableClass::TableEmptyContent.as_class()",
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
