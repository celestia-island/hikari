use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn make_num_input(value: &str, step: &str, min: &str, max: &str, extra_class: &str) -> VNode {
    let mut classes = "hi-number-input".to_string();
    if !extra_class.is_empty() {
        classes.push_str(" ");
        classes.push_str(extra_class);
    }
    glow_wrap(
        rsx! {
            div { class: classes.as_str(),
                button { class: "hi-number-input__btn", "-" }
                input { class: "hi-number-input__input", r#type: "number", value: value, step: step, min: min, max: max }
                button { class: "hi-number-input__btn", "+" }
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
    let num_large = make_num_input("100", "10", "", "", "hi-number-input--lg");
    let num_disabled = make_num_input("0", "1", "", "", "hi-number-input--disabled");
    let num_small = make_num_input("5", "1", "", "", "hi-number-input--sm");

    render_demo_page(
        "page-component-number-input",
        "Number Input",
        "Numeric field with increment and decrement controls. Supports decimal steps, range limits, and sizes.",
        rsx! {
            {render_demo_block("Basic Number Input",
                render_demo_row({num_basic})
            )}
            {render_demo_block("Decimal Step",
                render_demo_row({num_decimal})
            )}
            {render_demo_block("With Range",
                render_demo_row(
                    rsx! {
                        {num_range}
                        span { style: "color:var(--hi-color-text-secondary);font-size:13px;", "Min: 0, Max: 100" }
                    }
                )
            )}
            {render_demo_block("Sizes",
                render_demo_row(
                    rsx! {
                        {num_small}
                        {make_num_input("0", "1", "", "", "")}
                        {num_large}
                    }
                )
            )}
            {render_demo_block("Disabled",
                render_demo_row({num_disabled})
            )}
            {render_demo_block("API",
                render_api_table(&[
                    ("value", "number", "0", "Current numeric value"),
                    ("min", "number", "-Infinity", "Minimum allowed value"),
                    ("max", "number", "Infinity", "Maximum allowed value"),
                    ("step", "number", "1", "Increment/decrement step size"),
                    ("disabled", "bool", "false", "Disable the control"),
                    ("size", "small | default | large", "default", "Input size preset"),
                ])
            )}
        },
    )
}
