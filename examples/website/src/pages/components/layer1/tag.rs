use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-component-tag", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Tag" }
                p { class: "page-header__subtitle",
                    "Compact labels for status indication, categorisation, and metadata display."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Tag Variants" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            span { class: "hi-tag hi-tag--primary", "Primary" }
                            span { class: "hi-tag hi-tag--success", "Success" }
                            span { class: "hi-tag hi-tag--danger", "Danger" }
                            span { class: "hi-tag hi-tag--warning", "Warning" }
                            span { class: "hi-tag", "Default" }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Tag Styles" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            span { class: "hi-tag hi-tag--primary", "Solid" }
                            span { class: "hi-tag hi-tag--primary hi-tag--outline", "Outline" }
                            span { class: "hi-tag hi-tag--primary hi-tag--light", "Light" }
                        }
                        div { class: "demo-row", style: "margin-top:8px;",
                            span { class: "hi-tag hi-tag--success", "Solid" }
                            span { class: "hi-tag hi-tag--success hi-tag--outline", "Outline" }
                            span { class: "hi-tag hi-tag--success hi-tag--light", "Light" }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Closable Tags" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            span { class: "hi-tag hi-tag--primary", "React" }
                            span { class: "hi-tag hi-tag--primary", "TypeScript" }
                            span { class: "hi-tag hi-tag--danger hi-tag--closable", "×" }
                            span { class: "hi-tag hi-tag--success", "Rust" }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Tag List" }
                    div { class: "demo-block__body",
                        div { style: "display:flex;flex-direction:column;gap:12px;",
                            div {
                                div { style: "font-size:13px;color:var(--hi-color-text-secondary);margin-bottom:6px;", "Technologies" }
                                div { class: "hi-tag-list",
                                    span { class: "hi-tag hi-tag--primary", "Tauri" }
                                    span { class: "hi-tag hi-tag--success", "Rust" }
                                    span { class: "hi-tag hi-tag--warning", "WebAssembly" }
                                    span { class: "hi-tag", "HTML/CSS" }
                                }
                            }
                            div {
                                div { style: "font-size:13px;color:var(--hi-color-text-secondary);margin-bottom:6px;", "Status" }
                                div { class: "hi-tag-list",
                                    span { class: "hi-tag hi-tag--success", "Stable" }
                                    span { class: "hi-tag hi-tag--warning", "Beta" }
                                    span { class: "hi-tag hi-tag--danger", "Deprecated" }
                                }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Icon Tags" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            span { class: "hi-tag hi-tag--primary", "📦 Package" }
                            span { class: "hi-tag hi-tag--success", "✅ Verified" }
                            span { class: "hi-tag hi-tag--danger", "🚨 Critical" }
                            span { class: "hi-tag hi-tag--warning", "⏳ Pending" }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                            tbody {
                                tr { td { code { "variant" } } td { code { "primary | success | danger | warning | default" } } td { code { "default" } } td { "Tag color variant" } }
                                tr { td { code { "style" } } td { code { "solid | outline | light" } } td { code { "solid" } } td { "Visual fill style" } }
                                tr { td { code { "closable" } } td { code { "bool" } } td { code { "false" } } td { "Show close button" } }
                                tr { td { code { "icon" } } td { code { "string" } } td { code { "-" } } td { "Leading icon character" } }
                                tr { td { code { "size" } } td { code { "small | default" } } td { code { "default" } } td { "Tag size" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
