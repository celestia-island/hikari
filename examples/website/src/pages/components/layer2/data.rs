use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-component-data", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Data" }
                p { class: "page-header__subtitle",
                    "Tables, lists, and data grids for displaying structured information."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Striped Table" }
                    div { class: "demo-block__body",
                        table { class: "hi-table hi-table--striped",
                            thead { tr { th { "Name" } th { "Age" } th { "Role" } th { "Status" } } }
                            tbody {
                                tr { td { "Alice" } td { "28" } td { "Engineer" } td { span { class: "hi-tag hi-tag--success", "Active" } } }
                                tr { td { "Bob" } td { "35" } td { "Designer" } td { span { class: "hi-tag hi-tag--success", "Active" } } }
                                tr { td { "Carol" } td { "42" } td { "Manager" } td { span { class: "hi-tag hi-tag--warning", "Away" } } }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic List" }
                    div { class: "demo-block__body",
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
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Data List with Avatars" }
                    div { class: "demo-block__body",
                        ul { class: "hi-list",
                            li { class: "hi-list__item",
                                div { style: "display:flex;align-items:center;gap:12px;",
                                    div { class: "hi-avatar hi-avatar--primary hi-avatar--sm", "A" }
                                    div { style: "flex:1;",
                                        div { class: "hi-list__title", "Alice Chen" }
                                        div { class: "hi-list__meta", "Lead Engineer · San Francisco" }
                                    }
                                    span { class: "hi-tag hi-tag--success", "Online" }
                                }
                            }
                            li { class: "hi-list__item",
                                div { style: "display:flex;align-items:center;gap:12px;",
                                    div { class: "hi-avatar hi-avatar--danger hi-avatar--sm", "B" }
                                    div { style: "flex:1;",
                                        div { class: "hi-list__title", "Bob Martinez" }
                                        div { class: "hi-list__meta", "Senior Designer · New York" }
                                    }
                                    span { class: "hi-tag hi-tag--warning", "Busy" }
                                }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Component" } th { "Property" } th { "Type" } th { "Description" } } }
                            tbody {
                                tr { td { code { "Table" } } td { code { "striped" } } td { code { "bool" } } td { "Alternate row background colors" } }
                                tr { td { code { "Table" } } td { code { "bordered" } } td { code { "bool" } } td { "Show cell borders" } }
                                tr { td { code { "Table" } } td { code { "compact" } } td { code { "bool" } } td { "Reduce cell padding" } }
                                tr { td { code { "List" } } td { code { "split" } } td { code { "bool" } } td { "Show dividers between items" } }
                                tr { td { code { "List" } } td { code { "loading" } } td { code { "bool" } } td { "Show loading skeleton" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
