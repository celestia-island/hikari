// packages/components/src/display/timeline.rs
// Timeline component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, TimelineClass, UtilityClass};

use crate::styled::StyledComponent;

/// Timeline component type wrapper (for StyledComponent)
pub struct TimelineComponent;

/// Timeline component with Arknights + FUI styling
///
/// A vertical timeline for displaying a series of events in chronological order.
/// Supports custom icons, colors, and positioning.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Timeline, TimelineItem, TimelinePosition};
///
/// fn app() -> Element {
///     rsx! {
///         Timeline {
///             TimelineItem {
///                 position: TimelinePosition::Left,
///                 time: "2024-01-01",
///                 title: "Project Started",
///                 "Initial project setup and planning"
///             }
///             TimelineItem {
///                 position: TimelinePosition::Right,
///                 time: "2024-02-15",
///                 title: "First Milestone",
///                 "Completed core features"
///             }
///         }
///     }
/// }
/// ```
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TimelinePosition {
    #[default]
    Alternate,
    Left,
    Right,
}

#[derive(Clone, PartialEq, Props)]
pub struct TimelineProps {
    /// Position of timeline items
    #[props(default)]
    pub position: TimelinePosition,

    /// Show connecting line between items
    #[props(default = true)]
    pub line: bool,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Additional CSS styles
    #[props(default)]
    pub style: String,

    pub children: Element,
}

impl Default for TimelineProps {
    fn default() -> Self {
        Self {
            position: Default::default(),
            line: true,
            class: String::default(),
            style: String::default(),
            children: VNode::empty(),
        }
    }
}

#[component]
pub fn Timeline(props: TimelineProps) -> Element {
    let position_class = match props.position {
        TimelinePosition::Alternate => TimelineClass::Alternate,
        TimelinePosition::Left => TimelineClass::Left,
        TimelinePosition::Right => TimelineClass::Right,
    };

    let timeline_classes = ClassesBuilder::new()
        .add(TimelineClass::Timeline)
        .add(position_class)
        .add_if(TimelineClass::NoLine, || !props.line)
        .add_raw(&props.class)
        .build();

    rsx! {
        div {
            class: "{timeline_classes}",
            style: "{props.style}",
            {props.children}
        }
    }
}

/// Individual timeline item
#[derive(Clone, PartialEq, Props)]
pub struct TimelineItemProps {
    /// Position of this item
    #[props(default)]
    pub position: TimelinePosition,

    /// Time/date label
    #[props(default)]
    pub time: String,

    /// Title of the timeline event
    #[props(default)]
    pub title: String,

    /// Icon for the timeline dot
    #[props(default)]
    pub icon: Option<Element>,

    /// Color of the timeline dot
    #[props(default)]
    pub color: String,

    /// Whether this is the last item (hide line after it)
    #[props(default)]
    pub last: bool,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Additional CSS styles
    #[props(default)]
    pub style: String,

    pub children: Element,
}

impl Default for TimelineItemProps {
    fn default() -> Self {
        Self {
            position: Default::default(),
            time: String::default(),
            title: String::default(),
            icon: Some(VNode::empty()),
            color: String::default(),
            last: false,
            class: String::default(),
            style: String::default(),
            children: VNode::empty(),
        }
    }
}

#[component]
pub fn TimelineItem(props: TimelineItemProps) -> Element {
    let position_class = match props.position {
        TimelinePosition::Alternate => TimelineClass::Alternate,
        TimelinePosition::Left => TimelineClass::Left,
        TimelinePosition::Right => TimelineClass::Right,
    };

    let item_classes = ClassesBuilder::new()
        .add(TimelineClass::Item)
        .add(position_class)
        .add_if(TimelineClass::Last, || props.last)
        .add_raw(&props.class)
        .build();

    let dot_style = if props.color.is_empty() {
        String::new()
    } else {
        format!("background-color: {}; border-color: {};", props.color, props.color)
    };

    rsx! {
        div {
            class: "{item_classes}",
            style: "{props.style}",

            // Timeline dot
            div {
                class: "{TimelineClass::Dot.as_class()}",
                style: "{dot_style}",
                {props.icon}
            }

            // Timeline content
            div {
                class: "{TimelineClass::Content.as_class()}",

                if !props.time.is_empty() {
                    div {
                        class: "{TimelineClass::Time.as_class()}",
                        "{props.time}"
                    }
                }

                if !props.title.is_empty() {
                    div {
                        class: "{TimelineClass::Title.as_class()}",
                        "{props.title}"
                    }
                }

                {props.children}
            }
        }
    }
}

impl StyledComponent for TimelineComponent {
    fn styles() -> &'static str {
        r#"
.hi-timeline {
    position: relative;
    padding: 1rem 0;
}

.hi-timeline::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 2px;
    background: linear-gradient(
        to bottom,
        var(--hi-color-border),
        var(--hi-color-primary)
    );
    transform: translateX(-50%);
}

.hi-timeline-alternate .hi-timeline-item:nth-child(odd) {
    flex-direction: row-reverse;
}

.hi-timeline-left .hi-timeline-item,
.hi-timeline-right .hi-timeline-item {
    flex-direction: row;
}

.hi-timeline-left .hi-timeline-item {
    text-align: left;
}

.hi-timeline-right .hi-timeline-item {
    text-align: right;
    flex-direction: row-reverse;
}

.hi-timeline-no-line::before {
    display: none;
}

.hi-timeline-item {
    display: flex;
    align-items: flex-start;
    gap: 1.5rem;
    margin-bottom: 2rem;
    position: relative;
}

.hi-timeline-item:last-child {
    margin-bottom: 0;
}

.hi-timeline-dot {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: var(--hi-color-primary);
    border: 3px solid var(--hi-color-bg-container);
    box-shadow: 0 0 0 2px var(--hi-color-primary),
                0 0 8px var(--hi-color-primary-glow);
    flex-shrink: 0;
    z-index: 1;
    transition: all 0.3s ease;
}

.hi-timeline-dot:hover {
    transform: scale(1.2);
    box-shadow: 0 0 0 2px var(--hi-color-primary),
                0 0 16px var(--hi-color-primary-glow);
}

.hi-timeline-content {
    flex: 1;
    padding: 1rem;
    background-color: var(--hi-color-bg-elevated);
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    transition: all 0.3s ease;
}

.hi-timeline-content:hover {
    border-color: var(--hi-color-primary);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1),
                0 0 8px var(--hi-color-primary-glow);
}

.hi-timeline-time {
    font-size: 0.75rem;
    color: var(--hi-color-text-secondary);
    margin-bottom: 0.25rem;
    font-weight: 500;
}

.hi-timeline-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--hi-color-text-primary);
    margin-bottom: 0.5rem;
}

.hi-timeline-last::after {
    display: none;
}
"#
    }

    fn name() -> &'static str {
        "timeline"
    }
}
