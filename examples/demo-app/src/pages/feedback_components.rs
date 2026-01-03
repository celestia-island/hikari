// demo-app/src/pages/feedback_components.rs
// Feedback components demonstration page

use dioxus::prelude::*;
use hikari_components::*;

use crate::{app::Route, components::{Layout, Section}};

#[component]
pub fn FeedbackComponents() -> Element {
    rsx! {
        Layout {
            current_route: Route::FeedbackComponents {},

            h1 { class: "text-3xl lg:text-4xl font-bold mb-8 text-[#1a1a2e]",
                "Feedback Components"
            }

            Section {
                title: "Alerts".to_string(),
                children: rsx! {
                    div { class: "flex flex-col gap-3 max-w-2xl",
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
                    div { class: "flex flex-wrap gap-3",
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
                    p { class: "mt-3 text-gray-600 text-sm",
                        "Click buttons to show toast notifications (console log for demo)"
                    }
                }
            }

            Section {
                title: "Tooltips".to_string(),
                children: rsx! {
                    div { class: "flex flex-wrap gap-3 items-center",
                        div { class: "inline-block",
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
