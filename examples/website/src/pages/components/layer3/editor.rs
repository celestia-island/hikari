use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-editor", "Editor", "Rich text and markdown editor with formatting toolbar, preview, and code block support.", rsx! [
        {render_demo_block("Markdown Editor", rsx!{
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
        })}
        {render_demo_block("Split View Editor", rsx!{
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
                        p { class: "hi-editor__preview--bold", "Bold text" }
                        p { class: "hi-editor__preview--italic", "Italic text" }
                        p { code { "inline code" } }
                    }
                }
            }
        })}
        {render_demo_block("Read-Only Mode", rsx!{
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
        })}
        {render_demo_block("Compact Editor with Limits", rsx!{
            div { class: "hi-editor hi-editor--compact",
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
                        textarea { class: "hi-editor__textarea hi-editor__textarea--sm", placeholder: "Write a short bio...",
                            "Type something here..."
                         }
                    }
                    div { class: "hi-editor__footer",
                        span { "18 / 200 characters" }
                        span { "Markdown supported" }
                    }
                }
            }
        })}
        {render_demo_block("API", rsx!{
            div {
                {render_api_table(&[
                ("mode", "markdown | rich-text | code", "markdown", "Editor mode"),
                ("toolbar", "bool", "true", "Show formatting toolbar"),
                ("preview", "bool", "false", "Show live preview panel"),
                ("placeholder", "string", "-", "Placeholder text"),
                ("readonly", "bool", "false", "Make editor read-only"),
                ("height", "string | number", "300px", "Editor height"),
            ])}
            }
        })}
    ])
}
