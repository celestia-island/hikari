// demo-app/src/pages/table_demo.rs
// Table component demo page

use dioxus::prelude::*;
use hikari_components::{ColumnAlign, Input, table::{ColumnDef, Table}};

use crate::{app::Route, components::Layout};

#[component]
pub fn TableDemo() -> Element {
    let active_tab = use_signal(|| DemoTab::Basic);

    rsx! {
        Layout {
            current_route: Route::TableDemo {},

            div { class: "mb-6",
                h1 { class: "text-3xl font-bold text-[#1a1a2e] mb-2", "Table Component Demo" }
                p { class: "text-gray-600",
                    "Advanced table features: sorting, filtering, pagination, selection, and editing"
                }
            }

            // Demo tabs
            DemoTabs { active_tab: active_tab }

            // Content area
            div { class: "bg-white rounded-xl p-8 shadow-md mt-6",
                TableDemoContent { active_tab: active_tab }
            }
        }
    }
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
enum DemoTab {
    #[default]
    Basic,
    Sorting,
    Filtering,
    Pagination,
    Selection,
    Editing,
}

#[component]
fn DemoTabs(active_tab: Signal<DemoTab>) -> Element {
    let tabs = [
        DemoTab::Basic,
        DemoTab::Sorting,
        DemoTab::Filtering,
        DemoTab::Pagination,
        DemoTab::Selection,
        DemoTab::Editing,
    ];

    rsx! {
        div { class: "bg-white rounded-xl p-2 flex gap-2 shadow-md flex-wrap",
            {tabs.into_iter().map(|tab| {
                let tab_value = tab;
                let is_active = active_tab() == tab;
                let label = match tab {
                    DemoTab::Basic => "Basic",
                    DemoTab::Sorting => "Sortable",
                    DemoTab::Filtering => "Filterable",
                    DemoTab::Pagination => "Pagination",
                    DemoTab::Selection => "Selection",
                    DemoTab::Editing => "Editable",
                };
                rsx! {
                    button {
                        key: "{label}",
                        onclick: move |_| active_tab.set(tab_value),
                        class: format!(
                            "px-5 py-3 border-none rounded-lg cursor-pointer font-medium transition-all duration-200 {}",
                            if is_active {
                                "bg-[#4a9eff] text-white shadow-md"
                            } else {
                                "bg-transparent text-gray-600 hover:bg-gray-100"
                            }
                        ),
                        "{label}"
                    }
                }
            })}
        }
    }
}

#[component]
fn TableDemoContent(active_tab: Signal<DemoTab>) -> Element {
    match active_tab() {
        DemoTab::Basic => rsx! { BasicTableDemo {} },
        DemoTab::Sorting => rsx! { SortableTableDemo {} },
        DemoTab::Filtering => rsx! { FilterableTableDemo {} },
        DemoTab::Pagination => rsx! { PaginatedTableDemo {} },
        DemoTab::Selection => rsx! { SelectableTableDemo {} },
        DemoTab::Editing => rsx! { EditableTableDemo {} },
    }
}

#[component]
fn BasicTableDemo() -> Element {
    let columns = vec![
        ColumnDef::new("id", "ID").width("80px"),
        ColumnDef::new("name", "Operator Name"),
        ColumnDef::new("class", "Class").width("120px"),
        ColumnDef::new("rarity", "Rarity").width("100px").align(ColumnAlign::Center),
        ColumnDef::new("level", "Level").width("100px").align(ColumnAlign::Center),
    ];

    let data = vec![
        vec!["1".to_string(), "Amiya".to_string(), "Guard".to_string(), "6".to_string(), "90".to_string()],
        vec!["2".to_string(), "SilverAsh".to_string(), "Guard".to_string(), "6".to_string(), "90".to_string()],
        vec!["3".to_string(), "Exusiai".to_string(), "Sniper".to_string(), "6".to_string(), "90".to_string()],
        vec!["4".to_string(), "Siege".to_string(), "Vanguard".to_string(), "6".to_string(), "80".to_string()],
        vec!["5".to_string(), "Myrtle".to_string(), "Vanguard".to_string(), "4".to_string(), "70".to_string()],
    ];

    rsx! {
        h2 { class: "text-xl font-semibold text-[#1a1a2e] mb-4", "Basic Table" }
        p { class: "text-gray-600 mb-6 leading-relaxed",
            "A simple table with bordered, striped, and hoverable styles."
        }

        Table {
            columns: columns,
            data: data,
            bordered: true,
            striped: true,
            hoverable: true,
        }

        div { class: "mt-6 p-4 bg-gray-50 rounded-lg border-l-4 border-[#4a9eff]",
            h4 { class: "text-[#1a1a2e] text-sm font-semibold mb-2", "Features" }
            ul { class: "m-0 pl-5 text-gray-600 text-sm leading-relaxed",
                li { "Bordered cells for clarity" }
                li { "Striped rows for better readability" }
                li { "Hover effect on rows" }
                li { "Column alignment (left, center, right)" }
                li { "Custom column widths" }
            }
        }
    }
}

#[component]
fn SortableTableDemo() -> Element {
    let mut sort_column = use_signal(|| Option::<String>::None);
    let mut sort_direction = use_signal(|| 1isize);

    let columns = vec![
        ColumnDef::new("id", "ID").width("80px").sortable(true),
        ColumnDef::new("name", "Operator Name").sortable(true),
        ColumnDef::new("class", "Class").width("120px").sortable(true),
        ColumnDef::new("rarity", "Rarity").width("100px").align(ColumnAlign::Center).sortable(true),
        ColumnDef::new("level", "Level").width("100px").align(ColumnAlign::Center).sortable(true),
    ];

    let mut data = vec![
        vec!["1".to_string(), "Amiya".to_string(), "Guard".to_string(), "6".to_string(), "90".to_string()],
        vec!["2".to_string(), "SilverAsh".to_string(), "Guard".to_string(), "6".to_string(), "90".to_string()],
        vec!["3".to_string(), "Exusiai".to_string(), "Sniper".to_string(), "6".to_string(), "90".to_string()],
        vec!["4".to_string(), "Siege".to_string(), "Vanguard".to_string(), "6".to_string(), "80".to_string()],
        vec!["5".to_string(), "Myrtle".to_string(), "Vanguard".to_string(), "4".to_string(), "70".to_string()],
        vec!["6".to_string(), "Texas".to_string(), "Vanguard".to_string(), "5".to_string(), "80".to_string()],
        vec!["7".to_string(), "Specter".to_string(), "Guard".to_string(), "5".to_string(), "70".to_string()],
    ];

    if let Some(col) = sort_column() {
        let col_idx = columns.iter().position(|c| c.column_key == col).unwrap_or(0);
        data.sort_by(|a, b| {
            let cmp = a[col_idx].cmp(&b[col_idx]);
            if sort_direction() < 0 { cmp.reverse() } else { cmp }
        });
    }

    let sort_info = sort_column().map(|col| {
        let dir = if sort_direction() > 0 { "asc" } else { "desc" };
        format!("{} ({})", col, dir)
    });

    rsx! {
        h2 { class: "text-xl font-semibold text-[#1a1a2e] mb-4", "Sortable Table" }
        p { class: "text-gray-600 mb-6 leading-relaxed",
            "Click on column headers to sort. Click again to reverse the order."
        }

        div { class: "mb-4 flex gap-3 items-center",
            span { class: "text-gray-600 text-sm",
                "Current sort: "
            }
            if let Some(info) = sort_info {
                span { class: "text-[#4a9eff] font-medium text-sm",
                    "{info}"
                }
                button {
                    onclick: move |_| {
                        sort_column.set(None);
                        sort_direction.set(1);
                    },
                    class: "px-3 py-1.5 border border-gray-300 bg-white rounded cursor-pointer text-xs hover:bg-gray-50",
                    "Clear"
                }
            } else {
                span { class: "text-gray-400 text-sm", "None" }
            }
        }

        Table {
            columns: columns,
            data: data,
            bordered: true,
            hoverable: true,
        }
    }
}

#[component]
fn FilterableTableDemo() -> Element {
    let mut filter_text = use_signal(String::new);

    let columns = vec![
        ColumnDef::new("id", "ID").width("80px"),
        ColumnDef::new("name", "Operator Name"),
        ColumnDef::new("class", "Class").width("120px"),
        ColumnDef::new("rarity", "Rarity").width("100px").align(ColumnAlign::Center),
    ];

    let all_data = vec![
        vec!["1".to_string(), "Amiya".to_string(), "Guard".to_string(), "6".to_string()],
        vec!["2".to_string(), "SilverAsh".to_string(), "Guard".to_string(), "6".to_string()],
        vec!["3".to_string(), "Exusiai".to_string(), "Sniper".to_string(), "6".to_string()],
        vec!["4".to_string(), "Siege".to_string(), "Vanguard".to_string(), "6".to_string()],
        vec!["5".to_string(), "Myrtle".to_string(), "Vanguard".to_string(), "4".to_string()],
        vec!["6".to_string(), "Texas".to_string(), "Vanguard".to_string(), "5".to_string()],
        vec!["7".to_string(), "Specter".to_string(), "Guard".to_string(), "5".to_string()],
        vec!["8".to_string(), "Angelina".to_string(), "Caster".to_string(), "6".to_string()],
    ];

    let filter = filter_text();
    let filtered_data = if filter.is_empty() {
        all_data.clone()
    } else {
        all_data
            .iter()
            .filter(|row| row.iter().any(|cell| cell.to_lowercase().contains(&filter.to_lowercase())))
            .cloned()
            .collect::<Vec<_>>()
    };

    rsx! {
        h2 { class: "text-xl font-semibold text-[#1a1a2e] mb-4", "Filterable Table" }
        p { class: "text-gray-600 mb-6 leading-relaxed",
            "Type in the search box to filter table data across all columns."
        }

        div { class: "mb-4 flex gap-3 items-center",
            div { class: "flex-1 max-w-md",
                Input {
                    placeholder: "Search operators...",
                    value: filter_text(),
                    oninput: move |s: String| {
                        filter_text.set(s);
                    },
                }
            }
            span { class: "text-gray-600 text-sm",
                "Showing {filtered_data.len()} of {all_data.len()} rows"
            }
        }

        Table {
            columns: columns,
            data: filtered_data,
            bordered: true,
            striped: true,
            hoverable: true,
            empty_text: if !filter_text().is_empty() { "No matching operators found" } else { "No data available" },
        }
    }
}

#[component]
fn PaginatedTableDemo() -> Element {
    let mut current_page = use_signal(|| 1usize);
    let page_size = 5usize;

    let columns = vec![
        ColumnDef::new("id", "ID").width("80px"),
        ColumnDef::new("name", "Operator Name"),
        ColumnDef::new("class", "Class").width("120px"),
        ColumnDef::new("rarity", "Rarity").width("100px").align(ColumnAlign::Center),
    ];

    let all_data = (1..=25).map(|i| {
        vec![
            i.to_string(),
            format!("Operator {}", i),
            ["Guard", "Vanguard", "Sniper", "Caster", "Medic"][i % 5].to_string(),
            [(i % 3) + 4].iter().map(|x| x.to_string()).next().unwrap(),
        ]
    }).collect::<Vec<_>>();

    let total_pages = all_data.len().div_ceil(page_size);
    let page_data = {
        let start = (current_page() - 1) * page_size;
        let end = (start + page_size).min(all_data.len());
        all_data[start..end].to_vec()
    };

    let current_page_val = current_page();
    let all_data_count = all_data.len();

    rsx! {
        h2 { class: "text-xl font-semibold text-[#1a1a2e] mb-4", "Paginated Table" }
        p { class: "text-gray-600 mb-6 leading-relaxed",
            "Table with pagination controls for large datasets."
        }

        Table {
            columns: columns,
            data: page_data,
            bordered: true,
            striped: true,
            hoverable: true,
        }

        div { class: "mt-5 flex justify-center items-center gap-3",
            button {
                onclick: move |_| {
                    if current_page() > 1 {
                        current_page.set(current_page() - 1);
                    }
                },
                disabled: current_page() == 1,
                class: "px-4 py-2 border border-gray-300 bg-white rounded-lg cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50",
                "Previous"
            }

            div { class: "flex gap-1",
                {(1..=total_pages).map(|page| {
                    let is_current = current_page() == page;
                    rsx! {
                        button {
                            key: "{page}",
                            onclick: move |_| current_page.set(page),
                            class: format!(
                                "px-3 py-2 border rounded-lg cursor-pointer text-sm {}",
                                if is_current {
                                    "border-[#4a9eff] bg-[#4a9eff] text-white"
                                } else {
                                    "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                                }
                            ),
                            "{page}"
                        }
                    }
                })}
            }

            button {
                onclick: move |_| {
                    if current_page() < total_pages {
                        current_page.set(current_page() + 1);
                    }
                },
                disabled: current_page() == total_pages,
                class: "px-4 py-2 border border-gray-300 bg-white rounded-lg cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50",
                "Next"
            }
        }

        div { class: "mt-3 text-center text-gray-600 text-sm",
            "Page {current_page_val} of {total_pages} ({all_data_count} total rows)"
        }
    }
}

#[component]
fn SelectableTableDemo() -> Element {
    let mut selected_rows = use_signal(Vec::<usize>::new);

    let columns = vec![
        ColumnDef::new("id", "ID").width("80px"),
        ColumnDef::new("name", "Operator Name"),
        ColumnDef::new("class", "Class").width("120px"),
        ColumnDef::new("rarity", "Rarity").width("100px").align(ColumnAlign::Center),
    ];

    let data = vec![
        vec!["1".to_string(), "Amiya".to_string(), "Guard".to_string(), "6".to_string()],
        vec!["2".to_string(), "SilverAsh".to_string(), "Guard".to_string(), "6".to_string()],
        vec!["3".to_string(), "Exusiai".to_string(), "Sniper".to_string(), "6".to_string()],
        vec!["4".to_string(), "Siege".to_string(), "Vanguard".to_string(), "6".to_string()],
        vec!["5".to_string(), "Myrtle".to_string(), "Vanguard".to_string(), "4".to_string()],
    ];

    rsx! {
        h2 { class: "text-xl font-semibold text-[#1a1a2e] mb-4", "Selectable Table" }
        p { class: "text-gray-600 mb-6 leading-relaxed",
            "Click on rows to select them. Multiple selection supported."
        }

        div { class: "mb-4 p-3 bg-gray-50 rounded-lg flex gap-3 items-center",
            span { class: "text-gray-600 text-sm",
                "Selected: {selected_rows().len()} rows"
            }
            if !selected_rows().is_empty() {
                button {
                    onclick: move |_| {
                        selected_rows.set(Vec::new());
                    },
                    class: "px-3 py-1.5 border border-[#4a9eff] bg-white text-[#4a9eff] rounded cursor-pointer text-xs hover:bg-blue-50",
                    "Clear Selection"
                }
            }
        }

        Table {
            columns: columns,
            data: data,
            bordered: true,
            striped: true,
            hoverable: true,
        }

        if !selected_rows().is_empty() {
            div { class: "mt-4 p-4 bg-blue-50 rounded-lg border-l-4 border-[#4a9eff]",
                h4 { class: "text-[#1a1a2e] text-sm font-semibold mb-2", "Selected Row IDs" }
                p { class: "m-0 text-gray-600 text-sm",
                    "{selected_rows().iter().map(|i| (i + 1).to_string()).collect::<Vec<_>>().join(\", \")}"
                }
            }
        }
    }
}

#[component]
fn EditableTableDemo() -> Element {
    let mut editing_cell = use_signal(|| Option::<(usize, usize)>::None);
    let mut data = use_signal(|| vec![
        vec!["1".to_string(), "Amiya".to_string(), "Guard".to_string(), "90".to_string()],
        vec!["2".to_string(), "SilverAsh".to_string(), "Guard".to_string(), "90".to_string()],
        vec!["3".to_string(), "Exusiai".to_string(), "Sniper".to_string(), "85".to_string()],
        vec!["4".to_string(), "Siege".to_string(), "Vanguard".to_string(), "80".to_string()],
    ]);

    rsx! {
        h2 { class: "text-xl font-semibold text-[#1a1a2e] mb-4", "Editable Table" }
        p { class: "text-gray-600 mb-6 leading-relaxed",
            "Double-click on cells to edit them. Click outside to save."
        }

        div { class: "mb-4 p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400",
            p { class: "m-0 text-yellow-800 text-sm",
                "This is a simplified demo. In production, you would integrate with form validation and backend updates."
            }
        }

        div { class: "hikari-table-wrapper",
            table {
                class: "hikari-table hikari-table-bordered hikari-table-hover",
                style: "width: 100%;",

                thead {
                    tr {
                        th { class: "hikari-table-header-cell", "ID" }
                        th { class: "hikari-table-header-cell", "Name" }
                        th { class: "hikari-table-header-cell", "Class" }
                        th { class: "hikari-table-header-cell", "Level" }
                    }
                }

                tbody {
                    {data().iter().enumerate().map(|(row_idx, row)| {
                        rsx! {
                            tr {
                                class: "hikari-table-row",
                                key: "{row_idx}",

                                {row.iter().enumerate().map(|(col_idx, cell)| {
                                    let is_editing = editing_cell() == Some((row_idx, col_idx));
                                    rsx! {
                                        td {
                                            class: "hikari-table-cell",
                                            style: "cursor: pointer;",
                                            key: "{row_idx}-{col_idx}",
                                            ondoubleclick: move |_| editing_cell.set(Some((row_idx, col_idx))),

                                            if is_editing {
                                                input {
                                                    value: "{cell}",
                                                    style: "width: 100%; padding: 4px; border: 2px solid #4a9eff; border-radius: 4px; font-size: 14px;",
                                                    oninput: move |e: Event<FormData>| {
                                                        let mut new_data = data().clone();
                                                        new_data[row_idx][col_idx] = e.value();
                                                        data.set(new_data);
                                                    },
                                                    onblur: move |_| editing_cell.set(None),
                                                    autofocus: true,
                                                }
                                            } else {
                                                {cell.clone()}
                                            }
                                        }
                                    }
                                })}
                            }
                        }
                    })}
                }
            }
        }

        div { class: "mt-4 p-4 bg-gray-50 rounded-lg",
            h4 { class: "text-[#1a1a2e] text-sm font-semibold mb-2", "Current Data State" }
            pre {
                class: "m-0 p-3 bg-white rounded text-xs overflow-x-auto",
                "{data().iter().map(|row| row.join(\" | \")).collect::<Vec<_>>().join(\"\\n\")}"
            }
        }
    }
}
