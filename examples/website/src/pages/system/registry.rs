// website/src/pages/system/registry.rs
// Component Registry System - Dynamic component documentation and rendering

use dioxus::prelude::*;

use crate::components::registry::{render_component, ComponentType};

/// Component Registry System Page
/// Demonstrates the MDX-like code block system for dynamic component rendering
#[component]
pub fn ComponentRegistry() -> Element {
    rsx! {
        crate::components::Layout {
            current_route: crate::app::Route::SystemOverview {},
            div {
                class: "page-container",

                // Header
                div {
                    class: "page-header",
                    h1 {
                        class: "page-title",
                        "Component Registry System"
                    }
                    p {
                        class: "page-description",
                        "MDX-like dynamic component documentation system"
                    }
                }

                // Introduction
                div {
                    class: "section",
                    h2 { "System Overview" }

                    p { "This system allows documentation to include interactive code blocks similar to MDX:" }

                    pre {
                        class: "code-block",
                        "```_inner_hikari\npages/components/layer1/basic\n```"
                    }

                    p { "The above block will dynamically render the component:" }

                    div { {render_component(ComponentType::Layer("layer1".to_string(), "basic".to_string(), None))} }
                }

                // Component Registry Table
                div {
                    class: "section",
                    h2 { "Available Components" }

                    // Layer 1 Components
                    h3 { "Layer 1: Basic Components" }
                    table {
                        class: "component-table",
                        thead {
                            tr {
                                th { "Path" }
                                th { "Category" }
                                th { "Name" }
                                th { "Status" }
                            }
                        }
                        tbody {
                            tr {
                                td { "layer1" }
                                td { "basic" }
                                td { { "Basic" } }
                                td { class: "status-badge status-ok", "✅" }
                            }
                            tr {
                                td { "layer1" }
                                td { "display" }
                                td { { "Display" } }
                                td { class: "status-badge status-ok", "✅" }
                            }
                            tr {
                                td { "layer1" }
                                td { "form" }
                                td { { "Form" } }
                                td { class: "status-badge status-ok", "✅" }
                            }
                            tr {
                                td { "layer1" }
                                td { "feedback" }
                                td { { "Feedback" } }
                                td { class: "status-badge status-ok", "✅" }
                            }
                            tr {
                                td { "layer1" }
                                td { "switch" }
                                td { { "Switch" } }
                                td { class: "status-badge status-ok", "✅" }
                            }
                        }
                    }

                    // Layer 2 Components
                    h3 { "Layer 2: Composite Components" }
                    table {
                        class: "component-table",
                        thead {
                            tr {
                                th { "Path" }
                                th { "Category" }
                                th { "Name" }
                                th { "Status" }
                            }
                        }
                        tbody {
                            tr {
                                td { "layer2" }
                                td { "navigation" }
                                td { { "Navigation" } }
                                td { class: "status-badge status-ok", "✅" }
                            }
                            tr {
                                td { "layer2" }
                                td { "data" }
                                td { { "Data" } }
                                td { class: "status-badge status-ok", "✅" }
                            }
                            tr {
                                td { "layer2" }
                                td { "form" }
                                td { { "Form" } }
                                td { class: "status-badge status-ok", "✅" }
                            }
                            tr {
                                td { "layer2" }
                                td { "feedback" }
                                td { { "Feedback" } }
                                td { class: "status-badge status-ok", "✅" }
                            }
                        }
                    }

                    // Layer 3 Components
                    h3 { "Layer 3: Production-Grade Components" }
                    table {
                        class: "component-table",
                        thead {
                            tr {
                                th { "Path" }
                                th { "Category" }
                                th { "Name" }
                                th { "Status" }
                            }
                        }
                        tbody {
                            tr {
                                td { "layer3" }
                                td { "media" }
                                td { { "Media" } }
                                td { class: "status-badge status-ok", "✅" }
                            }
                            tr {
                                td { "layer3" }
                                td { "editor" }
                                td { { "Editor" } }
                                td { class: "status-badge status-ok", "✅" }
                            }
                            tr {
                                td { "layer3" }
                                td { "visualization" }
                                td { { "Visualization" } }
                                td { class: "status-badge status-ok", "✅" }
                            }
                        }
                    }

                    // Demo Components
                    h3 { "Demo Components" }
                    table {
                        class: "component-table",
                        thead {
                            tr {
                                th { "Path" }
                                th { "Category" }
                                th { "Name" }
                                th { "Status" }
                            }
                        }
                        tbody {
                            tr {
                                td { "demos/layer1" }
                                td { "form_demo" }
                                td { { "Form Demo" } }
                                td { class: "status-badge status-ok", "✅" }
                            }
                            tr {
                                td { "demos/layer1" }
                                td { "auth_demo" }
                                td { { "Auth Demo" } }
                                td { class: "status-badge status-pending", "🚧" }
                            }
                            tr {
                                td { "demos/layer1" }
                                td { "gallery_demo" }
                                td { { "Gallery Demo" } }
                                td { class: "status-badge status-pending", "🚧" }
                            }
                        }
                    }

                    // Usage Example
                    div {
                        class: "section",
                        h2 { "Usage Example" }

                        p { "To reference components in documentation:" }

                        pre {
                            class: "code-block",
                            "```_inner_hikari\npages/components/layer2/form\n```"
                        }

                        p { "This will render the form component:" }

                        div { {render_component(ComponentType::Layer("layer2".to_string(), "form".to_string(), None))} }
                    }
                }
            }
        }
    }
}
