use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-component-table", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Table" }
                p { class: "page-header__subtitle",
                    "Structured data table with sorting indicators, bordered variants, and action columns."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic Table" }
                    div { class: "demo-block__body",
                        table { class: "hi-table",
                            thead { tr { th { "# " } th { "Name" } th { "Email" } th { "Role" } } }
                            tbody {
                                tr { td { "1" } td { "Alice Chen" } td { "alice@example.com" } td { "Admin" } }
                                tr { td { "2" } td { "Bob Martinez" } td { "bob@example.com" } td { "Editor" } }
                                tr { td { "3" } td { "Carol Wu" } td { "carol@example.com" } td { "Viewer" } }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Bordered Table" }
                    div { class: "demo-block__body",
                        table { class: "hi-table hi-table--bordered",
                            thead { tr { th { "Product" } th { "Category" } th { "Price" } } }
                            tbody {
                                tr { td { "Widget Pro" } td { "Electronics" } td { "$49.99" } }
                                tr { td { "Gadget Plus" } td { "Accessories" } td { "$19.99" } }
                                tr { td { "Tool Kit" } td { "Hardware" } td { "$89.99" } }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Striped Table" }
                    div { class: "demo-block__body",
                        table { class: "hi-table hi-table--striped",
                            thead { tr { th { "Date" } th { "Event" } th { "Location" } } }
                            tbody {
                                tr { td { "2025-04-01" } td { "Team Standup" } td { "Room A" } }
                                tr { td { "2025-04-02" } td { "Sprint Review" } td { "Room B" } }
                                tr { td { "2025-04-03" } td { "Design Workshop" } td { "Room C" } }
                                tr { td { "2025-04-04" } td { "Retrospective" } td { "Room A" } }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Table with Actions" }
                    div { class: "demo-block__body",
                        table { class: "hi-table hi-table--striped",
                            thead { tr { th { "Service" } th { "Status" } th { "Uptime" } th { "Actions" } } }
                            tbody {
                                tr { td { "API Gateway" } td { span { class: "hi-tag hi-tag--success", "Running" } } td { "99.9%" } td { button { class: "hi-button hi-button-ghost hi-button-sm", "Restart" } } }
                                tr { td { "Auth Service" } td { span { class: "hi-tag hi-tag--success", "Running" } } td { "99.8%" } td { button { class: "hi-button hi-button-ghost hi-button-sm", "Restart" } } }
                                tr { td { "Worker Pool" } td { span { class: "hi-tag hi-tag--danger", "Down" } } td { "0%" } td { button { class: "hi-button hi-button-primary hi-button-sm", "Fix" } } }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                            tbody {
                                tr { td { code { "bordered" } } td { code { "bool" } } td { code { "false" } } td { "Show cell borders" } }
                                tr { td { code { "striped" } } td { code { "bool" } } td { code { "false" } } td { "Alternate row backgrounds" } }
                                tr { td { code { "compact" } } td { code { "bool" } } td { code { "false" } } td { "Reduce padding for dense data" } }
                                tr { td { code { "hoverable" } } td { code { "bool" } } td { code { "true" } } td { "Highlight row on hover" } }
                                tr { td { code { "scroll" } } td { code { "bool" } } td { code { "false" } } td { "Enable horizontal scroll for overflow" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
