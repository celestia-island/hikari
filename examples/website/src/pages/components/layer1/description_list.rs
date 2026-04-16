use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-component-description-list", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Description List" }
                p { class: "page-header__subtitle",
                    "Key-value pair display for metadata, configurations, and detail panels."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic Description List" }
                    div { class: "demo-block__body",
                        dl { class: "hi-description-list",
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "Name" }
                                dd { class: "hi-description-list__detail", "Hikari UI" }
                            }
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "Version" }
                                dd { class: "hi-description-list__detail", "2.4.0" }
                            }
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "License" }
                                dd { class: "hi-description-list__detail", "MIT" }
                            }
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "Author" }
                                dd { class: "hi-description-list__detail", "Tairitsu Team" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Project Metadata" }
                    div { class: "demo-block__body",
                        dl { class: "hi-description-list hi-description-list--horizontal",
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "Repository" }
                                dd { class: "hi-description-list__detail", "github.com/tairitsu/hikari" }
                            }
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "Language" }
                                dd { class: "hi-description-list__detail", "Rust" }
                            }
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "Framework" }
                                dd { class: "hi-description-list__detail", "Tauri + WebAssembly" }
                            }
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "Stars" }
                                dd { class: "hi-description-list__detail", "1,234" }
                            }
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "Last Release" }
                                dd { class: "hi-description-list__detail", "2025-04-15" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "With Tags" }
                    div { class: "demo-block__body",
                        dl { class: "hi-description-list",
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "Status" }
                                dd { class: "hi-description-list__detail",
                                    span { class: "hi-tag hi-tag--success", "Active" }
                                }
                            }
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "Priority" }
                                dd { class: "hi-description-list__detail",
                                    span { class: "hi-tag hi-tag--danger", "High" }
                                }
                            }
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "Tags" }
                                dd { class: "hi-description-list__detail",
                                    span { class: "hi-tag hi-tag--primary", "UI" }
                                    span { class: "hi-tag hi-tag--warning", "WIP" }
                                    span { class: "hi-tag", "v2" }
                                }
                            }
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "Assignee" }
                                dd { class: "hi-description-list__detail",
                                    div { style: "display:flex;align-items:center;gap:8px;",
                                        div { class: "hi-avatar hi-avatar--primary hi-avatar--xs", "A" }
                                        span { "Alice Chen" }
                                    }
                                }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Bordered Style" }
                    div { class: "demo-block__body",
                        dl { class: "hi-description-list hi-description-list--bordered",
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "CPU Usage" }
                                dd { class: "hi-description-list__detail", "23%" }
                            }
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "Memory" }
                                dd { class: "hi-description-list__detail", "512 MB / 4 GB" }
                            }
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "Disk" }
                                dd { class: "hi-description-list__detail", "128 GB / 256 GB" }
                            }
                            div { class: "hi-description-list__item",
                                dt { class: "hi-description-list__term", "Uptime" }
                                dd { class: "hi-description-list__detail", "42 days" }
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
                                tr { td { code { "layout" } } td { code { "vertical | horizontal" } } td { code { "vertical" } } td { "Term-detail alignment" } }
                                tr { td { code { "bordered" } } td { code { "bool" } } td { code { "false" } } td { "Show borders between items" } }
                                tr { td { code { "colon" } } td { code { "bool" } } td { code { "true" } } td { "Show colon after term" } }
                                tr { td { code { "size" } } td { code { "small | default | large" } } td { code { "default" } } td { "Font and spacing size" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
