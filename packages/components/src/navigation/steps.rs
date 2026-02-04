// packages/components/src/navigation/steps.rs
// Steps component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::ClassesBuilder;

use crate::styled::StyledComponent;

/// Steps component type wrapper (for StyledComponent)
pub struct StepsComponent;

/// Step item status
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum StepStatus {
    #[default]
    Wait,
    Process,
    Finish,
    Error,
}

/// Steps component direction
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum StepsDirection {
    #[default]
    Horizontal,
    Vertical,
}

#[derive(Clone, PartialEq, Props)]
pub struct StepItemProps {
    /// Step title
    pub title: String,

    /// Step description (optional)
    #[props(default)]
    pub description: Option<String>,

    /// Step icon (optional)
    #[props(default)]
    pub icon: Option<String>,

    /// Step status
    #[props(default)]
    pub status: StepStatus,

    /// Additional CSS class
    #[props(default)]
    pub class: String,
}

#[derive(Clone, PartialEq, Props, Default)]
pub struct StepsProps {
    /// Current step index (0-based)
    #[props(default = 0)]
    pub current: usize,

    /// Direction of steps
    #[props(default)]
    pub direction: StepsDirection,

    /// Step items
    pub steps: Vec<StepItemProps>,

    /// Additional CSS class
    #[props(default)]
    pub class: String,

    /// Additional inline style
    #[props(default)]
    pub style: String,

    /// Callback when step changes (clickable)
    #[props(default)]
    pub on_change: Option<EventHandler<usize>>,
}

/// Steps component with Arknights + FUI styling
///
/// A steps wizard component that displays progress through a series of steps.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Steps;
///
/// fn app() -> Element {
///     rsx! {
///         Steps {
///             current: 1,
///             direction: StepsDirection::Horizontal,
///             steps: vec![
///                 StepItemProps { title: "Step 1".to_string() },
///                 StepItemProps { title: "Step 2".to_string() },
///                 StepItemProps { title: "Step 3".to_string() },
///             ],
///         }
///     }
/// }
/// ```
#[component]
pub fn Steps(props: StepsProps) -> Element {
    let wrapper_classes = ClassesBuilder::new()
        .add_raw("hi-steps-wrapper")
        .add_raw(&props.class)
        .build();

    let direction_class = match props.direction {
        StepsDirection::Horizontal => "hi-steps-horizontal",
        StepsDirection::Vertical => "hi-steps-vertical",
    };

    let step_items: Vec<_> = props
        .steps
        .iter()
        .enumerate()
        .map(|(index, step)| {
            let step_status = if index < props.current {
                StepStatus::Finish
            } else if index == props.current {
                StepStatus::Process
            } else {
                StepStatus::Wait
            };

            let status_class = match step_status {
                StepStatus::Wait => "hi-step-wait",
                StepStatus::Process => "hi-step-process",
                StepStatus::Finish => "hi-step-finish",
                StepStatus::Error => "hi-step-error",
            };

            let step_classes = ClassesBuilder::new()
                .add_raw("hi-step-item")
                .add_raw(status_class)
                .add_raw(&step.class)
                .build();

            let is_clickable = props.on_change.is_some();

            (index, step, step_classes, is_clickable, step_status)
        })
        .collect();

    rsx! {
        div {
            class: "{wrapper_classes}",
            style: "{props.style}",
            class: "{direction_class}",

            for (index, step, step_classes, is_clickable, step_status) in step_items {
                div {
                    class: "{step_classes}",
                    onclick: move |_e| {
                        if is_clickable
                            && let Some(handler) = props.on_change.as_ref() {
                                handler.call(index);
                            }
                    },

                    // Step indicator
                    div {
                        class: "hi-step-icon",

                        if step_status == StepStatus::Wait {
                            span { class: "hi-step-number", "{index + 1}" }
                        } else if step_status == StepStatus::Process {
                            span { class: "hi-step-number hi-step-number-process", "{index + 1}" }
                        } else if step_status == StepStatus::Finish {
                            svg {
                                class: "hi-step-number hi-step-number-finish",
                                view_box: "0 0 24 24",
                                fill: "none",
                                stroke: "currentColor",
                                stroke_width: "2",
                                polyline { points: "20 6 9 17 4 12" }
                            }
                        } else {
                            svg {
                                class: "hi-step-number hi-step-number-error",
                                view_box: "0 0 24 24",
                                fill: "none",
                                stroke: "currentColor",
                                stroke_width: "2",
                                circle { cx: "12", cy: "12", r: "10" }
                                line { x1: "12", y1: "8", x2: "12", y2: "12" }
                                line { x1: "12", y1: "16", x2: "12.01", y2: "16" }
                            }
                        }
                    }

                    // Step content
                    div {
                        class: "hi-step-content",
                        div { class: "hi-step-title", "{step.title}" }
                        if let Some(ref desc) = step.description {
                            div { class: "hi-step-description", "{desc}" }
                        }
                    }
                }
            }
        }
    }
}

impl StyledComponent for StepsComponent {
    fn styles() -> &'static str {
        r#"
.hi-steps-wrapper {
    display: flex;
    width: 100%;
}

.hi-steps-horizontal {
    flex-direction: row;
}

.hi-steps-vertical {
    flex-direction: column;
}

.hi-step-item {
    display: flex;
    align-items: flex-start;
    position: relative;
    flex: 1;
    padding: 0.5rem 1rem;
}

.hi-step-item:not(:last-child)::after {
    content: '';
    position: absolute;
    background-color: var(--hi-color-border);
}

.hi-steps-horizontal .hi-step-item:not(:last-child)::after {
    top: 1.5rem;
    left: 2rem;
    right: 1rem;
    height: 1px;
}

.hi-steps-vertical .hi-step-item:not(:last-child)::after {
    top: 1.5rem;
    left: 1.5rem;
    bottom: 0;
    width: 1px;
}

.hi-step-process .hi-step-icon .hi-step-number-process {
    background-color: var(--hi-color-primary);
    color: white;
    box-shadow: 0 0 8px rgba(var(--hi-color-primary-rgb), 0.5);
}

.hi-step-finish .hi-step-icon .hi-step-number-finish {
    color: var(--hi-color-primary);
    width: 1.5rem;
    height: 1.5rem;
}

.hi-step-error .hi-step-icon .hi-step-number-error {
    color: var(--hi-color-error);
    width: 1.5rem;
    height: 1.5rem;
}

.hi-step-icon {
    position: relative;
    z-index: 1;
    margin-right: 0.75rem;
}

.hi-step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    font-size: 0.875rem;
    font-weight: 600;
    background-color: var(--hi-color-surface);
    color: var(--hi-color-text-secondary);
    border: 2px solid var(--hi-color-border);
    transition: all 0.3s ease;
}

.hi-step-content {
    flex: 1;
}

.hi-step-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--hi-color-text-primary);
    margin-bottom: 0.25rem;
}

.hi-step-description {
    font-size: 0.75rem;
    color: var(--hi-color-text-secondary);
}

.hi-step-process .hi-step-title {
    color: var(--hi-color-primary);
}

.hi-step-finish .hi-step-title {
    color: var(--hi-color-text-primary);
}

.hi-step-wait .hi-step-title {
    color: var(--hi-color-text-secondary);
}

.hi-step-error .hi-step-title {
    color: var(--hi-color-error);
}
"#
    }

    fn name() -> &'static str {
        "steps"
    }
}
