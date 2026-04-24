use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page(
        "page-component-avatar",
        "Avatar",
        "User or entity representation with size variants, color options, and initials fallback.",
        VNode::Fragment(vec![
            render_demo_block("Avatar Sizes",
                render_demo_row(
                    rsx! {
                        div { class: "hi-avatar hi-avatar--xs", "A" }
                        div { class: "hi-avatar hi-avatar--sm", "B" }
                        div { class: "hi-avatar", "C" }
                        div { class: "hi-avatar hi-avatar--lg", "D" }
                        div { class: "hi-avatar hi-avatar--xl", "E" }
                    }
                )
            ),
            render_demo_block("Avatar Colors",
                render_demo_row(
                    rsx! {
                        div { class: "hi-avatar hi-avatar--primary", "P" }
                        div { class: "hi-avatar hi-avatar--secondary", "S" }
                        div { class: "hi-avatar hi-avatar--success", "G" }
                        div { class: "hi-avatar hi-avatar--danger", "R" }
                        div { class: "hi-avatar hi-avatar--warning", "Y" }
                    }
                )
            ),
            render_demo_block("Avatar with Label",
                rsx! {
                    div { style: "display:flex;flex-direction:column;gap:12px;",
                        div { style: "display:flex;align-items:center;gap:12px;",
                            div { class: "hi-avatar hi-avatar--primary", "A" }
                            div {
                                div { style: "font-weight:600;", "Alice Chen" }
                                div { style: "color:var(--hi-color-text-secondary);font-size:13px;", "alice@example.com" }
                            }
                        }
                        div { style: "display:flex;align-items:center;gap:12px;",
                            div { class: "hi-avatar hi-avatar--success", "B" }
                            div {
                                div { style: "font-weight:600;", "Bob Martinez" }
                                div { style: "color:var(--hi-color-text-secondary);font-size:13px;", "bob@example.com" }
                            }
                        }
                    }
                }
            ),
            render_demo_block("Avatar Group",
                render_demo_row(
                    rsx! {
                        div { class: "hi-avatar-group",
                            div { class: "hi-avatar hi-avatar--primary", "A" }
                            div { class: "hi-avatar hi-avatar--danger", "B" }
                            div { class: "hi-avatar hi-avatar--success", "C" }
                            div { class: "hi-avatar hi-avatar--warning", "D" }
                            div { class: "hi-avatar hi-avatar--secondary hi-avatar--overflow", "+3" }
                        }
                    }
                )
            ),
            render_demo_block("Avatar Shapes",
                render_demo_row(
                    rsx! {
                        div { class: "hi-avatar hi-avatar--circle", "C" }
                        div { class: "hi-avatar hi-avatar--square", "S" }
                    }
                )
            ),
            render_demo_block("Image Avatar",
                VNode::Fragment(vec![
                    render_demo_row(
                        rsx! {
                            div { class: "hi-avatar",
                                img { src: "https://i.pravatar.cc/150?img=1", alt: "Alice Chen", style: "width:100%;height:100%;object-fit:cover;border-radius:inherit;" }
                            }
                            div { class: "hi-avatar hi-avatar--lg",
                                img { src: "https://i.pravatar.cc/150?img=2", alt: "Bob Martinez", style: "width:100%;height:100%;object-fit:cover;border-radius:inherit;" }
                            }
                            div { class: "hi-avatar hi-avatar--xl",
                                img { src: "https://i.pravatar.cc/150?img=3", alt: "Carol Wu", style: "width:100%;height:100%;object-fit:cover;border-radius:inherit;" }
                            }
                            div { class: "hi-avatar", "F" }
                        }
                    ),
                    rsx! { p { style: "margin-top:12px;font-size:13px;color:var(--hi-color-text-secondary);", "Images fall back to initials on load error." } },
                ])
            ),
            render_demo_block("Avatar with Status",
                render_demo_row(
                    rsx! {
                        div { style: "position:relative;display:inline-block;",
                            div { class: "hi-avatar hi-avatar--primary", "A" }
                            div { style: "position:absolute;bottom:0;right:0;width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid white;" }
                        }
                        div { style: "position:relative;display:inline-block;",
                            div { class: "hi-avatar hi-avatar--danger", "R" }
                            div { style: "position:absolute;bottom:0;right:0;width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid white;" }
                        }
                        div { style: "position:relative;display:inline-block;",
                            div { class: "hi-avatar hi-avatar--secondary", "S" }
                            div { style: "position:absolute;bottom:0;right:0;width:14px;height:14px;border-radius:50%;background:#9ca3af;border:2px solid white;" }
                        }
                        div { style: "position:relative;display:inline-block;",
                            div { class: "hi-avatar hi-avatar--warning", "Y" }
                            div { style: "position:absolute;bottom:0;right:0;width:14px;height:14px;border:2px solid white;background:transparent;border-top:3px solid #f59e0b;border-right:3px solid transparent;transform:rotate(45deg);" }
                        }
                    }
                )
            ),
            render_demo_block("API",
                render_api_table(&[
                    ("size", "xs | sm | default | lg | xl", "default", "Avatar diameter"),
                    ("color", "primary | secondary | success | danger | warning", "-", "Background color"),
                    ("shape", "circle | square", "circle", "Border radius style"),
                    ("src", "string", "-", "Image URL (falls back to initials)"),
                    ("group", "number", "-", "Max visible count in avatar group"),
                ])
            ),
        ]),
    )
}
