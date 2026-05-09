use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn make_switch(checked: bool, extra_class: &str) -> VNode {
    let mut classes = "hi-switch".to_string();
    if !extra_class.is_empty() {
        classes.push(' ');
        classes.push_str(extra_class);
    }
    let checked_attr = if checked { "true" } else { "false" };
    let mut children: Vec<VNode> = Vec::new();
    children.push(rsx! {
        input {
            r#type: "checkbox",
            class: "hi-switch__input",
            checked: checked_attr,
            attr: "aria-checked", checked_attr,
        }
    });
    children.push(rsx! { span { class: "hi-switch__rail" } });
    VNode::Element(
        tairitsu_vdom::VElement::new("label")
            .class(classes.as_str())
            .attr("role", "switch")
            .children(children),
    )
}

pub fn render() -> VNode {
    render_demo_page(
        "page-component-switch",
        "Switch",
        "Boolean toggle control with optional labels and size variants.",
        rsx! {
            {render_demo_block("Basic Switch",
                render_demo_row(
                    rsx! {
                        {make_switch(false, "")}
                        {make_switch(true, "")}
                    }
                )
            )}
            {render_demo_block("Switch Sizes",
                render_demo_row(
                    rsx! {
                        {make_switch(true, "hi-switch--sm")}
                        {make_switch(true, "")}
                        {make_switch(true, "hi-switch--lg")}
                    }
                )
            )}
            {render_demo_block("With Labels",
                rsx! {
                    div { class: "hi-switch-list",
                        div { class: "hi-switch-list__item",
                            {make_switch(true, "")}
                            span { class: "hi-switch-list__label", "Wi-Fi" }
                        }
                        div { class: "hi-switch-list__item",
                            {make_switch(false, "")}
                            span { class: "hi-switch-list__label", "Bluetooth" }
                        }
                        div { class: "hi-switch-list__item",
                            {make_switch(false, "")}
                            span { class: "hi-switch-list__label", "Airplane Mode" }
                        }
                    }
                }
            )}
            {render_demo_block("With Description",
                rsx! {
                    div { class: "hi-switch-settings",
                        div { class: "hi-switch-settings__row",
                            div { class: "hi-switch-settings__info",
                                div { class: "hi-switch-settings__name", "Auto-save" }
                                p { class: "hi-switch-settings__desc", "Automatically save changes every 30 seconds" }
                            }
                            {make_switch(true, "")}
                        }
                        div { class: "hi-switch-settings__row",
                            div { class: "hi-switch-settings__info",
                                div { class: "hi-switch-settings__name", "Notifications" }
                                p { class: "hi-switch-settings__desc", "Receive push notifications for updates" }
                            }
                            {make_switch(false, "")}
                        }
                    }
                }
            )}
            {render_demo_block("Danger Variant",
                rsx! {
                    div { class: "hi-switch-list",
                        div { class: "hi-switch-list__item",
                            {make_switch(false, "hi-switch--danger")}
                            span { "Auto-delete after 30 days" }
                        }
                        div { class: "hi-switch-list__item",
                            {make_switch(true, "hi-switch--danger")}
                            span { "Auto-delete enabled (active)" }
                        }
                    }
                }
            )}
            {render_demo_block("With Description",
                rsx! {
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
            )}
            {render_demo_block("Disabled",
                render_demo_row(
                    rsx! {
                        {make_switch(false, "hi-switch--disabled")}
                        {make_switch(true, "hi-switch--disabled")}
                    }
                )
            )}
            {render_demo_block("Danger Variant",
                rsx! {
                    div { style: "display:flex;flex-direction:column;gap:16px;",
                        div { style: "display:flex;align-items:center;gap:16px;",
                            {make_switch(false, "hi-switch--danger")},
                            span { "Auto-delete after 30 days" }
                        }
                        div { style: "display:flex;align-items:center;gap:16px;",
                            {make_switch(true, "hi-switch--danger")},
                            span { "Auto-delete enabled (active)" }
                        }
                    }
                }
            )}
            {render_demo_block("API",
                render_api_table(&[
                    ("checked", "bool", "false", "Controlled checked state"),
                    ("disabled", "bool", "false", "Disable the switch"),
                    ("size", "small | default | large", "default", "Switch size"),
                    ("onChange", "(checked: bool) => void", "-", "Change callback"),
                ])
            )}
        }
    )
}
