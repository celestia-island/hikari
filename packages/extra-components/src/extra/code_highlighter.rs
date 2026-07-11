//! CodeHighlighter - Framework Agnostic State Model

use tairitsu_vdom::{VElement, VNode, VText};

/// Render an MDI icon as an inline SVG string via hikari-icons.
/// Falls back to an empty string if the icon is not found.
fn render_icon_svg(name: &str, size: u32) -> String {
    match hikari_icons::get(name) {
        Some(d) => {
            let path = d
                .path
                .or_else(|| d.paths.first().and_then(|p| p.d))
                .unwrap_or("");
            if path.is_empty() {
                String::new()
            } else {
                format!(
                    r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="{size}" height="{size}" fill="currentColor"><path d="{path}"/></svg>"#
                )
            }
        }
        None => String::new(),
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum Language {
    #[default]
    Rust,
    JavaScript,
    TypeScript,
    Python,
    Go,
    Java,
    Cpp,
    Html,
    Css,
    Json,
    Yaml,
    Markdown,
    Plain,
}

impl Language {
    #[must_use]
    pub const fn display_name(&self) -> &'static str {
        match self {
            Self::Rust => "Rust",
            Self::JavaScript => "JavaScript",
            Self::TypeScript => "TypeScript",
            Self::Python => "Python",
            Self::Go => "Go",
            Self::Java => "Java",
            Self::Cpp => "C++",
            Self::Html => "HTML",
            Self::Css => "CSS",
            Self::Json => "JSON",
            Self::Yaml => "YAML",
            Self::Markdown => "Markdown",
            Self::Plain => "Plain Text",
        }
    }

    #[must_use]
    pub const fn class_name(&self) -> &'static str {
        match self {
            Self::Rust => "language-rust",
            Self::JavaScript => "language-javascript",
            Self::TypeScript => "language-typescript",
            Self::Python => "language-python",
            Self::Go => "language-go",
            Self::Java => "language-java",
            Self::Cpp => "language-cpp",
            Self::Html => "language-html",
            Self::Css => "language-css",
            Self::Json => "language-json",
            Self::Yaml => "language-yaml",
            Self::Markdown => "language-markdown",
            Self::Plain => "language-plain",
        }
    }
}

/// State model for a code highlighter
///
/// ## Example
///
/// ```rust
/// use hikari_extra_components::extra::{CodeHighlighterState, Language};
///
/// let state = CodeHighlighterState::new(
///     r#"fn main() { println!("Hello"); }"#.to_string(),
///     Language::Rust,
/// );
///
/// assert_eq!(state.line_count(), 1);
/// assert!(state.show_line_numbers);
/// ```
#[derive(Clone, PartialEq, Debug)]
pub struct CodeHighlighterState {
    pub code: String,
    pub language: Language,
    pub show_line_numbers: bool,
    pub show_language: bool,
    pub show_copy: bool,
    pub wrap: bool,
    pub copied: bool,
    pub copy_anim_progress: f64,
    pub class: String,
    pub style: String,
}

impl CodeHighlighterState {
    #[must_use]
    pub const fn new(code: String, language: Language) -> Self {
        Self {
            code,
            language,
            show_line_numbers: true,
            show_language: true,
            show_copy: true,
            wrap: true,
            copied: false,
            copy_anim_progress: 1.0,
            class: String::new(),
            style: String::new(),
        }
    }

    #[must_use]
    pub const fn with_show_line_numbers(mut self, show: bool) -> Self {
        self.show_line_numbers = show;
        self
    }

    #[must_use]
    pub const fn with_show_language(mut self, show: bool) -> Self {
        self.show_language = show;
        self
    }

    #[must_use]
    pub const fn with_show_copy(mut self, show: bool) -> Self {
        self.show_copy = show;
        self
    }

    #[must_use]
    pub const fn with_wrap(mut self, wrap: bool) -> Self {
        self.wrap = wrap;
        self
    }

    pub fn with_class(mut self, class: impl Into<String>) -> Self {
        self.class = class.into();
        self
    }

    pub fn with_style(mut self, style: impl Into<String>) -> Self {
        self.style = style.into();
        self
    }

    #[must_use]
    pub fn line_count(&self) -> usize {
        self.code.lines().count().max(1)
    }

    #[must_use]
    pub fn line_numbers(&self) -> Vec<String> {
        (1..=self.line_count()).map(|n| n.to_string()).collect()
    }

    #[must_use]
    pub fn lines(&self) -> Vec<&str> {
        let lines: Vec<&str> = self.code.lines().collect();
        if lines.is_empty() && !self.code.is_empty() {
            vec![self.code.as_str()]
        } else {
            lines
        }
    }

    pub const fn mark_copied(&mut self) {
        self.copied = true;
        self.copy_anim_progress = 0.0;
    }

    pub const fn reset_copied(&mut self) {
        self.copied = false;
        self.copy_anim_progress = 1.0;
    }

    pub fn tick_copy_animation(&mut self, delta_ms: f64) {
        if self.copy_anim_progress < 1.0 {
            self.copy_anim_progress = (self.copy_anim_progress + delta_ms / 300.0).min(1.0);
        }
    }

    #[must_use]
    pub fn copy_icon_scale(&self) -> f64 {
        if self.copy_anim_progress >= 1.0 {
            1.0
        } else {
            0.2f64.mul_add((std::f64::consts::PI * self.copy_anim_progress).sin(), 1.0)
        }
    }

    #[must_use]
    pub fn container_class(&self) -> String {
        let mut classes = String::from("hi-code-highlighter");
        classes.push(' ');
        classes.push_str(self.language.class_name());
        if self.wrap {
            classes.push_str(" hi-code-wrap");
        }
        if self.copied {
            classes.push_str(" hi-code-copied");
        }
        if !self.class.is_empty() {
            classes.push(' ');
            classes.push_str(&self.class);
        }
        classes
    }

    #[must_use]
    pub const fn copy_button_text(&self) -> &'static str {
        if self.copied { "✓" } else { "Copy" }
    }

    /// Returns the MDI icon name for the copy button based on state.
    /// "content-copy" when idle, "check" when copied.
    #[must_use]
    pub const fn copy_button_icon(&self) -> &'static str {
        if self.copied { "check" } else { "content-copy" }
    }
}

impl Default for CodeHighlighterState {
    fn default() -> Self {
        Self::new(String::new(), Language::default())
    }
}

/// Event emitted when copy is triggered
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct CodeHighlighterCopyEvent {
    pub code: String,
    pub language: Language,
}

#[must_use]
pub fn render_code_highlighter(state: &CodeHighlighterState) -> VNode {
    let lines = state.lines();
    let line_numbers = state.line_numbers();

    let mut container = VElement::new("div")
        .class(state.container_class())
        .attr_opt(
            "style",
            if state.style.is_empty() {
                None
            } else {
                Some(state.style.clone())
            },
        );

    // Header
    let mut header = VElement::new("div").class("hi-code-highlighter-container");

    if state.show_language {
        let lang_div = VElement::new("div")
            .class("hi-code-highlighter-language")
            .child(VNode::Element(
                VElement::new("span")
                    .class("hi-code-highlighter-language-label")
                    .child(VNode::Text(VText::new(state.language.display_name()))),
            ));
        header = header.child(VNode::Element(lang_div));
    }

    if state.show_copy {
        // NOTE: clipboard copy is handled by the caller via state.copied.
        // platform::copy_to_clipboard is a stub (returns false) until WIT is implemented.
        // The caller should call copy_to_clipboard and toggle state.copied on success.
        let copy_btn = VElement::new("button")
            .class("hi-code-highlighter-copy")
            .child(VNode::Element({
                let scale = state.copy_icon_scale();
                let icon_style = if (scale - 1.0).abs() > 0.001 {
                    Some(format!("transform: scale({scale:.2});"))
                } else {
                    None
                };
                // Render hikari-icon SVG (content-copy when idle, check when copied).
                let icon_name = state.copy_button_icon();
                let icon_svg = render_icon_svg(icon_name, 14);
                VElement::new("span")
                    .class("hi-code-highlighter-copy-icon")
                    .attr_opt("style", icon_style)
                    .dangerous_inner_html(&icon_svg)
            }));
        header = header.child(VNode::Element(copy_btn));
    }

    container = container.child(VNode::Element(header));

    // Code body: line numbers + content side by side
    let mut code_body = VElement::new("div").class(state.container_class());

    if state.show_line_numbers && !lines.is_empty() {
        let mut nums_div = VElement::new("div").class("hi-code-highlighter-line-numbers");

        let num_nodes: Vec<VNode> = line_numbers
            .iter()
            .map(|n| {
                VNode::Element(
                    VElement::new("div")
                        .class("hi-code-highlighter-line-number")
                        .child(VNode::Text(VText::new(n))),
                )
            })
            .collect();

        nums_div = nums_div.children(num_nodes);
        code_body = code_body.child(VNode::Element(nums_div));
    }

    // Content div with code lines
    let mut content_div = VElement::new("div").class("hi-code-highlighter-content");

    let line_nodes: Vec<VNode> = lines
        .iter()
        .map(|line| {
            VNode::Element(
                VElement::new("div")
                    .class("hi-code-highlighter-line")
                    .child(VNode::Text(VText::new(line))),
            )
        })
        .collect();

    content_div = content_div.children(line_nodes);
    code_body = code_body.child(VNode::Element(content_div));

    container = container.child(VNode::Element(code_body));

    VNode::Element(container)
}

pub struct CodeHighlighterComponent;

impl CodeHighlighterComponent {
    #[must_use]
    pub const fn styles() -> &'static str {
        r#"
.hi-code-highlighter {
  display: flex;
  flex-direction: column;
  width: 100%;
  background-color: var(--hi-color-code-background, #1e1e1e);
  border: 1px solid var(--hi-color-border, #e0e0e0);
  border-radius: 8px;
  overflow: hidden;
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
}

.hi-code-highlighter-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: var(--hi-color-code-header, #2a2a2a);
  border-bottom: 1px solid var(--hi-color-border, #e0e0e0);
}

.hi-code-highlighter-language {
  display: flex;
  align-items: center;
}

.hi-code-highlighter-language-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  background-color: var(--hi-color-primary, #00A0E9);
  color: white;
  transition: all 0.3s ease;
}

.hi-code-highlighter-language-label:hover {
  opacity: 0.9;
}

.hi-code-highlighter-copy {
  background: none;
  border: 1px solid var(--hi-color-border, #e0e0e0);
  border-radius: 4px;
  padding: 0.25rem 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.hi-code-highlighter-copy:hover {
  background-color: rgba(0, 160, 233, 0.1);
  border-color: var(--hi-color-primary, #00A0E9);
}

.hi-code-highlighter-copy:active {
  transform: scale(0.95);
}

.hi-code-highlighter-content {
  flex: 1;
  padding: 1rem;
  overflow-x: auto;
  color: var(--hi-color-code-text, #d4d4d4);
}

.hi-code-highlighter-line {
  display: flex;
  align-items: flex-start;
  min-height: 1.6em;
}

.hi-code-highlighter-line span {
  white-space: pre;
  word-break: break-word;
}

.hi-code-highlighter-wrap {
  .hi-code-highlighter-content {
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.hi-code-highlighter-line-numbers {
  display: flex;
  flex-direction: column;
  padding: 1rem 0.75rem;
  background-color: var(--hi-color-code-line-numbers, #252525);
  border-right: 1px solid var(--hi-color-border, #e0e0e0);
  user-select: none;
}

.hi-code-highlighter-line-number {
  font-size: 0.75rem;
  color: var(--hi-color-text-secondary, #666);
  text-align: right;
  min-height: 1.6em;
}

.hi-code-highlighter.language-rust {
  .hi-code-highlighter-content {
    .hi-code-highlighter-line:nth-child(1n) {
      opacity: 1;
    }
  }
}

.hi-code-highlighter-language-label {
  box-shadow: 0 0 10px rgba(0, 160, 233, 0.2);
}

.hi-code-highlighter-copy:hover {
  box-shadow: 0 0 15px rgba(0, 160, 233, 0.1);
}

[data-theme="hikari"] {
  .hi-code-highlighter {
    background-color: #1e1e1e;
    border-color: #e0e0e0;
  }

  .hi-code-highlighter-container {
    background-color: #2a2a2a;
    border-bottom-color: #e0e0e0;
  }

  .hi-code-highlighter-language-label {
    background-color: #00A0E9;
  }

  .hi-code-highlighter-line-numbers {
    background-color: #252525;
    border-right-color: #e0e0e0;
  }

  .hi-code-highlighter-content {
    color: #d4d4d4;
  }

  .hi-code-highlighter-line-number {
    color: #666;
  }
}

[data-theme="tairitsu"] {
  .hi-code-highlighter {
    background-color: #0d0d0d;
    border-color: rgba(255, 255, 255, 0.12);
  }

  .hi-code-highlighter-container {
    background-color: #1a1a1a;
    border-bottom-color: rgba(255, 255, 255, 0.12);
  }

  .hi-code-highlighter-language-label {
    background-color: #1a237e;
  }

  .hi-code-highlighter-line-numbers {
    background-color: #141414;
    border-right-color: rgba(255, 255, 255, 0.12);
  }

  .hi-code-highlighter-content {
    color: rgba(255, 255, 255, 0.9);
  }

  .hi-code-highlighter-line-number {
    color: rgba(255, 255, 255, 0.6);
  }
}

.hi-code-highlighter.hi-code-copied {
  .hi-code-highlighter-content {
    opacity: 0.6;
  }
}

.hi-code-highlighter-copy-icon {
  transition: all 0.2s ease;
}

.hi-code-highlighter-copied .hi-code-highlighter-copy-icon {
  color: #4caf50;
}
"#
    }

    #[must_use]
    pub const fn name() -> &'static str {
        "code_highlighter"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_language_display_name() {
        assert_eq!(Language::Rust.display_name(), "Rust");
        assert_eq!(Language::Python.display_name(), "Python");
        assert_eq!(Language::Plain.display_name(), "Plain Text");
        assert_eq!(Language::Cpp.display_name(), "C++");
    }

    #[test]
    fn test_language_class_name() {
        assert_eq!(Language::Rust.class_name(), "language-rust");
        assert_eq!(Language::Python.class_name(), "language-python");
        assert_eq!(Language::Plain.class_name(), "language-plain");
        assert_eq!(Language::TypeScript.class_name(), "language-typescript");
    }

    #[test]
    fn test_state_new() {
        let state = CodeHighlighterState::new("fn main() {}".to_string(), Language::Rust);
        assert_eq!(state.code, "fn main() {}");
        assert_eq!(state.language, Language::Rust);
        assert!(state.show_line_numbers);
        assert!(state.show_language);
        assert!(state.show_copy);
        assert!(state.wrap);
        assert!(!state.copied);
    }

    #[test]
    fn test_line_count() {
        let state = CodeHighlighterState::new("line1\nline2\nline3".to_string(), Language::Rust);
        assert_eq!(state.line_count(), 3);

        let empty = CodeHighlighterState::new(String::new(), Language::Rust);
        assert_eq!(empty.line_count(), 1);
    }

    #[test]
    fn test_line_numbers() {
        let state = CodeHighlighterState::new("a\nb\nc".to_string(), Language::Rust);
        let nums = state.line_numbers();
        assert_eq!(nums, vec!["1", "2", "3"]);
    }

    #[test]
    fn test_lines() {
        let state = CodeHighlighterState::new("a\nb\nc".to_string(), Language::Rust);
        assert_eq!(state.lines(), vec!["a", "b", "c"]);
    }

    #[test]
    fn test_copied_state() {
        let mut state = CodeHighlighterState::default();
        assert!(!state.copied);
        assert_eq!(state.copy_button_icon(), "content-copy");

        state.mark_copied();
        assert!(state.copied);
        assert_eq!(state.copy_button_icon(), "check");

        state.reset_copied();
        assert!(!state.copied);
    }

    #[test]
    fn test_container_class() {
        let state = CodeHighlighterState::new("code".to_string(), Language::Rust);
        let cls = state.container_class();
        assert!(cls.contains("hi-code-highlighter"));
        assert!(cls.contains("language-rust"));
        assert!(cls.contains("hi-code-wrap"));
    }

    #[test]
    fn test_container_class_with_custom_class() {
        let state =
            CodeHighlighterState::new("code".to_string(), Language::Python).with_class("my-class");
        let cls = state.container_class();
        assert!(cls.contains("language-python"));
        assert!(cls.contains("my-class"));
    }

    #[test]
    fn test_builder_pattern() {
        let state = CodeHighlighterState::new("fn main() {}".to_string(), Language::Rust)
            .with_show_line_numbers(false)
            .with_show_copy(false)
            .with_wrap(false)
            .with_class("custom");

        assert!(!state.show_line_numbers);
        assert!(!state.show_copy);
        assert!(!state.wrap);
        assert_eq!(state.class, "custom");
    }

    #[test]
    fn test_component_name() {
        assert_eq!(CodeHighlighterComponent::name(), "code_highlighter");
    }

    #[test]
    fn test_copy_event() {
        let event = CodeHighlighterCopyEvent {
            code: "fn main() {}".to_string(),
            language: Language::Rust,
        };
        assert_eq!(event.code, "fn main() {}");
        assert_eq!(event.language, Language::Rust);
    }
}
