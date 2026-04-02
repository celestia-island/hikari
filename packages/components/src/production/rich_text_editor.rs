// packages/components/src/production/rich_text_editor.rs
// Rich text editor component with Arknights + FUI styling
//
// Platform API: Uses tairitsu WIT bindings for contenteditable, execCommand,
// and inner HTML retrieval. Stubs are provided in platform/wit.rs for
// environments without WIT support.

use hikari_palette::classes::{ClassesBuilder, RichTextEditorClass};

use crate::{platform, prelude::*, styled::StyledComponent};

pub struct RichTextEditorComponent;

#[define_props]
pub struct RichTextEditorProps {
    #[default("".to_string())]
    pub content: String,

    #[default("".to_string())]
    pub placeholder: String,

    #[default(true)]
    pub toolbar: bool,

    pub height: Option<String>,

    #[default("".to_string())]
    pub class: String,

    #[default("".to_string())]
    pub style: String,
}

#[component]
pub fn RichTextEditor(props: RichTextEditorProps) -> Element {
    let content = use_signal(|| props.content.clone());

    let container_classes = ClassesBuilder::new()
        .add(RichTextEditorClass::Container)
        .add_raw(&props.class)
        .build();

    let toolbar_classes = ClassesBuilder::new()
        .add(RichTextEditorClass::Toolbar)
        .build();

    let editor_classes = ClassesBuilder::new()
        .add(RichTextEditorClass::Editor)
        .build();

    let height_style = if let Some(ref h) = props.height {
        format!("height: {}; {}", h, props.style)
    } else {
        props.style.clone()
    };

    let exec_format = move |command: &str| {
        platform::exec_command(command, None);
    };

    rsx! {
        div {
            class: container_classes,
            style: height_style,

            if props.toolbar {
                div {
                    class: toolbar_classes,

                    button {
                        class: "hi-rich-text-editor-toolbar-button",
                        onclick: move |_| exec_format("bold"),
                        "B"
                    }

                    button {
                        class: "hi-rich-text-editor-toolbar-button",
                        onclick: move |_| exec_format("italic"),
                        style: "font-style: italic;",
                        "I"
                    }

                    button {
                        class: "hi-rich-text-editor-toolbar-button",
                        onclick: move |_| exec_format("underline"),
                        style: "text-decoration: underline;",
                        "U"
                    }

                    div { class: "hi-editor-divider" }

                    button {
                        class: "hi-rich-text-editor-toolbar-button",
                        onclick: move |_| exec_format("justifyLeft"),
                        "⫷"
                    }

                    button {
                        class: "hi-rich-text-editor-toolbar-button",
                        onclick: move |_| exec_format("justifyCenter"),
                        "⫿"
                    }

                    button {
                        class: "hi-rich-text-editor-toolbar-button",
                        onclick: move |_| exec_format("justifyRight"),
                        "⫸"
                    }

                    div { class: "hi-editor-divider" }

                    button {
                        class: "hi-rich-text-editor-toolbar-button",
                        onclick: move |_| exec_format("insertUnorderedList"),
                        "•"
                    }

                    button {
                        class: "hi-rich-text-editor-toolbar-button",
                        onclick: move |_| exec_format("insertOrderedList"),
                        "1."
                    }
                }
            }

            div {
                class: editor_classes,
                contenteditable: "true",
                "data-placeholder": "{props.placeholder}",
                dangerous_inner_html: "{content.get()}",
            }
        }
    }
}

impl StyledComponent for RichTextEditorComponent {
    fn styles() -> &'static str {
        r#"
.hi-rich-text-editor {
    background-color: var(--hi-color-bg-container);
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    overflow: hidden;
}

.hi-rich-text-editor:focus-within {
    border-color: var(--hi-color-primary);
    box-shadow: 0 0 2px var(--hi-color-primary-glow);
}

.hi-rich-text-editor-toolbar {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem;
    background-color: var(--hi-color-bg-elevated);
    border-bottom: 1px solid var(--hi-color-border);
}

.hi-rich-text-editor-toolbar-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0 0.75rem;
    background-color: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--hi-color-text-secondary);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}

.hi-rich-text-editor-toolbar-button:hover {
    background-color: var(--hi-color-primary-bg);
    color: var(--hi-color-primary);
}

.hi-editor-divider {
    width: 1px;
    height: 20px;
    background: var(--hi-border);
    margin: 0 4px;
}

[data-theme="dark"] .hi-editor-divider {
    background: var(--hi-border);
}

.hi-rich-text-editor-editor {
    padding: 1rem;
    min-height: 200px;
    outline: none;
    color: var(--hi-color-text-primary);
    line-height: 1.6;
}

.hi-rich-text-editor-editor:empty::before {
    content: attr(data-placeholder);
    color: var(--hi-color-text-tertiary);
}

.hi-rich-text-editor-editor:focus {
    outline: none;
}

.hi-rich-text-editor-editor p {
    margin: 0.5rem 0;
}

.hi-rich-text-editor-editor p:first-child {
    margin-top: 0;
}

.hi-rich-text-editor-editor p:last-child {
    margin-bottom: 0;
}
"#
    }

    fn name() -> &'static str {
        "rich-text-editor"
    }
}
