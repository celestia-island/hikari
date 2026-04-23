use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-table", "Table", "Structured data table with sorting indicators, bordered variants, and action columns.", rsx! {
        render_demo_block("Basic Table", rsx! {
            table { class: "hi-table",
                thead { tr { th { "# " } th { "Name" } th { "Email" } th { "Role" } } }
                tbody {
                    tr { td { "1" } td { "Alice Chen" } td { "alice@example.com" } td { "Admin" } }
                    tr { td { "2" } td { "Bob Martinez" } td { "bob@example.com" } td { "Editor" } }
                    tr { td { "3" } td { "Carol Wu" } td { "carol@example.com" } td { "Viewer" } }
                }
            }
        })
        render_demo_block("Bordered Table", rsx! {
            table { class: "hi-table hi-table--bordered",
                thead { tr { th { "Product" } th { "Category" } th { "Price" } } }
                tbody {
                    tr { td { "Widget Pro" } td { "Electronics" } td { "$49.99" } }
                    tr { td { "Gadget Plus" } td { "Accessories" } td { "$19.99" } }
                    tr { td { "Tool Kit" } td { "Hardware" } td { "$89.99" } }
                }
            }
        })
        render_demo_block("Striped Table", rsx! {
            table { class: "hi-table hi-table--striped",
                thead { tr { th { "Date" } th { "Event" } th { "Location" } } }
                tbody {
                    tr { td { "2025-04-01" } td { "Team Standup" } td { "Room A" } }
                    tr { td { "2025-04-02" } td { "Sprint Review" } td { "Room B" } }
                    tr { td { "2025-04-03" } td { "Design Workshop" } td { "Room C" } }
                    tr { td { "2025-04-04" } td { "Retrospective" } td { "Room A" } }
                }
            }
        })
        render_demo_block("Table with Actions", rsx! {
            table { class: "hi-table hi-table--striped",
                thead { tr { th { "Service" } th { "Status" } th { "Uptime" } th { "Actions" } } }
                tbody {
                    tr { td { "API Gateway" } td { span { class: "hi-tag hi-tag--success", "Running" } } td { "99.9%" } td { button { class: "hi-button hi-button-ghost hi-button-sm", "Restart" } } }
                    tr { td { "Auth Service" } td { span { class: "hi-tag hi-tag--success", "Running" } } td { "99.8%" } td { button { class: "hi-button hi-button-ghost hi-button-sm", "Restart" } } }
                    tr { td { "Worker Pool" } td { span { class: "hi-tag hi-tag--danger", "Down" } } td { "0%" } td { button { class: "hi-button hi-button-primary hi-button-sm", "Fix" } } }
                }
            }
        })
        render_demo_block("API", rsx! {
            {render_api_table(&[
                ("bordered", "bool", "false", "Show cell borders"),
                ("striped", "bool", "false", "Alternate row backgrounds"),
                ("compact", "bool", "false", "Reduce padding for dense data"),
                ("hoverable", "bool", "true", "Highlight row on hover"),
                ("scroll", "bool", "false", "Enable horizontal scroll for overflow"),
            ])}
        })
    })
}
