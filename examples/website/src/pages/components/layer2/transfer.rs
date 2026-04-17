use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn arrow_btn(label: &str) -> VNode {
    glow_wrap(
        rsx! { button { class: "hi-button hi-button-primary hi-button-sm", label } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            ..Default::default()
        },
    )
}

pub fn render() -> VNode {
    let btn_all_right = glow_wrap(
        rsx! { button { class: "hi-button hi-button-secondary hi-button-sm", "⇒" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Secondary,
            ..Default::default()
        },
    );
    let btn_all_left = glow_wrap(
        rsx! { button { class: "hi-button hi-button-secondary hi-button-sm", "⇐" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Secondary,
            ..Default::default()
        },
    );

    rsx! {
        div { id: "page-component-transfer", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Transfer" }
                p { class: "page-header__subtitle",
                    "Dual-panel transfer widget for moving items between two lists."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic Transfer" }
                    div { class: "demo-block__body",
                        div { class: "hi-transfer",
                            div { class: "hi-transfer__panel",
                                div { class: "hi-transfer__header",
                                    span { "Available" }
                                    span { class: "hi-transfer__count", "5" }
                                }
                                {glow_wrap(
                                    rsx! { input { class: "hi-transfer__filter", placeholder: "Search...", r#type: "text" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                div { class: "hi-transfer__list",
                                    label { class: "hi-transfer__item", input { r#type: "checkbox" } " Rust" }
                                    label { class: "hi-transfer__item", input { r#type: "checkbox" } " Go" }
                                    label { class: "hi-transfer__item", input { r#type: "checkbox" } " Python" }
                                    label { class: "hi-transfer__item", input { r#type: "checkbox" } " TypeScript" }
                                    label { class: "hi-transfer__item", input { r#type: "checkbox" } " C++" }
                                }
                            }
                            div { class: "hi-transfer__actions",
                                {arrow_btn("\u{2192}")}
                                {arrow_btn("\u{2190}")}
                                {btn_all_right}
                                {btn_all_left}
                            }
                            div { class: "hi-transfer__panel",
                                div { class: "hi-transfer__header",
                                    span { "Selected" }
                                    span { class: "hi-transfer__count", "0" }
                                }
                                div { class: "hi-transfer__list" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Transfer with Pre-selected" }
                    div { class: "demo-block__body",
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
                                {arrow_btn("\u{2192}")}
                                {arrow_btn("\u{2190}")}
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
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Disabled Transfer" }
                    div { class: "demo-block__body",
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
                                button { class: "hi-button hi-button-secondary hi-button-sm", style: "opacity:0.5;cursor:not-allowed;", "⇒" }
                                button { class: "hi-button hi-button-secondary hi-button-sm", style: "opacity:0.5;cursor:not-allowed;", "⇐" }
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
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "One-Way Transfer" }
                    div { class: "demo-block__body",
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
                                {arrow_btn("\u{2192}")}
                            }
                            div { class: "hi-transfer__panel",
                                div { class: "hi-transfer__header",
                                    span { "Granted" }
                                    span { class: "hi-transfer__count", "0" }
                                }
                                div { class: "hi-transfer__list" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                            tbody {
                                tr { td { code { "dataSource" } } td { code { "TransferItem[]" } } td { code { "-" } } td { "Source data items" } }
                                tr { td { code { "targetKeys" } } td { code { "string[]" } } td { code { "[]" } } td { "Keys of initially selected items" } }
                                tr { td { code { "showSearch" } } td { code { "bool" } } td { code { "false" } } td { "Show filter input" } }
                                tr { td { code { "showSelectAll" } } td { code { "bool" } } td { code { "true" } } td { "Show select all toggle" } }
                                tr { td { code { "titles" } } td { code { "[string, string]" } } td { code { "['', '']" } } td { "Panel header titles" } }
                                tr { td { code { "disabled" } } td { code { "bool" } } td { code { "false" } } td { "Disable the entire transfer" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
