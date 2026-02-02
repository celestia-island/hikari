// website/src/components/doc_components.rs
// Documentation components

use dioxus::prelude::*;

/// Section component for documentation pages
#[component]
pub fn Section(title: String, content: Element) -> Element {
    rsx! {
        div {
            class: "section mb-12",
            h2 { class: "text-2xl font-bold mb-4", "{title}" }
            {content}
        }
    }
}

/// PropsRow struct for PropsTable
#[derive(Clone, PartialEq, Props)]
pub struct PropsRow {
    pub name: String,
    pub prop_type: String,
    pub default: String,
    pub description: String,
    pub required: bool,
}

/// PropsTableProps for PropsTable component
#[derive(Clone, PartialEq, Props)]
pub struct PropsTableProps {
    pub props: Vec<PropsRow>,
}

/// PropsTable component for displaying component props
#[component]
pub fn PropsTable(props: PropsTableProps) -> Element {
    rsx! {
        div {
            class: "props-table overflow-x-auto",
            table {
                class: "min-w-full divide-y divide-gray-200",
                thead {
                    class: "bg-gray-50",
                    tr {
                        th { class: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", "Name" }
                        th { class: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", "Type" }
                        th { class: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", "Default" }
                        th { class: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", "Description" }
                        th { class: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", "Required" }
                    }
                }
                tbody {
                    class: "bg-white divide-y divide-gray-200",
                    for prop in props.props.iter() {
                        tr {
                            td { class: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 font-mono", "{prop.name}" }
                            td { class: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono", "{prop.prop_type}" }
                            td { class: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono", "{prop.default}" }
                            td { class: "px-6 py-4 text-sm text-gray-500", "{prop.description}" }
                            td { class: "px-6 py-4 whitespace-nowrap text-sm",
                                if prop.required {
                                    span { class: "px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800", "Required" }
                                } else {
                                    span { class: "px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800", "Optional" }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/// ExampleCard component for showing code examples
#[component]
pub fn ExampleCard(title: String, description: String, code: String, preview: Element) -> Element {
    rsx! {
        div {
            class: "example-card mb-6",
            div {
                class: "border rounded-lg overflow-hidden",
                div {
                    class: "p-4 border-b",
                    h3 { class: "text-lg font-semibold mb-2", "{title}" }
                    p { class: "text-gray-600 text-sm", "{description}" }
                }
                div {
                    class: "p-4 bg-gray-50",
                    h4 { class: "text-sm font-medium mb-2", "Code" }
                    pre { class: "bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm font-mono", "{code}" }
                }
                div {
                    class: "p-4",
                    h4 { class: "text-sm font-medium mb-2", "Preview" }
                    div { class: "preview", {preview} }
                }
            }
        }
    }
}
