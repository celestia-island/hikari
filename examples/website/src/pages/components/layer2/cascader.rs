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

    rsx! {
        div { id: "page-component-cascader", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Cascader" }
                p { class: "page-header__subtitle",
                    "Multi-level selection component for hierarchical data such as locations, categories, or org charts."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Location Picker" }
                    div { class: "demo-block__body",
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
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Category Selector" }
                    div { class: "demo-block__body",
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
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Disabled Cascader" }
                    div { class: "demo-block__body",
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
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                            tbody {
                                tr { td { code { "options" } } td { code { "CascaderOption[]" } } td { code { "-" } } td { "Hierarchical data source" } }
                                tr { td { code { "value" } } td { code { "string[]" } } td { code { "-" } } td { "Selected path values" } }
                                tr { td { code { "placeholder" } } td { code { "string" } } td { code { "Select" } } td { "Input placeholder text" } }
                                tr { td { code { "disabled" } } td { code { "bool" } } td { code { "false" } } td { "Disable the cascader" } }
                                tr { td { code { "multiple" } } td { code { "bool" } } td { code { "false" } } td { "Allow multiple selections" } }
                                tr { td { code { "expandTrigger" } } td { code { "click | hover" } } td { code { "click" } } td { "How to expand sub-menus" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
