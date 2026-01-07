// table-demo/src/app.rs
// Application logic for the table demo

use dioxus::prelude::*;
use components::{ColumnAlign, Input, table::{ColumnDef, Table}};

#[component]
pub fn App() -> Element {
    let active_tab = use_signal(|| DemoTab::Basic);

    rsx! {
        div { class: "table-demo",
            style: "min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: system-ui, -apple-system, sans-serif;",

            // Header
            header {
                style: "background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); padding: 20px 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);",
                div {
                    style: "max-width: 1400px; margin: 0 auto;",
                    h1 { style: "margin: 0; font-size: 28px; color: #1a1a2e;",
                        "Table Component Demo"
                    }
                    p { style: "margin: 8px 0 0 0; color: #666;",
                        "Advanced table features: sorting, filtering, pagination, selection, and editing"
                    }
                }
            }

            // Main content
            main {
                style: "max-width: 1400px; margin: 40px auto; padding: 0 20px;",

                // Demo tabs
                DemoTabs { active_tab: active_tab }

                // Content area
                div {
                    style: "background: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin-top: 24px;",

                    // Demo content based on active tab
                    TableDemo { active_tab: active_tab }
                }
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
        (DemoTab::Basic, "Basic Table"),
        (DemoTab::Sorting, "Sortable"),
        (DemoTab::Filtering, "Filterable"),
        (DemoTab::Pagination, "Pagination"),
        (DemoTab::Selection, "Selection"),
        (DemoTab::Editing, "Editable"),
    ];

    rsx! {
        div { style: "background: white; border-radius: 12px; padding: 8px; display: flex; gap: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);",
            {tabs.into_iter().map(|(tab, label)| {
                let is_active = active_tab() == tab;
                rsx! {
                    button {
                        key: "{label:?}",
                        onclick: move |_| active_tab.set(tab),
                        style: format!(
                            "padding: 12px 24px; border: none; background: {}; color: {}; border-radius: 8px; cursor: pointer; font-weight: 500; transition: all 0.2s; font-size: 14px; flex: 1;",
                            if is_active { "#4a9eff" } else { "transparent" },
                            if is_active { "#fff" } else { "#666" }
                        ),
                        "{label}"
                    }
                }
            })}
        }
    }
}

#[component]
fn TableDemo(active_tab: Signal<DemoTab>) -> Element {
    match active_tab() {
        DemoTab::Basic => rsx! { BasicTableDemo {} },
        DemoTab::Sorting => rsx! { SortableTableDemo {} },
        DemoTab::Filtering => rsx! { FilterableTableDemo {} },
        DemoTab::Pagination => rsx! { PaginatedTableDemo {} },
        DemoTab::Selection => rsx! { SelectableTableDemo {} },
        DemoTab::Editing => rsx! { EditableTableDemo {} },
    }
}

// Basic table demo
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
        div {
            h2 { style: "margin: 0 0 16px 0; font-size: 20px; color: #1a1a2e;", "Basic Table" }
            p { style: "margin: 0 0 24px 0; color: #666; line-height: 1.6;",
                "A simple table with bordered, striped, and hoverable styles."
            }

            Table {
                columns: columns,
                data: data,
                bordered: true,
                striped: true,
                hoverable: true,
            }

            div { style: "margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #4a9eff;",
                h4 { style: "margin: 0 0 8px 0; color: #1a1a2e; font-size: 14px;", "Features" }
                ul { style: "margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;",
                    li { "Bordered cells for clarity" }
                    li { "Striped rows for better readability" }
                    li { "Hover effect on rows" }
                    li { "Column alignment (left, center, right)" }
                    li { "Custom column widths" }
                }
            }
        }
    }
}

// Sortable table demo
#[component]
fn SortableTableDemo() -> Element {
    let mut sort_column = use_signal(|| Option::<String>::None);
    let mut sort_direction = use_signal(|| 1isize); // 1 for asc, -1 for desc

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

    // Apply sorting
    if let Some(col) = sort_column() {
        let col_idx = columns.iter().position(|c| c.column_key == col).unwrap_or(0);
        data.sort_by(|a, b| {
            let cmp = a[col_idx].cmp(&b[col_idx]);
            if sort_direction() < 0 {
                cmp.reverse()
            } else {
                cmp
            }
        });
    }

    // Compute sort direction text
    let sort_info = sort_column().map(|col| {
        let dir = if sort_direction() > 0 { "asc" } else { "desc" };
        format!("{} ({})", col, dir)
    });

    rsx! {
        div {
            h2 { style: "margin: 0 0 16px 0; font-size: 20px; color: #1a1a2e;", "Sortable Table" }
            p { style: "margin: 0 0 24px 0; color: #666; line-height: 1.6;",
                "Click on column headers to sort. Click again to reverse the order."
            }

            div { style: "margin-bottom: 16px; display: flex; gap: 12px; align-items: center;",
                span { style: "color: #666; font-size: 14px;",
                    "Current sort: "
                }
                if let Some(info) = sort_info {
                    span { style: "color: #4a9eff; font-weight: 500; font-size: 14px;",
                        "{info}"
                    }
                    button {
                        onclick: move |_| {
                            sort_column.set(None);
                            sort_direction.set(1);
                        },
                        style: "padding: 6px 12px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 12px;",
                        "Clear"
                    }
                } else {
                    span { style: "color: #999; font-size: 14px;", "None" }
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
}

// Filterable table demo
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
        div {
            h2 { style: "margin: 0 0 16px 0; font-size: 20px; color: #1a1a2e;", "Filterable Table" }
            p { style: "margin: 0 0 24px 0; color: #666; line-height: 1.6;",
                "Type in the search box to filter table data across all columns."
            }

            div { style: "margin-bottom: 16px; display: flex; gap: 12px; align-items: center;",
                div { style: "flex: 1; max-width: 400px;",
                    Input {
                        placeholder: "Search operators...",
                        value: filter_text(),
                        oninput: move |s: String| {
                            filter_text.set(s);
                        },
                    }
                }
                span { style: "color: #666; font-size: 14px;",
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
}

// Paginated table demo
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

    // Precompute pagination button styles
    let page_buttons: Vec<(usize, String, String, String)> = (1..=total_pages)
        .map(|page| {
            let is_current = current_page() == page;
            let border = if is_current { "#4a9eff" } else { "#ddd" };
            let bg = if is_current { "#4a9eff" } else { "white" };
            let text = if is_current { "white" } else { "#666" };
            (page, border.to_string(), bg.to_string(), text.to_string())
        })
        .collect();

    let current_page_val = current_page();
    let all_data_count = all_data.len();

    rsx! {
        div {
            h2 { style: "margin: 0 0 16px 0; font-size: 20px; color: #1a1a2e;", "Paginated Table" }
            p { style: "margin: 0 0 24px 0; color: #666; line-height: 1.6;",
                "Table with pagination controls for large datasets."
            }

            Table {
                columns: columns,
                data: page_data,
                bordered: true,
                striped: true,
                hoverable: true,
            }

            // Pagination controls
            div { style: "margin-top: 20px; display: flex; justify-content: center; align-items: center; gap: 12px;",
                button {
                    onclick: move |_| {
                        if current_page() > 1 {
                            current_page.set(current_page() - 1);
                        }
                    },
                    disabled: current_page() == 1,
                    style: "padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer; font-size: 14px; &:disabled {{ opacity: 0.5; cursor: not-allowed; }}",
                    "Previous"
                }

                div { style: "display: flex; gap: 4px;",
                    {page_buttons.into_iter().map(|(page_num, border, bg, text)| {
                        rsx! {
                            button {
                                key: "{page_num}",
                                onclick: move |_| current_page.set(page_num),
                                style: format!(
                                    "padding: 8px 12px; border: 1px solid {}; background: {}; color: {}; border-radius: 6px; cursor: pointer; font-size: 14px;",
                                    border, bg, text
                                ),
                                "{page_num}"
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
                    style: "padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer; font-size: 14px; &:disabled {{ opacity: 0.5; cursor: not-allowed; }}",
                    "Next"
                }
            }

            div { style: "margin-top: 12px; text-align: center; color: #666; font-size: 14px;",
                "Page {current_page_val} of {total_pages} ({all_data_count} total rows)"
            }
        }
    }
}

// Selectable table demo
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
        div {
            h2 { style: "margin: 0 0 16px 0; font-size: 20px; color: #1a1a2e;", "Selectable Table" }
            p { style: "margin: 0 0 24px 0; color: #666; line-height: 1.6;",
                "Click on rows to select them. Multiple selection supported."
            }

            div { style: "margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 8px; display: flex; gap: 12px; align-items: center;",
                span { style: "color: #666; font-size: 14px;",
                    "Selected: {selected_rows().len()} rows"
                }
                if !selected_rows().is_empty() {
                    button {
                        onclick: move |_| {
                            selected_rows.set(Vec::new());
                        },
                        style: "padding: 6px 12px; border: 1px solid #4a9eff; background: white; color: #4a9eff; border-radius: 4px; cursor: pointer; font-size: 12px;",
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
                div { style: "margin-top: 16px; padding: 16px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #4a9eff;",
                    h4 { style: "margin: 0 0 8px 0; color: #1a1a2e; font-size: 14px;", "Selected Row IDs" }
                    p { style: "margin: 0; color: #666; font-size: 14px;",
                        "{selected_rows().iter().map(|i| (i + 1).to_string()).collect::<Vec<_>>().join(\", \")}"
                    }
                }
            }
        }
    }
}

// Editable table demo
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
        div {
            h2 { style: "margin: 0 0 16px 0; font-size: 20px; color: #1a1a2e;", "Editable Table" }
            p { style: "margin: 0 0 24px 0; color: #666; line-height: 1.6;",
                "Double-click on cells to edit them. Click outside to save."
            }

            div { style: "margin-bottom: 16px; padding: 12px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;",
                p { style: "margin: 0; color: #856404; font-size: 14px;",
                    "This is a simplified demo. In production, you would integrate with form validation and backend updates."
                }
            }

            div { class: "hi-table-wrapper",
                table {
                    class: "hi-table hi-table-bordered hi-table-hover",
                    style: "width: 100%;",

                    thead {
                        tr {
                            th { class: "hi-table-header-cell", "ID" }
                            th { class: "hi-table-header-cell", "Name" }
                            th { class: "hi-table-header-cell", "Class" }
                            th { class: "hi-table-header-cell", "Level" }
                        }
                    }

                    tbody {
                        {data().iter().enumerate().map(|(row_idx, row)| {
                            rsx! {
                                tr {
                                    class: "hi-table-row",
                                    key: "{row_idx}",

                                    {row.iter().enumerate().map(|(col_idx, cell)| {
                                        let is_editing = editing_cell() == Some((row_idx, col_idx));
                                        rsx! {
                                            td {
                                                class: "hi-table-cell",
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

            div { style: "margin-top: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px;",
                h4 { style: "margin: 0 0 8px 0; color: #1a1a2e; font-size: 14px;", "Current Data State" }
                pre {
                    style: "margin: 0; padding: 12px; background: white; border-radius: 4px; font-size: 12px; overflow-x: auto;",
                    "{data().iter().map(|row| row.join(\" | \")).collect::<Vec<_>>().join(\"\\n\")}"
                }
            }
        }
    }
}
