use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

use crate::components::{demo_page::render_demo_page, glow::{GlowColor, GlowConfig, GlowIntensity, glow_wrap}};

fn make_num_input(value: &str, step: &str, min: &str, max: &str, extra_class: &str) -> VNode {
    let mut classes = "hi-number-input-wrapper".to_string();
    if !extra_class.is_empty() {
        classes.push_str(" ");
        classes.push_str(extra_class);
    }
    glow_wrap(
        rsx! {
            div { class: classes.as_str(),
                button { class: "hi-number-input-btn hi-number-input-btn-decrement", "-" }
                input { class: "hi-number-input-input", r#type: "number", value: value, step: step, min: min, max: max }
                button { class: "hi-number-input-btn hi-number-input-btn-increment", "+" }
            }
        },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    )
}

pub fn render() -> VNode {
    let num_basic = make_num_input("0", "1", "", "", "");
    let num_decimal = make_num_input("3.14", "0.01", "", "", "");
    let num_range = make_num_input("50", "1", "0", "100", "");
    let num_large = make_num_input("100", "10", "", "", "hi-number-input-lg");
    let num_disabled = make_num_input("0", "1", "", "", "");
    let num_small = make_num_input("5", "1", "", "", "hi-number-input-sm");

    render_demo_page(
        "page-component-number-input",
        "Number Input",
        "Numeric field with increment and decrement controls. Supports decimal steps, range limits, and sizes.",
        rsx! {
            div { class: "demo-block",
                h3 { class: "demo-block__title", "Basic Number Input" }
                div { class: "demo-block__body",
                    div { class: "demo-row",
                        {num_basic}
                    }
                }
            }
            div { class: "demo-block",
                h3 { class: "demo-block__title", "Decimal Step" }
                div { class: "demo-block__body",
                    div { class: "demo-row",
                        {num_decimal}
                    }
                }
            }
            div { class: "demo-block",
                h3 { class: "demo-block__title", "With Range" }
                div { class: "demo-block__body",
                    div { class: "demo-row",
                        {num_range}
                        span { class: "hi-number-input__hint", "Min: 0, Max: 100" }
                    }
                }
            }
            div { class: "demo-block",
                h3 { class: "demo-block__title", "Sizes" }
                div { class: "demo-block__body",
                    div { class: "demo-row",
                        {num_small}
                        {make_num_input("0", "1", "", "", "")}
                        {num_large}
                    }
                }
            }
            div { class: "demo-block",
                h3 { class: "demo-block__title", "Disabled" }
                div { class: "demo-block__body",
                    div { class: "demo-row",
                        {num_disabled}
                    }
                }
            }
            div { class: "demo-block",
                h3 { class: "demo-block__title", "API" }
                div { class: "demo-block__body",
                    table { class: "api-table",
                        thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                        tbody {
                            tr { td { code { "value" } } td { code { "number" } } td { code { "0" } } td { "Current numeric value" } }
                            tr { td { code { "min" } } td { code { "number" } } td { code { "-Infinity" } } td { "Minimum allowed value" } }
                            tr { td { code { "max" } } td { code { "number" } } td { code { "Infinity" } } td { "Maximum allowed value" } }
                            tr { td { code { "step" } } td { code { "1" } } td { code { "default" } } td { "Increment/decrement step size" } }
                            tr { td { code { "disabled" } } td { code { "bool" } } td { code { "false" } } td { "Disable the control" } }
                            tr { td { code { "size" } } td { code { "small | default | large" } } td { code { "default" } } td { "Input size preset" } }
                        }
                    }
                }
            }
        },
    )
}
