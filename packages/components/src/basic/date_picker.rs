// packages/components/src/basic/date_picker.rs
// DatePicker component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, DatePickerClass};

use crate::styled::StyledComponent;

/// DatePicker component type wrapper (for StyledComponent)
pub struct DatePickerComponent;

#[derive(Clone, PartialEq, Props)]
pub struct DatePickerProps {
    /// Current date value
    #[props(default)]
    pub value: Option<String>,

    /// Minimum date (optional)
    #[props(default)]
    pub min: Option<String>,

    /// Maximum date (optional)
    #[props(default)]
    pub max: Option<String>,

    /// Date format (default: YYYY-MM-DD)
    #[props(default = "YYYY-MM-DD".to_string())]
    pub format: String,

    /// Placeholder text
    #[props(default)]
    pub placeholder: Option<String>,

    /// Whether the input is disabled
    #[props(default = false)]
    pub disabled: bool,

    /// Whether the input is readonly
    #[props(default = false)]
    pub readonly: bool,

    /// Additional CSS class
    #[props(default)]
    pub class: String,

    /// Additional inline style
    #[props(default)]
    pub style: String,

    /// Callback when date changes
    pub on_change: Option<EventHandler<String>>,

    /// Callback on focus
    #[props(default)]
    pub on_focus: Option<EventHandler<FocusEvent>>,

    /// Callback on blur
    #[props(default)]
    pub on_blur: Option<EventHandler<FocusEvent>>,
}

#[component]
pub fn DatePicker(props: DatePickerProps) -> Element {
    let wrapper_classes = ClassesBuilder::new()
        .add(DatePickerClass::DatePickerWrapper)
        .add_raw(&props.class)
        .build();

    let input_classes = ClassesBuilder::new()
        .add(DatePickerClass::DatePicker)
        .build();

    let disabled_class = if props.disabled {
        "hi-date-picker-disabled"
    } else {
        ""
    };

    let display_value = props.value.clone().unwrap_or_default();

    rsx! {
        div {
            class: "{wrapper_classes}",
            style: "{props.style}",

            input {
                class: "{input_classes}",
                class: "{disabled_class}",
                r#type: "date",
                value: display_value,
                min: props.min,
                max: props.max,
                disabled: props.disabled,
                readonly: props.readonly,
                placeholder: props.placeholder,
                onchange: move |e| {
                    if let Some(handler) = props.on_change.as_ref() {
                        handler.call(e.data.value());
                    }
                },
                onfocus: move |e| {
                    if let Some(handler) = props.on_focus.as_ref() {
                        handler.call(e);
                    }
                },
                onblur: move |e| {
                    if let Some(handler) = props.on_blur.as_ref() {
                        handler.call(e);
                    }
                },
            }

            // Calendar icon
            svg {
                class: "hi-date-picker-icon",
                view_box: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                stroke_width: "2",
                rect { x: "3", y: "4", width: "18", height: "18", rx: "2", ry: "2" }
                line { x1: "16", y1: "2", x2: "16", y2: "6" }
                line { x1: "8", y1: "2", x2: "8", y2: "6" }
                line { x1: "3", y1: "10", x2: "21", y2: "10" }
            }
        }
    }
}

impl StyledComponent for DatePickerComponent {
    fn styles() -> &'static str {
        r#"
.hi-date-picker-wrapper {
    position: relative;
    width: 100%;
}

.hi-date-picker {
    width: 100%;
    height: 36px;
    padding: 0.5rem 2.5rem 0.5rem 0.75rem;
    border: 1px solid var(--hi-color-border);
    border-radius: 6px;
    background-color: var(--hi-color-background);
    color: var(--hi-color-text-primary);
    font-size: 0.875rem;
    font-family: inherit;
    transition: all 0.3s ease;
    cursor: pointer;
}

.hi-date-picker:hover:not(:disabled) {
    border-color: var(--hi-color-primary);
    box-shadow: 0 0 0 3px rgba(var(--hi-color-primary-rgb), 0.1);
}

.hi-date-picker:focus {
    outline: none;
    border-color: var(--hi-color-primary);
    box-shadow: 0 0 0 3px rgba(var(--hi-color-primary-rgb), 0.15);
}

.hi-date-picker-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: var(--hi-color-surface);
}

.hi-date-picker-icon {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: var(--hi-color-text-secondary);
    pointer-events: none;
}

.hi-date-picker:hover:not(:disabled) + .hi-date-picker-icon {
    color: var(--hi-color-primary);
}
"#
    }

    fn name() -> &'static str {
        "date_picker"
    }
}
