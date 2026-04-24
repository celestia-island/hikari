use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page(
        "page-component-image",
        "Image",
        "Responsive image display with size variants, object-fit modes, and fallback states.",
        VNode::Fragment(vec![
            render_demo_block("Basic Image",
                render_demo_row(
                    rsx! {
                        img { class: "hi-image", src: "https://picsum.photos/300/200", alt: "landscape" }
                    }
                )
            ),
            render_demo_block("Image Sizes",
                render_demo_row(
                    rsx! {
                        img { class: "hi-image hi-image--xs", src: "https://picsum.photos/100/100", alt: "xs" }
                        img { class: "hi-image hi-image--sm", src: "https://picsum.photos/100/100", alt: "sm" }
                        img { class: "hi-image hi-image--md", src: "https://picsum.photos/200/200", alt: "md" }
                        img { class: "hi-image hi-image--lg", src: "https://picsum.photos/300/200", alt: "lg" }
                    }
                )
            ),
            render_demo_block("Object Fit",
                render_demo_row(
                    rsx! {
                        div { style: "text-align:center;",
                            img { class: "hi-image hi-image--cover", style: "width:150px;height:150px;", src: "https://picsum.photos/300/100", alt: "cover" }
                            p { style: "font-size:12px;color:var(--hi-color-text-secondary);margin-top:4px;", "cover" }
                        }
                        div { style: "text-align:center;",
                            img { class: "hi-image hi-image--contain", style: "width:150px;height:150px;", src: "https://picsum.photos/300/100", alt: "contain" }
                            p { style: "font-size:12px;color:var(--hi-color-text-secondary);margin-top:4px;", "contain" }
                        }
                        div { style: "text-align:center;",
                            img { class: "hi-image hi-image--fill", style: "width:150px;height:150px;", src: "https://picsum.photos/300/100", alt: "fill" }
                            p { style: "font-size:12px;color:var(--hi-color-text-secondary);margin-top:4px;", "fill" }
                        }
                    }
                )
            ),
            render_demo_block("Error and Loading State",
                render_demo_row(
                    rsx! {
                        div { class: "hi-image hi-image--error", style: "width:150px;height:150px;display:flex;align-items:center;justify-content:center;",
                            span { "\u{2715}" }
                        }
                        div { class: "hi-image hi-image--loading", style: "width:150px;height:150px;display:flex;align-items:center;justify-content:center;",
                            div { class: "hi-spin" }
                        }
                    }
                )
            ),
            render_demo_block("Rounded Image",
                render_demo_row(
                    rsx! {
                        img { class: "hi-image hi-image--rounded", style: "width:100px;height:100px;", src: "https://picsum.photos/200/200", alt: "rounded" }
                        img { class: "hi-image hi-image--circle", style: "width:100px;height:100px;", src: "https://picsum.photos/200/200", alt: "circle" }
                    }
                )
            ),
            render_demo_block("API",
                render_api_table(&[
                    ("src", "string", "-", "Image source URL"),
                    ("alt", "string", "-", "Alternative text description"),
                    ("size", "xs | sm | md | lg", "md", "Preset image size"),
                    ("fit", "cover | contain | fill", "cover", "Object-fit mode"),
                    ("shape", "default | rounded | circle", "default", "Border radius style"),
                    ("fallback", "string", "-", "Fallback image on error"),
                ])
            ),
        ]),
    )
}
