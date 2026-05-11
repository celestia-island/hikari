//! RichTextEditor - Framework Agnostic State Model
//!
//! ## Migration Notice
//!
//! Previously a Dioxus component using `web-sys` (`contenteditable`, `execCommand`).
//! Now provides a pure state model with formatting commands and content tracking.
//!
//! ## Platform API
//!
//! Formatting commands delegate to `platform::exec_command` (tairitsu WIT binding).
//! Content retrieval uses `platform::get_inner_html` / `platform::set_content_editable`.

use serde::{Deserialize, Serialize};

use tairitsu_vdom::{VElement, VNode, VText};

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default, Serialize, Deserialize)]
pub enum EditorMode {
    #[default]
    Rich,
    Markdown,
    Html,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
pub enum TextFormat {
    Bold,
    Italic,
    Underline,
    Strikethrough,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
pub enum TextAlignment {
    Left,
    Center,
    Right,
    Justify,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
pub enum ListType {
    Ordered,
    Unordered,
}

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct RichTextEditorState {
    pub content: String,
    pub mode: EditorMode,
    pub placeholder: String,
    pub show_toolbar: bool,
    pub readonly: bool,
    pub min_height: Option<String>,
    pub class: String,
    pub is_focused: bool,
    pub selection_start: Option<u32>,
    pub selection_end: Option<u32>,
    pub active_formats: Vec<TextFormat>,
    pub alignment: TextAlignment,
}

impl RichTextEditorState {
    pub fn new(content: impl Into<String>) -> Self {
        Self {
            content: content.into(),
            mode: EditorMode::default(),
            placeholder: String::new(),
            show_toolbar: true,
            readonly: false,
            min_height: None,
            class: String::new(),
            is_focused: false,
            selection_start: None,
            selection_end: None,
            active_formats: Vec::new(),
            alignment: TextAlignment::Left,
        }
    }

    pub fn with_mode(mut self, mode: EditorMode) -> Self {
        self.mode = mode;
        self
    }

    pub fn with_placeholder(mut self, placeholder: impl Into<String>) -> Self {
        self.placeholder = placeholder.into();
        self
    }

    pub fn with_show_toolbar(mut self, show: bool) -> Self {
        self.show_toolbar = show;
        self
    }

    pub fn with_readonly(mut self, readonly: bool) -> Self {
        self.readonly = readonly;
        self
    }

    pub fn with_min_height(mut self, height: impl Into<String>) -> Self {
        self.min_height = Some(height.into());
        self
    }

    pub fn with_class(mut self, class: impl Into<String>) -> Self {
        self.class = class.into();
        self
    }

    pub fn set_content(&mut self, content: impl Into<String>) {
        self.content = content.into();
    }

    pub fn set_focused(&mut self, focused: bool) {
        self.is_focused = focused;
    }

    pub fn set_selection(&mut self, start: Option<u32>, end: Option<u32>) {
        self.selection_start = start;
        self.selection_end = end;
    }

    pub fn has_selection(&self) -> bool {
        self.selection_start.is_some() && self.selection_end.is_some()
    }

    pub fn is_bold(&self) -> bool {
        self.active_formats.contains(&TextFormat::Bold)
    }

    pub fn is_italic(&self) -> bool {
        self.active_formats.contains(&TextFormat::Italic)
    }

    pub fn is_underline(&self) -> bool {
        self.active_formats.contains(&TextFormat::Underline)
    }

    pub fn toggle_format(&mut self, format: TextFormat) {
        if let Some(pos) = self.active_formats.iter().position(|f| *f == format) {
            self.active_formats.remove(pos);
        } else {
            self.active_formats.push(format);
        }
    }

    pub fn set_alignment(&mut self, alignment: TextAlignment) {
        self.alignment = alignment;
    }

    pub fn format_command(format: TextFormat) -> &'static str {
        match format {
            TextFormat::Bold => "bold",
            TextFormat::Italic => "italic",
            TextFormat::Underline => "underline",
            TextFormat::Strikethrough => "strikeThrough",
        }
    }

    pub fn alignment_command(alignment: TextAlignment) -> &'static str {
        match alignment {
            TextAlignment::Left => "justifyLeft",
            TextAlignment::Center => "justifyCenter",
            TextAlignment::Right => "justifyRight",
            TextAlignment::Justify => "justifyFull",
        }
    }

    pub fn list_command(list_type: ListType) -> &'static str {
        match list_type {
            ListType::Ordered => "insertOrderedList",
            ListType::Unordered => "insertUnorderedList",
        }
    }

    pub fn height_style(&self) -> String {
        match &self.min_height {
            Some(h) => format!("min-height: {};", h),
            None => String::new(),
        }
    }

    pub fn class_string(&self) -> String {
        if self.class.is_empty() {
            "hi-editor".to_string()
        } else {
            format!("hi-editor {}", self.class)
        }
    }

    pub fn editor_class_string(&self) -> String {
        let mut cls = String::from("hi-editor-content");
        if self.readonly {
            cls.push_str(" hi-editor-readonly");
        }
        cls
    }

    pub fn placeholder_attr(&self) -> &str {
        &self.placeholder
    }
}

impl Default for RichTextEditorState {
    fn default() -> Self {
        Self::new("")
    }
}

#[derive(Clone, PartialEq, Debug)]
pub struct ContentChangeEvent {
    pub content: String,
    pub html: String,
}

#[derive(Clone, PartialEq, Debug)]
pub struct FormatChangeEvent {
    pub format: TextFormat,
    pub active: bool,
}

pub const RICH_TEXT_EDITOR_STYLES: &str = r#"
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

.hi-editor:focus-within {
  border-color: var(--hi-color-primary);
  box-shadow: 0 0 2px var(--hi-color-primary-glow);
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

.hi-editor-readonly {
  opacity: 0.7;
  cursor: not-allowed;
}
"#;

pub fn render_rich_text_editor(state: &RichTextEditorState) -> VNode {
    let mut container_children: Vec<VNode> = Vec::new();

    if state.show_toolbar {
        let mut toolbar = VElement::new("div").class("hi-editor-toolbar");

        let bold_active = if state.is_bold() {
            "hi-editor-tool-btn hi-editor-tool-btn--active"
        } else {
            "hi-editor-tool-btn"
        };
        let italic_active = if state.is_italic() {
            "hi-editor-tool-btn hi-editor-tool-btn--active"
        } else {
            "hi-editor-tool-btn"
        };
        let underline_active = if state.is_underline() {
            "hi-editor-tool-btn hi-editor-tool-btn--active"
        } else {
            "hi-editor-tool-btn"
        };
        let strike_active = if state.active_formats.contains(&TextFormat::Strikethrough) {
            "hi-editor-tool-btn hi-editor-tool-btn--active"
        } else {
            "hi-editor-tool-btn"
        };

        toolbar = toolbar.child(VNode::Element(
            VElement::new("span")
                .class(bold_active)
                .attr(
                    "data-command",
                    RichTextEditorState::format_command(TextFormat::Bold),
                )
                .child(VNode::Text(VText::new("B"))),
        ));
        toolbar = toolbar.child(VNode::Element(
            VElement::new("span")
                .class(italic_active)
                .attr(
                    "data-command",
                    RichTextEditorState::format_command(TextFormat::Italic),
                )
                .child(VNode::Text(VText::new("I"))),
        ));
        toolbar = toolbar.child(VNode::Element(
            VElement::new("span")
                .class(underline_active)
                .attr(
                    "data-command",
                    RichTextEditorState::format_command(TextFormat::Underline),
                )
                .child(VNode::Text(VText::new("U"))),
        ));
        toolbar = toolbar.child(VNode::Element(
            VElement::new("span")
                .class(strike_active)
                .attr(
                    "data-command",
                    RichTextEditorState::format_command(TextFormat::Strikethrough),
                )
                .child(VNode::Text(VText::new("S"))),
        ));

        toolbar = toolbar.child(VNode::Element(
            VElement::new("div").class("hi-editor-divider"),
        ));

        let align_left = if state.alignment == TextAlignment::Left {
            "hi-editor-tool-btn hi-editor-tool-btn--active"
        } else {
            "hi-editor-tool-btn"
        };
        let align_center = if state.alignment == TextAlignment::Center {
            "hi-editor-tool-btn hi-editor-tool-btn--active"
        } else {
            "hi-editor-tool-btn"
        };
        let align_right = if state.alignment == TextAlignment::Right {
            "hi-editor-tool-btn hi-editor-tool-btn--active"
        } else {
            "hi-editor-tool-btn"
        };

        toolbar = toolbar.child(VNode::Element(
            VElement::new("span")
                .class(align_left)
                .attr(
                    "data-command",
                    RichTextEditorState::alignment_command(TextAlignment::Left),
                )
                .child(VNode::Text(VText::new("Left"))),
        ));
        toolbar = toolbar.child(VNode::Element(
            VElement::new("span")
                .class(align_center)
                .attr(
                    "data-command",
                    RichTextEditorState::alignment_command(TextAlignment::Center),
                )
                .child(VNode::Text(VText::new("Center"))),
        ));
        toolbar = toolbar.child(VNode::Element(
            VElement::new("span")
                .class(align_right)
                .attr(
                    "data-command",
                    RichTextEditorState::alignment_command(TextAlignment::Right),
                )
                .child(VNode::Text(VText::new("Right"))),
        ));

        toolbar = toolbar.child(VNode::Element(
            VElement::new("div").class("hi-editor-divider"),
        ));

        toolbar = toolbar.child(VNode::Element(
            VElement::new("span")
                .class("hi-editor-tool-btn")
                .attr(
                    "data-command",
                    RichTextEditorState::list_command(ListType::Ordered),
                )
                .child(VNode::Text(VText::new("OL"))),
        ));
        toolbar = toolbar.child(VNode::Element(
            VElement::new("span")
                .class("hi-editor-tool-btn")
                .attr(
                    "data-command",
                    RichTextEditorState::list_command(ListType::Unordered),
                )
                .child(VNode::Text(VText::new("UL"))),
        ));

        container_children.push(VNode::Element(toolbar));
    }

    let content_class = format!("{} {}", state.editor_class_string(), state.class_string());
    let mut content = VElement::new("div")
        .class(content_class)
        .attr(
            "data-contenteditable",
            if state.readonly { "false" } else { "true" },
        )
        .attr("data-placeholder", state.placeholder_attr());

    if !state.content.is_empty() {
        content = content.attr("dangerous_inner_html", &state.content);
    }

    if !state.height_style().is_empty() {
        content = content.attr("style", state.height_style());
    }

    container_children.push(VNode::Element(content));

    VNode::Element(
        VElement::new("div")
            .class(state.class_string())
            .children(container_children),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_state() {
        let state = RichTextEditorState::new("Hello");
        assert_eq!(state.content, "Hello");
        assert_eq!(state.mode, EditorMode::Rich);
        assert!(state.show_toolbar);
        assert!(!state.readonly);
        assert!(!state.is_focused);
        assert!(state.active_formats.is_empty());
        assert_eq!(state.alignment, TextAlignment::Left);
    }

    #[test]
    fn test_builder() {
        let state = RichTextEditorState::new("")
            .with_mode(EditorMode::Markdown)
            .with_placeholder("Type here...")
            .with_show_toolbar(false)
            .with_readonly(true)
            .with_min_height("300px")
            .with_class("custom");

        assert_eq!(state.mode, EditorMode::Markdown);
        assert_eq!(state.placeholder, "Type here...");
        assert!(!state.show_toolbar);
        assert!(state.readonly);
        assert_eq!(state.min_height.as_deref(), Some("300px"));
        assert_eq!(state.class, "custom");
    }

    #[test]
    fn test_toggle_format() {
        let mut state = RichTextEditorState::new("");

        state.toggle_format(TextFormat::Bold);
        assert!(state.is_bold());

        state.toggle_format(TextFormat::Italic);
        assert!(state.is_italic());
        assert_eq!(state.active_formats.len(), 2);

        state.toggle_format(TextFormat::Bold);
        assert!(!state.is_bold());
        assert_eq!(state.active_formats.len(), 1);
    }

    #[test]
    fn test_alignment() {
        let mut state = RichTextEditorState::new("");
        assert_eq!(state.alignment, TextAlignment::Left);

        state.set_alignment(TextAlignment::Center);
        assert_eq!(state.alignment, TextAlignment::Center);
    }

    #[test]
    fn test_selection() {
        let mut state = RichTextEditorState::new("");
        assert!(!state.has_selection());

        state.set_selection(Some(0), Some(5));
        assert!(state.has_selection());
        assert_eq!(state.selection_start, Some(0));
        assert_eq!(state.selection_end, Some(5));
    }

    #[test]
    fn test_format_command() {
        assert_eq!(
            RichTextEditorState::format_command(TextFormat::Bold),
            "bold"
        );
        assert_eq!(
            RichTextEditorState::format_command(TextFormat::Italic),
            "italic"
        );
        assert_eq!(
            RichTextEditorState::format_command(TextFormat::Underline),
            "underline"
        );
        assert_eq!(
            RichTextEditorState::format_command(TextFormat::Strikethrough),
            "strikeThrough"
        );
    }

    #[test]
    fn test_alignment_command() {
        assert_eq!(
            RichTextEditorState::alignment_command(TextAlignment::Left),
            "justifyLeft"
        );
        assert_eq!(
            RichTextEditorState::alignment_command(TextAlignment::Center),
            "justifyCenter"
        );
        assert_eq!(
            RichTextEditorState::alignment_command(TextAlignment::Right),
            "justifyRight"
        );
        assert_eq!(
            RichTextEditorState::alignment_command(TextAlignment::Justify),
            "justifyFull"
        );
    }

    #[test]
    fn test_list_command() {
        assert_eq!(
            RichTextEditorState::list_command(ListType::Ordered),
            "insertOrderedList"
        );
        assert_eq!(
            RichTextEditorState::list_command(ListType::Unordered),
            "insertUnorderedList"
        );
    }

    #[test]
    fn test_class_strings() {
        let state = RichTextEditorState::new("");
        assert_eq!(state.class_string(), "hi-editor");

        let state = RichTextEditorState::new("").with_class("my-class");
        assert_eq!(state.class_string(), "hi-editor my-class");

        assert!(state.editor_class_string().contains("hi-editor-content"));
    }

    #[test]
    fn test_height_style() {
        let state = RichTextEditorState::new("");
        assert!(state.height_style().is_empty());

        let state = RichTextEditorState::new("").with_min_height("300px");
        assert_eq!(state.height_style(), "min-height: 300px;");
    }

    #[test]
    fn test_set_content() {
        let mut state = RichTextEditorState::new("");
        state.set_content("<p>New content</p>");
        assert_eq!(state.content, "<p>New content</p>");
    }

    #[test]
    fn test_default() {
        let state = RichTextEditorState::default();
        assert_eq!(state.content, "");
    }
}
