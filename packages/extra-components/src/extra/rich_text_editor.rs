// hi-extra-components/src/extra/rich_text_editor.rs
// RichTextEditor component with Arknights + FUI styling

use dioxus::prelude::*;
use hikari_components::basic::IconButton;
use hikari_icons::MdiIcon;
use hikari_palette::classes::ClassesBuilder;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum EditorMode {
    #[default]
    Rich,
    Markdown,
    Html,
}

#[derive(Clone, PartialEq, Props)]
pub struct RichTextEditorProps {
    /// Initial content
    #[props(default)]
    pub content: String,

    /// Editor mode
    #[props(default)]
    pub mode: EditorMode,

    /// Placeholder text
    #[props(default)]
    pub placeholder: Option<String>,

    /// Whether toolbar is visible
    #[props(default)]
    pub show_toolbar: bool,

    /// Whether editor is readonly
    #[props(default)]
    pub readonly: bool,

    /// Minimum height
    #[props(default)]
    pub min_height: Option<String>,

    /// Additional CSS class
    #[props(default)]
    pub class: String,

    /// Callback when content changes
    #[props(default)]
    pub on_change: Option<EventHandler<String>>,
}

/// RichTextEditor component with toolbar
///
/// A rich text editor with formatting toolbar using existing components.
///
/// # Examples
///
/// ## Basic Usage
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_extra_components::RichTextEditor;
///
/// fn app() -> Element {
///     rsx! {
///         RichTextEditor {
///             content: "Hello, World!".to_string(),
///             show_toolbar: true,
///         }
///     }
/// }
/// ```
#[component]
pub fn RichTextEditor(props: RichTextEditorProps) -> Element {
    let editor_classes = ClassesBuilder::new()
        .add_raw("hi-editor")
        .add_raw(&props.class)
        .build();

    let height_style = props
        .min_height
        .map(|h| format!("min-height: {};", h))
        .unwrap_or_default();

    rsx! {
        div { class: "{editor_classes}",
            if props.show_toolbar {
                div { class: "hi-editor-toolbar",
                    IconButton { icon: MdiIcon::FormatBold, onclick: |_| {} }
                    IconButton { icon: MdiIcon::FormatItalic, onclick: |_| {} }
                    IconButton { icon: MdiIcon::FormatUnderline, onclick: |_| {} }
                    div { class: "hi-editor-divider" }
                    IconButton { icon: MdiIcon::FormatAlignLeft, onclick: |_| {} }
                    IconButton { icon: MdiIcon::FormatAlignCenter, onclick: |_| {} }
                    IconButton { icon: MdiIcon::FormatAlignRight, onclick: |_| {} }
                    div { class: "hi-editor-divider" }
                    IconButton { icon: MdiIcon::FormatListBulleted, onclick: |_| {} }
                    IconButton { icon: MdiIcon::FormatListNumbered, onclick: |_| {} }
                }
            }

            div {
                class: "hi-editor-content",
                contenteditable: !props.readonly,
                "data-placeholder": props.placeholder.unwrap_or_default(),
                style: "{height_style}",
                "{props.content}"
            }
        }
    }
}

/// RichTextEditor component's type wrapper for StyledComponent
pub struct RichTextEditorComponent;

impl hikari_components::StyledComponent for RichTextEditorComponent {
    fn styles() -> &'static str {
        r#"
.hi-editor {
  width: 100%;
  border: 1px solid var(--hi-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--hi-surface);
}

[data-theme="dark"] .hi-editor {
  background: var(--hi-background);
  border-color: var(--hi-border);
}

.hi-editor-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--hi-border);
  background: var(--hi-surface);
}

[data-theme="dark"] .hi-editor-toolbar {
  background: var(--hi-background);
  border-bottom-color: var(--hi-border);
}

.hi-editor-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--hi-border);
  background: var(--hi-surface);
}

[data-theme="dark"] .hi-editor-toolbar {
  background: var(--hi-background);
  border-bottom-color: var(--hi-border);
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

.hi-editor-content {
  padding: 16px;
  min-height: 200px;
  outline: none;
  line-height: 1.6;
  color: var(--hi-text-primary);
}

[data-theme="dark"] .hi-editor-content {
  color: var(--hi-text-primary);
}

.hi-editor-content:empty:before {
  content: attr(data-placeholder);
  color: var(--hi-text-secondary);
}

[data-theme="dark"] .hi-editor-content:empty:before {
  color: var(--hi-text-secondary);
}

.hi-editor-content:focus {
  outline: none;
}
"#
    }

    fn name() -> &'static str {
        "rich_text_editor"
    }
}
