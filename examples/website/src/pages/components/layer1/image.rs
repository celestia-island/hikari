use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-component-image", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Image" }
                p { class: "page-header__subtitle",
                    "Responsive image display with size variants, object-fit modes, and fallback states."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic Image" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            img { class: "hi-image", src: "https://picsum.photos/300/200", alt: "landscape" }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Image Sizes" }
                    div { class: "demo-block__body",
                        div { class: "demo-row", style: "align-items:flex-end;",
                            img { class: "hi-image hi-image--xs", src: "https://picsum.photos/100/100", alt: "xs" }
                            img { class: "hi-image hi-image--sm", src: "https://picsum.photos/100/100", alt: "sm" }
                            img { class: "hi-image hi-image--md", src: "https://picsum.photos/200/200", alt: "md" }
                            img { class: "hi-image hi-image--lg", src: "https://picsum.photos/300/200", alt: "lg" }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Object Fit" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
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
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Error and Loading State" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            div { class: "hi-image hi-image--error", style: "width:150px;height:150px;display:flex;align-items:center;justify-content:center;",
                                span { "✗" }
                            }
                            div { class: "hi-image hi-image--loading", style: "width:150px;height:150px;display:flex;align-items:center;justify-content:center;",
                                div { class: "hi-spin" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Rounded Image" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            img { class: "hi-image hi-image--rounded", style: "width:100px;height:100px;", src: "https://picsum.photos/200/200", alt: "rounded" }
                            img { class: "hi-image hi-image--circle", style: "width:100px;height:100px;", src: "https://picsum.photos/200/200", alt: "circle" }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                            tbody {
                                tr { td { code { "src" } } td { code { "string" } } td { code { "-" } } td { "Image source URL" } }
                                tr { td { code { "alt" } } td { code { "string" } } td { code { "-" } } td { "Alternative text description" } }
                                tr { td { code { "size" } } td { code { "xs | sm | md | lg" } } td { code { "md" } } td { "Preset image size" } }
                                tr { td { code { "fit" } } td { code { "cover | contain | fill" } } td { code { "cover" } } td { "Object-fit mode" } }
                                tr { td { code { "shape" } } td { code { "default | rounded | circle" } } td { code { "default" } } td { "Border radius style" } }
                                tr { td { code { "fallback" } } td { code { "string" } } td { code { "-" } } td { "Fallback image on error" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
