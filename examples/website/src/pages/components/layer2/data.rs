use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};

pub fn render() -> VNode {
    render_demo_page("page-component-data", "Data", "Tables, lists, and data grids for displaying structured information.", rsx! [
        {render_demo_block("Striped Table", rsx! {
            table { class: "hi-table hi-table--striped",
                thead { tr { th { "Name" } th { "Age" } th { "Role" } th { "Status" } } }
                tbody {
                    tr { td { "Alice" } td { "28" } td { "Engineer" } td { span { class: "hi-tag hi-tag--success", "Active" } } }
                    tr { td { "Bob" } td { "35" } td { "Designer" } td { span { class: "hi-tag hi-tag--success", "Active" } } }
                    tr { td { "Carol" } td { "42" } td { "Manager" } td { span { class: "hi-tag hi-tag--warning", "Away" } } }
                }
            }
        })}
        {render_demo_block("Basic List", rsx! {
            ul { class: "hi-list",
                li { class: "hi-list__item",
                    div { class: "hi-list__title", "Project Alpha" }
                    div { class: "hi-list__meta", "Updated 2 hours ago" }
                }
                li { class: "hi-list__item",
                    div { class: "hi-list__title", "Project Beta" }
                    div { class: "hi-list__meta", "Updated yesterday" }
                }
                li { class: "hi-list__item",
                    div { class: "hi-list__title", "Project Gamma" }
                    div { class: "hi-list__meta", "Updated 3 days ago" }
                }
            }
        })}
        {render_demo_block("Data List with Avatars", rsx! {
            ul { class: "hi-list",
                li { class: "hi-list__item",
                    div { class: "hi-list__item--avatar",
                        div { class: "hi-avatar hi-avatar--primary hi-avatar--sm", "A" }
                        div { class: "hi-list__item--body",
                            div { class: "hi-list__title", "Alice Chen" }
                            div { class: "hi-list__meta", "Lead Engineer · San Francisco" }
                        }
                        span { class: "hi-tag hi-tag--success", "Online" }
                    }
                }
                li { class: "hi-list__item",
                    div { class: "hi-list__item--avatar",
                        div { class: "hi-avatar hi-avatar--danger hi-avatar--sm", "B" }
                        div { class: "hi-list__item--body",
                            div { class: "hi-list__title", "Bob Martinez" }
                            div { class: "hi-list__meta", "Senior Designer · New York" }
                        }
                        span { class: "hi-tag hi-tag--warning", "Busy" }
                    }
                }
            }
        })}
        {render_demo_block("API", rsx! {
            div {
                {render_api_table(&[
                    ("Table", "striped", "bool", "Alternate row background colors"),
                    ("Table", "bordered", "bool", "Show cell borders"),
                    ("Table", "compact", "bool", "Reduce cell padding"),
                    ("List", "split", "bool", "Show dividers between items"),
                    ("List", "loading", "bool", "Show loading skeleton"),
                ])}
            }
        })}
    ])
}
