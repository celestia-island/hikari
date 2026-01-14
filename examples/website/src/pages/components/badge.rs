// website/src/pages/components/badge.rs
// Badge component showcase page with real rendered examples

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _animation::style::{CssProperty, StyleStringBuilder};
use _components::{
    layout::{Container, Row, Section},
    Badge, BadgeVariant, Button, ButtonVariant,
};
use _icons::{Icon, MdiIcon};
use _palette::classes::{
    ClassesBuilder, FontSize, FontWeight, Margin, MarginBottom, Padding, PaddingLeft, TextColor,
};

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
                            .add(MarginBottom::Mb0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Badge"
                    }
                    p { class: ClassesBuilder::default().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "Small status indicators and counters with FUI aesthetics"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                        p {
                            "Badges are small status indicators used to highlight information or show counts. They support:"
                        }
                        ul { class: ClassesBuilder::default().add(PaddingLeft::Pl6).add(MarginBottom::Mb0).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "All Variants"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Semantic Usage"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Use appropriate variants for different contexts"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                                Row { gap: "md".to_string(),
                                    Icon { icon: MdiIcon::Alert, size: 20 }
                                    Badge { variant: BadgeVariant::Success, "Completed" }
                                    span { "Task finished successfully" }
                                }
                                Row { gap: "md".to_string(),
                                    Icon { icon: MdiIcon::Alert, size: 20 }
                                    Badge { variant: BadgeVariant::Warning, "Warning" }
                                    span { "Action required" }
                                }
                                Row { gap: "md".to_string(),
                                    Icon { icon: MdiIcon::Alert, size: 20 }
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Status Indicators"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Notification Dots"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Use dots to indicate unread notifications"
                        }
                        Row { gap: "lg".to_string(),
                            Badge { variant: BadgeVariant::Danger, dot: true,
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    icon: rsx! {
                                        Icon { icon: MdiIcon::Alert, size: 18 }
                                    },
                                }
                            }
                            Badge { variant: BadgeVariant::Primary, dot: true,
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    icon: rsx! {
                                        Icon { icon: MdiIcon::Alert, size: 18 }
                                    },
                                }
                            }
                            Badge { variant: BadgeVariant::Success, dot: true,
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    icon: rsx! {
                                        Icon { icon: MdiIcon::Alert, size: 18 }
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Counts"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Display numeric values on buttons or icons"
                        }
                        Row { gap: "lg".to_string(),
                            Badge { variant: BadgeVariant::Danger, count: 5,
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    icon: rsx! {
                                        Icon { icon: MdiIcon::Alert, size: 18 }
                                    },
                                }
                            }
                            Badge { variant: BadgeVariant::Primary, count: 12,
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    icon: rsx! {
                                        Icon { icon: MdiIcon::Alert, size: 18 }
                                    },
                                }
                            }
                            Badge { variant: BadgeVariant::Success, count: 99,
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    icon: rsx! {
                                        Icon { icon: MdiIcon::Alert, size: 18 }
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Maximum Value"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Show Zero"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Wrapping Components"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Badges can wrap any component to show status or counts"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                                div { style: StyleStringBuilder::new().add(CssProperty::Display, "flex").add(CssProperty::Gap, "16px").add(CssProperty::AlignItems, "center").build_clean(),
                                    Badge {
                                        variant: BadgeVariant::Primary,
                                        count: 5,
                                        Button {
                                            variant: ButtonVariant::Primary,
                                            icon: rsx! {
                                                Icon { icon: MdiIcon::Alert, size: 16 }
                                            },
                                            "Notifications"
                                        }
                                         }
                                    }
                                    div { style: StyleStringBuilder::new().add(CssProperty::Display, "flex").add(CssProperty::Gap, "16px").add(CssProperty::AlignItems, "center").build_clean(),
                                        Badge {
                                            variant: BadgeVariant::Success,
                                            count: 3,
                                            Button {
                                            variant: ButtonVariant::Secondary,
                                            icon: rsx! {
                                                Icon { icon: MdiIcon::Alert, size: 16 }
                                            },
                                            "Messages"
                                        }
                                         }
                                    }
                                    div { style: StyleStringBuilder::new().add(CssProperty::Display, "flex").add(CssProperty::Gap, "16px").add(CssProperty::AlignItems, "center").build_clean(),
                                        Badge {
                                            variant: BadgeVariant::Danger,
                                            count: 12,
                                            Button {
                                            variant: ButtonVariant::Ghost,
                                            icon: rsx! {
                                                Icon { icon: MdiIcon::Alert, size: 16 }
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Status Labels"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Use badges inline with text for status labels"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                                div { style: StyleStringBuilder::new().add(CssProperty::Display, "flex").add(CssProperty::Gap, "12px").add(CssProperty::AlignItems, "center").build_clean(),
                                    strong { "Server Status:" }
                                    Badge { variant: BadgeVariant::Success, "Online" }
                                }
                                div { style: StyleStringBuilder::new().add(CssProperty::Display, "flex").add(CssProperty::Gap, "12px").add(CssProperty::AlignItems, "center").build_clean(),
                                    strong { "Build Status:" }
                                    Badge { variant: BadgeVariant::Warning, "In Progress" }
                                }
                                div { style: StyleStringBuilder::new().add(CssProperty::Display, "flex").add(CssProperty::Gap, "12px").add(CssProperty::AlignItems, "center").build_clean(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "User Status"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            Row { gap: "md".to_string(),
                                Badge { variant: BadgeVariant::Success, dot: true,
                                    div { style: StyleStringBuilder::new().add(CssProperty::Display, "flex").add(CssProperty::AlignItems, "center").add(CssProperty::Gap, "8px").build_clean(),
                                        Icon { icon: MdiIcon::Alert, size: 20 }
                                        span { "John Doe" }
                                    }
                                }
                                Badge { variant: BadgeVariant::Warning, dot: true,
                                    div { style: StyleStringBuilder::new().add(CssProperty::Display, "flex").add(CssProperty::AlignItems, "center").add(CssProperty::Gap, "8px").build_clean(),
                                        Icon { icon: MdiIcon::Alert, size: 20 }
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Task Status"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                                div { style: StyleStringBuilder::new().add(CssProperty::Display, "flex").add(CssProperty::JustifyContent, "space-between").add(CssProperty::AlignItems, "center").build_clean(),
                                    span { "Design Review" }
                                    Badge { variant: BadgeVariant::Success, "Done" }
                                }
                                div { style: StyleStringBuilder::new().add(CssProperty::Display, "flex").add(CssProperty::JustifyContent, "space-between").add(CssProperty::AlignItems, "center").build_clean(),
                                    span { "Implementation" }
                                    Badge { variant: BadgeVariant::Primary, "In Progress" }
                                }
                                div { style: StyleStringBuilder::new().add(CssProperty::Display, "flex").add(CssProperty::JustifyContent, "space-between").add(CssProperty::AlignItems, "center").build_clean(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Badge"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P4).add_raw("bg-gray-900").add_raw("rounded").build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Dot Badge"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P4).add_raw("bg-gray-900").add_raw("rounded").build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Count Badge"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P4).add_raw("bg-gray-900").add_raw("rounded").build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Status Indicator"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P4).add_raw("bg-gray-900").add_raw("rounded").build(),
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
