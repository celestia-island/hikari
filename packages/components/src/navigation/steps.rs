// packages/components/src/navigation/steps.rs
// Steps component with Arknights + FUI styling

use crate::prelude::*;
use hikari_palette::classes::{ClassesBuilder, StepsClass, UtilityClass};

use crate::styled::StyledComponent;

pub struct StepsComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum StepStatus {
    #[default]
    Wait,
    Process,
    Finish,
    Error,
}

impl IntoAttrValue for StepStatus {
    fn into_attr_value(self) -> Option<String> {
        Some(match self {
            StepStatus::Wait => "wait".to_string(),
            StepStatus::Process => "process".to_string(),
            StepStatus::Finish => "finish".to_string(),
            StepStatus::Error => "error".to_string(),
        })
    }
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum StepsDirection {
    #[default]
    Horizontal,
    Vertical,
}

#[define_props]
#[derive(Debug)]
pub struct StepData {
    pub title: String,

    #[default]
    pub description: Option<String>,

    #[default]
    pub icon: Option<String>,

    #[default]
    pub status: StepStatus,

    #[default]
    pub class: String,
}

impl IntoAttrValue for StepData {
    fn into_attr_value(self) -> Option<String> {
        Some(self.title)
    }
}

#[define_props]
pub struct StepsProps {
    #[default(0)]
    pub current: usize,

    #[default]
    pub direction: StepsDirection,

    pub steps: Vec<StepData>,

    #[default]
    pub class: String,

    #[default]
    pub style: String,

    #[default]
    pub on_change: Option<Callback<usize, ()>>,
}

/// Internal data structure for step items
struct StepItemData {
    index: usize,
    step: StepData,
    step_classes: String,
    is_clickable: bool,
    step_status: StepStatus,
}

///
///
///
///
#[component]
pub fn Steps(props: StepsProps) -> Element {
    let direction_class = match props.direction {
        StepsDirection::Horizontal => StepsClass::Horizontal,
        StepsDirection::Vertical => StepsClass::Vertical,
    };

    let wrapper_classes = ClassesBuilder::new()
        .add(StepsClass::Wrapper)
        .add(direction_class)
        .add_raw(&props.class)
        .build();

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
                StepStatus::Wait => StepsClass::Wait,
                StepStatus::Process => StepsClass::Process,
                StepStatus::Finish => StepsClass::Finish,
                StepStatus::Error => StepsClass::Error,
            };

            let step_classes = ClassesBuilder::new()
                .add(StepsClass::Item)
                .add(status_class)
                .add_raw(&step.class)
                .build();

            let is_clickable = props.on_change.is_some();

            StepItemData {
                index,
                step: step.clone(),
                step_classes,
                is_clickable,
                step_status,
            }
        })
        .collect();

    let icon_class = StepsClass::Icon.as_class();
    let number_class = StepsClass::Number.as_class();
    let content_class = StepsClass::Content.as_class();
    let title_class = StepsClass::Title.as_class();
    let description_class = StepsClass::Description.as_class();

    let step_elements: Vec<Element> = step_items.into_iter().map(|item| {
        rsx! {
            StepItem {
                index: item.index,
                step: item.step,
                step_classes: item.step_classes,
                is_clickable: item.is_clickable,
                step_status: item.step_status,
                icon_class: icon_class.clone(),
                number_class: number_class.clone(),
                content_class: content_class.clone(),
                title_class: title_class.clone(),
                description_class: description_class.clone(),
                on_change: props.on_change.clone(),
            }
        }
    }).collect();

    rsx! {
        div {
            class: wrapper_classes,
            style: props.style,

            ..step_elements
        }
    }
}

/// Internal component for rendering individual step items
#[define_props]
#[derive(Debug)]
struct StepItemProps {
    #[default]
    index: usize,

    #[default]
    step: StepData,

    #[default]
    step_classes: String,

    #[default]
    is_clickable: bool,

    #[default]
    step_status: StepStatus,

    #[default]
    icon_class: String,
    #[props(default)]
    number_class: String,
    #[props(default)]
    content_class: String,
    #[props(default)]
    title_class: String,
    #[props(default)]
    description_class: String,
    #[props(default)]
    on_change: Option<Callback<usize, ()>>,
}

#[component]
fn StepItem(props: StepItemProps) -> Element {
    let step_number = props.index + 1;
    let step_title = props.step.title.clone();
    let step_description = props.step.description.clone();
    let index = props.index;
    let is_clickable = props.is_clickable;
    let on_change = props.on_change.clone();

    let icon_el = match props.step_status {
        StepStatus::Wait => rsx! {
            span { class: props.number_class, "{step_number}" }
        },
        StepStatus::Process => rsx! {
            span { class: props.number_class, "{step_number}" }
        },
        StepStatus::Finish => rsx! {
            svg {
                class: props.number_class,
                view_box: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                stroke_width: "2",
                polyline { points: "20 6 9 17 4 12" }
            }
        },
        StepStatus::Error => rsx! {
            svg {
                class: props.number_class,
                view_box: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                stroke_width: "2",
                circle { cx: "12", cy: "12", r: "10" }
                line { x1: "12", y1: "8", x2: "12", y2: "12" }
                line { x1: "12", y1: "16", x2: "12.01", y2: "16" }
            }
        },
    };

    let desc_el = if let Some(ref desc) = step_description {
        rsx! { div { class: props.description_class, "{desc}" } }
    } else {
        VNode::empty()
    };

    rsx! {
        div {
            class: props.step_classes,
            onclick: move |_e| {
                if is_clickable {
                    if let Some(handler) = on_change.as_ref() {
                        handler.call(index);
                    }
                }
            },

            // Step indicator
            div {
                class: props.icon_class,
                {icon_el}
            }

            // Step content
            div {
                class: props.content_class,
                div { class: props.title_class, step_title }
                {desc_el}
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
