// hi-extra-components/src/extra/rich_text_editor.rs
// RichTextEditor component with Arknights + FUI styling

use dioxus::prelude::*;
use hikari_components::basic::IconButton;
use hikari_icons::MdiIcon;
use hikari_palette::classes::ClassesBuilder;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

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

impl Default for RichTextEditorProps {
    fn default() -> Self {
        Self {
            content: String::default(),
            mode: Default::default(),
            placeholder: None,
            show_toolbar: true,
            readonly: false,
            min_height: None,
            class: String::default(),
            on_change: None,
        }
    }
}

/// RichTextEditor component with toolbar
///
/// A rich text editor with formatting toolbar using contenteditable API.
/// Supports bold, italic, underline, text alignment, and lists.
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

    let format_text = move |command: &str, value: Option<&str>| {
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(window) = web_sys::window() {
                if let Some(document) = window.document() {
                    let result = document.exec_command(command, false, value);
                    if !result.unwrap_or(false) {
                        web_sys::console::log_1(&format!("execCommand failed: {}", command).into());
                    }
                }
            }
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            let _ = command;
            let _ = value;
        }
    };

    let toggle_bold = move |_| {
        format_text("bold", None);
    };

    let toggle_italic = move |_| {
        format_text("italic", None);
    };

    let toggle_underline = move |_| {
        format_text("underline", None);
    };

    let align_left = move |_| {
        format_text("justifyLeft", None);
    };

    let align_center = move |_| {
        format_text("justifyCenter", None);
    };

    let align_right = move |_| {
        format_text("justifyRight", None);
    };

    let insert_bulleted_list = move |_| {
        format_text("insertUnorderedList", None);
    };

    let insert_numbered_list = move |_| {
        format_text("insertOrderedList", None);
    };

    let on_content_change = move |event: Event<FormData>| {
        if let Some(on_change) = props.on_change.as_ref() {
            #[cfg(target_arch = "wasm32")]
            {
                if let Some(window) = web_sys::window() {
                    if let Some(document) = window.document() {
                        if let Some(element) = document
                            .get_elements_by_class_name("hi-editor-content")
                            .get(0)
                        {
                            if let Some(element) = element.dyn_ref::<web_sys::HtmlElement>() {
                                if let Ok(inner_html) = element.inner_html() {
                                    on_change.call(inner_html);
                                }
                            }
                        }
                    }
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                let _ = event;
                let _ = on_change;
            }
        }
    };

    rsx! {
        div { class: "{editor_classes}",
            if props.show_toolbar {
                div { class: "hi-editor-toolbar",
                    IconButton { icon: MdiIcon::FormatBold, onclick: toggle_bold }
                    IconButton { icon: MdiIcon::FormatItalic, onclick: toggle_italic }
                    IconButton { icon: MdiIcon::FormatUnderline, onclick: toggle_underline }
                    div { class: "hi-editor-divider" }
                    IconButton { icon: MdiIcon::FormatAlignLeft, onclick: align_left }
                    IconButton { icon: MdiIcon::FormatAlignCenter, onclick: align_center }
                    IconButton { icon: MdiIcon::FormatAlignRight, onclick: align_right }
                    div { class: "hi-editor-divider" }
                    IconButton { icon: MdiIcon::FormatListBulleted, onclick: insert_bulleted_list }
                    IconButton { icon: MdiIcon::FormatListNumbered, onclick: insert_numbered_list }
                }
            }

            div {
                class: "hi-editor-content",
                contenteditable: !props.readonly,
                "data-placeholder": props.placeholder.unwrap_or_default(),
                style: "{height_style}",
                oninput: on_content_change,
                dangerous_inner_html: "{props.content}"
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
