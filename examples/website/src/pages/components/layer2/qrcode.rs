use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

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
                                canvas { class: "hi-qrcode__canvas", width: "128", height: "128" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "QR Code Sizes" }
                    div { class: "demo-block__body",
                        div { class: "demo-row", style: "align-items:flex-end;",
                            div { class: "hi-qrcode",
                                canvas { class: "hi-qrcode__canvas hi-qrcode__canvas--sm", width: "80", height: "80" }
                                div { style: "font-size:12px;color:var(--hi-color-text-secondary);text-align:center;margin-top:4px;", "Small" }
                            }
                            div { class: "hi-qrcode",
                                canvas { class: "hi-qrcode__canvas", width: "128", height: "128" }
                                div { style: "font-size:12px;color:var(--hi-color-text-secondary);text-align:center;margin-top:4px;", "Default" }
                            }
                            div { class: "hi-qrcode",
                                canvas { class: "hi-qrcode__canvas hi-qrcode__canvas--lg", width: "200", height: "200" }
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
                                    canvas { class: "hi-qrcode__canvas", width: "128", height: "128" }
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
                                    canvas { class: "hi-qrcode__canvas", width: "128", height: "128" }
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
