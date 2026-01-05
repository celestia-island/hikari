// demo-app/src/pages/feedback_components.rs
// Feedback components demonstration page

use dioxus::prelude::*;
use components::*;

use crate::{app::Route, components::{Layout, Section}};

#[component]
pub fn ComponentsFeedback() -> Element {
    rsx! {
        Layout {
            current_route: Route::ComponentsFeedback {},

            h1 { class: "hi-text-3xl lg:text-4xl hi-font-bold mb-8 hi-text-dark-theme",
                "Feedback Components"
            }

            Section {
                title: "Alerts".to_string(),
                children: rsx! {
                    div { class: "hi-flex hi-flex-col gap-3 hi-max-w-2xl",
                        Alert { variant: AlertVariant::Info, description: "This is an info alert message.".to_string() }
                        Alert { variant: AlertVariant::Success, description: "Operation completed successfully!".to_string() }
                        Alert { variant: AlertVariant::Warning, description: "Please review this warning message.".to_string() }
                        Alert { variant: AlertVariant::Error, description: "An error has occurred.".to_string() }
                    }
                }
            }

            Section {
                title: "Toasts".to_string(),
                children: rsx! {
                    div { class: "hi-flex hi-flex-wrap gap-3",
                        Button {
                            onclick: |_| println!("Show info toast"),
                            "Show Info Toast"
                        }
                        Button {
                            onclick: |_| println!("Show success toast"),
                            "Show Success Toast"
                        }
                        Button {
                            onclick: |_| println!("Show warning toast"),
                            "Show Warning Toast"
                        }
                    }
                    p { class: "mt-3 hi-text-gray-600 hi-text-sm",
                        "Click buttons to show toast notifications (console log for demo)"
                    }
                }
            }

            Section {
                title: "Tooltips".to_string(),
                children: rsx! {
                    div { class: "hi-flex hi-flex-wrap gap-3 hi-items-center",
                        div { class: "hi-inline-block",
                            Tooltip { content: "This is a helpful tooltip".to_string(),
                                Button { "Hover me" }
                            }
                        }
                        Button { "Button with tooltip coming soon" }
                    }
                }
            }
        }
    }
}
