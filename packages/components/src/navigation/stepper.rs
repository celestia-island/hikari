// hi-components/src/navigation/stepper.rs
// Stepper component with Arknights + FUI styling

use dioxus::prelude::*;

/// Stepper component type wrapper
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

#[derive(Clone, PartialEq, Props)]
pub struct StepperProps {
    /// Current step index (0-based)
    #[props(default)]
    pub current: usize,

    /// Total number of steps
    #[props(default = 5)]
    pub total: usize,

    /// Step direction
    #[props(default)]
    pub direction: StepperDirection,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,
}

impl Default for StepperProps {
    fn default() -> Self {
        Self {
            current: 0,
            total: 5,
            direction: StepperDirection::default(),
            class: String::default(),
        }
    }
}

/// Stepper component
///
/// A step wizard component showing progress through a multi-step process
#[component]
pub fn Stepper(props: StepperProps) -> Element {
    let direction_class = match props.direction {
        StepperDirection::Horizontal => "hi-stepper-horizontal",
        StepperDirection::Vertical => "hi-stepper-vertical",
    };

    rsx! {
        div {
            class: "hi-stepper {direction_class} {props.class}",
            for index in 0..props.total {
                div {
                    class: if index < props.current {
                        "hi-step hi-step-pending"
                    } else if index == props.current {
                        "hi-step hi-step-active"
                    } else {
                        "hi-step hi-step-finished"
                    },

                    // Step number
                    div {
                        class: "hi-step-number",
                        "{index + 1}"
                    }

                    // Connector line (except for last step in horizontal mode)
                    if index < props.total - 1 && props.direction == StepperDirection::Horizontal {
                        div {
                            class: "hi-step-connector",
                        }
                    }

                    // Vertical connector line
                    if props.direction == StepperDirection::Vertical && index < props.total - 1 {
                        div {
                            class: "hi-step-connector-vertical",
                        }
                    }
                }
            }
        }
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
