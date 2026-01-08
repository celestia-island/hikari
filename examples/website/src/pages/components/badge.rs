// website/src/pages/components/badge.rs
// Badge component showcase page with real rendered examples


use dioxus::prelude::*;

use _components::{Badge, BadgeVariant, Button, ButtonVariant, layout::{Container, Row, Section}};
use _icons::{Icon, LucideIcon};
use _palette::classes::{ ClassesBuilder, MarginBottom, FontSize, FontWeight, TextColor, Padding, PaddingLeft, Margin, };
use crate::{app::Route, components::Layout};

#[allow(non_snake_case)]
pub fn ComponentsBadge() -> Element {
    rsx! {
        Layout { current_route: Route::ComponentsBasic {},

            Container {
                // Page header
                div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::default()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(Margin::M0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Badge"
                    }
                    p { class: ClassesBuilder::default().add(Margin::M0).add(TextColor::Gray600).build(),
                        "Small status indicators and counters with FUI aesthetics"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                        p {
                            "Badges are small status indicators used to highlight information or show counts. They support:"
                        }
                        ul { class: ClassesBuilder::default().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Multiple variants" }
                                " - Default, Primary, Success, Warning, Danger"
                            }
                            li {
                                strong { "Dot mode" }
                                " - Small dot indicator without text"
                            }
                            li {
                                strong { "Count mode" }
                                " - Numeric badges with max value"
                            }
                            li {
                                strong { "Wrapper" }
                                " - Can wrap other components"
                            }
                        }
                    }
                }

                // Badge Variants
                Section {
                    title: Some("Badge Variants".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "All Variants"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Badges come in different variants for different semantic meanings"
                        }
                        Row { gap: "md".to_string(),
                            Badge { variant: BadgeVariant::Default, "Default" }
                            Badge { variant: BadgeVariant::Primary, "Primary" }
                            Badge { variant: BadgeVariant::Success, "Success" }
                            Badge { variant: BadgeVariant::Warning, "Warning" }
                            Badge { variant: BadgeVariant::Danger, "Danger" }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Semantic Usage"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Use appropriate variants for different contexts"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                Row { gap: "md".to_string(),
                                    Icon { icon: LucideIcon::badge, size: 20 }
                                    Badge { variant: BadgeVariant::Success, "Completed" }
                                    span { "Task finished successfully" }
                                }
                                Row { gap: "md".to_string(),
                                    Icon { icon: LucideIcon::badge, size: 20 }
                                    Badge { variant: BadgeVariant::Warning, "Warning" }
                                    span { "Action required" }
                                }
                                Row { gap: "md".to_string(),
                                    Icon { icon: LucideIcon::badge, size: 20 }
                                    Badge { variant: BadgeVariant::Danger, "Error" }
                                    span { "Operation failed" }
                                }
                            }
                        }
                    }
                }

                // Dot Badges
                Section {
                    title: Some("Dot Badges".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Status Indicators"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Dot badges are perfect for showing online status or active states"
                        }
                        Row { gap: "md".to_string(),
                            Badge { variant: BadgeVariant::Primary, dot: true, "Online" }
                            Badge { variant: BadgeVariant::Success, dot: true, "Active" }
                            Badge { variant: BadgeVariant::Warning, dot: true, "Away" }
                            Badge { variant: BadgeVariant::Danger, dot: true, "Offline" }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Notification Dots"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Use dots to indicate unread notifications"
                        }
                        Row { gap: "lg".to_string(),
                            Badge { variant: BadgeVariant::Danger, dot: true,
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    icon: rsx! {
                                        Icon { icon: LucideIcon::badge, size: 18 }
                                    },
                                }
                            }
                            Badge { variant: BadgeVariant::Primary, dot: true,
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    icon: rsx! {
                                        Icon { icon: LucideIcon::badge, size: 18 }
                                    },
                                }
                            }
                            Badge { variant: BadgeVariant::Success, dot: true,
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    icon: rsx! {
                                        Icon { icon: LucideIcon::badge, size: 18 }
                                    },
                                }
                            }
                        }
                    }
                }

                // Count Badges
                Section {
                    title: Some("Count Badges".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Counts"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Display numeric values on buttons or icons"
                        }
                        Row { gap: "lg".to_string(),
                            Badge { variant: BadgeVariant::Danger, count: 5,
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    icon: rsx! {
                                        Icon { icon: LucideIcon::badge, size: 18 }
                                    },
                                }
                            }
                            Badge { variant: BadgeVariant::Primary, count: 12,
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    icon: rsx! {
                                        Icon { icon: LucideIcon::badge, size: 18 }
                                    },
                                }
                            }
                            Badge { variant: BadgeVariant::Success, count: 99,
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    icon: rsx! {
                                        Icon { icon: LucideIcon::badge, size: 18 }
                                    },
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Maximum Value"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Use the max prop to cap the displayed value"
                        }
                        Row { gap: "lg".to_string(),
                            Badge {
                                variant: BadgeVariant::Danger,
                                count: 5,
                                max: Some(99),
                                Button { variant: ButtonVariant::Primary, "Notifications" }
                            }
                            Badge {
                                variant: BadgeVariant::Primary,
                                count: 100,
                                max: Some(99),
                                Button { variant: ButtonVariant::Primary, "Messages" }
                            }
                            Badge {
                                variant: BadgeVariant::Success,
                                count: 999,
                                max: Some(99),
                                Button { variant: ButtonVariant::Primary, "Updates" }
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Show Zero"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Control whether to show badge when count is zero"
                        }
                        Row { gap: "lg".to_string(),
                            Badge { variant: BadgeVariant::Default, count: 0,
                                Button { variant: ButtonVariant::Ghost, "No badge" }
                            }
                            Badge {
                                variant: BadgeVariant::Primary,
                                count: 0,
                                show_zero: true,
                                Button { variant: ButtonVariant::Ghost, "Show zero" }
                            }
                        }
                    }
                }

                // Badge Wrapper
                Section {
                    title: Some("Badge Wrapper".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Wrapping Components"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Badges can wrap any component to show status or counts"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                div { style: "display: flex; gap: 16px; align-items: center;",
                                    Badge {
                                        variant: BadgeVariant::Primary,
                                        count: 5,
                                        Button {
                                            variant: ButtonVariant::Primary,
                                            icon: rsx! {
                                                Icon { icon: LucideIcon::badge, size: 16 }
                                            },
                                            "Notifications"
                                        }
                                    }
                                }
                                div { style: "display: flex; gap: 16px; align-items: center;",
                                    Badge {
                                        variant: BadgeVariant::Success,
                                        count: 3,
                                        Button {
                                            variant: ButtonVariant::Secondary,
                                            icon: rsx! {
                                                Icon { icon: LucideIcon::badge, size: 16 }
                                            },
                                            "Messages"
                                        }
                                    }
                                }
                                div { style: "display: flex; gap: 16px; align-items: center;",
                                    Badge {
                                        variant: BadgeVariant::Danger,
                                        count: 12,
                                        Button {
                                            variant: ButtonVariant::Ghost,
                                            icon: rsx! {
                                                Icon { icon: LucideIcon::badge, size: 16 }
                                            },
                                            "Alerts"
                                        }
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
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Status Labels"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Use badges inline with text for status labels"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                div { style: "display: flex; gap: 12px; align-items: center;",
                                    strong { "Server Status:" }
                                    Badge { variant: BadgeVariant::Success, "Online" }
                                }
                                div { style: "display: flex; gap: 12px; align-items: center;",
                                    strong { "Build Status:" }
                                    Badge { variant: BadgeVariant::Warning, "In Progress" }
                                }
                                div { style: "display: flex; gap: 12px; align-items: center;",
                                    strong { "Deployment:" }
                                    Badge { variant: BadgeVariant::Danger, "Failed" }
                                }
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
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "User Status"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            Row { gap: "md".to_string(),
                                Badge { variant: BadgeVariant::Success, dot: true,
                                    div { style: "display: flex; align-items: center; gap: 8px;",
                                        Icon { icon: LucideIcon::badge, size: 20 }
                                        span { "John Doe" }
                                    }
                                }
                                Badge { variant: BadgeVariant::Warning, dot: true,
                                    div { style: "display: flex; align-items: center; gap: 8px;",
                                        Icon { icon: LucideIcon::badge, size: 20 }
                                        span { "Jane Smith" }
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
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Task Status"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                div { style: "display: flex; justify-content: space-between; align-items: center;",
                                    span { "Design Review" }
                                    Badge { variant: BadgeVariant::Success, "Done" }
                                }
                                div { style: "display: flex; justify-content: space-between; align-items: center;",
                                    span { "Implementation" }
                                    Badge { variant: BadgeVariant::Primary, "In Progress" }
                                }
                                div { style: "display: flex; justify-content: space-between; align-items: center;",
                                    span { "Testing" }
                                    Badge { variant: BadgeVariant::Default, "Pending" }
                                }
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
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Badge"
                        }
                        div { class: "code-example",
                            code { r#"Badge {{
    variant: BadgeVariant::Primary,
    "New"
}}"# }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Dot Badge"
                        }
                        div { class: "code-example",
                            code {
                                r#"Badge {{
    variant: BadgeVariant::Success,
    dot: true,
    "Online"
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Count Badge"
                        }
                        div { class: "code-example",
                            code {
                                r#"Badge {{
    variant: BadgeVariant::Danger,
    count: 5,
    max: Some(99),
    Button {{ "Notifications" }}
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Status Indicator"
                        }
                        div { class: "code-example",
                            code {
                                r#"Badge {{
    variant: BadgeVariant::Success,
    dot: true,
    Button {{
        variant: ButtonVariant::Ghost,
        "User Profile"
    }}
}}"#
                            }
                        }
                    }
                }
            }
        }
    }
}
