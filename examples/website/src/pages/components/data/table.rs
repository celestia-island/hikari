// website/src/pages/components/data/table.rs
// Table component showcase page with real rendered examples

use dioxus::prelude::*;
use std::collections::HashMap;

use crate::{app::Route, components::Layout};
use _components::{
    data::{ColumnAlign, ColumnDef, SortConfig, SortDirection, Table, TableSize},
    layout::{Container, Section},
};
use _palette::classes::{ClassesBuilder, FontSize, FontWeight, MarginBottom, Padding, TextColor};

/// Interactive sortable table component with state management
#[component]
fn InteractiveSortableTable() -> Element {
    let mut sort_column = use_signal(|| String::new());
    let mut sort_direction = use_signal(|| SortDirection::default());

    let sample_data = vec![
        vec!["Amiya".to_string(), "Guard".to_string(), "6".to_string(), "5".to_string()],
        vec!["SilverAsh".to_string(), "Guard".to_string(), "6".to_string(), "6".to_string()],
        vec!["Exusiai".to_string(), "Sniper".to_string(), "6".to_string(), "6".to_string()],
        vec!["Siege".to_string(), "Vanguard".to_string(), "3".to_string(), "5".to_string()],
        vec!["Texas".to_string(), "Vanguard".to_string(), "1".to_string(), "4".to_string()],
        vec!["Myrtle".to_string(), "Supporter".to_string(), "5".to_string(), "4".to_string()],
        vec!["Angelina".to_string(), "Specialist".to_string(), "6".to_string(), "5".to_string()],
        vec!["Laplum".to_string(), "Supporter".to_string(), "5".to_string(), "4".to_string()],
        vec!["Vodfox".to_string(), "Caster".to_string(), "5".to_string(), "5".to_string()],
        vec!["Ceobe".to_string(), "Vanguard".to_string(), "1".to_string(), "3".to_string()],
    ];

    let on_sort_change = move |config: SortConfig| {
        sort_column.set(config.column.clone());
        sort_direction.set(config.direction);
    };

    // Show current sort state
    let sort_status = if !sort_column().is_empty() {
        format!(
            "Sorting by: {} ({})",
            sort_column(),
            match sort_direction() {
                SortDirection::Ascending => "↑",
                SortDirection::Descending => "↓",
                SortDirection::None => "-",
            }
        )
    } else {
        "Not sorted".to_string()
    };

    rsx! {
        div {
            div { class: ClassesBuilder::new().add(MarginBottom::Mb4).build(),
                span { class: "text-sm text-gray-500", "{sort_status}" }
            }
            Table {
                columns: vec![
                    ColumnDef::new("name", "Name").sortable(true),
                    ColumnDef::new("class", "Class").sortable(true),
                    ColumnDef::new("level", "Level").align(ColumnAlign::Center).sortable(true),
                    ColumnDef::new("rarity", "Rarity").align(ColumnAlign::Center).sortable(true),
                ],
                data: sample_data,
                sort_column: sort_column(),
                sort_direction: sort_direction(),
                on_sort_change: move |c| on_sort_change(c),
                bordered: true,
                striped: true,
                hoverable: true,
            }
        }
    }
}

#[allow(non_snake_case)]
pub fn ComponentsTable() -> Element {
    rsx! {
        Layout {
            current_route: Route::DataTable {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Table"
                    }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "Table component with column definitions and multiple styles"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Table is used to display data in rows and columns. It supports:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Multiple sizes" }
                                " - Small, Medium, Large"
                            }
                            li {
                                strong { "Style variants" }
                                " - Bordered, Striped, Hoverable"
                            }
                            li {
                                strong { "Column definitions" }
                                " - Width, alignment, sortable, filterable"
                            }
                            li {
                                strong { "Empty state" }
                                " - Custom empty message when no data"
                            }
                        }
                    }
                }

                // Basic Table
                Section {
                    title: Some("Basic Tables".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Simple Table"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Basic table with column definitions and data"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Table {
                                columns: vec![
                                    ColumnDef::new("name", "Name"),
                                    ColumnDef::new("role", "Role"),
                                    ColumnDef::new("level", "Level").align(ColumnAlign::Center),
                                ],
                                data: vec![
                                    vec!["Amiya".to_string(), "Guard".to_string(), "6".to_string()],
                                    vec!["SilverAsh".to_string(), "Guard".to_string(), "6".to_string()],
                                    vec!["Exusiai".to_string(), "Sniper".to_string(), "6".to_string()],
                                    vec!["Siege".to_string(), "Vanguard".to_string(), "6".to_string()],
                                    vec!["Texas".to_string(), "Vanguard".to_string(), "6".to_string()],
                                ],
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Borders"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Table with bordered option"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Table {
                                columns: vec![
                                    ColumnDef::new("name", "Name"),
                                    ColumnDef::new("role", "Role"),
                                    ColumnDef::new("level", "Level").align(ColumnAlign::Center),
                                ],
                                data: vec![
                                    vec!["Amiya".to_string(), "Guard".to_string(), "6".to_string()],
                                    vec!["SilverAsh".to_string(), "Guard".to_string(), "6".to_string()],
                                    vec!["Exusiai".to_string(), "Sniper".to_string(), "6".to_string()],
                                ],
                                bordered: true,
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Striped Rows"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Table with striped rows for better readability"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Table {
                                columns: vec![
                                    ColumnDef::new("name", "Name"),
                                    ColumnDef::new("role", "Role"),
                                    ColumnDef::new("level", "Level").align(ColumnAlign::Center),
                                ],
                                data: vec![
                                    vec!["Amiya".to_string(), "Guard".to_string(), "6".to_string()],
                                    vec!["SilverAsh".to_string(), "Guard".to_string(), "6".to_string()],
                                    vec!["Exusiai".to_string(), "Sniper".to_string(), "6".to_string()],
                                    vec!["Siege".to_string(), "Vanguard".to_string(), "6".to_string()],
                                    vec!["Texas".to_string(), "Vanguard".to_string(), "6".to_string()],
                                ],
                                striped: true,
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Hoverable Rows"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Table with hover effect on rows"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Table {
                                columns: vec![
                                    ColumnDef::new("name", "Name"),
                                    ColumnDef::new("role", "Role"),
                                    ColumnDef::new("level", "Level").align(ColumnAlign::Center),
                                ],
                                data: vec![
                                    vec!["Amiya".to_string(), "Guard".to_string(), "6".to_string()],
                                    vec!["SilverAsh".to_string(), "Guard".to_string(), "6".to_string()],
                                    vec!["Exusiai".to_string(), "Sniper".to_string(), "6".to_string()],
                                ],
                                hoverable: true,
                            }
                        }
                    }
                }

                // Table Sizes
                Section {
                    title: Some("Table Sizes".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Size Variants"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Tables in different sizes for various contexts"
                        }
                        div { class: ClassesBuilder::new().add(MarginBottom::Mb6).build(),
                            h4 { "Small" }
                            Table {
                                size: TableSize::Small,
                                columns: vec![
                                    ColumnDef::new("name", "Name"),
                                    ColumnDef::new("role", "Role"),
                                ],
                                data: vec![
                                    vec!["Amiya".to_string(), "Guard".to_string()],
                                    vec!["SilverAsh".to_string(), "Guard".to_string()],
                                ],
                            }
                        }
                        div { class: ClassesBuilder::new().add(MarginBottom::Mb6).build(),
                            h4 { "Medium (Default)" }
                            Table {
                                size: TableSize::Medium,
                                columns: vec![
                                    ColumnDef::new("name", "Name"),
                                    ColumnDef::new("role", "Role"),
                                ],
                                data: vec![
                                    vec!["Amiya".to_string(), "Guard".to_string()],
                                    vec!["SilverAsh".to_string(), "Guard".to_string()],
                                ],
                            }
                        }
                        div { class: ClassesBuilder::new().add(MarginBottom::Mb0).build(),
                            h4 { "Large" }
                            Table {
                                size: TableSize::Large,
                                columns: vec![
                                    ColumnDef::new("name", "Name"),
                                    ColumnDef::new("role", "Role"),
                                ],
                                data: vec![
                                    vec!["Amiya".to_string(), "Guard".to_string()],
                                    vec!["SilverAsh".to_string(), "Guard".to_string()],
                                ],
                            }
                        }
                    }
                }

                // Column Features
                Section {
                    title: Some("Column Features".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Sortable Columns"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Columns with sortable option show sort icon"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Table {
                                columns: vec![
                                    ColumnDef::new("name", "Name").sortable(true),
                                    ColumnDef::new("role", "Role").sortable(true),
                                    ColumnDef::new("level", "Level").align(ColumnAlign::Center).sortable(true),
                                ],
                                data: vec![
                                    vec!["Amiya".to_string(), "Guard".to_string(), "6".to_string()],
                                    vec!["SilverAsh".to_string(), "Guard".to_string(), "6".to_string()],
                                    vec!["Exusiai".to_string(), "Sniper".to_string(), "6".to_string()],
                                ],
                                bordered: true,
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Column Width and Alignment"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Columns with custom width and text alignment"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Table {
                                columns: vec![
                                    ColumnDef::new("name", "Name").width("200px"),
                                    ColumnDef::new("role", "Role").width("150px"),
                                    ColumnDef::new("level", "Level").align(ColumnAlign::Center).width("100px"),
                                    ColumnDef::new("status", "Status").align(ColumnAlign::Center).width("100px"),
                                ],
                                data: vec![
                                    vec!["Amiya".to_string(), "Guard".to_string(), "6".to_string(), "Active".to_string()],
                                    vec!["SilverAsh".to_string(), "Guard".to_string(), "6".to_string(), "Active".to_string()],
                                    vec!["Exusiai".to_string(), "Sniper".to_string(), "6".to_string(), "Active".to_string()],
                                ],
                                bordered: true,
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Interactive Sorting"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Click column headers to sort. Current state is managed by parent component."
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Table {
                                columns: vec![
                                    ColumnDef::new("name", "Name").sortable(true),
                                    ColumnDef::new("role", "Role").sortable(true),
                                    ColumnDef::new("level", "Level").align(ColumnAlign::Center).sortable(true),
                                    ColumnDef::new("rarity", "Rarity").align(ColumnAlign::Center).sortable(true),
                                ],
                                data: vec![
                                    vec!["Texas".to_string(), "Vanguard".to_string(), "1".to_string(), "4".to_string()],
                                    vec!["Siege".to_string(), "Vanguard".to_string(), "3".to_string(), "5".to_string()],
                                    vec!["Amiya".to_string(), "Guard".to_string(), "6".to_string(), "5".to_string()],
                                    vec!["SilverAsh".to_string(), "Guard".to_string(), "6".to_string(), "6".to_string()],
                                    vec!["Exusiai".to_string(), "Sniper".to_string(), "6".to_string(), "6".to_string()],
                                ],
                                bordered: true,
                                striped: true,
                            }
                        }
                    }

                    // Interactive Sortable Table Example
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Sortable Table with State"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Fully interactive sortable table with state management. Click headers to sort."
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            InteractiveSortableTable {}
                        }
                    }
                }

                // Empty State
                Section {
                    title: Some("Empty State".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "No Data"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Table with no data shows empty state"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Table {
                                columns: vec![
                                    ColumnDef::new("name", "Name"),
                                    ColumnDef::new("role", "Role"),
                                ],
                                data: vec![],
                                bordered: true,
                                empty_text: "No operators available".to_string(),
                            }
                        }
                    }
                }

                // Usage Examples
                Section {
                    title: Some("Usage Examples".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Table"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Table {{
    columns: vec![
        ColumnDef::new("name", "Name"),
        ColumnDef::new("role", "Role"),
    ],
    data: vec![
        vec!["Amiya".to_string(), "Guard".to_string()],
        vec!["SilverAsh".to_string(), "Guard".to_string()],
    ],
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Bordered and Striped"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Table {{
    columns: vec![
        ColumnDef::new("name", "Name"),
        ColumnDef::new("role", "Role"),
    ],
    data: vec![...],
    bordered: true,
    striped: true,
    hoverable: true,
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Column Width and Alignment"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Table {{
    columns: vec![
        ColumnDef::new("name", "Name").width("200px"),
        ColumnDef::new("role", "Role").align(ColumnAlign::Center),
    ],
    data: vec![...],
}}"#
                            }
                        }
                    }
                }
            }
        }
    }
}
