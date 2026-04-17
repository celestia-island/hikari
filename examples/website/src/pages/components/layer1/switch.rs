use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn make_switch(checked: bool, extra_class: &str) -> VNode {
    let mut classes = "hi-switch".to_string();
    if !extra_class.is_empty() {
        classes.push_str(" ");
        classes.push_str(extra_class);
    }
    let mut children: Vec<VNode> = Vec::new();
    children.push(rsx! { input { r#type: "checkbox", class: "hi-switch__input" } });
    children.push(rsx! { span { class: "hi-switch__rail" } });
    VNode::Element(
        tairitsu_vdom::VElement::new("label")
            .class(classes.as_str())
            .children(children),
    )
}

pub fn render() -> VNode {
    rsx! {
        div { id: "page-component-switch", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Switch" }
                p { class: "page-header__subtitle",
                    "Boolean toggle control with optional labels and size variants."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic Switch" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            {make_switch(false, "")}
                            {make_switch(true, "")}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Switch Sizes" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            {make_switch(true, "hi-switch--sm")}
                            {make_switch(true, "")}
                            {make_switch(true, "hi-switch--lg")}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "With Labels" }
                    div { class: "demo-block__body",
                        div { style: "display:flex;flex-direction:column;gap:16px;",
                            div { style: "display:flex;align-items:center;gap:12px;",
                                {make_switch(true, "")}
                                span { style: "font-size:14px;color:var(--hi-color-text-primary);", "Wi-Fi" }
                            }
                            div { style: "display:flex;align-items:center;gap:12px;",
                                {make_switch(false, "")}
                                span { style: "font-size:14px;color:var(--hi-color-text-primary);", "Bluetooth" }
                            }
                            div { style: "display:flex;align-items:center;gap:12px;",
                                {make_switch(false, "")}
                                span { style: "font-size:14px;color:var(--hi-color-text-primary);", "Airplane Mode" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "With Description" }
                    div { class: "demo-block__body",
                        div { style: "display:flex;flex-direction:column;gap:16px;",
                            div { style: "display:flex;align-items:center;justify-content:space-between;",
                                div {
                                    div { style: "font-size:14px;font-weight:500;color:var(--hi-color-text-primary);", "Auto-save" }
                                    p { style: "font-size:13px;color:var(--hi-color-text-secondary);margin:0;", "Automatically save changes every 30 seconds" }
                                }
                                {make_switch(true, "")}
                            }
                            div { style: "display:flex;align-items:center;justify-content:space-between;",
                                div {
                                    div { style: "font-size:14px;font-weight:500;color:var(--hi-color-text-primary);", "Notifications" }
                                    p { style: "font-size:13px;color:var(--hi-color-text-secondary);margin:0;", "Receive push notifications for updates" }
                                }
                                {make_switch(false, "")}
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Disabled" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            {make_switch(false, "hi-switch--disabled")}
                            {make_switch(true, "hi-switch--disabled")}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Danger Variant" }
                    div { class: "demo-block__body",
                        div { style: "display:flex;flex-direction:column;gap:16px;",
                            div { style: "display:flex;align-items:center;gap:16px;",
                                div { class: "hi-switch hi-switch--danger" }
                                span { "Auto-delete after 30 days" }
                            }
                            div { style: "display:flex;align-items:center;gap:16px;",
                                div { class: "hi-switch hi-switch--danger",
                                    input { r#type: "checkbox", checked: "true" }
                                }
                                span { "Auto-delete enabled (active)" }
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
                                tr { td { code { "checked" } } td { code { "bool" } } td { code { "false" } } td { "Controlled checked state" } }
                                tr { td { code { "disabled" } } td { code { "bool" } } td { code { "false" } } td { "Disable the switch" } }
                                tr { td { code { "size" } } td { code { "small | default | large" } } td { code { "default" } } td { "Switch size" } }
                                tr { td { code { "onChange" } } td { code { "(checked: bool) => void" } } td { code { "-" } } td { "Change callback" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
