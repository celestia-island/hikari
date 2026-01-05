// demo-app/src/pages/data_components.rs
// Data components demonstration page

use dioxus::prelude::*;
use components::*;

use crate::{app::Route, components::{Layout, Section}};

#[component]
pub fn ComponentsData() -> Element {
    let columns = vec![
        components::table::ColumnDef::new("name", "Operator Name").sortable(true),
        components::table::ColumnDef::new("class", "Class"),
        components::table::ColumnDef::new("rarity", "Rarity").align(components::ColumnAlign::Center),
        components::table::ColumnDef::new("level", "Level").align(components::ColumnAlign::Center),
    ];

    let data = vec![
        vec!["Amiya".to_string(), "Guard".to_string(), "6".to_string(), "90".to_string()],
        vec!["SilverAsh".to_string(), "Guard".to_string(), "6".to_string(), "90".to_string()],
        vec!["Exusiai".to_string(), "Sniper".to_string(), "6".to_string(), "90".to_string()],
        vec!["Siege".to_string(), "Vanguard".to_string(), "6".to_string(), "80".to_string()],
        vec!["Myrtle".to_string(), "Vanguard".to_string(), "4".to_string(), "70".to_string()],
    ];

    rsx! {
        Layout {
            current_route: Route::ComponentsData {},

            h1 { class: "hi-text-3xl lg:text-4xl hi-font-bold mb-8 hi-text-dark-theme",
                "Data Components"
            }

            Section {
                title: "Table".to_string(),
                children: rsx! {
                    div { class: "hi-max-w-3xl overflow-x-auto",
                        Table {
                            columns: columns.clone(),
                            data: data.clone(),
                            bordered: true,
                            striped: true,
                            hoverable: true,
                        }
                    }
                }
            }

            Section {
                title: "Tree".to_string(),
                children: rsx! {
                    div { class: "hi-max-w-2xl hi-bg-white hi-p-5 hi-rounded-lg",
                        p { class: "hi-mb-4 hi-text-gray-600",
                            "Tree component demo (visual placeholder)"
                        }
                        div { class: "font-mono hi-text-gray-800",
                            div { class: "py-1", "📁 Root" }
                            div { class: "py-1 pl-6", "  📁 Branch 1" }
                            div { class: "py-1 pl-12", "    📄 Leaf 1.1" }
                            div { class: "py-1 pl-12", "    📄 Leaf 1.2" }
                            div { class: "py-1 pl-6", "  📁 Branch 2" }
                            div { class: "py-1 pl-12", "    📄 Leaf 2.1" }
                        }
                    }
                }
            }

            Section {
                title: "Advanced Table Features".to_string(),
                children: rsx! {
                    div { class: "hi-max-w-3xl overflow-x-auto",
                        Table {
                            columns: columns,
                            data: data,
                            size: components::TableSize::Small,
                            bordered: true,
                        }
                    }
                }
            }
        }
    }
}
