//! Stepper — the crate's step bar, with Arknights + FUI styling.
//!
//! This is the single step-bar implementation in the crate. The former
//! `Steps` component was collapsed into it (its `#[deprecated]` thin alias now
//! lives in [`crate::navigation::steps`]), so the step bar, its direction enum
//! and its `hk-step*` class family each have exactly one definition.
//!
//! Step state is derived from `current`: steps before it render as completed,
//! the current one as active, the ones after it as upcoming. Horizontal step
//! bars join the steps with connector lines.

use hikari_palette::classes::{ClassesBuilder, StepperClass, UtilityClass};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct StepperComponent;

/// Layout direction of the step bar.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum StepperDirection {
    #[default]
    Horizontal,
    Vertical,
}

#[define_props]
pub struct StepperProps {
    #[default]
    pub current: usize,

    #[default(5)]
    pub total: usize,

    #[default]
    pub direction: StepperDirection,

    #[default]
    pub class: String,
}

/// Renders a horizontal or vertical step bar of `total` numbered steps.
///
/// The step at `current` is the active one; earlier steps read as completed and
/// later ones as upcoming. Consumers that need per-step titles, descriptions or
/// click handling render them alongside the bar instead.
#[component]
pub fn Stepper(props: StepperProps) -> Element {
    let direction_class = match props.direction {
        StepperDirection::Horizontal => StepperClass::Horizontal,
        StepperDirection::Vertical => StepperClass::Vertical,
    };

    let stepper_classes = ClassesBuilder::new()
        .add(StepperClass::Stepper)
        .add(direction_class)
        .add_raw(&props.class)
        .build();

    let step_number_class = StepperClass::StepNumber.as_class();
    let connector_class = StepperClass::StepConnector.as_class();
    let connector_vertical_class = StepperClass::StepConnectorVertical.as_class();

    rsx! {
        div { class: stepper_classes,
            for index in 0..props.total {
                {
                    let step_classes = ClassesBuilder::new()
                        .add(StepperClass::Step)
                        .add(
                            if index < props.current {
                                StepperClass::StepPending
                            } else if index == props.current {
                                StepperClass::StepActive
                            } else {
                                StepperClass::StepFinished
                            },
                        )
                        .build();
                    let step_number = index + 1;
                    rsx! {
                        div { class: {step_classes},

                            // Step number
                            div { class: step_number_class.clone(), "{step_number}" }

                            // Connector line (except for last step in horizontal mode)
                            {
                                if index < props.total - 1 && props.direction == StepperDirection::Horizontal {
                                    rsx! {
                                        div { class: connector_class.clone() }
                                    }
                                } else {
                                    VNode::empty()
                                }
                            }

                            // Vertical connector line
                            {
                                if props.direction == StepperDirection::Vertical && index < props.total - 1 {
                                    rsx! {
                                        div { class: connector_vertical_class.clone() }
                                    }
                                } else {
                                    VNode::empty()
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

impl StyledComponent for StepperComponent {
    fn styles() -> &'static str {
        r#"
.hk-stepper {
    display: flex;
    align-items: center;
    padding: 16px 0;
}

.hk-stepper-vertical {
    flex-direction: column;
    align-items: flex-start;
}

.hk-step {
    display: flex;
    align-items: center;
    position: relative;
}

.hk-stepper-vertical .hk-step {
    width: 100%;
    padding-bottom: 24px;
}

.hk-step-number {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.3s ease;
}

.hk-step-pending .hk-step-number {
    background-color: var(--hi-color-primary);
    color: var(--hi-color-text-on-solid, #ffffff);
    box-shadow: 0 0 8px var(--hi-color-primary-glow);
}

.hk-step-active .hk-step-number {
    background-color: var(--hi-color-bg-elevated);
    border: 2px solid var(--hi-color-primary);
    color: var(--hi-color-primary);
}

.hk-step-finished .hk-step-number {
    background-color: var(--hi-color-bg-elevated);
    border: 1px solid var(--hi-color-border);
    color: var(--hi-text-secondary);
}

.hk-step-connector {
    height: 2px;
    min-width: 32px;
    flex: 1;
    background-color: var(--hi-color-border);
    margin: 0 8px;
}

.hk-step-connector-vertical {
    width: 2px;
    height: 24px;
    background-color: var(--hi-color-border);
    position: absolute;
    left: 15px;
    top: 32px;
}

[data-theme="dark"] .hk-step-active .hk-step-number {
    background-color: var(--hi-surface);
}

[data-theme="dark"] .hk-step-finished .hk-step-number {
    background-color: var(--hi-surface);
}
"#
    }

    fn name() -> &'static str {
        "stepper"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stepper_direction() {
        let horizontal = StepperDirection::Horizontal;
        assert_eq!(horizontal, StepperDirection::default());
    }

    #[test]
    fn test_stepper_default() {
        let props = StepperProps::default();
        assert_eq!(props.current, 0);
        assert_eq!(props.total, 5);
        assert_eq!(props.direction, StepperDirection::default());
    }
}
