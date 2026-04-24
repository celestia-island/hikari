use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    let btn_right = glow_wrap(
        rsx! { button { class: "hi-button hi-button-secondary hi-button-sm", "→" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Secondary,
            ..Default::default()
        },
    );
    let btn_left = glow_wrap(
        rsx! { button { class: "hi-button hi-button-secondary hi-button-sm", "←" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Secondary,
            ..Default::default()
        },
    );

    render_demo_page("page-component-cascader", "Cascader", "Multi-level selection component for hierarchical data such as locations, categories, or org charts.", VNode::Fragment(vec![
        render_demo_block("Location Picker", rsx! {
            div {
                {glow_wrap(
                    rsx! {
                        div { class: "hi-cascader",
                            {glow_wrap(
                                rsx! { input { class: "hi-cascader__input", placeholder: "Select location", readonly: "true" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                            div { class: "hi-cascader__dropdown",
                                div { class: "hi-cascader__menu",
                                    div { class: "hi-cascader__item hi-cascader__item--active", "China" }
                                    div { class: "hi-cascader__item", "United States" }
                                    div { class: "hi-cascader__item", "Japan" }
                                    div { class: "hi-cascader__item", "Germany" }
                                }
                                div { class: "hi-cascader__menu",
                                    div { class: "hi-cascader__item hi-cascader__item--active", "Beijing" }
                                    div { class: "hi-cascader__item", "Shanghai" }
                                    div { class: "hi-cascader__item", "Shenzhen" }
                                    div { class: "hi-cascader__item", "Hangzhou" }
                                }
                                div { class: "hi-cascader__menu",
                                    div { class: "hi-cascader__item", "Chaoyang" }
                                    div { class: "hi-cascader__item", "Haidian" }
                                    div { class: "hi-cascader__item", "Dongcheng" }
                                }
                            }
                        }
                    },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                )}
            }
        }),
        render_demo_block("Category Selector", rsx! {
            div {
                {glow_wrap(
                    rsx! {
                        div { class: "hi-cascader",
                            {glow_wrap(
                                rsx! { input { class: "hi-cascader__input", value: "Electronics › Mobile › Smartphones", readonly: "true" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                        }
                    },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                )}
            }
        }),
        render_demo_block("Disabled Cascader", rsx! {
            div {
                {glow_wrap(
                    rsx! {
                        div { class: "hi-cascader hi-cascader--disabled",
                            {glow_wrap(
                                rsx! { input { class: "hi-cascader__input", placeholder: "Select location", disabled: "true", readonly: "true" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                        }
                    },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                )}
            }
        }),
        render_demo_block("API", rsx! {
            div {
                {render_api_table(&[
                    ("options", "CascaderOption[]", "-", "Hierarchical data source"),
                    ("value", "string[]", "-", "Selected path values"),
                    ("placeholder", "string", "Select", "Input placeholder text"),
                    ("disabled", "bool", "false", "Disable the cascader"),
                    ("multiple", "bool", "false", "Allow multiple selections"),
                    ("expandTrigger", "click | hover", "click", "How to expand sub-menus"),
                ])}
            }
        }),
    ]))
}
