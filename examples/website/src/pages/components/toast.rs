// website/src/pages/components/toast.rs
// Toast component showcase page with documentation

extern crate components as hikari_components;

use dioxus::prelude::*;
use components::{
    Toast, ToastVariant, ToastPosition,
    layout::{Container, Section}
};
use palette::classes::{
    ClassesBuilder, MarginBottom, FontSize, FontWeight, TextColor,
    Padding, PaddingLeft, Margin, Display, FlexDirection, Gap,
    BgColor, BorderRadius,
};

use crate::{app::Route, components::Layout};

#[allow(non_snake_case)]
pub fn ComponentsToast() -> Element {
    rsx! {
        Layout { current_route: Route::ComponentsFeedback {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(Margin::M0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Toast"
                    }
                    p { class: ClassesBuilder::new().add(Margin::M0).add(TextColor::Gray600).build(),
                        "Floating notification messages for user feedback with FUI aesthetics"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                        p {
                            "Toasts are floating notification messages that appear temporarily to provide feedback. They support:"
                        }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Multiple variants" }
                                " - Info, Success, Warning, Error"
                            }
                            li {
                                strong { "Flexible positioning" }
                                " - Top/Bottom, Left/Center/Right"
                            }
                            li {
                                strong { "Auto-dismiss" }
                                " - Optional duration setting"
                            }
                            li {
                                strong { "Manual close" }
                                " - Optional close button"
                            }
                            li {
                                strong { "Rich content" }
                                " - Title and message"
                            }
                        }
                    }
                }

                // Toast Variants
                Section {
                    title: Some("Toast Variants".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Info Toast"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Used for informational messages"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            div { class: ClassesBuilder::new().add(Padding::P4).build(),
                                Toast {
                                    variant: ToastVariant::Info,
                                    message: "This is an informational message.".to_string(),
                                    position: ToastPosition::TopRight,
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Success Toast"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Used to indicate successful operations"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            div { class: ClassesBuilder::new().add(Padding::P4).build(),
                                Toast {
                                    variant: ToastVariant::Success,
                                    message: "Operation completed successfully!".to_string(),
                                    position: ToastPosition::TopRight,
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Warning Toast"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Used for warning messages"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            div { class: ClassesBuilder::new().add(Padding::P4).build(),
                                Toast {
                                    variant: ToastVariant::Warning,
                                    message: "Please review your input.".to_string(),
                                    position: ToastPosition::TopRight,
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Error Toast"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Used for error messages"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            div { class: ClassesBuilder::new().add(Padding::P4).build(),
                                Toast {
                                    variant: ToastVariant::Error,
                                    message: "An error occurred. Please try again.".to_string(),
                                    position: ToastPosition::TopRight,
                                }
                            }
                        }
                    }
                }

                // Toast Positions
                Section {
                    title: Some("Toast Positions".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                        p { "Toasts can be positioned at different corners of the screen:" }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Position Options"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            div {
                                class: ClassesBuilder::new()
                                    .add(Display::Flex)
                                    .add(FlexDirection::Column)
                                    .add(Gap::Gap4)
                                    .build(),
                                div { class: ClassesBuilder::new().add(MarginBottom::Mb4).build(),
                                    strong { "Top-Right" }
                                    Toast {
                                        variant: ToastVariant::Info,
                                        message: "Top Right".to_string(),
                                        position: ToastPosition::TopRight,
                                    }
                                }
                                div { class: ClassesBuilder::new().add(MarginBottom::Mb4).build(),
                                    strong { "Top-Center" }
                                    Toast {
                                        variant: ToastVariant::Success,
                                        message: "Top Center".to_string(),
                                        position: ToastPosition::TopCenter,
                                    }
                                }
                                div { class: ClassesBuilder::new().add(MarginBottom::Mb4).build(),
                                    strong { "Top-Left" }
                                    Toast {
                                        variant: ToastVariant::Warning,
                                        message: "Top Left".to_string(),
                                        position: ToastPosition::TopLeft,
                                    }
                                }
                                div { class: ClassesBuilder::new().add(MarginBottom::Mb4).build(),
                                    strong { "Bottom-Right" }
                                    Toast {
                                        variant: ToastVariant::Error,
                                        message: "Bottom Right".to_string(),
                                        position: ToastPosition::BottomRight,
                                    }
                                }
                                div { class: ClassesBuilder::new().add(MarginBottom::Mb4).build(),
                                    strong { "Bottom-Center" }
                                    Toast {
                                        variant: ToastVariant::Info,
                                        message: "Bottom Center".to_string(),
                                        position: ToastPosition::BottomCenter,
                                    }
                                }
                                div { class: ClassesBuilder::new().add(MarginBottom::Mb4).build(),
                                    strong { "Bottom-Left" }
                                    Toast {
                                        variant: ToastVariant::Success,
                                        message: "Bottom Left".to_string(),
                                        position: ToastPosition::BottomLeft,
                                    }
                                }
                            }
                        }
                    }
                }

                // Toast Options
                Section {
                    title: Some("Toast Options".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Title"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Add a title to provide more context"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            div { class: ClassesBuilder::new().add(Padding::P4).build(),
                                Toast {
                                    variant: ToastVariant::Success,
                                    title: Some("Success".to_string()),
                                    message: "Your changes have been saved.".to_string(),
                                    position: ToastPosition::TopRight,
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Custom Duration"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Control how long the toast remains visible (in milliseconds)"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            div { class: ClassesBuilder::new().add(Padding::P4).build(),
                                Toast {
                                    variant: ToastVariant::Info,
                                    message: "This toast will auto-dismiss in 5 seconds.".to_string(),
                                    position: ToastPosition::TopRight,
                                    duration: Some(5000),
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Non-Closable"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Toasts without close button (must wait for duration)"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            div { class: ClassesBuilder::new().add(Padding::P4).build(),
                                Toast {
                                    variant: ToastVariant::Warning,
                                    message: "Please wait...".to_string(),
                                    position: ToastPosition::TopRight,
                                    closable: false,
                                    duration: Some(3000),
                                }
                            }
                        }
                    }
                }

                // Usage Examples
                Section {
                    title: Some("Usage Examples".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Toast"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add(Padding::P4)
                                .add(BgColor::Gray900)
                                .add(BorderRadius::Rounded)
                                .build(),
                            code {
                                r#"Toast {{
    variant: ToastVariant::Info,
    message: "Operation complete".to_string(),
    position: ToastPosition::TopRight,
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Toast with Title and Duration"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add(Padding::P4)
                                .add(BgColor::Gray900)
                                .add(BorderRadius::Rounded)
                                .build(),
                            code {
                                r#"Toast {{
    variant: ToastVariant::Success,
    title: Some("Success".to_string()),
    message: "Data saved successfully!".to_string(),
    position: ToastPosition::TopCenter,
    duration: Some(3000),
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Error Toast with Manual Close"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add(Padding::P4)
                                .add(BgColor::Gray900)
                                .add(BorderRadius::Rounded)
                                .build(),
                            code {
                                r#"Toast {{
    variant: ToastVariant::Error,
    title: Some("Error".to_string()),
    message: "Failed to process request.".to_string(),
    position: ToastPosition::BottomRight,
    closable: true,
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Temporary Notification"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add(Padding::P4)
                                .add(BgColor::Gray900)
                                .add(BorderRadius::Rounded)
                                .build(),
                            code {
                                r#"Toast {{
    variant: ToastVariant::Warning,
    message: "Session expiring soon...".to_string(),
    position: ToastPosition::TopLeft,
    duration: Some(5000),
    closable: true,
}}"#
                            }
                        }
                    }
                }

                // Best Practices
                Section {
                    title: Some("Best Practices".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "When to Use Toasts"
                        }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Success feedback" }
                                " - Confirm completed actions"
                            }
                            li {
                                strong { "Error notifications" }
                                " - Alert users to problems"
                            }
                            li {
                                strong { "Informational updates" }
                                " - Provide status updates"
                            }
                            li {
                                strong { "Warnings" }
                                " - Alert to potential issues"
                            }
                        }

                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Position Guidelines"
                        }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Top-Right" }
                                " - Most common, non-intrusive"
                            }
                            li {
                                strong { "Top-Center" }
                                " - Highly visible, important messages"
                            }
                            li {
                                strong { "Bottom-Right" }
                                " - Less intrusive notifications"
                            }
                            li {
                                strong { "Bottom-Center" }
                                " - Mobile-friendly option"
                            }
                        }

                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Duration Recommendations"
                        }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "2-3 seconds" }
                                " - Short info messages"
                            }
                            li {
                                strong { "4-5 seconds" }
                                " - Standard notifications"
                            }
                            li {
                                strong { "5+ seconds" }
                                " - Important messages requiring reading"
                            }
                            li {
                                strong { "Manual close" }
                                " - For critical errors or complex messages"
                            }
                        }
                    }
                }
            }
        }
    }
}
