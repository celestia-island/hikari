// packages/components/src/feedback/progress.rs
// Progress component with Arknights + FUI styling

use hikari_palette::classes::{ClassesBuilder, ProgressClass};

use crate::{prelude::*, styled::StyledComponent};

pub struct ProgressComponent;

#[define_props]
pub struct ProgressProps {
    pub value: f64,

    #[default(100.0)]
    pub max: f64,

    pub progress_type: ProgressType,

    pub status: ProgressStatus,

    #[default(false)]
    pub show_info: bool,

    pub class: String,

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
        .add_typed(ProgressClass::Wrapper)
        .add(&props.class)
        .build();

    let status_class = match props.status {
        ProgressStatus::Normal => "hi-progress-normal",
        ProgressStatus::Active => "hi-progress-active",
    };

    let combined_classes = format!("{wrapper_classes} {status_class}");
    let width_style = format!("width: {percentage:.0}%;");
    let stroke_dasharray_val = "339.292";
    let stroke_dashoffset_val = format!("{:.3}", 339.292 * (1.0 - percentage / 100.0));
    let percentage_text = format!("{percentage:.0}%");

    rsx! {
        div {
            class: combined_classes,
            style: props.style,

            {if props.progress_type == ProgressType::Linear {
                rsx! {
                    div {
                        class: "hi-progress-outer",
                        div {
                            class: "hi-progress-inner",
                            div {
                                class: "hi-progress-bg",
                                style: width_style,
                            }
                        }

                        if props.show_info {
                            span { class: "hi-progress-text",
                                percentage_text
                            }
                        }
                    }
                }
            } else {
                rsx! {
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
                                stroke_dasharray: stroke_dasharray_val,
                                stroke_dashoffset: stroke_dashoffset_val,
                                transform: "rotate(-90 60 60)",
                            }
                        }

                        if props.show_info {
                            span { class: "hi-progress-circle-text",
                                percentage_text
                            }
                        }
                    }
                }
            }}
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
    background-color: var(--hi-component-selection-surface);
    border: 1px solid var(--hi-component-selection-border);
    border-radius: 100px;
    overflow: hidden;
    height: 8px;
}

.hi-progress-bg {
    height: 100%;
    border-radius: 100px;
    background: var(--hi-component-selection-bg);
    transition: width 0.3s ease;
}

.hi-progress-text {
    flex-shrink: 0;
    font-size: 14px;
    color: var(--hi-text-primary);
    min-width: 40px;
    text-align: right;
}

/* Active status */
.hi-progress-active .hi-progress-bg {
    animation: hi-progress-active 2s linear infinite;
}

@keyframes hi-progress-active {
    0% { opacity: 1; }
    50% { opacity: 0.7; }
    100% { opacity: 1; }
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
    stroke: var(--hi-component-selection-surface);
}

.hi-progress-circle-path {
    stroke: var(--hi-primary);
    transition: stroke-dashoffset 0.3s ease;
}

.hi-progress-active .hi-progress-circle-path {
    animation: hi-progress-circle-active 2s linear infinite;
}

@keyframes hi-progress-circle-active {
    0% { opacity: 1; }
    50% { opacity: 0.7; }
    100% { opacity: 1; }
}

.hi-progress-circle-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 24px;
    font-weight: 600;
    color: var(--hi-text-primary);
}
"#
    }

    fn name() -> &'static str {
        "progress"
    }
}
