use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-cascader", "Cascader", "Multi-level selection component for hierarchical data such as locations, categories, or org charts.", rsx! [
        {render_demo_block("Location Picker", rsx! {
            div {
                {glow_wrap(
                    rsx! {
                        div { class: "hi-cascader-wrapper",
                            div { class: "hi-cascader",
                                {glow_wrap(
                                    rsx! {
                                        div { class: "hi-cascader-display",
                                            span { class: "hi-cascader-text", "Select location" }
                                            span { class: "hi-cascader-arrow", "▾" }
                                        }
                                    },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                        }
                    },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                )}
            }
        })}
        {render_demo_block("Cascader (Expanded)", rsx! {
            div {
                {glow_wrap(
                    rsx! {
                        div { class: "hi-cascader-wrapper",
                            div { class: "hi-cascader hi-cascader-open",
                                {glow_wrap(
                                    rsx! {
                                        div { class: "hi-cascader-display",
                                            span { class: "hi-cascader-text", "China / Beijing" }
                                            span { class: "hi-cascader-arrow", "▾" }
                                        }
                                    },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                div { class: "hi-cascader-dropdown",
                                    div { class: "hi-cascader-menu",
                                        ul { class: "hi-cascader-menu-list",
                                            li { class: "hi-cascader-menu-item hi-cascader-menu-item-selected", "China" }
                                            li { class: "hi-cascader-menu-item", "United States" }
                                            li { class: "hi-cascader-menu-item", "Japan" }
                                            li { class: "hi-cascader-menu-item", "Germany" }
                                        }
                                    }
                                    div { class: "hi-cascader-menu",
                                        ul { class: "hi-cascader-menu-list",
                                            li { class: "hi-cascader-menu-item hi-cascader-menu-item-selected", "Beijing" }
                                            li { class: "hi-cascader-menu-item", "Shanghai" }
                                            li { class: "hi-cascader-menu-item", "Shenzhen" }
                                            li { class: "hi-cascader-menu-item", "Hangzhou" }
                                        }
                                    }
                                    div { class: "hi-cascader-menu",
                                        ul { class: "hi-cascader-menu-list",
                                            li { class: "hi-cascader-menu-item", "Chaoyang" }
                                            li { class: "hi-cascader-menu-item", "Haidian" }
                                            li { class: "hi-cascader-menu-item", "Dongcheng" }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                )}
            }
        })}
        {render_demo_block("Category Selector", rsx! {
            div {
                {glow_wrap(
                    rsx! {
                        div { class: "hi-cascader-wrapper",
                            div { class: "hi-cascader",
                                {glow_wrap(
                                    rsx! {
                                        div { class: "hi-cascader-display",
                                            div { class: "hi-cascader-text", "Electronics / Mobile / Smartphones" }
                                        }
                                    },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                        }
                    },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                )}
            }
        })}
        {render_demo_block("Disabled Cascader", rsx! {
            div {
                {glow_wrap(
                    rsx! {
                        div { class: "hi-cascader-wrapper",
                            div { class: "hi-cascader hi-cascader-disabled",
                                {glow_wrap(
                                    rsx! {
                                        div { class: "hi-cascader-display",
                                            div { class: "hi-cascader-text", "Select location" }
                                        }
                                    },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                        }
                    },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                )}
            }
        })}
        {render_demo_block("API", rsx! {
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
        })}
    ])
}
