use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
use crate::components::icon_utils::icon_el;
use hikari_icons::MdiIcon;
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page(
        "page-component-tag",
        "Tag",
        "Compact labels for status indication, categorisation, and metadata display.",
        rsx! {
            {render_demo_block("Tag Variants",
                render_demo_row(
                    rsx! {
                        span { class: "hi-tag hi-tag--primary", "Primary" }
                        span { class: "hi-tag hi-tag--success", "Success" }
                        span { class: "hi-tag hi-tag--danger", "Danger" }
                        span { class: "hi-tag hi-tag--warning", "Warning" }
                        span { class: "hi-tag", "Default" }
                    }
                )
            )}
            {render_demo_block("Tag Styles",
                rsx! {
                    {render_demo_row(
                        rsx! {
                            span { class: "hi-tag hi-tag--primary", "Solid" }
                            span { class: "hi-tag hi-tag--primary hi-tag--outline", "Outline" }
                            span { class: "hi-tag hi-tag--primary hi-tag--light", "Light" }
                        }
                    )}
                    {render_demo_row(
                        rsx! {
                            span { class: "hi-tag hi-tag--success", "Solid" }
                            span { class: "hi-tag hi-tag--success hi-tag--outline", "Outline" }
                            span { class: "hi-tag hi-tag--success hi-tag--light", "Light" }
                        }
                    )}
                }
            )}
            {render_demo_block("Closable Tags",
                render_demo_row(
                    rsx! {
                        span { class: "hi-tag hi-tag--primary", "React" }
                        span { class: "hi-tag hi-tag--primary", "TypeScript" }
                         span { class: "hi-tag hi-tag--danger hi-tag--closable",
                            {icon_el(MdiIcon::Close, 12)}
                         }
                        span { class: "hi-tag hi-tag--success", "Rust" }
                    }
                )
            )}
            {render_demo_block("Tag List",
                rsx! {
                    div { class: "hi-tag-group",
                        div {
                            div { class: "hi-tag-group__label", "Technologies" }
                            div { class: "hi-tag-list",
                                span { class: "hi-tag hi-tag--primary", "Tauri" }
                                span { class: "hi-tag hi-tag--success", "Rust" }
                                span { class: "hi-tag hi-tag--warning", "WebAssembly" }
                                span { class: "hi-tag", "HTML/CSS" }
                            }
                        }
                        div {
                            div { class: "hi-tag-group__label", "Status" }
                            div { class: "hi-tag-list",
                                span { class: "hi-tag hi-tag--success", "Stable" }
                                span { class: "hi-tag hi-tag--warning", "Beta" }
                                span { class: "hi-tag hi-tag--danger", "Deprecated" }
                            }
                        }
                    }
                }
            )}
            {render_demo_block("Icon Tags",
                render_demo_row(
                    rsx! {
                        span { class: "hi-tag hi-tag--primary hi-tag--icon",
                            {icon_el(MdiIcon::Package, 12)}
                            "Package"
                        }
                        span { class: "hi-tag hi-tag--success hi-tag--icon",
                            {icon_el(MdiIcon::CheckboxMarkedCircle, 12)}
                            "Verified"
                        }
                        span { class: "hi-tag hi-tag--danger hi-tag--icon",
                            {icon_el(MdiIcon::Alert, 12)}
                            "Critical"
                        }
                        span { class: "hi-tag hi-tag--warning hi-tag--icon",
                            {icon_el(MdiIcon::ClockOutline, 12)}
                            "Pending"
                        }
                    }
                )
            )}
            {render_demo_block("API",
                render_api_table(&[
                    ("variant", "primary | success | danger | warning | default", "default", "Tag color variant"),
                    ("style", "solid | outline | light", "solid", "Visual fill style"),
                    ("closable", "bool", "false", "Show close button"),
                    ("icon", "string", "-", "Leading icon character"),
                    ("size", "small | default", "default", "Tag size"),
                ])
            )}
        }
    )
}
