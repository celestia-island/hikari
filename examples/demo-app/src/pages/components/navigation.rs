// demo-app/src/pages/navigation_components.rs
// Navigation components demonstration page

use dioxus::prelude::*;

use crate::{app::Route, components::{Layout, Section}};

#[component]
pub fn ComponentsNavigation() -> Element {
    rsx! {
        Layout {
            current_route: Route::ComponentsNavigation {},

            h1 { class: "text-3xl lg:text-4xl font-bold mb-8 text-[#1a1a2e]",
                "Navigation Components"
            }

            Section {
                title: "Menu".to_string(),
                children: rsx! {
                    p { class: "text-gray-600", "Menu component - inline demo for showcase" }
                    div { class: "bg-white rounded-lg p-5 max-w-xs",
                        div { class: "flex flex-col gap-2",
                            div { class: "px-2.5 py-2.5 rounded-lg bg-[#4a9eff] text-white cursor-pointer",
                                "Menu Item 1 (Active)"
                            }
                            div { class: "px-2.5 py-2.5 rounded-lg cursor-pointer hover:bg-gray-100",
                                "Menu Item 2"
                            }
                            div { class: "px-2.5 py-2.5 rounded-lg cursor-pointer hover:bg-gray-100",
                                "Menu Item 3"
                            }
                        }
                    }
                }
            }

            Section {
                title: "Tabs".to_string(),
                children: rsx! {
                    div { class: "max-w-2xl",
                        div { class: "border-b-2 border-gray-200 flex gap-6",
                            div { class: "px-6 py-3 cursor-pointer border-b-2 border-[#4a9eff] text-[#4a9eff] -mb-0.5",
                                "Tab 1"
                            }
                            div { class: "px-6 py-3 cursor-pointer text-gray-600 hover:text-gray-800",
                                "Tab 2"
                            }
                            div { class: "px-6 py-3 cursor-pointer text-gray-600 hover:text-gray-800",
                                "Tab 3"
                            }
                        }
                        div { class: "p-6 bg-white mt-4 rounded-r-lg rounded-b-lg rounded-bl-lg",
                            "Tab 1 content - Active tab panel"
                        }
                    }
                }
            }

            Section {
                title: "Breadcrumb".to_string(),
                children: rsx! {
                    div { class: "flex items-center gap-2 text-gray-600",
                        span { "Home" }
                        span { class: "text-gray-400", "/" }
                        span { "Components" }
                        span { class: "text-gray-400", "/" }
                        span { class: "text-[#4a9eff] font-medium", "Navigation" }
                    }
                }
            }
        }
    }
}
