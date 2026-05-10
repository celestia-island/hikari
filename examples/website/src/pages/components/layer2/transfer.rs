use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-transfer", "Transfer", "Dual-panel transfer widget for moving items between two lists.", rsx! [
        {render_demo_block("Basic Transfer", rsx! {
            div { class: "hi-transfer",
                div { class: "hi-transfer__panel",
                    div { class: "hi-transfer__header",
                        span { "Available" }
                        span { class: "hi-transfer__count", "5" }
                    }
                    div { {glow_wrap(
                        rsx! { input { class: "hi-transfer__filter", placeholder: "Search...", r#type: "text" } },
                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                    )} }
                    div { class: "hi-transfer__list",
                        label { class: "hi-transfer__item", input { r#type: "checkbox" } " Rust" }
                        label { class: "hi-transfer__item", input { r#type: "checkbox" } " Go" }
                        label { class: "hi-transfer__item", input { r#type: "checkbox" } " Python" }
                        label { class: "hi-transfer__item", input { r#type: "checkbox" } " TypeScript" }
                        label { class: "hi-transfer__item", input { r#type: "checkbox" } " C++" }
                    }
                }
                div { class: "hi-transfer__actions",
                    div { {glow_wrap(
                        rsx! { button { class: "hi-button hi-button-primary hi-button-sm", attr: "type", "button", "\u{2192}" } },
                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                    )} }
                    div { {glow_wrap(
                        rsx! { button { class: "hi-button hi-button-primary hi-button-sm", attr: "type", "button", "\u{2190}" } },
                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                    )} }
                    div { {glow_wrap(
                        rsx! { button { class: "hi-button hi-button-secondary hi-button-sm", attr: "type", "button", "\u{21D2}" } },
                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Secondary, ..Default::default() },
                    )} }
                    div { {glow_wrap(
                        rsx! { button { class: "hi-button hi-button-secondary hi-button-sm", attr: "type", "button", "\u{21D0}" } },
                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Secondary, ..Default::default() },
                    )} }
                }
                div { class: "hi-transfer__panel",
                    div { class: "hi-transfer__header",
                        span { "Selected" }
                        span { class: "hi-transfer__count", "0" }
                    }
                    div { class: "hi-transfer__list" }
                }
            }
        })}
        {render_demo_block("Transfer with Pre-selected", rsx! {
            div { class: "hi-transfer",
                div { class: "hi-transfer__panel",
                    div { class: "hi-transfer__header",
                        span { "Team Members" }
                        span { class: "hi-transfer__count", "3" }
                    }
                    div { class: "hi-transfer__list",
                        label { class: "hi-transfer__item", input { r#type: "checkbox", checked: "true" } " Alice" }
                        label { class: "hi-transfer__item", input { r#type: "checkbox" } " Bob" }
                        label { class: "hi-transfer__item", input { r#type: "checkbox" } " Carol" }
                    }
                }
                div { class: "hi-transfer__actions",
                    div { {glow_wrap(
                        rsx! { button { class: "hi-button hi-button-primary hi-button-sm", attr: "type", "button", "\u{2192}" } },
                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                    )} }
                    div { {glow_wrap(
                        rsx! { button { class: "hi-button hi-button-primary hi-button-sm", attr: "type", "button", "\u{2190}" } },
                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                    )} }
                }
                div { class: "hi-transfer__panel",
                    div { class: "hi-transfer__header",
                        span { "Assigned" }
                        span { class: "hi-transfer__count", "2" }
                    }
                    div { class: "hi-transfer__list",
                        label { class: "hi-transfer__item", input { r#type: "checkbox" } " Dave" }
                        label { class: "hi-transfer__item", input { r#type: "checkbox" } " Eve" }
                    }
                }
            }
        })}
        {render_demo_block("Disabled Transfer", rsx! {
            div { class: "hi-transfer hi-transfer--disabled",
                div { class: "hi-transfer__panel",
                    div { class: "hi-transfer__header",
                        span { "Source" }
                        span { class: "hi-transfer__count", "4" }
                    }
                    div { class: "hi-transfer__list",
                        label { class: "hi-transfer__item", input { r#type: "checkbox", disabled: "true" } " Option A" }
                        label { class: "hi-transfer__item", input { r#type: "checkbox", disabled: "true" } " Option B" }
                        label { class: "hi-transfer__item", input { r#type: "checkbox", checked: "true", disabled: "true" } " Option C" }
                    }
                }
                 div { class: "hi-transfer__actions",
                    button { class: "hi-button hi-button-secondary hi-button-sm hi-button--disabled", "\u{2192}" }
                    button { class: "hi-button hi-button-secondary hi-button-sm hi-button--disabled", "\u{2190}" }
                }
                div { class: "hi-transfer__panel",
                    div { class: "hi-transfer__header",
                        span { "Target" }
                        span { class: "hi-transfer__count", "1" }
                    }
                    div { class: "hi-transfer__list",
                        label { class: "hi-transfer__item", input { r#type: "checkbox", disabled: "true", checked: "true" } " Option C" }
                    }
                }
            }
        })}
        {render_demo_block("One-Way Transfer", rsx! {
            div { class: "hi-transfer",
                div { class: "hi-transfer__panel",
                    div { class: "hi-transfer__header",
                        span { "Permissions" }
                        span { class: "hi-transfer__count", "4" }
                    }
                    div { class: "hi-transfer__list",
                        label { class: "hi-transfer__item", input { r#type: "checkbox" } " Read" }
                        label { class: "hi-transfer__item", input { r#type: "checkbox" } " Write" }
                        label { class: "hi-transfer__item", input { r#type: "checkbox" } " Delete" }
                        label { class: "hi-transfer__item", input { r#type: "checkbox" } " Admin" }
                    }
                }
                div { class: "hi-transfer__actions",
                    div { {glow_wrap(
                        rsx! { button { class: "hi-button hi-button-primary hi-button-sm", attr: "type", "button", "\u{2192}" } },
                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                    )} }
                }
                div { class: "hi-transfer__panel",
                    div { class: "hi-transfer__header",
                        span { "Granted" }
                        span { class: "hi-transfer__count", "0" }
                    }
                    div { class: "hi-transfer__list" }
                }
            }
        })}
        {render_demo_block("API", rsx! {
            div {
                {render_api_table(&[
                    ("dataSource", "TransferItem[]", "-", "Source data items"),
                    ("targetKeys", "string[]", "[]", "Keys of initially selected items"),
                    ("showSearch", "bool", "false", "Show filter input"),
                    ("showSelectAll", "bool", "true", "Show select all toggle"),
                    ("titles", "[string, string]", "['', '']", "Panel header titles"),
                    ("disabled", "bool", "false", "Disable the entire transfer"),
                ])}
            }
        })}
    ])
}
