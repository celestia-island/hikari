// hi-components/src/navigation/stepper.rs
// Stepper component with Arknights + FUI styling

use hikari_palette::classes::{ClassesBuilder, StepperClass, TypedClass};

use crate::{prelude::*, styled::StyledComponent};

pub struct StepperComponent;

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum StepStatus {
    #[default]
    Wait,
    Process,
    Finish,
    Error,
}

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

///
#[component]
pub fn Stepper(props: StepperProps) -> Element {
    let direction_class = match props.direction {
        StepperDirection::Horizontal => StepperClass::Horizontal,
        StepperDirection::Vertical => StepperClass::Vertical,
    };

    let stepper_classes = ClassesBuilder::new()
        .add_typed(StepperClass::Stepper)
        .add_typed(direction_class)
        .add(&props.class)
        .build();

    let step_number_class = StepperClass::StepNumber.class_name();
    let connector_class = StepperClass::StepConnector.class_name();
    let connector_vertical_class = StepperClass::StepConnectorVertical.class_name();

    rsx! {
        div { class: stepper_classes,
            for index in 0..props.total {
                {
                    let step_classes = ClassesBuilder::new()
                        .add_typed(StepperClass::Step)
                        .add_typed(
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
.hi-stepper {
    display: flex;
    align-items: center;
    padding: 16px 0;
}

.hi-stepper-vertical {
    flex-direction: column;
    align-items: flex-start;
}

.hi-step {
    display: flex;
    align-items: center;
    position: relative;
}

.hi-stepper-vertical .hi-step {
    width: 100%;
    padding-bottom: 24px;
}

.hi-step-number {
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

.hi-step-pending .hi-step-number {
    background-color: var(--hi-color-primary);
    color: white;
    box-shadow: 0 0 8px var(--hi-color-primary-glow);
}

.hi-step-active .hi-step-number {
    background-color: var(--hi-color-bg-elevated);
    border: 2px solid var(--hi-color-primary);
    color: var(--hi-color-primary);
}

.hi-step-finished .hi-step-number {
    background-color: var(--hi-color-bg-elevated);
    border: 1px solid var(--hi-color-border);
    color: var(--hi-text-secondary);
}

.hi-step-connector {
    height: 2px;
    min-width: 32px;
    flex: 1;
    background-color: var(--hi-color-border);
    margin: 0 8px;
}

.hi-step-connector-vertical {
    width: 2px;
    height: 24px;
    background-color: var(--hi-color-border);
    position: absolute;
    left: 15px;
    top: 32px;
}

[data-theme="dark"] .hi-step-active .hi-step-number {
    background-color: var(--hi-surface);
}

[data-theme="dark"] .hi-step-finished .hi-step-number {
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
    fn test_step_status() {
        let wait = StepStatus::Wait;
        assert_eq!(wait, StepStatus::default());
    }

    #[test]
    fn test_stepper_default() {
        let props = StepperProps::default();
        assert_eq!(props.current, 0);
        assert_eq!(props.total, 5);
        assert_eq!(props.direction, StepperDirection::default());
    }
}
