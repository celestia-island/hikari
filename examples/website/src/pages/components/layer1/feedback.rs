use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
use hikari_icons::generated::mdi_selected::get;
use hikari_icons::MdiIcon;
use tairitsu_macros::rsx;
use tairitsu_vdom::{VElement, VNode};

fn icon_el(icon: MdiIcon, size: u32) -> VNode {
    let icon_name = icon.to_string();
    let svg_str = get(&icon_name)
        .map(|data| {
            format!(
                r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{}" width="{}" height="{}"><path fill="currentColor" d="{}"/></svg>"#,
                data.view_box.as_deref().unwrap_or("0 0 24 24"),
                size,
                size,
                data.path.as_deref().unwrap_or("")
            )
        })
        .unwrap_or_else(|| String::from(
            r#"<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>"#
        ));
    VNode::Element(
        VElement::new("span")
            .class("hikari-icon")
            .inner_html(svg_str),
    )
}

fn alert_node(class: &str, icon: MdiIcon, text: &str, role: &str, live: &str) -> VNode {
    VNode::Element(
        VElement::new("div")
            .class(class)
            .attr("role", role)
            .attr("aria-live", live)
            .children(vec![
                VNode::Element(
                    VElement::new("span")
                        .style("display:flex;align-items:center;gap:8px;")
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
                        .style("display:flex;align-items:center;gap:8px;flex:1;")
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
                    div { style: "display:flex;flex-direction:column;gap:12px;",
                        {alert_node("hi-alert hi-alert--info", MdiIcon::Information, "This is an informational alert for general notices.", "status", "polite")}
                        {alert_node("hi-alert hi-alert--success", MdiIcon::Check, "Operation completed successfully.", "status", "polite")}
                        {alert_node("hi-alert hi-alert--danger", MdiIcon::Close, "An error occurred. Please try again later.", "alert", "assertive")}
                        {alert_node("hi-alert hi-alert--warning", MdiIcon::AlertTriangle, "Warning: Your session will expire in 5 minutes.", "alert", "assertive")}
                    }
                }
            )}
            {render_demo_block("Closable Alerts",
                rsx! {
                    div { style: "display:flex;flex-direction:column;gap:12px;",
                        {closable_alert("hi-alert hi-alert--info", MdiIcon::Information, "This alert can be dismissed.")}
                        {closable_alert("hi-alert hi-alert--success", MdiIcon::Check, "Changes saved successfully.")}
                        {closable_alert("hi-alert hi-alert--success", MdiIcon::Check, " Changes saved successfully.")}
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
