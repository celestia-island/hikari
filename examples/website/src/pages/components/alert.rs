// website/src/pages/components/alert.rs
// Alert component showcase page with real rendered examples

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{Alert, AlertVariant, Button, ButtonVariant, layout::{Container, Row, Section}};
use _icons::{Icon, MdiIcon};
use _palette::classes::{ ClassesBuilder, FontSize, FontWeight, MarginBottom, Padding, PaddingLeft, TextColor, };

#[allow(non_snake_case)]
pub fn ComponentsAlert() -> Element {
    rsx! {
        Layout { current_route: Route::ComponentsFeedback {},

            Container {
                // Page header
                div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::default()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Alert"
                    }
                    p { class: ClassesBuilder::default().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "Inline alert messages for feedback and notifications with FUI aesthetics"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                        p { "Alerts display important messages to users. They support:" }
                        ul { class: ClassesBuilder::default().add(PaddingLeft::Pl6).add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Multiple variants" }
                                " - Info, Success, Warning, Error"
                            }
                            li {
                                strong { "Customizable content" }
                                " - Title and description"
                            }
                            li {
                                strong { "Optional close button" }
                                " - Closable alerts"
                            }
                            li {
                                strong { "Custom icons" }
                                " - Override default icons"
                            }
                        }
                    }
                }

                // Alert Variants
                Section {
                    title: Some("Alert Variants".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Info Alert"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Used for informational messages"
                        }
                        Alert {
                            variant: AlertVariant::Info,
                            title: Some("Information".to_string()),
                            description: Some("This is an informational message for the user.".to_string()),
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Success Alert"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Used to indicate successful operations"
                        }
                        Alert {
                            variant: AlertVariant::Success,
                            title: Some("Success".to_string()),
                            description: Some("Your changes have been saved successfully.".to_string()),
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Warning Alert"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Used for warning messages that need attention"
                        }
                        Alert {
                            variant: AlertVariant::Warning,
                            title: Some("Warning".to_string()),
                            description: Some("Please review your input before proceeding.".to_string()),
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Error Alert"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Used for error messages and failures"
                        }
                        Alert {
                            variant: AlertVariant::Error,
                            title: Some("Error".to_string()),
                            description: Some("An error occurred while processing your request.".to_string()),
                        }
                    }
                }

                // Simple Alerts
                Section {
                    title: Some("Simple Alerts".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Alerts without Title"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Minimal alerts with only description text"
                        }
                        div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            Alert {
                                variant: AlertVariant::Info,
                                description: Some("New version available. Click to update.".to_string()),
                            }
                            Alert {
                                variant: AlertVariant::Success,
                                description: Some("All systems operational.".to_string()),
                            }
                            Alert {
                                variant: AlertVariant::Warning,
                                description: Some("Your session will expire in 5 minutes.".to_string()),
                            }
                        }
                    }
                }

                // Closable Alerts
                Section {
                    title: Some("Closable Alerts".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Close Button"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Alerts can be dismissed by clicking the close button"
                        }
                        div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            Alert {
                                variant: AlertVariant::Info,
                                title: Some("Update Available".to_string()),
                                description: Some("A new version is ready to install.".to_string()),
                                closable: true,
                            }
                            Alert {
                                variant: AlertVariant::Success,
                                title: Some("Complete".to_string()),
                                description: Some("Operation finished successfully.".to_string()),
                                closable: true,
                            }
                            Alert {
                                variant: AlertVariant::Warning,
                                title: Some("Attention Required".to_string()),
                                description: Some("Please verify your information.".to_string()),
                                closable: true,
                            }
                        }
                    }
                }

                // Custom Icons
                Section {
                    title: Some("Custom Icons".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Alerts with Custom Icons"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "You can override the default icon with custom content"
                        }
                        div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            Alert {
                                variant: AlertVariant::Info,
                                title: Some("New Message".to_string()),
                                description: Some("You have received a new message.".to_string()),
                                icon: rsx! {
                                    Icon { icon: MdiIcon::Alert, size: 20 }
                                },
                            }
                            Alert {
                                variant: AlertVariant::Success,
                                title: Some("Download Complete".to_string()),
                                description: Some("Your file is ready.".to_string()),
                                icon: rsx! {
                                    Icon { icon: MdiIcon::Alert, size: 20 }
                                },
                            }
                            Alert {
                                variant: AlertVariant::Warning,
                                title: Some("Storage Warning".to_string()),
                                description: Some("You're running low on disk space.".to_string()),
                                icon: rsx! {
                                    Icon { icon: MdiIcon::Alert, size: 20 }
                                },
                            }
                        }
                    }
                }

                // Usage Examples
                Section {
                    title: Some("Usage Examples".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Alert"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P4).add_raw("bg-gray-900").add_raw("rounded").build(),
                            code {
                                r#"Alert {{
    variant: AlertVariant::Info,
    title: Some("Information".to_string()),
    description: Some("This is an info message.".to_string()),
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Closable Alert with Handler"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P4).add_raw("bg-gray-900").add_raw("rounded").build(),
                            code {
                                r#"let mut show_alert = use_signal(|| true);

Alert {{
    variant: AlertVariant::Success,
    title: Some("Success".to_string()),
    description: Some("Operation completed!".to_string()),
    closable: true,
    on_close: move |_| show_alert.set(false),
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Alert with Custom Icon"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P4).add_raw("bg-gray-900").add_raw("rounded").build(),
                            code {
                                r#"Alert {{
    variant: AlertVariant::Warning,
    title: Some("Warning".to_string()),
    description: Some("Custom icon alert.".to_string()),
    icon: rsx! {{
        Icon {{ icon: MdiIcon::Alert }}
    }},
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Simple Alert"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P4).add_raw("bg-gray-900").add_raw("rounded").build(),
                            code {
                                r#"Alert {{
    variant: AlertVariant::Info,
    description: Some("Simple info message.".to_string()),
}}"#
                            }
                        }
                    }
                }

                // Common Patterns
                Section {
                    title: Some("Common Patterns".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Form Validation"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Use alerts to show form validation errors"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                                Alert {
                                    variant: AlertVariant::Error,
                                    title: Some("Form Errors".to_string()),
                                    description: Some("Please fix the following issues:".to_string()),
                                    closable: true,
                                }
                                div { class: ClassesBuilder::new().add(TextColor::Secondary).add(MarginBottom::Mb4).build(),
                                    ul {
                                        li { "Email address is required" }
                                        li { "Password must be at least 8 characters" }
                                    }
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Success Feedback"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Confirm successful actions to users"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                                Alert {
                                    variant: AlertVariant::Success,
                                    title: Some("Settings Saved".to_string()),
                                    description: Some("Your preferences have been updated.".to_string()),
                                    closable: true,
                                }
                                Row { gap: "md".to_string(),
                                    Button { variant: ButtonVariant::Primary, "Continue" }
                                    Button { variant: ButtonVariant::Ghost, "View Settings" }
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "System Status"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Display system status or maintenance notifications"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            Alert {
                                variant: AlertVariant::Warning,
                                title: Some("Scheduled Maintenance".to_string()),
                                description: Some(
                                    "System maintenance will occur on Sunday from 2:00 AM to 4:00 AM UTC. Some features may be unavailable."
                                        .to_string(),
                                ),
                                closable: true,
                            }
                        }
                    }
                }
            }
        }
    }
}
