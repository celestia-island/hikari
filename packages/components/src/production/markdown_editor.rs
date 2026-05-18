// packages/components/src/production/markdown_editor.rs
// MarkdownEditor component

use hikari_icons::Icon;
use hikari_icons::mdi_minimal::MdiIcon;
use hikari_palette::classes::{ClassesBuilder, MarkdownEditorClass, TypedClass};

use crate::prelude::*;
use crate::styled::StyledComponent;

/// Marker struct providing the styled CSS for the markdown editor component.
pub struct MarkdownEditorComponent;

/// Display mode for the markdown editor.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MarkdownEditorMode {
    #[default]
    Edit,
    Preview,
    Split,
}

/// Available sizes for the markdown editor.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MarkdownEditorSize {
    #[default]
    Medium,
    Small,
    Large,
}

/// Props for the MarkdownEditor component.
#[define_props]
pub struct MarkdownEditorProps {
    #[default(String::default())]
    pub value: String,

    #[default(String::default())]
    pub placeholder: String,

    pub mode: MarkdownEditorMode,

    pub size: MarkdownEditorSize,

    #[default(true)]
    pub toolbar: bool,

    #[default(false)]
    pub line_numbers: bool,

    pub height: Option<String>,

    #[default(String::default())]
    pub class: String,

    pub on_change: Option<EventHandler<String>>,
}

/// Renders a markdown editor with a formatting toolbar and edit/preview/split modes.
#[component]
pub fn MarkdownEditor(props: MarkdownEditorProps) -> Element {
    let content = use_signal(|| props.value.clone());
    let current_mode = use_signal(|| props.mode);

    let size_class = match props.size {
        MarkdownEditorSize::Small => MarkdownEditorClass::Sm,
        MarkdownEditorSize::Medium => MarkdownEditorClass::Md,
        MarkdownEditorSize::Large => MarkdownEditorClass::Lg,
    };

    let container_classes = ClassesBuilder::new()
        .add_typed(MarkdownEditorClass::Container)
        .add_typed(size_class)
        .add(&props.class)
        .build();

    let height_style = if let Some(h) = &props.height {
        format!("height: {};", h)
    } else {
        String::new()
    };

    // Create two separate handlers for the two textareas
    let handle_input_edit = {
        let on_change = props.on_change.clone();
        let content_for_edit = content.clone();
        move |e: InputEvent| {
            let new_value = e.data.clone();
            content_for_edit.set(new_value.clone());
            if let Some(handler) = on_change.as_ref() {
                handler.call(new_value);
            }
        }
    };

    let handle_input_split = {
        let on_change = props.on_change.clone();
        let content_for_split = content.clone();
        move |e: InputEvent| {
            let new_value = e.data.clone();
            content_for_split.set(new_value.clone());
            if let Some(handler) = on_change.as_ref() {
                handler.call(new_value);
            }
        }
    };

    // Insert handlers - each needs its own clones
    let insert_bold = {
        let on_change = props.on_change.clone();
        let content = content.clone();
        move |_| {
            let current = content.get();
            let new_value = format!("**{}**", current);
            content.set(new_value.clone());
            if let Some(handler) = on_change.as_ref() {
                handler.call(new_value);
            }
        }
    };

    let insert_italic = {
        let on_change = props.on_change.clone();
        let content = content.clone();
        move |_| {
            let current = content.get();
            let new_value = format!("*{}*", current);
            content.set(new_value.clone());
            if let Some(handler) = on_change.as_ref() {
                handler.call(new_value);
            }
        }
    };

    let insert_heading = {
        let on_change = props.on_change.clone();
        let content = content.clone();
        move |_| {
            let current = content.get();
            let new_value = format!("# {}", current);
            content.set(new_value.clone());
            if let Some(handler) = on_change.as_ref() {
                handler.call(new_value);
            }
        }
    };

    let insert_code = {
        let on_change = props.on_change.clone();
        let content = content.clone();
        move |_| {
            let current = content.get();
            let new_value = format!("```\n{}\n```", current);
            content.set(new_value.clone());
            if let Some(handler) = on_change.as_ref() {
                handler.call(new_value);
            }
        }
    };

    let insert_link = {
        let on_change = props.on_change.clone();
        let content = content.clone();
        move |_| {
            let current = content.get();
            let new_value = format!("[{}](url)", current);
            content.set(new_value.clone());
            if let Some(handler) = on_change.as_ref() {
                handler.call(new_value);
            }
        }
    };

    let insert_image = {
        let on_change = props.on_change.clone();
        let content = content.clone();
        move |_| {
            let current = content.get();
            let new_value = format!("![alt]({})", current);
            content.set(new_value.clone());
            if let Some(handler) = on_change.as_ref() {
                handler.call(new_value);
            }
        }
    };

    let insert_list = {
        let on_change = props.on_change.clone();
        let content = content.clone();
        move |_| {
            let current = content.get();
            let new_value = format!("- {}", current);
            content.set(new_value.clone());
            if let Some(handler) = on_change.as_ref() {
                handler.call(new_value);
            }
        }
    };

    let insert_numbered = {
        let on_change = props.on_change.clone();
        let content = content.clone();
        move |_| {
            let current = content.get();
            let new_value = format!("1. {}", current);
            content.set(new_value.clone());
            if let Some(handler) = on_change.as_ref() {
                handler.call(new_value);
            }
        }
    };

    let insert_quote = {
        let on_change = props.on_change.clone();
        let content = content.clone();
        move |_| {
            let current = content.get();
            let new_value = format!("> {}", current);
            content.set(new_value.clone());
            if let Some(handler) = on_change.as_ref() {
                handler.call(new_value);
            }
        }
    };

    // Mode setters - each needs its own clone of current_mode
    let set_mode_edit = {
        let current_mode = current_mode.clone();
        move |_| {
            current_mode.set(MarkdownEditorMode::Edit);
        }
    };

    let set_mode_preview = {
        let current_mode = current_mode.clone();
        move |_| {
            current_mode.set(MarkdownEditorMode::Preview);
        }
    };

    let set_mode_split = {
        let current_mode = current_mode.clone();
        move |_| {
            current_mode.set(MarkdownEditorMode::Split);
        }
    };

    // Get current values for display
    let current_mode_value = current_mode.get();
    let content_value = content.get();

    rsx! {
        div {
            class: container_classes,
            style: height_style,

            // Toolbar
            if props.toolbar {
                div { class: MarkdownEditorClass::Toolbar.class_name(),
                    // Format buttons
                    button {
                        class: MarkdownEditorClass::ToolbarButton.class_name(),
                        onclick: insert_bold,
                        title: "Bold",
                        Icon { icon: MdiIcon::FormatBold, size: 18 }
                    }
                    button {
                        class: MarkdownEditorClass::ToolbarButton.class_name(),
                        onclick: insert_italic,
                        title: "Italic",
                        Icon { icon: MdiIcon::FormatItalic, size: 18 }
                    }
                    button {
                        class: MarkdownEditorClass::ToolbarButton.class_name(),
                        onclick: insert_heading,
                        title: "Heading",
                        "H"
                    }
                    button {
                        class: MarkdownEditorClass::ToolbarButton.class_name(),
                        onclick: insert_code,
                        title: "Code Block",
                        Icon { icon: MdiIcon::Code, size: 18 }
                    }
                    button {
                        class: MarkdownEditorClass::ToolbarButton.class_name(),
                        onclick: insert_link,
                        title: "Link",
                        "🔗"
                    }
                    button {
                        class: MarkdownEditorClass::ToolbarButton.class_name(),
                        onclick: insert_image,
                        title: "Image",
                        Icon { icon: MdiIcon::Image, size: 18 }
                    }
                    button {
                        class: MarkdownEditorClass::ToolbarButton.class_name(),
                        onclick: insert_list,
                        title: "List",
                        Icon { icon: MdiIcon::FormatListBulleted, size: 18 }
                    }
                    button {
                        class: MarkdownEditorClass::ToolbarButton.class_name(),
                        onclick: insert_numbered,
                        title: "Numbered List",
                        Icon { icon: MdiIcon::FormatListNumbered, size: 18 }
                    }
                    button {
                        class: MarkdownEditorClass::ToolbarButton.class_name(),
                        onclick: insert_quote,
                        title: "Quote",
                        "\""
                    }

                    div { class: "{MarkdownEditorClass::ToolbarDivider.class_name()}" }

                    // Mode buttons
                    button {
                        class: if current_mode_value == MarkdownEditorMode::Edit {
                            "{MarkdownEditorClass::ToolbarButton.class_name()} {MarkdownEditorClass::ToolbarButtonActive.class_name()}"
                        } else {
                            "{MarkdownEditorClass::ToolbarButton.class_name()}"
                        },
                        onclick: set_mode_edit,
                        "Edit"
                    }
                    button {
                        class: if current_mode_value == MarkdownEditorMode::Preview {
                            "{MarkdownEditorClass::ToolbarButton.class_name()} {MarkdownEditorClass::ToolbarButtonActive.class_name()}"
                        } else {
                            "{MarkdownEditorClass::ToolbarButton.class_name()}"
                        },
                        onclick: set_mode_preview,
                        "Preview"
                    }
                    button {
                        class: if current_mode_value == MarkdownEditorMode::Split {
                            "{MarkdownEditorClass::ToolbarButton.class_name()} {MarkdownEditorClass::ToolbarButtonActive.class_name()}"
                        } else {
                            "{MarkdownEditorClass::ToolbarButton.class_name()}"
                        },
                        onclick: set_mode_split,
                        "Split"
                    }
                }
            }

            // Editor area
            div { class: MarkdownEditorClass::Content.class_name(),
                match current_mode_value {
                    MarkdownEditorMode::Edit => rsx! {
                        textarea {
                            class: MarkdownEditorClass::Textarea.class_name(),
                            placeholder: props.placeholder,
                            value: "{content_value}",
                            oninput: handle_input_edit,
                        }
                    },
                    MarkdownEditorMode::Preview => rsx! {
                        div { class: MarkdownEditorClass::Preview.class_name(),
                            // Basic markdown rendering (simplified)
                            div {
                                dangerous_inner_html: render_markdown_simple(&content_value),
                            }
                        }
                    },
                    MarkdownEditorMode::Split => rsx! {
                        div { class: MarkdownEditorClass::SplitContainer.class_name(),
                            textarea {
                                class: "{MarkdownEditorClass::Textarea.class_name()} {MarkdownEditorClass::SplitPane.class_name()}",
                                placeholder: props.placeholder,
                                value: "{content_value}",
                                oninput: handle_input_split,
                            }
                            div {
                                class: "{MarkdownEditorClass::Preview.class_name()} {MarkdownEditorClass::SplitPane.class_name()}",
                                div {
                                    dangerous_inner_html: render_markdown_simple(&content_value),
                                }
                            }
                        }
                    },
                }
            }
        }
    }
}

fn render_markdown_simple(markdown: &str) -> String {
    let mut html = markdown.to_string();

    html = html.replace('&', "&amp;");
    html = html.replace('<', "&lt;");
    html = html.replace('>', "&gt;");

    let mut result = String::new();
    let mut in_bold = false;
    let mut in_italic = false;
    let mut in_code = false;
    let mut chars = html.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '*' && chars.peek() == Some(&'*') && !in_code {
            chars.next();
            if in_bold {
                result.push_str("</strong>");
            } else {
                result.push_str("<strong>");
            }
            in_bold = !in_bold;
        } else if c == '*' && !in_bold && !in_code {
            if in_italic {
                result.push_str("</em>");
            } else {
                result.push_str("<em>");
            }
            in_italic = !in_italic;
        } else if c == '`' && !in_bold && !in_italic {
            if in_code {
                result.push_str("</code>");
            } else {
                result.push_str("<code>");
            }
            in_code = !in_code;
        } else if c == '\n' {
            result.push_str("<br>");
        } else {
            result.push(c);
        }
    }

    if in_bold {
        result.push_str("</strong>");
    }
    if in_italic {
        result.push_str("</em>");
    }
    if in_code {
        result.push_str("</code>");
    }

    let lines: Vec<&str> = result.split("<br>").collect();
    let mut processed = Vec::new();
    for line in lines {
        let trimmed = line.trim_start_matches(' ');
        if let Some(rest) = trimmed.strip_prefix("### ") {
            processed.push(format!("<h3>{}</h3>", rest));
        } else if let Some(rest) = trimmed.strip_prefix("## ") {
            processed.push(format!("<h2>{}</h2>", rest));
        } else if let Some(rest) = trimmed.strip_prefix("# ") {
            processed.push(format!("<h1>{}</h1>", rest));
        } else {
            processed.push(line.to_string());
        }
    }

    format!(
        "<div class=\"markdown-content\">{}</div>",
        processed.join("<br>")
    )
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
    box-shadow: 0 0 0 2px var(--hi-glow-button-primary);
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
