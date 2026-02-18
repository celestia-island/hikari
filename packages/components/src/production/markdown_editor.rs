// packages/components/src/production/markdown_editor.rs
// MarkdownEditor component with Arknights + FUI styling

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::{ClassesBuilder, MarkdownEditorClass, UtilityClass};

use crate::styled::StyledComponent;

/// MarkdownEditor component type wrapper (for StyledComponent)
pub struct MarkdownEditorComponent;

/// Markdown editor mode
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MarkdownEditorMode {
    #[default]
    Edit,
    Preview,
    Split,
}

/// Markdown editor size
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MarkdownEditorSize {
    #[default]
    Medium,
    Small,
    Large,
}

/// MarkdownEditor component props
#[derive(Clone, PartialEq, Props)]
pub struct MarkdownEditorProps {
    /// Initial content
    #[props(default)]
    pub value: String,

    /// Placeholder text
    #[props(default)]
    pub placeholder: String,

    /// Editor mode
    #[props(default)]
    pub mode: MarkdownEditorMode,

    /// Editor size
    #[props(default)]
    pub size: MarkdownEditorSize,

    /// Show toolbar
    #[props(default = true)]
    pub toolbar: bool,

    /// Show line numbers
    #[props(default)]
    pub line_numbers: bool,

    /// Custom height
    #[props(default)]
    pub height: Option<String>,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Callback when content changes
    pub on_change: Option<EventHandler<String>>,
}

/// MarkdownEditor component with live preview
///
/// A markdown editor with toolbar, syntax highlighting support, and live preview.
#[component]
pub fn MarkdownEditor(props: MarkdownEditorProps) -> Element {
    let mut content = use_signal(|| props.value.clone());
    let mut current_mode = use_signal(|| props.mode);

    let size_class = match props.size {
        MarkdownEditorSize::Small => MarkdownEditorClass::Sm,
        MarkdownEditorSize::Medium => MarkdownEditorClass::Md,
        MarkdownEditorSize::Large => MarkdownEditorClass::Lg,
    };

    let container_classes = ClassesBuilder::new()
        .add(MarkdownEditorClass::Container)
        .add(size_class)
        .add_raw(&props.class)
        .build();

    let height_style = if let Some(h) = &props.height {
        format!("height: {};", h)
    } else {
        String::new()
    };

    let handle_input = {
        let on_change = props.on_change.clone();
        move |e: Event<FormData>| {
            let new_value = e.value();
            content.set(new_value.clone());
            if let Some(handler) = on_change.as_ref() {
                handler.call(new_value);
            }
        }
    };

    let on_change_for_insert = props.on_change.clone();
    let insert_bold = move |_| {
        let current = content();
        let new_value = format!("**{}**", current);
        content.set(new_value.clone());
        if let Some(handler) = on_change_for_insert.as_ref() {
            handler.call(new_value);
        }
    };

    let on_change_for_italic = props.on_change.clone();
    let insert_italic = move |_| {
        let current = content();
        let new_value = format!("*{}*", current);
        content.set(new_value.clone());
        if let Some(handler) = on_change_for_italic.as_ref() {
            handler.call(new_value);
        }
    };

    let on_change_for_heading = props.on_change.clone();
    let insert_heading = move |_| {
        let current = content();
        let new_value = format!("# {}", current);
        content.set(new_value.clone());
        if let Some(handler) = on_change_for_heading.as_ref() {
            handler.call(new_value);
        }
    };

    let on_change_for_code = props.on_change.clone();
    let insert_code = move |_| {
        let current = content();
        let new_value = format!("```\n{}\n```", current);
        content.set(new_value.clone());
        if let Some(handler) = on_change_for_code.as_ref() {
            handler.call(new_value);
        }
    };

    let on_change_for_link = props.on_change.clone();
    let insert_link = move |_| {
        let current = content();
        let new_value = format!("[{}](url)", current);
        content.set(new_value.clone());
        if let Some(handler) = on_change_for_link.as_ref() {
            handler.call(new_value);
        }
    };

    let on_change_for_image = props.on_change.clone();
    let insert_image = move |_| {
        let current = content();
        let new_value = format!("![alt]({})", current);
        content.set(new_value.clone());
        if let Some(handler) = on_change_for_image.as_ref() {
            handler.call(new_value);
        }
    };

    let on_change_for_list = props.on_change.clone();
    let insert_list = move |_| {
        let current = content();
        let new_value = format!("- {}", current);
        content.set(new_value.clone());
        if let Some(handler) = on_change_for_list.as_ref() {
            handler.call(new_value);
        }
    };

    let on_change_for_numbered = props.on_change.clone();
    let insert_numbered = move |_| {
        let current = content();
        let new_value = format!("1. {}", current);
        content.set(new_value.clone());
        if let Some(handler) = on_change_for_numbered.as_ref() {
            handler.call(new_value);
        }
    };

    let on_change_for_quote = props.on_change.clone();
    let insert_quote = move |_| {
        let current = content();
        let new_value = format!("> {}", current);
        content.set(new_value.clone());
        if let Some(handler) = on_change_for_quote.as_ref() {
            handler.call(new_value);
        }
    };

    let set_mode_edit = move |_| {
        current_mode.set(MarkdownEditorMode::Edit);
    };

    let set_mode_preview = move |_| {
        current_mode.set(MarkdownEditorMode::Preview);
    };

    let set_mode_split = move |_| {
        current_mode.set(MarkdownEditorMode::Split);
    };

    rsx! {
        div {
            class: "{container_classes}",
            style: "{height_style}",

            // Toolbar
            if props.toolbar {
                div { class: "{MarkdownEditorClass::Toolbar.as_class()}",
                    // Format buttons
                    button {
                        class: "{MarkdownEditorClass::ToolbarButton.as_class()}",
                        onclick: insert_bold,
                        title: "Bold",
                        Icon { icon: MdiIcon::FormatBold, size: 18 }
                    }
                    button {
                        class: "{MarkdownEditorClass::ToolbarButton.as_class()}",
                        onclick: insert_italic,
                        title: "Italic",
                        Icon { icon: MdiIcon::FormatItalic, size: 18 }
                    }
                    button {
                        class: "{MarkdownEditorClass::ToolbarButton.as_class()}",
                        onclick: insert_heading,
                        title: "Heading",
                        "H"
                    }
                    button {
                        class: "{MarkdownEditorClass::ToolbarButton.as_class()}",
                        onclick: insert_code,
                        title: "Code Block",
                        Icon { icon: MdiIcon::Code, size: 18 }
                    }
                    button {
                        class: "{MarkdownEditorClass::ToolbarButton.as_class()}",
                        onclick: insert_link,
                        title: "Link",
                        "🔗"
                    }
                    button {
                        class: "{MarkdownEditorClass::ToolbarButton.as_class()}",
                        onclick: insert_image,
                        title: "Image",
                        Icon { icon: MdiIcon::Image, size: 18 }
                    }
                    button {
                        class: "{MarkdownEditorClass::ToolbarButton.as_class()}",
                        onclick: insert_list,
                        title: "List",
                        Icon { icon: MdiIcon::FormatListBulleted, size: 18 }
                    }
                    button {
                        class: "{MarkdownEditorClass::ToolbarButton.as_class()}",
                        onclick: insert_numbered,
                        title: "Numbered List",
                        Icon { icon: MdiIcon::FormatListNumbered, size: 18 }
                    }
                    button {
                        class: "{MarkdownEditorClass::ToolbarButton.as_class()}",
                        onclick: insert_quote,
                        title: "Quote",
                        "\""
                    }

                    div { class: "{MarkdownEditorClass::ToolbarDivider.as_class()}" }

                    // Mode buttons
                    button {
                        class: if current_mode() == MarkdownEditorMode::Edit {
                            "{MarkdownEditorClass::ToolbarButton.as_class()} {MarkdownEditorClass::ToolbarButtonActive.as_class()}"
                        } else {
                            "{MarkdownEditorClass::ToolbarButton.as_class()}"
                        },
                        onclick: set_mode_edit,
                        "Edit"
                    }
                    button {
                        class: if current_mode() == MarkdownEditorMode::Preview {
                            "{MarkdownEditorClass::ToolbarButton.as_class()} {MarkdownEditorClass::ToolbarButtonActive.as_class()}"
                        } else {
                            "{MarkdownEditorClass::ToolbarButton.as_class()}"
                        },
                        onclick: set_mode_preview,
                        "Preview"
                    }
                    button {
                        class: if current_mode() == MarkdownEditorMode::Split {
                            "{MarkdownEditorClass::ToolbarButton.as_class()} {MarkdownEditorClass::ToolbarButtonActive.as_class()}"
                        } else {
                            "{MarkdownEditorClass::ToolbarButton.as_class()}"
                        },
                        onclick: set_mode_split,
                        "Split"
                    }
                }
            }

            // Editor area
            div { class: "{MarkdownEditorClass::Content.as_class()}",
                match current_mode() {
                    MarkdownEditorMode::Edit => rsx! {
                        textarea {
                            class: "{MarkdownEditorClass::Textarea.as_class()}",
                            placeholder: "{props.placeholder}",
                            value: "{content}",
                            oninput: handle_input,
                        }
                    },
                    MarkdownEditorMode::Preview => rsx! {
                        div { class: "{MarkdownEditorClass::Preview.as_class()}",
                            // Basic markdown rendering (simplified)
                            div {
                                dangerous_inner_html: "{render_markdown_simple(&content())}",
                            }
                        }
                    },
                    MarkdownEditorMode::Split => rsx! {
                        div { class: "{MarkdownEditorClass::SplitContainer.as_class()}",
                            textarea {
                                class: "{MarkdownEditorClass::Textarea.as_class()} {MarkdownEditorClass::SplitPane.as_class()}",
                                placeholder: "{props.placeholder}",
                                value: "{content}",
                                oninput: handle_input,
                            }
                            div {
                                class: "{MarkdownEditorClass::Preview.as_class()} {MarkdownEditorClass::SplitPane.as_class()}",
                                div {
                                    dangerous_inner_html: "{render_markdown_simple(&content())}",
                                }
                            }
                        }
                    },
                }
            }
        }
    }
}

/// Simple markdown to HTML converter (basic implementation)
fn render_markdown_simple(markdown: &str) -> String {
    let mut html = markdown.to_string();

    // Escape HTML
    html = html.replace('&', "&amp;");
    html = html.replace('<', "&lt;");
    html = html.replace('>', "&gt;");

    // Headers
    html = html.replace("\n### ", "\n<h3>");
    html = html.replace("\n## ", "\n<h2>");
    html = html.replace("\n# ", "\n<h1>");

    // Bold
    html = html
        .replace("**", "<strong>")
        .replacen("<strong>", "</strong>", 1);
    while html.contains("<strong>") {
        html = html.replacen("<strong>", "</strong>", 1);
    }

    // Italic
    html = html.replace("*", "<em>").replacen("<em>", "</em>", 1);
    while html.contains("<em>") {
        html = html.replacen("<em>", "</em>", 1);
    }

    // Code
    html = html.replace("`", "<code>").replacen("<code>", "</code>", 1);
    while html.contains("<code>") {
        html = html.replacen("<code>", "</code>", 1);
    }

    // Line breaks
    html = html.replace("\n", "<br>");

    // Wrap in paragraph
    format!("<div class=\"markdown-content\">{}</div>", html)
}

impl StyledComponent for MarkdownEditorComponent {
    fn styles() -> &'static str {
        r#"
.hi-markdown-editor {
    background-color: var(--hi-color-bg-container);
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.hi-markdown-editor:focus-within {
    border-color: var(--hi-color-primary);
    box-shadow: 0 0 0 2px var(--hi-color-primary-glow);
}

[data-theme="dark"] .hi-markdown-editor {
    background-color: var(--hi-surface);
}

.hi-markdown-editor-sm {
    min-height: 150px;
}

.hi-markdown-editor-md {
    min-height: 250px;
}

.hi-markdown-editor-lg {
    min-height: 400px;
}

.hi-markdown-editor-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px;
    background-color: var(--hi-color-bg-elevated);
    border-bottom: 1px solid var(--hi-color-border);
    flex-wrap: wrap;
}

.hi-markdown-editor-toolbar-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background-color: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--hi-text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
}

.hi-markdown-editor-toolbar-button:hover {
    background-color: var(--hi-color-hover);
    color: var(--hi-text-primary);
}

.hi-markdown-editor-toolbar-button-active {
    background-color: var(--hi-color-primary);
    color: white;
}

.hi-markdown-editor-toolbar-divider {
    width: 1px;
    height: 24px;
    background-color: var(--hi-color-border);
    margin: 0 4px;
}

.hi-markdown-editor-content {
    flex: 1;
    display: flex;
    overflow: hidden;
}

.hi-markdown-editor-textarea {
    width: 100%;
    flex: 1;
    padding: 16px;
    border: none;
    outline: none;
    resize: none;
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: 14px;
    line-height: 1.6;
    color: var(--hi-text-primary);
    background-color: transparent;
}

.hi-markdown-editor-textarea::placeholder {
    color: var(--hi-text-tertiary);
}

.hi-markdown-editor-preview {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    color: var(--hi-text-primary);
    line-height: 1.6;
}

.hi-markdown-editor-preview .markdown-content {
    font-size: 14px;
}

.hi-markdown-editor-preview h1,
.hi-markdown-editor-preview h2,
.hi-markdown-editor-preview h3 {
    margin: 16px 0 8px 0;
    font-weight: 600;
    color: var(--hi-text-primary);
}

.hi-markdown-editor-preview strong {
    font-weight: 600;
}

.hi-markdown-editor-preview code {
    background-color: var(--hi-color-bg-elevated);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: 13px;
}

.hi-markdown-editor-split-container {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.hi-markdown-editor-split-pane {
    width: 50% !important;
    border-right: 1px solid var(--hi-color-border);
}

.hi-markdown-editor-split-pane:last-child {
    border-right: none;
}
"#
    }

    fn name() -> &'static str {
        "markdown-editor"
    }
}
