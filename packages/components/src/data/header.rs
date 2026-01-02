// hikari-components/src/data/header.rs
// Header component for table headers

use super::column::ColumnDef;
use dioxus::prelude::*;

// Re-export SortDirection from sort module to avoid ambiguity
pub use super::sort::SortDirection;

/// Header component props
#[derive(Clone, PartialEq, Props, Default)]
pub struct HeaderProps {
    /// Column definitions
    pub columns: Vec<ColumnDef>,

    /// Currently sorted column
    #[props(default)]
    pub sort_column: Option<String>,

    /// Sort direction
    #[props(default)]
    pub sort_direction: SortDirection,

    /// Sort handler
    #[props(default)]
    pub on_sort: Option<EventHandler<String>>,

    /// Custom CSS classes
    #[props(default)]
    pub class: String,
}

/// Header component for table header row
///
/// Renders table header row with:
/// - Column headers
/// - Sort indicators (↑/↓ icons)
/// - Click to sort functionality
/// - Fixed column support
/// - Arknights header styling with subtle FUI glow
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Header, ColumnDef, SortDirection, ColumnAlign};
///
/// fn app() -> Element {
///     let columns = vec![
///         ColumnDef {
///             column_key: "name".to_string(),
///             title: "Name".to_string(),
///             align: ColumnAlign::Left,
///             sortable: true,
///             ..Default::default()
///         },
///     ];
///
///     rsx! {
///         Header {
///             columns: columns.clone(),
///             sort_column: Some("name".to_string()),
///             sort_direction: SortDirection::Asc,
///             on_sort: Some(|key| println!("Sort by: {}", key)),
///         }
///     }
/// }
/// ```
#[component]
pub fn Header(props: HeaderProps) -> Element {
    rsx! {
        thead {
            class: "hikari-table-header {props.class}",
            tr {
                class: "hikari-header-row",

                {props.columns.iter().map(|column| {
                    let is_sorted = props.sort_column.as_ref() == Some(&column.column_key);
                    let sort_dir = if is_sorted {
                        props.sort_direction
                    } else {
                        SortDirection::None
                    };

                    let base_classes = "hikari-header-cell";
                    let column_classes = column.build_classes();
                    let sortable_class = column.sortable_class();
                    let fixed_class = column.fixed_class();
                    let active_class = if is_sorted {
                        "hikari-header-cell-active"
                    } else {
                        ""
                    };

                    let classes = format!(
                        "{} {} {} {} {}",
                        base_classes,
                        column_classes,
                        sortable_class,
                        fixed_class,
                        active_class
                    )
                    .split_whitespace()
                    .collect::<Vec<&str>>()
                    .join(" ");

                    let width_styles = column.width_styles();
                    let column_key = column.column_key.clone();
                    let sortable = column.sortable;
                    let has_filter = column.filterable;
                    let title = column.title.clone();
                    let on_sort = props.on_sort;

                    rsx! {
                        th {
                            class: "{classes} {column.class}",
                            style: "{width_styles}",
                            "data-key": "{column.column_key}",
                            "data-align": "{column.align as i32}",
                            "data-fixed": "{column.fixed}",
                            "data-sortable": "{sortable}",

                            onclick: move |_e: MouseEvent| {
                                if sortable {
                                    if let Some(ref handler) = on_sort {
                                        handler.call(column_key.clone());
                                    }
                                }
                            },

                            // Column title
                            span {
                                class: "hikari-header-cell-content",
                                { title }
                            }

                            // Sort indicator
                            if column.sortable {
                                span {
                                    class: "hikari-sort-indicator {sort_dir.class()}",
                                    aria_hidden: "true",
                                    { sort_dir.icon() }
                                }
                            }

                            // Filter icon
                            if has_filter {
                                span {
                                    class: "hikari-filter-icon",
                                    aria_hidden: "true",
                                    "⚬"
                                }
                            }

                            // Resize handle
                            if column.resizable {
                                span {
                                    class: "hikari-resize-handle",
                                    aria_hidden: "true"
                                }
                            }
                        }
                    }
                })}
            }
        }
    }
}

/// Helper to check if a column is currently sorted
pub fn is_sorted_column(sort_column: &Option<String>, column_key: &str) -> bool {
    sort_column.as_ref() == Some(&column_key.to_string())
}

/// Helper to get the sort icon for a column
pub fn get_sort_icon(
    sort_column: &Option<String>,
    sort_direction: SortDirection,
    column_key: &str,
) -> &'static str {
    if is_sorted_column(sort_column, column_key) {
        sort_direction.icon()
    } else {
        "⇅"
    }
}

/// Helper to get the sort class for a column
pub fn get_sort_class(
    sort_column: &Option<String>,
    sort_direction: SortDirection,
    column_key: &str,
) -> String {
    if is_sorted_column(sort_column, column_key) {
        format!("hikari-sorted {}", sort_direction.class())
    } else {
        "hikari-sortable".to_string()
    }
}
