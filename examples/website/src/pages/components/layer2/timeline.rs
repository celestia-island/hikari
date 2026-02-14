// website/src/pages/components/extra/timeline_doc.rs
// Timeline component documentation page

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::layout::{Container, Section};
use _extra_components::extra::{Timeline as TimelineComponent, TimelineItem, TimelinePosition, TimelineStatus};
use _palette::classes::{ClassesBuilder, FontSize, FontWeight, MarginBottom, TextColor};

// Code examples as constants
const CODE_BASIC: &str = r#"TimelineComponent {
    position: TimelinePosition::Left,
    TimelineItem {
        title: "Project Started",
        description: "Initial project setup and team formation",
        time: "2024-01-01",
        icon: "🚀",
        status: TimelineStatus::Completed,
    }
    TimelineItem {
        title: "Development Phase",
        description: "Core features implementation",
        time: "2024-02-01",
        icon: "⚡",
        status: TimelineStatus::InProgress,
    }
}"#;

const CODE_CENTER: &str = r#"TimelineComponent {
    position: TimelinePosition::Center,
    TimelineItem {
        title: "Phase 1",
        description: "Planning and design",
        time: "2024-01",
        icon: "📋",
        status: TimelineStatus::Completed,
    }
}"#;

const CODE_STATUS: &str = r#"TimelineItem {
    title: "Cancelled Task",
    description: "This task was cancelled",
    time: "2024-03-01",
    icon: "🚫",
    status: TimelineStatus::Cancelled,
}"#;

#[allow(non_snake_case)]
pub fn Timeline() -> Element {
    rsx! {
        Layout {
            current_route: Route::Timeline {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Timeline"
                    }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        "Event timeline with milestones and status indicators"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Timeline is a component for displaying chronological events and supports:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").build(),
                            li { "Multiple status types (Pending, In Progress, Completed, Cancelled)" }
                            li { "Three position options (Left, Center, Right)" }
                            li { "Icon support for each item" }
                            li { "Collapsible descriptions" }
                            li { "Connecting lines between items" }
                            li { "Responsive theming (hikari/tairitsu)" }
                        }
                    }
                }

                // Basic Usage
                Section {
                    title: Some("Basic Usage".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Left Position"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Timeline positioned on the left side"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").add_raw("border").add_raw("rounded-lg").build(),
                            TimelineComponent {
                                position: TimelinePosition::Left,
                                TimelineItem {
                                    title: "Project Kickoff".to_string(),
                                    description: "Team formation and project initialization".to_string(),
                                    time: "2024-01-15".to_string(),
                                    icon: "🎯".to_string(),
                                    status: TimelineStatus::Completed,
                                }
                                TimelineItem {
                                    title: "Design Phase".to_string(),
                                    description: "UI/UX design and system architecture".to_string(),
                                    time: "2024-02-01".to_string(),
                                    icon: "🎨".to_string(),
                                    status: TimelineStatus::Completed,
                                }
                                TimelineItem {
                                    title: "Development".to_string(),
                                    description: "Core feature implementation".to_string(),
                                    time: "2024-03-01".to_string(),
                                    icon: "⚡".to_string(),
                                    status: TimelineStatus::InProgress,
                                }
                                TimelineItem {
                                    title: "Testing".to_string(),
                                    description: "Quality assurance and bug fixes".to_string(),
                                    time: "2024-04-01".to_string(),
                                    icon: "🔍".to_string(),
                                    status: TimelineStatus::Pending,
                                }
                            }
                        }
                    }
                }

                // Center Position
                Section {
                    title: Some("Position Options".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Center Position"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Timeline centered with icons in the middle"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").add_raw("border").add_raw("rounded-lg").build(),
                            TimelineComponent {
                                position: TimelinePosition::Center,
                                TimelineItem {
                                    title: "Phase 1".to_string(),
                                    description: "Research and planning".to_string(),
                                    time: "2024-01".to_string(),
                                    icon: "📋".to_string(),
                                    status: TimelineStatus::Completed,
                                }
                                TimelineItem {
                                    title: "Phase 2".to_string(),
                                    description: "Design and prototyping".to_string(),
                                    time: "2024-02".to_string(),
                                    icon: "✏️".to_string(),
                                    status: TimelineStatus::Completed,
                                }
                                TimelineItem {
                                    title: "Phase 3".to_string(),
                                    description: "Implementation and testing".to_string(),
                                    time: "2024-03".to_string(),
                                    icon: "🔧".to_string(),
                                    status: TimelineStatus::InProgress,
                                }
                            }
                        }
                    }
                }

                // Status Variants
                Section {
                    title: Some("Status Variants".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "All Status Types"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Display items with different statuses"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").add_raw("border").add_raw("rounded-lg").build(),
                            TimelineComponent {
                                position: TimelinePosition::Left,
                                TimelineItem {
                                    title: "Completed Task".to_string(),
                                    description: "This task is finished".to_string(),
                                    time: "2024-01-01".to_string(),
                                    icon: "✅".to_string(),
                                    status: TimelineStatus::Completed,
                                }
                                TimelineItem {
                                    title: "In Progress Task".to_string(),
                                    description: "Currently working on this".to_string(),
                                    time: "2024-02-01".to_string(),
                                    icon: "⏳".to_string(),
                                    status: TimelineStatus::InProgress,
                                }
                                TimelineItem {
                                    title: "Pending Task".to_string(),
                                    description: "Waiting to start".to_string(),
                                    time: "2024-03-01".to_string(),
                                    icon: "⏸️".to_string(),
                                    status: TimelineStatus::Pending,
                                }
                                TimelineItem {
                                    title: "Cancelled Task".to_string(),
                                    description: "This task was cancelled".to_string(),
                                    time: "2024-04-01".to_string(),
                                    icon: "🚫".to_string(),
                                    status: TimelineStatus::Cancelled,
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Timeline"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_BASIC}" }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Center Position"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_CENTER}" }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb0).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Status Variants"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_STATUS}" }
                        }
                    }
                }
            }
        }
    }
}
