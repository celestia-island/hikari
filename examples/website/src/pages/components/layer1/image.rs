use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page(
        "page-component-image",
        "Image",
        "Responsive image display with size variants, object-fit modes, and fallback states.",
        rsx! {
            {render_demo_block("Basic Image",
                render_demo_row(
                    rsx! {
                        img { class: "hi-image", src: "https://picsum.photos/300/200", alt: "landscape" }
                    }
                )
            )}
            {render_demo_block("Image Sizes",
                render_demo_row(
                    rsx! {
                        img { class: "hi-image hi-image--xs", src: "https://picsum.photos/100/100", alt: "xs" }
                        img { class: "hi-image hi-image--sm", src: "https://picsum.photos/100/100", alt: "sm" }
                        img { class: "hi-image hi-image--md", src: "https://picsum.photos/200/200", alt: "md" }
                        img { class: "hi-image hi-image--lg", src: "https://picsum.photos/300/200", alt: "lg" }
                    }
                )
            )}
            {render_demo_block("Object Fit",
                render_demo_row(
                    rsx! {
                        div { class: "hi-image-demo",
                            img { class: "hi-image hi-image--cover hi-image--square", src: "https://picsum.photos/300/100", alt: "cover" }
                            p { class: "hi-image-demo__label", "cover" }
                        }
                        div { class: "hi-image-demo",
                            img { class: "hi-image hi-image--contain hi-image--square", src: "https://picsum.photos/300/100", alt: "contain" }
                            p { class: "hi-image-demo__label", "contain" }
                        }
                        div { class: "hi-image-demo",
                            img { class: "hi-image hi-image--fill hi-image--square", src: "https://picsum.photos/300/100", alt: "fill" }
                            p { class: "hi-image-demo__label", "fill" }
                        }
                    }
                )
            )}
            {render_demo_block("Error and Loading State",
                render_demo_row(
                    rsx! {
                        div { class: "hi-image hi-image--error hi-image--square", "\u{2715}" }
                        div { class: "hi-image hi-image--loading hi-image--square",
                            div { class: "hi-spin" }
                        }
                    }
                )
            )}
            {render_demo_block("Rounded Image",
                render_demo_row(
                    rsx! {
                        img { class: "hi-image hi-image--rounded", style: "width:100px;height:100px;", src: "https://picsum.photos/200/200", alt: "rounded" }
                        img { class: "hi-image hi-image--circle", style: "width:100px;height:100px;", src: "https://picsum.photos/200/200", alt: "circle" }
                    }
                )
            )}
            {render_demo_block("API",
                render_api_table(&[
                    ("src", "string", "-", "Image source URL"),
                    ("alt", "string", "-", "Alternative text description"),
                    ("size", "xs | sm | md | lg", "md", "Preset image size"),
                    ("fit", "cover | contain | fill", "cover", "Object-fit mode"),
                    ("shape", "default | rounded | circle", "default", "Border radius style"),
                    ("fallback", "string", "-", "Fallback image on error"),
                ])
            )}
        }
    )
}
