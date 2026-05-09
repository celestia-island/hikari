use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use hikari_icons::generated::mdi_selected::get;
use hikari_icons::MdiIcon;
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn icon_el(icon: MdiIcon, size: u32) -> VNode {
    let svg_str = get(icon.to_string().as_str())
        .map(|data| {
            format!(
                r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{}" width="{}" height="{}"><path fill="currentColor" d="{}"/></svg>"#,
                data.view_box.as_deref().unwrap_or("0 0 24 24"),
                size,
                size,
                data.path.as_deref().unwrap_or("")
            )
        })
        .unwrap_or_default();
    VNode::Element(
        tairitsu_vdom::VElement::new("span")
            .class("hikari-icon")
            .inner_html(svg_str),
    )
}

fn btn(class: &str, label: &str, color: GlowColor) -> VNode {
    glow_wrap(
        rsx! { button { class: class, attr: "type", "button", {tairitsu_vdom::VNode::Text(tairitsu_vdom::VText::new(label))} } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color,
            ..Default::default()
        },
    )
}

fn btn_disabled(class: &str, label: &str, color: GlowColor) -> VNode {
    glow_wrap(
        rsx! { button { class: class, attr: "type", "button", attr: "disabled", "true", {tairitsu_vdom::VNode::Text(tairitsu_vdom::VText::new(label))} } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color,
            ..Default::default()
        },
    )
}

pub fn render() -> VNode {
    render_demo_page(
        "page-component-button",
        "Button",
        "Primary action trigger with variants: primary, secondary, danger, ghost. Supports multiple sizes and states.",
        rsx! {
            {render_demo_block("Button Variants",
                render_demo_row(
                    rsx! {
                        {btn("hi-button hi-button-primary", "Primary", GlowColor::Primary)}
                        {btn("hi-button hi-button-secondary", "Secondary", GlowColor::Secondary)}
                        {btn("hi-button hi-button-danger", "Danger", GlowColor::Danger)}
                        {btn("hi-button hi-button-ghost", "Ghost", GlowColor::Ghost)}
                    }
                )
            )}
            {render_demo_block("Button Sizes",
                render_demo_row(
                    rsx! {
                        {btn("hi-button hi-button-primary hi-button-sm", "Small", GlowColor::Primary)}
                        {btn("hi-button hi-button-primary", "Default", GlowColor::Primary)}
                        {btn("hi-button hi-button-primary hi-button-lg", "Large", GlowColor::Primary)}
                    }
                )
            )}
            {render_demo_block("Button States",
                render_demo_row(
                    rsx! {
                        {btn("hi-button hi-button-primary", "Normal", GlowColor::Primary)}
                        {btn_disabled("hi-button hi-button-primary", "Loading...", GlowColor::Primary)}
                        {btn("hi-button hi-button-primary", " Icon Button", GlowColor::Primary)}
                        {btn_disabled("hi-button hi-button-primary", "Disabled", GlowColor::Primary)}
                    }
                )
            )}
            {render_demo_block("Button Group",
                render_demo_row(
                    rsx! {
                        {btn("hi-button hi-button-secondary", "Cancel", GlowColor::Secondary)}
                        {btn("hi-button hi-button-primary", "Confirm", GlowColor::Primary)}
                    }
                )
            )}
            {render_demo_block("Block Buttons",
                rsx! {
                    div { class: "hi-btn-group--block",
                        button { class: "hi-button hi-button-primary hi-button--block", attr: "type", "button", "Full Width Primary" }
                        button { class: "hi-button hi-button-danger hi-button--block", attr: "type", "button", "Delete Account" }
                        div { class: "hi-btn-group",
                            button { class: "hi-button hi-button-secondary hi-button--flex", attr: "type", "button", "Cancel" }
                            button { class: "hi-button hi-button-primary hi-button--flex", attr: "type", "button", "Confirm" }
                        }
                    }
                }
            )}
            {render_demo_block("API",
                render_api_table(&[
                    ("variant", "primary | secondary | danger | ghost", "primary", "Visual style variant"),
                    ("size", "small | default | large", "default", "Button size preset"),
                    ("disabled", "bool", "false", "Disable the button"),
                    ("glow", "dim | soft | bright", "-", "Glow hover intensity"),
                ])
            )}
        },
    )
}
