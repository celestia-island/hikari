// website/src/pages/components/entry/cascader_doc.rs
// Cascader component documentation page

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{
    entry::{Cascader as CascaderComponent, CascaderOption, CascaderSize},
    layout::{Container, Section},
};
use _palette::classes::{ClassesBuilder, FontSize, FontWeight, MarginBottom, TextColor};

// Code examples as constants
const CODE_BASIC: &str = r#"CascaderComponent {
    placeholder: "Select location".to_string(),
    size: CascaderSize::Md,
    options: vec![
        CascaderOption {
            label: "Zhejiang".to_string(),
            value: "zhejiang".to_string(),
            children: Some(vec![
                CascaderOption {
                    label: "Hangzhou".to_string(),
                    value: "hangzhou".to_string(),
                    ..Default::default()
                },
            ]),
            ..Default::default()
        },
    ],
    on_change: move |values| println!("{:?}", values),
}"#;

const CODE_CLEAR_SIZE: &str = r#"CascaderComponent {
    placeholder: "Select product".to_string(),
    size: CascaderSize::Lg,
    allow_clear: true,
    disabled: false,
    options: vec![...],
    on_change: move |values| println!("{:?}", values),
}"#;

const CODE_CONTROLLED: &str = r#"let mut selected = use_signal(|| Option::<Vec<String>>::None);

CascaderComponent {
    placeholder: "Select location".to_string(),
    value: selected(),
    options: vec![...],
    on_change: move |values| selected.set(Some(values)),
}"#;

#[allow(non_snake_case)]
pub fn Cascader() -> Element {
    let mut selected_cascader = use_signal(|| Option::<Vec<String>>::None);
    let mut cascader2_value = use_signal(|| Option::<Vec<String>>::None);

    rsx! {
        Layout {
            current_route: Route::Cascader {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Cascader"
                    }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        "Hierarchical dropdown selection component"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Cascader is a hierarchical dropdown selector that supports:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").build(),
                            li { "Nested option structure" }
                            li { "Keyboard navigation" }
                            li { "Multiple selection levels" }
                            li { "Clear selection option" }
                            li { "Disabled state" }
                            li { "Three size variants" }
                        }
                    }
                }

                // Basic Cascader
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
                            "Simple Cascader"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Basic cascader with hierarchical options"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            CascaderComponent {
                                placeholder: "Select location".to_string(),
                                size: CascaderSize::Md,
                                options: vec![
                                    CascaderOption {
                                        label: "Zhejiang".to_string(),
                                        value: "zhejiang".to_string(),
                                        children: Some(vec![
                                            CascaderOption {
                                                label: "Hangzhou".to_string(),
                                                value: "hangzhou".to_string(),
                                                children: Some(vec![
                                                    CascaderOption {
                                                        label: "West Lake".to_string(),
                                                        value: "west_lake".to_string(),
                                                        ..Default::default()
                                                    },
                                                    CascaderOption {
                                                        label: "Xixi Wetland".to_string(),
                                                        value: "xixi_wetland".to_string(),
                                                        ..Default::default()
                                                    },
                                                ]),
                                                ..Default::default()
                                            },
                                            CascaderOption {
                                                label: "Ningbo".to_string(),
                                                value: "ningbo".to_string(),
                                                ..Default::default()
                                            },
                                        ]),
                                        ..Default::default()
                                    },
                                    CascaderOption {
                                        label: "Jiangsu".to_string(),
                                        value: "jiangsu".to_string(),
                                        children: Some(vec![
                                            CascaderOption {
                                                label: "Nanjing".to_string(),
                                                value: "nanjing".to_string(),
                                                ..Default::default()
                                            },
                                            CascaderOption {
                                                label: "Suzhou".to_string(),
                                                value: "suzhou".to_string(),
                                                ..Default::default()
                                            },
                                        ]),
                                        ..Default::default()
                                    },
                                ],
                                on_change: move |values| selected_cascader.set(Some(values)),
                            }
                        }
                        if let Some(ref values) = selected_cascader().as_ref() {
                            div { class: ClassesBuilder::new().add_raw("mt-4").add(TextColor::Secondary).build(),
                                "Selected: {values.join(\" / \")}"
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
                            "With Clear Option"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Cascader with clear button to reset selection"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            CascaderComponent {
                                placeholder: "Select product".to_string(),
                                size: CascaderSize::Md,
                                allow_clear: true,
                                options: vec![
                                    CascaderOption {
                                        label: "Electronics".to_string(),
                                        value: "electronics".to_string(),
                                        children: Some(vec![
                                            CascaderOption {
                                                label: "Phones".to_string(),
                                                value: "phones".to_string(),
                                                ..Default::default()
                                            },
                                            CascaderOption {
                                                label: "Laptops".to_string(),
                                                value: "laptops".to_string(),
                                                ..Default::default()
                                            },
                                        ]),
                                        ..Default::default()
                                    },
                                    CascaderOption {
                                        label: "Clothing".to_string(),
                                        value: "clothing".to_string(),
                                        children: Some(vec![
                                            CascaderOption {
                                                label: "Men".to_string(),
                                                value: "men".to_string(),
                                                ..Default::default()
                                            },
                                            CascaderOption {
                                                label: "Women".to_string(),
                                                value: "women".to_string(),
                                                ..Default::default()
                                            },
                                        ]),
                                        ..Default::default()
                                    },
                                ],
                                value: cascader2_value(),
                                on_change: move |values| cascader2_value.set(Some(values)),
                            }
                        }
                    }
                }

                // Size Variants
                Section {
                    title: Some("Size Variants".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Small, Medium, Large"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Cascader in different sizes"
                        }
                        div { class: ClassesBuilder::new().add_raw("space-y-4").build(),
                            div { class: ClassesBuilder::new().add_raw("flex items-center gap-4").build(),
                                CascaderComponent {
                                    placeholder: "Small".to_string(),
                                    size: CascaderSize::Sm,
                                    options: vec![
                                        CascaderOption {
                                            label: "Option 1".to_string(),
                                            value: "1".to_string(),
                                            ..Default::default()
                                        },
                                    ],
                                    on_change: |_| {},
                                }
                            }
                            div { class: ClassesBuilder::new().add_raw("flex items-center gap-4").build(),
                                CascaderComponent {
                                    placeholder: "Medium".to_string(),
                                    size: CascaderSize::Md,
                                    options: vec![
                                        CascaderOption {
                                            label: "Option 1".to_string(),
                                            value: "1".to_string(),
                                            ..Default::default()
                                        },
                                    ],
                                    on_change: |_| {},
                                }
                            }
                            div { class: ClassesBuilder::new().add_raw("flex items-center gap-4").build(),
                                CascaderComponent {
                                    placeholder: "Large".to_string(),
                                    size: CascaderSize::Lg,
                                    options: vec![
                                        CascaderOption {
                                            label: "Option 1".to_string(),
                                            value: "1".to_string(),
                                            ..Default::default()
                                        },
                                    ],
                                    on_change: |_| {},
                                }
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
                            "Disabled Cascader"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Disabled cascader cannot be interacted with"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            CascaderComponent {
                                placeholder: "Disabled".to_string(),
                                size: CascaderSize::Md,
                                disabled: true,
                                options: vec![
                                    CascaderOption {
                                        label: "Option 1".to_string(),
                                        value: "1".to_string(),
                                        ..Default::default()
                                    },
                                ],
                                on_change: |_| {},
                            }
                        }
                    }
                }

                // Disabled Options
                Section {
                    title: Some("Disabled Options".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Individual Disabled Options"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Options can be individually disabled"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            CascaderComponent {
                                placeholder: "Select region".to_string(),
                                size: CascaderSize::Md,
                                options: vec![
                                    CascaderOption {
                                        label: "Region A".to_string(),
                                        value: "region_a".to_string(),
                                        disabled: false,
                                        ..Default::default()
                                    },
                                    CascaderOption {
                                        label: "Region B".to_string(),
                                        value: "region_b".to_string(),
                                        disabled: true,
                                        ..Default::default()
                                    },
                                    CascaderOption {
                                        label: "Region C".to_string(),
                                        value: "region_c".to_string(),
                                        disabled: false,
                                        ..Default::default()
                                    },
                                ],
                                on_change: |_| {},
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
                            "Basic Cascader"
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
                            "With Clear and Size"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_CLEAR_SIZE}" }
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
                            "Controlled Value"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_CONTROLLED}" }
                        }
                    }
                }
            }
        }
    }
}
