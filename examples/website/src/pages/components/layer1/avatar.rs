use tairitsu_macros::rsx;
use tairitsu_vdom::{VElement, VNode};

use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};

fn status_dot(bg_class: &str) -> VNode {
    VNode::Element(
        VElement::new("div")
            .class(format!("hi-avatar__status {}", bg_class))
    )
}

pub fn render() -> VNode {
    render_demo_page(
        "page-component-avatar",
        "Avatar",
        "User or entity representation with size variants, color options, and initials fallback.",
        rsx! {
            {render_demo_block("Avatar Sizes",
                render_demo_row(
                    rsx! {
                        div { class: "hi-avatar hi-avatar--xs", "A" }
                        div { class: "hi-avatar hi-avatar--sm", "B" }
                        div { class: "hi-avatar", "C" }
                        div { class: "hi-avatar hi-avatar--lg", "D" }
                        div { class: "hi-avatar hi-avatar--xl", "E" }
                    }
                )
            )}
            {render_demo_block("Avatar Colors",
                render_demo_row(
                    rsx! {
                        div { class: "hi-avatar hi-avatar--primary", "P" }
                        div { class: "hi-avatar hi-avatar--secondary", "S" }
                        div { class: "hi-avatar hi-avatar--success", "G" }
                        div { class: "hi-avatar hi-avatar--danger", "R" }
                        div { class: "hi-avatar hi-avatar--warning", "Y" }
                    }
                )
            )}
            {render_demo_block("Avatar with Label",
                rsx! {
                    div { class: "hi-avatar-label-list",
                        div { class: "hi-avatar-label",
                            div { class: "hi-avatar hi-avatar--primary", "A" }
                            div { class: "hi-avatar-label__info",
                                div { class: "hi-avatar-label__name", "Alice Chen" }
                                div { class: "hi-avatar-label__email", "alice@example.com" }
                            }
                        }
                        div { class: "hi-avatar-label",
                            div { class: "hi-avatar hi-avatar--success", "B" }
                            div { class: "hi-avatar-label__info",
                                div { class: "hi-avatar-label__name", "Bob Martinez" }
                                div { class: "hi-avatar-label__email", "bob@example.com" }
                            }
                        }
                    }
                }
            )}
            {render_demo_block("Avatar Group",
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
            )}
            {render_demo_block("Avatar Shapes",
                render_demo_row(
                    rsx! {
                        div { class: "hi-avatar hi-avatar--circle", "C" }
                        div { class: "hi-avatar hi-avatar--square", "S" }
                    }
                )
            )}
            {render_demo_block("Image Avatar",
                rsx! {
                    {render_demo_row(
                        rsx! {
                            div { class: "hi-avatar",
                                img { src: "https://i.pravatar.cc/150?img=1", alt: "Alice Chen", class: "hi-avatar__img" }
                            }
                            div { class: "hi-avatar hi-avatar--lg",
                                img { src: "https://i.pravatar.cc/150?img=2", alt: "Bob Martinez", class: "hi-avatar__img" }
                            }
                            div { class: "hi-avatar hi-avatar--xl",
                                img { src: "https://i.pravatar.cc/150?img=3", alt: "Carol Wu", class: "hi-avatar__img" }
                            }
                            div { class: "hi-avatar", "F" }
                        }
                    )}
                    {rsx! { p { class: "hi-avatar__hint", "Images fall back to initials on load error." } }}
                }
            )}
            {render_demo_block("Avatar with Status",
                render_demo_row(
                    rsx! {
                        div { class: "hi-avatar-wrapper",
                            div { class: "hi-avatar hi-avatar--primary", "A" }
                            {status_dot("hi-avatar__status--success")}
                        }
                        div { class: "hi-avatar-wrapper",
                            div { class: "hi-avatar hi-avatar--danger", "R" }
                            {status_dot("hi-avatar__status--danger")}
                        }
                        div { class: "hi-avatar-wrapper",
                            div { class: "hi-avatar hi-avatar--secondary", "S" }
                            {status_dot("hi-avatar__status--default")}
                        }
                        div { class: "hi-avatar-wrapper",
                            div { class: "hi-avatar hi-avatar--warning", "Y" }
                            {status_dot("hi-avatar__status--warning")}
                        }
                    }
                )
            )}
            {render_demo_block("API",
                render_api_table(&[
                    ("size", "xs | sm | default | lg | xl", "default", "Avatar diameter"),
                    ("color", "primary | secondary | success | danger | warning", "-", "Background color"),
                    ("shape", "circle | square", "circle", "Border radius style"),
                    ("src", "string", "-", "Image URL (falls back to initials)"),
                    ("group", "number", "-", "Max visible count in avatar group"),
                ])
            )}
        }
    )
}
