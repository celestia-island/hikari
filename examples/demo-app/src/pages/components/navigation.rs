// demo-app/src/pages/navigation_components.rs
// Navigation components demonstration page

use dioxus::prelude::*;

use crate::{app::Route, components::{Layout, Section}};

#[component]
pub fn ComponentsNavigation() -> Element {
    rsx! {
        Layout {
            current_route: Route::ComponentsNavigation {},

            h1 { class: "hi-text-3xl lg:text-4xl hi-font-bold mb-8 hi-text-dark-theme",
                "Navigation Components"
            }

            Section {
                title: "Menu".to_string(),
                children: rsx! {
                    p { class: "hi-text-gray-600", "Menu component - inline demo for showcase" }
                    div { class: "hi-bg-white hi-rounded-lg hi-p-5 max-w-xs",
                        div { class: "hi-flex hi-flex-col hi-gap-2",
                            div { class: "px-2.5 py-2.5 hi-rounded-lg bg-[#4a9eff] hi-text-white hi-cursor-pointer",
                                "Menu Item 1 (Active)"
                            }
                            div { class: "px-2.5 py-2.5 hi-rounded-lg hi-cursor-pointer hi-hover:bg-gray-100",
                                "Menu Item 2"
                            }
                            div { class: "px-2.5 py-2.5 hi-rounded-lg hi-cursor-pointer hi-hover:bg-gray-100",
                                "Menu Item 3"
                            }
                        }
                    }
                }
            }

            Section {
                title: "Tabs".to_string(),
                children: rsx! {
                    div { class: "hi-max-w-2xl",
                        div { class: "border-b-2 hi-border-gray-200 hi-flex gap-6",
                            div { class: "px-6 py-3 hi-cursor-pointer border-b-2 border-[#4a9eff] hi-text-primary-light -mb-0.5",
                                "Tab 1"
                            }
                            div { class: "px-6 py-3 hi-cursor-pointer hi-text-gray-600 hover:text-gray-800",
                                "Tab 2"
                            }
                            div { class: "px-6 py-3 hi-cursor-pointer hi-text-gray-600 hover:text-gray-800",
                                "Tab 3"
                            }
                        }
                        div { class: "hi-p-6 hi-bg-white mt-4 rounded-r-lg rounded-b-lg rounded-bl-lg",
                            "Tab 1 content - Active tab panel"
                        }
                    }
                }
            }

            Section {
                title: "Breadcrumb".to_string(),
                children: rsx! {
                    div { class: "hi-flex hi-items-center hi-gap-2 hi-text-gray-600",
                        span { "Home" }
                        span { class: "hi-text-gray-400", "/" }
                        span { "Components" }
                        span { class: "hi-text-gray-400", "/" }
                        span { class: "hi-text-primary-light hi-font-medium", "Navigation" }
                    }
                }
            }
        }
    }
}
