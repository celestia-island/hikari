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
    rsx! {
        div { id: "page-component-qrcode", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "QRCode" }
                p { class: "page-header__subtitle",
                    "Static QR code generation placeholder for encoding URLs, text, or other data."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic QR Code" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            div { class: "hi-qrcode",
                                { make_qr_svg(128) }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "QR Code Sizes" }
                    div { class: "demo-block__body",
                        div { class: "demo-row", style: "align-items:flex-end;",
                            div { style: "display:flex;flex-direction:column;align-items:center;gap:4px;",
                                div { class: "hi-qrcode",
                                    { make_qr_svg(80) }
                                }
                                div { style: "font-size:12px;color:var(--hi-color-text-secondary);text-align:center;margin-top:4px;", "Small" }
                            }
                            div { style: "display:flex;flex-direction:column;align-items:center;gap:4px;",
                                div { class: "hi-qrcode",
                                    { make_qr_svg(128) }
                                }
                                div { style: "font-size:12px;color:var(--hi-color-text-secondary);text-align:center;margin-top:4px;", "Default" }
                            }
                            div { style: "display:flex;flex-direction:column;align-items:center;gap:4px;",
                                div { class: "hi-qrcode",
                                    { make_qr_svg(200) }
                                }
                                div { style: "font-size:12px;color:var(--hi-color-text-secondary);text-align:center;margin-top:4px;", "Large" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "QR Code with Label" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            div { style: "display:flex;flex-direction:column;align-items:center;gap:8px;",
                                div { class: "hi-qrcode",
                                    { make_qr_svg(128) }
                                }
                                span { style: "font-size:13px;color:var(--hi-color-text-secondary);", "Scan to visit github.com/tairitsu/hikari" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "QR Code with Download" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            div { style: "display:flex;flex-direction:column;align-items:center;gap:8px;",
                                div { class: "hi-qrcode",
                                    { make_qr_svg(128) }
                                }
                                button { class: "hi-button hi-button-secondary hi-button-sm", "Download PNG" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                            tbody {
                                tr { td { code { "value" } } td { code { "string" } } td { code { "-" } } td { "Data to encode in the QR code" } }
                                tr { td { code { "size" } } td { code { "number" } } td { code { "128" } } td { "Canvas dimension in pixels" } }
                                tr { td { code { "color" } } td { code { "string" } } td { code { "#000" } } td { "Foreground color" } }
                                tr { td { code { "bgColor" } } td { code { "string" } } td { code { "#fff" } } td { "Background color" } }
                                tr { td { code { "level" } } td { code { "L | M | Q | H" } } td { code { "M" } } td { "Error correction level" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
