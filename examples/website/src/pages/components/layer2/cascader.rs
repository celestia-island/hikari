use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-cascader", "Cascader", "Multi-level selection component for hierarchical data such as locations, categories, or org charts.", rsx! [
        style { r#"
.hi-cascader-wrapper{position:relative;display:inline-block;width:240px}
.hi-cascader{display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;border:2px solid var(--hi-gray-300,#d1d5db);border-radius:8px;background:#fff;cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease}
.hi-cascader:hover{border-color:var(--hi-gray-400,#9ca3af)}
.hi-cascader-open{border-color:var(--hi-pink,#F5A9A9);box-shadow:0 0 0 3px rgba(245,169,169,.2)}
.hi-cascader-display{display:flex;align-items:center;gap:.5rem;flex:1;min-width:0}
.hi-cascader-text{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hi-cascader-arrow{color:var(--hi-gray-400,#9ca3af);transition:transform .2s ease}
.hi-cascader-open .hi-cascader-arrow{transform:rotate(180deg)}
.hi-cascader-dropdown{display:none;position:absolute;top:calc(100% + 4px);left:0;z-index:1000;min-width:200px;max-height:320px;overflow:hidden;background:#fff;border:1px solid rgba(0,0,0,.12);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);flex-direction:row}
.hi-cascader-open .hi-cascader-dropdown{display:flex}
.hi-cascader-menu{min-width:160px;max-height:320px;overflow-y:auto;overflow-x:hidden;border-right:1px solid rgba(0,0,0,.08)}
.hi-cascader-menu:last-child{border-right:none}
.hi-cascader-menu-list{list-style:none;margin:0;padding:4px 0;display:flex;flex-direction:column;gap:2px}
.hi-cascader-menu-item{display:block;padding:6px 12px;margin:0 4px;border-radius:6px;font-size:13px;color:#333;line-height:1.5;cursor:pointer;user-select:none;transition:all .15s ease}
.hi-cascader-menu-item:hover,.hi-cascader-menu-item-selected{background:#eef2ff;color:#4338ca}
.hi-cascader-menu-item-selected{font-weight:600}
.hi-cascader-disabled{opacity:.5;pointer-events:none}
"# }
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
