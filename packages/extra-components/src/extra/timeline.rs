// hi-extra-components/src/extra/timeline.rs
// Timeline component with Arknights + FUI styling

use dioxus::prelude::*;
use hikari_palette::classes::{ClassesBuilder, TextColor};

/// Timeline position
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TimelinePosition {
    #[default]
    Left,
    Center,
    Right,
}

/// Timeline item status
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum TimelineStatus {
    Pending,
    InProgress,
    Completed,
    Cancelled,
}

impl Default for TimelineStatus {
    fn default() -> Self {
        Self::Pending
    }
}

#[derive(Clone, PartialEq, Props, Default)]
pub struct TimelineItemProps {
    /// Item title
    #[props(into)]
    pub title: String,

    /// Item description
    #[props(into)]
    pub description: String,

    /// Item time/date
    #[props(into, default)]
    pub time: String,

    /// Item icon (optional emoji)
    #[props(into, default)]
    pub icon: String,

    /// Item status
    #[props(default)]
    pub status: TimelineStatus,

    /// Whether item is expanded (collapsible description)
    #[props(default)]
    pub expanded: bool,

    /// Additional content
    #[props(default)]
    pub extra: Option<Element>,
}

/// Timeline item component
///
/// # Examples
///
/// ```rust,ignore
/// use hikari_extra_components::TimelineItem;
///
/// rsx! {
///     TimelineItem {
///         title: "Project Started",
///         description: "Initial project setup and team formation",
///         time: "2024-01-01",
///         icon: "🚀",
///         status: TimelineStatus::Completed,
///     }
/// }
/// ```
#[component]
pub fn TimelineItem(props: TimelineItemProps) -> Element {
    let mut expanded = use_signal(|| props.expanded);

    let status_class = match props.status {
        TimelineStatus::Pending => "hi-timeline-pending",
        TimelineStatus::InProgress => "hi-timeline-in-progress",
        TimelineStatus::Completed => "hi-timeline-completed",
        TimelineStatus::Cancelled => "hi-timeline-cancelled",
    };

    let status_dot_class = match props.status {
        TimelineStatus::Pending => "hi-timeline-dot-pending",
        TimelineStatus::InProgress => "hi-timeline-dot-in-progress",
        TimelineStatus::Completed => "hi-timeline-dot-completed",
        TimelineStatus::Cancelled => "hi-timeline-dot-cancelled",
    };

    // Pre-compute values to avoid borrowing issues
    let has_description = !props.description.is_empty() || props.extra.is_some();

    let toggle_expanded = move |_| {
        if has_description {
            expanded.set(!expanded());
        }
    };

    let is_expanded = expanded();

    rsx! {
        div {
            class: format!("hi-timeline-item {status_class}"),

            // Timeline dot
            div {
                class: format!("hi-timeline-dot {status_dot_class}"),
                if !props.icon.is_empty() {
                    div {
                        class: "hi-timeline-icon",
                        "{props.icon}"
                    }
                }
            }

            // Timeline content
            div {
                class: "hi-timeline-content",

                // Header
                div {
                    class: {
                        let mut classes = ClassesBuilder::new();
                        classes = classes.add_raw("hi-timeline-header");
                        if has_description {
                            classes = classes.add_raw("hi-timeline-header-clickable");
                        }
                        classes.build()
                    },
                    onclick: toggle_expanded,

                    h4 {
                        class: "hi-timeline-title",
                        "{props.title}"
                    }

                    if !props.time.is_empty() {
                        span {
                            class: "hi-timeline-time",
                            "{props.time}"
                        }
                    }
                }

                // Description
                if has_description {
                    div {
                        class: format!(
                            "hi-timeline-description {}",
                            if is_expanded {
                                "hi-timeline-description-expanded"
                            } else {
                                "hi-timeline-description-collapsed"
                            }
                        ),

                        if !props.description.is_empty() {
                            p {
                                class: ClassesBuilder::new()
                                    .add(TextColor::Secondary)
                                    .build(),
                                "{props.description}"
                            }
                        }

                        if let Some(extra) = props.extra {
                            div {
                                class: "hi-timeline-extra",
                                { extra }
                            }
                        }
                    }
                }
            }
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct TimelineProps {
    /// Timeline position
    #[props(default)]
    pub position: TimelinePosition,

    /// Whether to show connecting line
    #[props(default = true)]
    pub show_line: bool,

    /// Timeline items (children)
    #[props(default)]
    pub children: Element,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,
}

impl Default for TimelineProps {
    fn default() -> Self {
        Self {
            position: TimelinePosition::default(),
            show_line: true,
            children: VNode::empty(),
            class: String::default(),
        }
    }
}

/// Timeline component
///
/// # Examples
///
/// ```rust,ignore
/// use hikari_extra_components::{Timeline, TimelineItem, TimelineStatus};
///
/// rsx! {
///     Timeline {
///         position: TimelinePosition::Left,
///         TimelineItem {
///             title: "Phase 1",
///             description: "Initial development phase",
///             time: "2024-01-01",
///             icon: "🎯",
///             status: TimelineStatus::Completed,
///         }
///         TimelineItem {
///             title: "Phase 2",
///             description: "Feature implementation",
///             time: "2024-02-01",
///             icon: "⚡",
///             status: TimelineStatus::InProgress,
///         }
///     }
/// }
/// ```
#[component]
pub fn Timeline(props: TimelineProps) -> Element {
    let position_class = match props.position {
        TimelinePosition::Left => "hi-timeline-left",
        TimelinePosition::Center => "hi-timeline-center",
        TimelinePosition::Right => "hi-timeline-right",
    };

    rsx! {
        div {
            class: format!(
                "hi-timeline {position_class} {} {}",
                if props.show_line { "hi-timeline-line" } else { "" },
                props.class
            ),
            { props.children }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timeline_position() {
        let left = TimelinePosition::Left;
        assert_eq!(left, TimelinePosition::default());
    }

    #[test]
    fn test_timeline_status() {
        let pending = TimelineStatus::Pending;
        assert_eq!(pending, TimelineStatus::default());
    }

    #[test]
    fn test_status_variants() {
        let statuses = [
            TimelineStatus::Pending,
            TimelineStatus::InProgress,
            TimelineStatus::Completed,
            TimelineStatus::Cancelled,
        ];
        assert_eq!(statuses.len(), 4);
    }
}
