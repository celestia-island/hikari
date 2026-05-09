use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use crate::components::icon_utils::icon_el;
use hikari_components::prelude::*;
use hikari_components::{
    Progress, ProgressStatus, Skeleton, SkeletonVariant, Spin, SpinSize, SpinTip,
};
use hikari_icons::MdiIcon;
use tairitsu_macros::rsx;
use tairitsu_vdom::{VElement, VNode};

fn alert_node(class: &str, icon: MdiIcon, text: &str, role: &str, live: &str) -> VNode {
    VNode::Element(
        VElement::new("div")
            .class(class)
            .attr("role", role)
            .attr("aria-live", live)
            .children(vec![
                VNode::Element(
                    VElement::new("span")
                        .class("hi-alert__body")
                        .children(vec![icon_el(icon, 16), VNode::Text(tairitsu_vdom::VText::new(text))])
                )
            ])
    )
}

fn closable_alert(class: &str, icon: MdiIcon, text: &str) -> VNode {
    VNode::Element(
        VElement::new("div")
            .class(class)
            .children(vec![
                VNode::Element(
                    VElement::new("span")
                        .class("hi-alert__body hi-alert__body--closable")
                        .children(vec![icon_el(icon, 16), VNode::Text(tairitsu_vdom::VText::new(text))])
                ),
                VNode::Element(
                    VElement::new("button")
                        .class("hi-alert__close")
                        .attr("type", "button")
                        .attr("aria-label", "Dismiss")
                        .children(vec![icon_el(MdiIcon::Close, 16)])
                )
            ])
    )
}

pub fn render() -> VNode {
    render_demo_page(
        "page-component-feedback",
        "Feedback",
        "Alerts, progress bars, and spinners for communicating system status to users.",
        rsx! {
            {render_demo_block("Alert Variants",
                rsx! {
                    div { class: "hi-alert-stack",
                        {alert_node("hi-alert hi-alert--info", MdiIcon::Information, "This is an informational alert for general notices.", "status", "polite")}
                        {alert_node("hi-alert hi-alert--success", MdiIcon::Check, "Operation completed successfully.", "status", "polite")}
                        {alert_node("hi-alert hi-alert--danger", MdiIcon::Close, "An error occurred. Please try again later.", "alert", "assertive")}
                        {alert_node("hi-alert hi-alert--warning", MdiIcon::AlertTriangle, "Warning: Your session will expire in 5 minutes.", "alert", "assertive")}
                    }
                }
            )}
            {render_demo_block("Closable Alerts",
                rsx! {
                    div { class: "hi-alert-stack",
                        {closable_alert("hi-alert hi-alert--info", MdiIcon::Information, "This alert can be dismissed.")}
                        {closable_alert("hi-alert hi-alert--success", MdiIcon::Check, "Changes saved successfully.")}
                        {closable_alert("hi-alert hi-alert--success", MdiIcon::Check, " Changes saved successfully.")}
                    }
                }
            )}
            {render_demo_block("Spinners",
                rsx! {
                    div { class: "hi-spinner-row",
                        Spin { size: SpinSize::Small, spinning: true }
                        Spin { size: SpinSize::Medium, spinning: true }
                        Spin { size: SpinSize::Large, spinning: true, tip: SpinTip::Loading }
                        Spin { size: SpinSize::Medium, spinning: false }
                    }
                }
            )}
            {render_demo_block("Progress Bars",
                rsx! {
                    div { class: "hi-progress-stack",
                        Progress { value: 30.0, show_info: true }
                        Progress { value: 70.0, show_info: true, status: ProgressStatus::Active }
                        Progress { value: 100.0, show_info: true }
                        Progress { value: 0.0, show_info: true, status: ProgressStatus::Active }
                    }
                }
            )}
            {render_demo_block("Skeleton Loading",
                rsx! {
                    div { class: "hi-skeleton-stack",
                        Skeleton { rows: Some(3) }
                        div { class: "hi-skeleton-row",
                            Skeleton { variant: SkeletonVariant::Circular, width: Some("40px".into()), height: Some("40px".into()) }
                            Skeleton { variant: SkeletonVariant::Text, width: Some("200px".into()) }
                        }
                    }
                }
            )}
            {render_demo_block("API",
                render_api_table(&[
                    ("variant", "info | success | danger | warning", "info", "Alert color variant"),
                    ("closable", "bool", "false", "Show dismiss button"),
                    ("icon", "MdiIcon", "-", "Leading icon"),
                    ("role", "string", "status | alert", "ARIA role (status or alert)"),
                    ("aria-live", "string", "polite | assertive", "ARIA live region politeness"),
                ])
            )}
        }
    )
}
