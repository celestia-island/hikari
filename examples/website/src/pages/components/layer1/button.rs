use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn btn(class: &str, label: &str, color: GlowColor) -> VNode {
    glow_wrap(
        rsx! { button { class: class, label } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color,
            ..Default::default()
        },
    )
}

fn btn_raw(class: &str, label: &str, extra: &str) -> VNode {
    rsx! { button { class: format!("{} {}", class, extra), label } }
}

pub fn render() -> VNode {
    render_demo_page(
        "page-component-button",
        "Button",
        "Primary action trigger with variants: primary, secondary, danger, ghost. Supports multiple sizes and states.",
        VNode::Fragment(vec![
            render_demo_block("Button Variants",
                render_demo_row(
                    VNode::Fragment(vec![
                        btn("hi-button hi-button-primary", "Primary", GlowColor::Primary),
                        btn("hi-button hi-button-secondary", "Secondary", GlowColor::Secondary),
                        btn("hi-button hi-button-danger", "Danger", GlowColor::Danger),
                        btn("hi-button hi-button-ghost", "Ghost", GlowColor::Ghost),
                    ])
                )
            ),
            render_demo_block("Button Sizes",
                render_demo_row(
                    VNode::Fragment(vec![
                        btn("hi-button hi-button-primary hi-button-sm", "Small", GlowColor::Primary),
                        btn("hi-button hi-button-primary", "Default", GlowColor::Primary),
                        btn("hi-button hi-button-primary hi-button-lg", "Large", GlowColor::Primary),
                    ])
                )
            ),
            render_demo_block("Button States",
                render_demo_row(
                    VNode::Fragment(vec![
                        btn("hi-button hi-button-primary", "Normal", GlowColor::Primary),
                        btn_raw("hi-button hi-button-primary", "\u{23F7} Loading...", "disabled=\"true\""),
                        btn("hi-button hi-button-primary", "\u{2605} Icon Button", GlowColor::Primary),
                        btn("hi-button hi-button-primary", "Disabled", GlowColor::Primary),
                    ])
                )
            ),
            render_demo_block("Button Group",
                render_demo_row(
                    VNode::Fragment(vec![
                        btn("hi-button hi-button-secondary", "Cancel", GlowColor::Secondary),
                        btn("hi-button hi-button-primary", "Confirm", GlowColor::Primary),
                    ])
                )
            ),
            render_demo_block("Block Buttons",
                rsx! {
                    div { style: "display:flex;flex-direction:column;gap:12px;",
                        button { class: "hi-button hi-button-primary", style: "width:100%;", "Full Width Primary" }
                        button { class: "hi-button hi-button-danger", style: "width:100%;", "Delete Account" }
                        div { style: "display:flex;gap:12px;",
                            button { class: "hi-button hi-button-secondary", style: "flex:1;", "Cancel" }
                            button { class: "hi-button hi-button-primary", style: "flex:1;", "Confirm" }
                        }
                    }
                }
            ),
            render_demo_block("API",
                render_api_table(&[
                    ("variant", "primary | secondary | danger | ghost", "primary", "Visual style variant"),
                    ("size", "small | default | large", "default", "Button size preset"),
                    ("disabled", "bool", "false", "Disable the button"),
                    ("glow", "dim | soft | bright", "-", "Glow hover intensity"),
                ])
            ),
        ]),
    )
}
