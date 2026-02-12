// packages/components/src/production/rich_text_editor.rs
// Rich text editor component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, RichTextEditorClass, UtilityClass};

use crate::styled::StyledComponent;

/// RichTextEditor component type wrapper (for StyledComponent)
pub struct RichTextEditorComponent;

/// Rich text editor component with Arknights + FUI styling
#[derive(Clone, PartialEq, Props)]
pub struct RichTextEditorProps {
    #[props(default)]
    pub content: String,

    #[props(default)]
    pub placeholder: String,

    #[props(default = true)]
    pub toolbar: bool,

    #[props(default)]
    pub height: Option<String>,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,
}

#[component]
pub fn RichTextEditor(props: RichTextEditorProps) -> Element {
    let mut content = use_signal(|| props.content.clone());

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

    rsx! {
        div {
            class: "{container_classes}",
            style: "{height_style}",

            if props.toolbar {
                div {
                    class: "{toolbar_classes}",

                    button {
                        class: "{RichTextEditorClass::ToolbarButton.as_class()}",
                        "B"
                    }

                    button {
                        class: "{RichTextEditorClass::ToolbarButton.as_class()}",
                        "I"
                    }

                    button {
                        class: "{RichTextEditorClass::ToolbarButton.as_class()}",
                        "U"
                    }
                }
            }

            div {
                class: "{editor_classes}",
                {
                    "{content}"
                }
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

.hi-rich-text-editor-editor {
    padding: 1rem;
    min-height: 200px;
    outline: none;
    color: var(--hi-color-text-primary);
}

.hi-rich-text-editor-editor:empty::before {
    content: attr(data-placeholder);
    color: var(--hi-color-text-tertiary);
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
