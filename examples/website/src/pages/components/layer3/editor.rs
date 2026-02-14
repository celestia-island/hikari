// website/src/pages/components/layer3/editor.rs
// Layer 3: Editor components index

use dioxus::prelude::*;

use crate::components::{
    Layout, {CodeBlock, MarkdownRenderer},
};
use _extra_components::extra::RichTextEditor;
use _icons::{Icon, MdiIcon};
use _palette::classes::{ClassesBuilder, Display, FontSize, Gap, MarginBottom, Padding, TextColor};

/// Layer 3 Editor Components Index
#[allow(non_snake_case)]
pub fn Layer3Editor() -> Element {
    let mut editor_content =
        use_signal(|| "<p>欢迎使用 <strong>Hikari</strong> 富文本编辑器！</p>".to_string());

    let components = vec![
        (
            "RichTextEditor",
            "富文本编辑器",
            "完整的富文本编辑功能",
            MdiIcon::FileEdit,
        ),
        (
            "CodeEditor",
            "代码编辑器",
            "完整的代码编辑功能",
            MdiIcon::Code,
        ),
    ];

    let sample_markdown = r#"
# Markdown 渲染示例

## 标题层级

这是一个 markdown 渲染组件的示例，展示了如何使用 `MarkdownRenderer` 组件。

### 支持的语法

1. 段落文本
2. **粗体** 和 *斜体*
3. `内联代码`
4. 代码块

## 代码块

下面是一个 Rust 代码块的：

\```rust
fn hello() {
    println!("Hello, Hikari!");
}
\```

## 内部组件引用

使用 ```_inner_hikari 标记可以引用其他组件：

\```_inner_hikari
pages/components/layer1/basic
\```

## 列表

- 第一个项目
- 第二个项目
- 第三个项目

## 分割线

---

以上是 markdown 渲染的示例。
"#;

    let sample_code = r#"
use dioxus::prelude::*;

fn main() {
    rsx! {
        div { "Hello, World!" }
    }
}
"#;

    rsx! {
        Layout {
            current_route: crate::app::Route::Layer3Editor {},
            div {
                class: ClassesBuilder::new()
                    .add_raw("page-container")
                    .build(),

                div {
                    class: ClassesBuilder::new()
                        .add_raw("page-header")
                        .build(),

                    h1 {
                        class: ClassesBuilder::new()
                            .add_raw("page-title")
                            .add(FontSize::X4xl)
                            .build(),
                        "Layer 3: 编辑器组件"
                    }

                    p {
                        class: ClassesBuilder::new()
                            .add_raw("page-description")
                            .add(TextColor::Muted)
                            .add(FontSize::Xl)
                            .build(),
                        "生产级编辑器组件。参考 Quill.js、Monaco Editor。"
                    }
                }

                // RichTextEditor Demo
                div {
                    class: ClassesBuilder::new()
                        .add_raw("section")
                        .add(MarginBottom::Mb8)
                        .build(),

                    h2 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X2xl)
                            .add(MarginBottom::Mb4)
                            .build(),
                        "RichTextEditor 富文本编辑器"
                    }

                    p {
                        class: ClassesBuilder::new()
                            .add(TextColor::Muted)
                            .add(MarginBottom::Mb4)
                            .build(),
                        "支持富文本编辑，包括粗体、斜体、下划线、对齐和列表。"
                    }

                    RichTextEditor {
                        content: editor_content(),
                        show_toolbar: true,
                        min_height: Some("200px".to_string()),
                        on_change: move |content| editor_content.set(content),
                    }
                }

                // Markdown Renderer Demo
                div {
                    class: ClassesBuilder::new()
                        .add_raw("section")
                        .add(MarginBottom::Mb8)
                        .build(),

                    h2 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X2xl)
                            .add(MarginBottom::Mb4)
                            .build(),
                        "Markdown 渲染组件"
                    }

                    MarkdownRenderer {
                        content: sample_markdown.to_string(),
                    }
                }

                // Code Block Demo
                div {
                    class: ClassesBuilder::new()
                        .add_raw("section")
                        .add(MarginBottom::Mb8)
                        .build(),

                    h2 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X2xl)
                            .add(MarginBottom::Mb4)
                            .build(),
                        "代码块组件"
                    }

                    CodeBlock {
                        language: "rust".to_string(),
                        code: sample_code.to_string(),
                    }
                }

                // Components Grid
                div {
                    class: ClassesBuilder::new()
                        .add(Display::Grid)
                        .add_raw("grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6")
                        .build(),

                        for (name, cn_name, description, icon) in components {
                            div {
                                class: ClassesBuilder::new()
                                    .add_raw("component-card")
                                    .add(Padding::P6)
                                    .build(),

                                Icon {
                                    icon,
                                    size: 32,
                                    class: "component-icon"
                                }

                                h3 {
                                    class: ClassesBuilder::new()
                                        .add(FontSize::Lg)
                                        .add(MarginBottom::Mb1)
                                        .build(),
                                    "{name}"
                                }

                                p {
                                    class: ClassesBuilder::new()
                                        .add(TextColor::Muted)
                                        .add(MarginBottom::Mb2)
                                        .build(),
                                    "{cn_name}"
                                }

                                p {
                                    class: ClassesBuilder::new()
                                        .add(TextColor::Muted)
                                        .build(),
                                    "{description}"
                                }
                            }
                        }
                }

            }
        }
    }
}
