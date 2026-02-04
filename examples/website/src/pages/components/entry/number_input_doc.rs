// website/src/pages/components/entry/number_input_doc.rs
// NumberInput component documentation page

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{
    entry::NumberInput,
    layout::{Container, Section},
};
use _palette::classes::{ClassesBuilder, FontSize, FontWeight, MarginBottom, TextColor};

// Code examples as constants
const CODE_BASIC: &str = r#"let mut value = use_signal(|| 0);

NumberInput {
    value: value(),
    on_change: move |v| value.set(v),
}"#;

const CODE_MIN_MAX_STEP: &str = r#"let mut value = use_signal(|| 50);

NumberInput {
    value: value(),
    on_change: move |v| value.set(v),
    min: 0,
    max: 100,
    step: 5,
}"#;

const CODE_DISABLED: &str = r#"NumberInput {
    value: 0,
    on_change: |_| {},
    disabled: true,
}"#;

const CODE_MIN_ONLY: &str = r#"NumberInput {
    value: 10,
    on_change: |_| {},
    min: 10,
}"#;

#[allow(non_snake_case)]
pub fn NumberInputDoc() -> Element {
    let mut value1 = use_signal(|| 0);
    let mut value2 = use_signal(|| 50);
    let mut value3 = use_signal(|| 10);
    let mut value4 = use_signal(|| 0);
    let mut value5 = use_signal(|| 100);

    rsx! {
        Layout {
            current_route: Route::NumberInputDoc {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "NumberInput"
                    }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        "Number input component with increment/decrement buttons"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "NumberInput is a numeric input component that supports:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").build(),
                            li { "Increment/decrement buttons" }
                            li { "Minimum and maximum values" }
                            li { "Step size control" }
                            li { "Disabled state" }
                            li { "Direct number input" }
                        }
                    }
                }

                // Basic NumberInput
                Section {
                    title: Some("Basic Usage".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Simple NumberInput"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Basic number input with default settings"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            NumberInput {
                                value: value1(),
                                on_change: move |v| value1.set(v),
                            }
                            div { class: ClassesBuilder::new().add_raw("mt-4").add(TextColor::Secondary).build(),
                                "Value: {value1()}"
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Min and Max"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Number input with minimum and maximum values"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            NumberInput {
                                value: value2(),
                                on_change: move |v| value2.set(v),
                                min: 0,
                                max: 100,
                            }
                            div { class: ClassesBuilder::new().add_raw("mt-4").add(TextColor::Secondary).build(),
                                "Value: {value2()}"
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Step"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Number input with custom step size"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            NumberInput {
                                value: value3(),
                                on_change: move |v| value3.set(v),
                                min: 0,
                                max: 100,
                                step: 5,
                            }
                            div { class: ClassesBuilder::new().add_raw("mt-4").add(TextColor::Secondary).build(),
                                "Value: {value3()} (step: 5)"
                            }
                        }
                    }
                }

                // Disabled State
                Section {
                    title: Some("Disabled State".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Disabled NumberInput"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Disabled number input cannot be interacted with"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            NumberInput {
                                value: value4(),
                                on_change: move |v| value4.set(v),
                                disabled: true,
                            }
                        }
                    }
                }

                // Various Constraints
                Section {
                    title: Some("Advanced Usage".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Min Only"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Number input with only minimum value constraint"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            NumberInput {
                                value: 10,
                                on_change: |_| {},
                                min: 10,
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Max Only"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Number input with only maximum value constraint"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            NumberInput {
                                value: 100,
                                on_change: |_| {},
                                max: 100,
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb0).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Large Step"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Number input with large step size"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            NumberInput {
                                value: value5(),
                                on_change: move |v| value5.set(v),
                                step: 10,
                            }
                            div { class: ClassesBuilder::new().add_raw("mt-4").add(TextColor::Secondary).build(),
                                "Value: {value5()} (step: 10)"
                            }
                        }
                    }
                }

                // Usage Examples
                Section {
                    title: Some("Usage Examples".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic NumberInput"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_BASIC}" }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Min, Max, and Step"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_MIN_MAX_STEP}" }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Disabled"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_DISABLED}" }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb0).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Min Only Constraint"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_MIN_ONLY}" }
                        }
                    }
                }
            }
        }
    }
}
