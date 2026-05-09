use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn make_qr_svg(size: u32) -> VNode {
    let size_s = size.to_string();
    let mut rects: Vec<VNode> = Vec::new();
    let grid_size = 21;
    let cell_size = size / grid_size;
    for row in 0..grid_size {
        for col in 0..grid_size {
            let is_finder = (row < 7 && col < 7)
                || (row < 7 && col >= grid_size - 7)
                || (row >= grid_size - 7 && col < 7);
            let is_timing = (row == 6 && col >= 7 && col < grid_size - 7)
                || (col == 6 && row >= 7 && row < grid_size - 7);
            let is_align = row >= grid_size - 9
                && row <= grid_size - 5
                && col >= grid_size - 9
                && col <= grid_size - 5;
            let filled = is_finder
                || is_timing
                || is_align
                || ((row.wrapping_mul(17 + col).wrapping_add(col * 31)) % 3 == 0)
                || ((row * col) % 7 == 0 && row > 7 && col > 7);
            if filled {
                let cs = cell_size.to_string();
                let x = (col * cell_size).to_string();
                let y = (row * cell_size).to_string();
                rects.push(rsx! { rect { x: x, y: y, width: cs.clone(), height: cs.clone(), fill: "#1a1a1a" } });
            }
        }
    }
    rsx! {
        svg {
            width: size_s.clone(),
            height: size_s.clone(),
            viewBox: "0 0 {size_s} {size_s}",
            rect { width: size_s.clone(), height: size_s.clone(), fill: "#ffffff" },
            g { { tairitsu_vdom::VNode::Fragment(rects) } }
        }
    }
}

pub fn render() -> VNode {
    render_demo_page("page-component-qrcode", "QRCode", "Static QR code generation placeholder for encoding URLs, text, or other data.", rsx! [
        {render_demo_block("Basic QR Code", rsx! {
            div {
                {render_demo_row(rsx! {
                    div { class: "hi-qrcode",
                        { make_qr_svg(128) }
                    }
                })}
            }
        })}
        {render_demo_block("QR Code Sizes", rsx! {
            div {
                {render_demo_row(rsx! {
                    div { class: "hi-qrcode--size",
                        div { class: "hi-qrcode",
                            { make_qr_svg(80) }
                        }
                        div { class: "hi-qrcode__label", "Small" }
                    }
                    div { class: "hi-qrcode--size",
                        div { class: "hi-qrcode",
                            { make_qr_svg(128) }
                        }
                        div { class: "hi-qrcode__label", "Default" }
                    }
                    div { class: "hi-qrcode--size",
                        div { class: "hi-qrcode",
                            { make_qr_svg(200) }
                        }
                        div { class: "hi-qrcode__label", "Large" }
                    }
                })}
            }
        })}
        {render_demo_block("QR Code with Label", rsx! {
            div {
                {render_demo_row(rsx! {
                    div { class: "hi-qrcode--labeled",
                        div { class: "hi-qrcode",
                            { make_qr_svg(128) }
                        }
                        span { class: "hi-qrcode__caption", "Scan to visit github.com/tairitsu/hikari" }
                    }
                })}
            }
        })}
        {render_demo_block("QR Code with Download", rsx! {
            div {
                {render_demo_row(rsx! {
                    div { class: "hi-qrcode--labeled",
                        div { class: "hi-qrcode",
                            { make_qr_svg(128) }
                        }
                        button { class: "hi-button hi-button-secondary hi-button-sm", "Download PNG" }
                    }
                })}
            }
        })}
        {render_demo_block("API", rsx! {
            div {
                {render_api_table(&[
                    ("value", "string", "-", "Data to encode in the QR code"),
                    ("size", "number", "128", "Canvas dimension in pixels"),
                    ("color", "string", "#000", "Foreground color"),
                    ("bgColor", "string", "#fff", "Background color"),
                    ("level", "L | M | Q | H", "M", "Error correction level"),
                ])}
            }
        })}
    ])
}
