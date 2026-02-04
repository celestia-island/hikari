// packages/components/src/feedback/progress.rs
// Progress component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::ClassesBuilder;

use crate::styled::StyledComponent;

/// Progress component type wrapper (for StyledComponent)
pub struct ProgressComponent;

/// Progress component with Arknights + FUI styling
///
/// A progress bar component with configurable percentage, size, and status.
/// Supports linear (bar) and circular (spinner) styles.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Progress;
///
/// fn app() -> Element {
///     let mut progress = use_signal(|| 65);
///
///     rsx! {
///         Progress {
///             value: progress(),
///             max: 100,
///             show_info: true,
///         }
///     }
/// }
/// ```
#[derive(Clone, PartialEq, Props)]
pub struct ProgressProps {
    /// Current progress value
    pub value: f64,

    /// Maximum value (default: 100)
    #[props(default = 100.0)]
    pub max: f64,

    /// Progress bar type
    #[props(default)]
    pub progress_type: ProgressType,

    /// Progress status
    #[props(default)]
    pub status: ProgressStatus,

    /// Show percentage text
    #[props(default = false)]
    pub show_info: bool,

    /// Additional CSS class
    #[props(default)]
    pub class: String,

    /// Additional inline style
    #[props(default)]
    pub style: String,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ProgressType {
    #[default]
    Linear,
    Circular,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ProgressStatus {
    #[default]
    Normal,
    Active,
    Exception,
    Success,
}

#[component]
pub fn Progress(props: ProgressProps) -> Element {
    let percentage = (props.value / props.max * 100.0).clamp(0.0, 100.0);

    let wrapper_classes = ClassesBuilder::new()
        .add_raw("hi-progress-wrapper")
        .add_raw(&props.class)
        .build();

    let progress_classes = ClassesBuilder::new()
        .add_raw("hi-progress")
        .add_raw(match props.progress_type {
            ProgressType::Linear => "hi-progress-linear",
            ProgressType::Circular => "hi-progress-circular",
        })
        .add_raw(match props.status {
            ProgressStatus::Normal => "hi-progress-normal",
            ProgressStatus::Active => "hi-progress-active",
            ProgressStatus::Exception => "hi-progress-exception",
            ProgressStatus::Success => "hi-progress-success",
        })
        .build();

    let bar_style = if props.progress_type == ProgressType::Linear {
        format!("width: {}%;", percentage)
    } else {
        String::new()
    };

    let circumference = 2.0 * std::f64::consts::PI * 30.0; // radius 30
    let offset = circumference * (1.0 - percentage / 100.0);
    let stroke_dasharray = format!("{circumference} {offset}");

    rsx! {
        div {
            class: "{wrapper_classes}",
            style: "{props.style}",

            if props.progress_type == ProgressType::Linear {
                // Linear progress bar
                div {
                    class: "{progress_classes}",
                    style: "{bar_style}",

                    if props.show_info {
                        span {
                            class: "hi-progress-info",
                            "{percentage:.0}%"
                        }
                    }
                }
            } else {
                // Circular progress spinner
                div {
                    class: "{progress_classes}",

                    if props.show_info {
                        span {
                            class: "hi-progress-info",
                            "{percentage:.0}%"
                        }
                    }

                    svg {
                        width: "64px",
                        height: "64px",
                        view_box: "0 0 36 36",
                        class: "hi-progress-circle",

                        circle {
                            cx: "18",
                            cy: "18",
                            r: "15.9",
                            stroke: "currentColor",
                            stroke_width: "3",
                            stroke_dasharray: "{stroke_dasharray}",
                            stroke_dashoffset: "{offset}",
                            fill: "none",
                        }
                    }
                }
            }
        }
    }
}

impl StyledComponent for ProgressComponent {
    fn styles() -> &'static str {
        r#"
.hi-progress-wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.hi-progress {
    position: relative;
    overflow: hidden;
}

.hi-progress-linear {
    height: 8px;
    background-color: var(--hi-color-background);
    border-radius: 8px;
    transition: all 0.3s ease;
}

.hi-progress-normal .hi-progress-linear {
    background-color: var(--hi-color-border);
}

.hi-progress-active .hi-progress-linear {
    background-color: var(--hi-color-primary);
}

.hi-progress-exception .hi-progress-linear {
    background-color: var(--hi-color-warning);
}

.hi-progress-success .hi-progress-linear {
    background-color: var(--hi-color-success);
}

.hi-progress-circular {
    width: 64px;
    height: 64px;
    display: inline-block;
    position: relative;
}

.hi-progress-circle {
    transform: rotate(-90deg);
    transition: stroke-dashoffset 0.3s ease;
}

.hi-progress-normal .hi-progress-circle circle {
    stroke: var(--hi-color-border);
}

.hi-progress-active .hi-progress-circle circle {
    stroke: var(--hi-color-primary);
}

.hi-progress-exception .hi-progress-circle circle {
    stroke: var(--hi-color-warning);
}

.hi-progress-success .hi-progress-circle circle {
    stroke: var(--hi-color-success);
}

.hi-progress-info {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--hi-color-text-primary);
}
"#
    }

    fn name() -> &'static str {
        "progress"
    }
}
