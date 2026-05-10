// packages/components/src/feedback/progress.rs
// Progress component with Arknights + FUI styling
// Active pulse: RAF-driven (migrated from CSS @keyframes)

use std::cell::RefCell;
use std::rc::Rc;

use hikari_palette::classes::{ClassesBuilder, ProgressClass};
use tairitsu_hooks::ReactiveSignal;

use crate::{platform, prelude::*, styled::StyledComponent};

pub struct ProgressComponent;

struct PulseState {
    phase: f64,
    last_ts: Option<f64>,
    stopped: bool,
}

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

    let opacity_signal = use_signal(|| 1.0_f64);
    let is_active = props.status == ProgressStatus::Active;

    {
        let op_clone = opacity_signal.clone();
        use_effect(move || {
            if !is_active {
                return;
            }
            let state = Rc::new(RefCell::new(PulseState {
                phase: 0.0,
                last_ts: None,
                stopped: false,
            }));
            let s_ref = state.clone();
            let op_sig = op_clone.clone();
            platform::request_animation_frame_with_timestamp(move |ts| {
                let mut s = s_ref.borrow_mut();
                if s.stopped {
                    return;
                }
                s.last_ts = Some(ts);
                drop(s);
                pulse_loop(s_ref.clone(), op_sig.clone());
            });
        });
    }

    let opacity = opacity_signal.get();
    let pulse_style = if is_active && opacity < 0.99 {
        format!("opacity: {opacity:.2};")
    } else {
        String::new()
    };

    let width_style = if is_active {
        format!("width: {percentage:.0}%; {pulse_style}")
    } else {
        format!("width: {percentage:.0}%;")
    };

    let stroke_dasharray_val = "339.292";
    let stroke_dashoffset_val = format!("{:.3}", 339.292 * (1.0 - percentage / 100.0));
    let percentage_text = format!("{percentage:.0}%");

    let aria_valuenow = props.value.to_string();
    let aria_valuemax = props.max.to_string();

    let circle_style = if is_active && opacity < 0.99 {
        format!("opacity: {opacity:.2};")
    } else {
        String::new()
    };

    rsx! {
        div {
            class: combined_classes,
            style: props.style,
            role: "progressbar",
            "aria-valuenow": aria_valuenow,
            "aria-valuemin": "0",
            "aria-valuemax": aria_valuemax,
            "aria-label": "Progress",

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
                                style: circle_style,
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

/* Active status — RAF-driven opacity pulse (migrated from CSS @keyframes) */
.hi-progress-active .hi-progress-bg {
  transition: opacity 0.1s linear;
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
  transition: opacity 0.1s linear;
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

const PULSE_PERIOD_MS: f64 = 2000.0;

fn pulse_loop(
    state: Rc<RefCell<PulseState>>,
    opacity_signal: ReactiveSignal<f64>,
) {
    platform::request_animation_frame_with_timestamp(move |ts| {
        let mut s = state.borrow_mut();
        if s.stopped {
            return;
        }
        let prev = s.last_ts.unwrap_or(ts);
        let delta = ts - prev;
        s.last_ts = Some(ts);
        s.phase = (s.phase + delta / PULSE_PERIOD_MS) % 1.0;
        let opacity = 1.0 - 0.3 * (2.0 * std::f64::consts::PI * s.phase).sin().max(0.0);
        drop(s);
        opacity_signal.set(opacity);
        pulse_loop(state.clone(), opacity_signal.clone());
    });
}
