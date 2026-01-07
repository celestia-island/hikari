// demo-app/src/pages/components/feedback.rs
// Feedback components demonstration page with interactive demos

extern crate components as hikari_components;

use dioxus::prelude::*;
use components::{
    Alert, AlertVariant, Button, ButtonVariant, ButtonSize, Tooltip, Card, Input
};
use components::layout::{Container, Grid, Row, Section};

use crate::{app::Route, components::Layout};

#[component]
pub fn ComponentsFeedback() -> Element {
    // Toast state management
    let mut show_toast = use_signal(|| false);
    let mut toast_variant = use_signal(|| AlertVariant::Info);
    let mut toast_message = use_signal(|| "Default toast message".to_string());

    rsx! {
        Layout {
            current_route: Route::ComponentsFeedback {},

            Container {
                // Page header
                div {
                    class: "showcase-header",
                    h1 {
                        class: "showcase-title",
                        "Feedback Components"
                    }
                    p {
                        class: "showcase-description",
                        "Interactive feedback and notification components"
                    }
                }

                // Alerts Section
                Section {
                    title: "Alerts".to_string(),
                    description: "Alert components for displaying important messages to users.".to_string(),

                    Container {
                        max_width: "lg".to_string(),
                        class: "showcase-vertical-stack".to_string(),
                        Alert {
                            variant: AlertVariant::Info,
                            description: "This is an info alert message with important information.".to_string()
                        }
                        Alert {
                            variant: AlertVariant::Success,
                            description: "Operation completed successfully! Your changes have been saved.".to_string()
                        }
                        Alert {
                            variant: AlertVariant::Warning,
                            description: "Please review this warning message before proceeding.".to_string()
                        }
                        Alert {
                            variant: AlertVariant::Error,
                            description: "An error has occurred. Please try again later.".to_string()
                        }
                    }
                }

                // Toasts Section
                Section {
                    title: "Toast Notifications".to_string(),
                    description: "Click buttons below to trigger toast notifications:".to_string(),

                    // Toast trigger buttons
                    Row {
                        gap: "sm".to_string(),
                        Button {
                            variant: ButtonVariant::Primary,
                            onclick: move |_| {
                                toast_variant.set(AlertVariant::Info);
                                toast_message.set("This is an info toast notification".to_string());
                                show_toast.set(true);
                                // Note: Auto-hide functionality removed for simplicity
                            },
                            "Show Info Toast"
                        }
                        Button {
                            variant: ButtonVariant::Success,
                            onclick: move |_| {
                                toast_variant.set(AlertVariant::Success);
                                toast_message.set("Operation completed successfully!".to_string());
                                show_toast.set(true);
                            },
                            "Show Success Toast"
                        }
                        Button {
                            variant: ButtonVariant::Secondary,
                            onclick: move |_| {
                                toast_variant.set(AlertVariant::Warning);
                                toast_message.set("Please review this warning message".to_string());
                                show_toast.set(true);
                            },
                            "Show Warning Toast"
                        }
                        Button {
                            variant: ButtonVariant::Danger,
                            onclick: move |_| {
                                toast_variant.set(AlertVariant::Error);
                                toast_message.set("An error has occurred".to_string());
                                show_toast.set(true);
                            },
                            "Show Error Toast"
                        }
                    }

                    // Toast display (demo implementation)
                    if *show_toast.read() {
                        div {
                            class: format!(
                                "toast-notification toast-notification-{}",
                                match *toast_variant.read() {
                                    AlertVariant::Info => "info",
                                    AlertVariant::Success => "success",
                                    AlertVariant::Warning => "warning",
                                    AlertVariant::Error => "error",
                                }
                            ),

                            div {
                                class: "toast-content",
                                div {
                                    class: "toast-message",
                                    div {
                                        class: "toast-title",
                                        {match *toast_variant.read() {
                                            AlertVariant::Info => "Information",
                                            AlertVariant::Success => "Success",
                                            AlertVariant::Warning => "Warning",
                                            AlertVariant::Error => "Error",
                                        }}
                                    }
                                    div {
                                        class: "toast-text",
                                        "{toast_message.read().clone()}"
                                    }
                                }
                                button {
                                    class: "toast-close",
                                    onclick: move |_| show_toast.set(false),
                                    "✕"
                                }
                            }
                        }
                    }
                }

                // Tooltips Section
                Section {
                    title: "Tooltips".to_string(),
                    description: "Hover over elements to see tooltip content.".to_string(),

                    Row {
                        gap: "lg".to_string(),

                        // Basic tooltip
                        div {
                            class: "tooltip-wrapper",
                            Button {
                                "Hover me"
                            }
                            div {
                                class: "tooltip-content",
                                "This is a helpful tooltip"
                            }
                        }

                        // Tooltip with icon
                        div {
                            class: "tooltip-wrapper",
                            Button {
                                variant: ButtonVariant::Ghost,
                                "With Icon"
                            }
                            div {
                                class: "tooltip-content",
                                "Tooltip with icon ℹ️"
                            }
                        }
                    }
                }

                // Interactive Demo Section
                Section {
                    title: "Interactive Demo".to_string(),

                    Grid {
                        columns: 12,
                        gap: "lg".to_string(),

                        // Demo card 1
                        Card {
                            title: "Form Validation".to_string(),
                            div {
                                class: "demo-form-group",
                                Input {
                                    placeholder: "Enter email address..."
                                }
                            }
                            Row {
                                gap: "sm".to_string(),
                                Button {
                                    variant: ButtonVariant::Primary,
                                    onclick: move |_| {
                                        toast_variant.set(AlertVariant::Info);
                                        toast_message.set("Validating email...".to_string());
                                        show_toast.set(true);
                                    },
                                    "Validate"
                                }
                            }
                        }

                        // Demo card 2
                        Card {
                            title: "Action Feedback".to_string(),
                            div {
                                class: "demo-description",
                                "Click a button to see feedback"
                            }
                            div {
                                class: "showcase-vertical-stack",
                                Button {
                                    variant: ButtonVariant::Success,
                                    onclick: move |_| {
                                        toast_variant.set(AlertVariant::Success);
                                        toast_message.set("Changes saved successfully!".to_string());
                                        show_toast.set(true);
                                    },
                                    "Save Changes"
                                }
                                Button {
                                    variant: ButtonVariant::Danger,
                                    onclick: move |_| {
                                        toast_variant.set(AlertVariant::Error);
                                        toast_message.set("Failed to delete item".to_string());
                                        show_toast.set(true);
                                    },
                                    "Delete Item"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
