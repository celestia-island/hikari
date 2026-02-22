// packages/components/src/feedback/progress.rs
// Progress component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, ProgressClass};

use crate::styled::StyledComponent;

pub struct ProgressComponent;

#[derive(Clone, PartialEq, Props)]
pub struct ProgressProps {
    pub value: f64,

    #[props(default = 100.0)]
    pub max: f64,

    #[props(default)]
    pub progress_type: ProgressType,

    #[props(default)]
    pub status: ProgressStatus,

    #[props(default = false)]
    pub show_info: bool,

    #[props(default)]
    pub class: String,

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
}

#[component]
pub fn Progress(props: ProgressProps) -> Element {
    let percentage = (props.value / props.max * 100.0).clamp(0.0, 100.0);

    let wrapper_classes = ClassesBuilder::new()
        .add(ProgressClass::Wrapper)
        .add_raw(&props.class)
        .build();

    let status_class = match props.status {
        ProgressStatus::Normal => "hi-progress-normal",
        ProgressStatus::Active => "hi-progress-active",
    };

    rsx! {
        div {
            class: "{wrapper_classes} {status_class}",
            style: "{props.style}",

            if props.progress_type == ProgressType::Linear {
                div { class: "hi-progress-outer",
                    div { class: "hi-progress-inner",
                        div {
                            class: "hi-progress-bg",
                            style: "width: {percentage}%;",
                        }
                    }

                    if props.show_info {
                        span { class: "hi-progress-text",
                            "{percentage:.0}%"
                        }
                    }
                }
            } else {
                div { class: "hi-progress-circle-wrapper",
                    svg {
                        class: "hi-progress-circle",
                        width: "120",
                        height: "120",
                        view_box: "0 0 120 120",

                        circle {
                            class: "hi-progress-circle-trail",
                            cx: "60",
                            cy: "60",
                            r: "54",
                            stroke_width: "6",
                            fill: "none",
                        }

                        circle {
                            class: "hi-progress-circle-path",
                            cx: "60",
                            cy: "60",
                            r: "54",
                            stroke_width: "6",
                            fill: "none",
                            stroke_linecap: "round",
                            stroke_dasharray: "{339.292}",
                            stroke_dashoffset: "{339.292 * (1.0 - percentage / 100.0)}",
                            transform: "rotate(-90 60 60)",
                        }
                    }

                    if props.show_info {
                        span { class: "hi-progress-circle-text",
                            "{percentage:.0}%"
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

.hi-progress-outer {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

.hi-progress-inner {
    flex: 1;
    background-color: var(--hi-color-background, #f5f5f5);
    border-radius: 100px;
    overflow: hidden;
    height: 8px;
}

.hi-progress-bg {
    height: 100%;
    border-radius: 100px;
    background-color: var(--hi-color-primary, #1890ff);
    transition: width 0.3s ease;
}

.hi-progress-text {
    flex-shrink: 0;
    font-size: 14px;
    color: var(--hi-color-text-primary, #333);
    min-width: 40px;
    text-align: right;
}

/* Status variants */
.hi-progress-active .hi-progress-bg {
    background: linear-gradient(90deg, var(--hi-color-primary, #1890ff) 0%, #40a9ff 100%);
    animation: hi-progress-active 2s linear infinite;
}

@keyframes hi-progress-active {
    0% { background-position: 0% 50%; }
    100% { background-position: 200% 50%; }
}

/* Circular progress */
.hi-progress-circle-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.hi-progress-circle {
    display: block;
}

.hi-progress-circle-trail {
    stroke: var(--hi-color-background, #f5f5f5);
}

.hi-progress-circle-path {
    stroke: var(--hi-color-primary, #1890ff);
    transition: stroke-dashoffset 0.3s ease;
}

.hi-progress-active .hi-progress-circle-path {
    stroke: var(--hi-color-primary, #1890ff);
}

.hi-progress-circle-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 24px;
    font-weight: 600;
    color: var(--hi-color-text-primary, #333);
}

[data-theme="dark"] .hi-progress-inner {
    background-color: var(--hi-surface-hover, #252525);
}

[data-theme="dark"] .hi-progress-circle-trail {
    stroke: var(--hi-surface-hover, #252525);
}

[data-theme="dark"] .hi-progress-text {
    color: var(--hi-text-primary, #e0e0e0);
}

[data-theme="dark"] .hi-progress-circle-text {
    color: var(--hi-text-primary, #e0e0e0);
}
"#
    }

    fn name() -> &'static str {
        "progress"
    }
}
