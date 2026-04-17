use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-component-editor", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Editor" }
                p { class: "page-header__subtitle",
                    "Rich text and markdown editor with formatting toolbar, preview, and code block support."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Markdown Editor" }
                    div { class: "demo-block__body",
                        div { class: "hi-editor",
                            div { class: "hi-editor__toolbar",
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn hi-editor__btn--active", "B" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn", "I" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn", "U" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn", "S" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                span { class: "hi-editor__separator", "|" }
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn", "H1" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn", "H2" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                span { class: "hi-editor__separator", "|" }
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn", "\"\"\"" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn", "Link" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn", "📷" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn", "List" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                            div { class: "hi-editor__content",
                                textarea { class: "hi-editor__textarea", placeholder: "Start writing markdown...",
                                    "# Hello World\n\nThis is a **markdown** editor.\n\n- Item 1\n- Item 2\n\n```rust\nfn main() {\n    println!(\"Hello\");\n}\n```"
                                }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Split View Editor" }
                    div { class: "demo-block__body",
                        div { class: "hi-editor hi-editor--split",
                            div { class: "hi-editor__toolbar",
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn", "B" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn", "I" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn", "U" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                            div { class: "hi-editor__panels",
                                div { class: "hi-editor__panel",
                                    textarea { class: "hi-editor__textarea", placeholder: "Write...",
                                        "**Bold text**\n\n_Italic text_\n\n`inline code`"
                                    }
                                }
                                div { class: "hi-editor__divider" }
                                div { class: "hi-editor__panel hi-editor__preview",
                                    p { style: "font-weight:bold;", "Bold text" }
                                    p { style: "font-style:italic;", "Italic text" }
                                    p { code { "inline code" } }
                                }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Read-Only Mode" }
                    div { class: "demo-block__body",
                        div { class: "hi-editor",
                            div { class: "hi-editor__toolbar",
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn", "B", disabled: "true" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn", "I", disabled: "true" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-editor__btn", "U", disabled: "true" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                             }
                            div { class: "hi-editor__content",
                                textarea { class: "hi-editor__textarea", readonly: "readonly",
                                    "# Hikari UI Component Library\n\n## Features\n\n- **Glow effects** with configurable intensity\n- **30+ components** across 3 complexity layers\n- **Rust + WebAssembly** for performance\n\n```rust\nuse hikari::prelude::*;\n\nfn main() {\n    App::new().run();\n}\n```"
                                 }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Compact Editor with Limits" }
                    div { class: "demo-block__body",
                        div { style: "max-width:500px;",
                            div { class: "hi-editor",
                                div { class: "hi-editor__toolbar",
                                    {glow_wrap(
                                        rsx! { button { class: "hi-editor__btn", "B" } },
                                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                    )}
                                    {glow_wrap(
                                        rsx! { button { class: "hi-editor__btn", "I" } },
                                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                    )}
                                    {glow_wrap(
                                        rsx! { button { class: "hi-editor__btn", "Link" } },
                                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                    )}
                                }
                                div { class: "hi-editor__content",
                                    textarea { class: "hi-editor__textarea", placeholder: "Write a short bio...", style: "height:80px;",
                                        "Type something here..."
                                     }
                                }
                                div { style: "display:flex;justify-content:space-between;padding-top:6px;font-size:12px;color:var(--hi-gray-400);",
                                    span { "18 / 200 characters" }
                                    span { "Markdown supported" }
                                }
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
                                tr { td { code { "mode" } } td { code { "markdown | rich-text | code" } } td { code { "markdown" } } td { "Editor mode" } }
                                tr { td { code { "toolbar" } } td { code { "bool" } } td { code { "true" } } td { "Show formatting toolbar" } }
                                tr { td { code { "preview" } } td { code { "bool" } } td { code { "false" } } td { "Show live preview panel" } }
                                tr { td { code { "placeholder" } } td { code { "string" } } td { code { "-" } } td { "Placeholder text" } }
                                tr { td { code { "readonly" } } td { code { "bool" } } td { code { "false" } } td { "Make editor read-only" } }
                                tr { td { code { "height" } } td { code { "string | number" } } td { code { "300px" } } td { "Editor height" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
