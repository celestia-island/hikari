// hi-extra-components/src/extra/code_highlighter.rs
// CodeHighlighter component with Arknights + FUI styling

use dioxus::prelude::*;
use hikari_palette::classes::ClassesBuilder;

/// CodeHighlighter component type wrapper (for implementing StyledComponent)
pub struct CodeHighlighterComponent;

/// Programming language
#[derive(Clone, Copy, PartialEq, Debug, Default)]
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
    pub fn display_name(&self) -> &'static str {
        match self {
            Language::Rust => "Rust",
            Language::JavaScript => "JavaScript",
            Language::TypeScript => "TypeScript",
            Language::Python => "Python",
            Language::Go => "Go",
            Language::Java => "Java",
            Language::Cpp => "C++",
            Language::Html => "HTML",
            Language::Css => "CSS",
            Language::Json => "JSON",
            Language::Yaml => "YAML",
            Language::Markdown => "Markdown",
            Language::Plain => "Plain Text",
        }
    }

    pub fn class_name(&self) -> &'static str {
        match self {
            Language::Rust => "language-rust",
            Language::JavaScript => "language-javascript",
            Language::TypeScript => "language-typescript",
            Language::Python => "language-python",
            Language::Go => "language-go",
            Language::Java => "language-java",
            Language::Cpp => "language-cpp",
            Language::Html => "language-html",
            Language::Css => "language-css",
            Language::Json => "language-json",
            Language::Yaml => "language-yaml",
            Language::Markdown => "language-markdown",
            Language::Plain => "language-plain",
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct CodeHighlighterProps {
    /// Code content to display
    #[props(into, default)]
    pub code: String,

    /// Programming language
    #[props(default)]
    pub language: Language,

    /// Whether to show line numbers
    #[props(default = true)]
    pub show_line_numbers: bool,

    /// Whether to show language label
    #[props(default = true)]
    pub show_language: bool,

    /// Whether to enable copy button
    #[props(default = true)]
    pub show_copy: bool,

    /// Whether to enable word wrap
    #[props(default = true)]
    pub wrap: bool,

    /// Custom CSS class
    #[props(into, default)]
    pub class: String,

    /// Custom inline style
    #[props(into, default)]
    pub style: String,
}

impl Default for CodeHighlighterProps {
    fn default() -> Self {
        Self {
            code: String::new(),
            language: Language::default(),
            show_line_numbers: true,
            show_language: true,
            show_copy: true,
            wrap: true,
            class: String::new(),
            style: String::new(),
        }
    }
}

/// CodeHighlighter component
///
/// Displays code with syntax highlighting (currently basic highlighting).
/// Supports line numbers, language label, and copy functionality.
///
/// # Example
///
/// ```rust,ignore
/// use hikari_extra_components::CodeHighlighter;
///
/// rsx! {
///     CodeHighlighter {
///         code: r#"fn main() {
///     println!("Hello, Hikari!");
/// }"#,
///         language: Language::Rust,
///     }
/// }
/// ```
#[component]
pub fn CodeHighlighter(props: CodeHighlighterProps) -> Element {
    let mut copied = use_signal(|| false);

    let code_ref = use_signal(|| props.code.clone());
    let code = code_ref();
    let lines: Vec<&str> = code.lines().collect();
    let line_numbers: Vec<String> = (1..=lines.len()).map(|n| n.to_string()).collect();

    let copy_text = move |_| {
        let code_to_copy = code_ref();

        #[cfg(target_arch = "wasm32")]
        {
            if let Some(window) = web_sys::window() {
                if let Some(clipboard) = window.navigator().clipboard() {
                    let _ = clipboard.write_text(&code_to_copy);
                }
            }
        }

        #[cfg(not(target_arch = "wasm32"))]
        {
            let _ = code_to_copy;
        }

        copied.set(true);

        #[cfg(target_arch = "wasm32")]
        {
            let copied_clone = copied.clone();
            let _ = web_sys::window().and_then(|w| {
                w.set_timeout_with_callback_and_timeout_and_arguments_0(
                    wasm_bindgen::closure::Closure::once_into_js(move || {
                        copied_clone.set(false);
                    })
                    .as_ref()
                    .unchecked_ref(),
                    2000,
                )
            });
        }

        #[cfg(not(target_arch = "wasm32"))]
        {
            // Non-WASM: just reset after 2 seconds (simulated)
            let _ = copied;
        }
    };

    let base_classes = ClassesBuilder::new().build();

    let code_block_classes = ClassesBuilder::new()
        .add_raw("hi-code-highlighter")
        .add_raw(props.language.class_name())
        .add_raw(if props.wrap { "hi-code-wrap" } else { "" })
        .build();

    rsx! {
        div {
            class: format!("{} {}", base_classes, props.class),
            style: "{props.style}",

            div {
                class: "hi-code-highlighter-container",

                // Language label
                if props.show_language {
                    div {
                        class: "hi-code-highlighter-language",
                        span { class: "hi-code-highlighter-language-label", "{props.language.display_name()}" }
                    }
                }

                // Copy button
                if props.show_copy {
                    button {
                        class: "hi-code-highlighter-copy",
                        onclick: copy_text,

                        if copied() {
                            span { class: "hi-code-highlighter-copy-icon", "✓" }
                        } else {
                            span { class: "hi-code-highlighter-copy-icon", "📋" }
                        }
                    }
                }
            }

            // Code content
            div {
                class: format!("{} {}", code_block_classes, if copied() { "hi-code-copied" } else { "" }),

                // Line numbers
                if props.show_line_numbers && !lines.is_empty() {
                    div {
                        class: "hi-code-highlighter-line-numbers",
                        for line_num in line_numbers.iter() {
                            div { class: "hi-code-highlighter-line-number", "{line_num}" }
                        }
                    }
                }

                // Code lines
                div {
                    class: "hi-code-highlighter-content",
                    for line in lines.iter() {
                        div { class: "hi-code-highlighter-line",
                            span { "{line}" }
                        }
                    }
                }
            }
        }
    }
}

impl CodeHighlighterComponent {
    pub fn styles() -> &'static str {
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

.hi-code-highlighter-wrapper {
  display: flex;
  flex: 1;
  overflow-x: auto;
}

.hi-code-highlighter-lines {
  display: flex;
  flex-direction: column;
  padding: 1rem 0;
  background-color: var(--hi-color-code-line-numbers, #252525);
  border-right: 1px solid var(--hi-color-border, #e0e0e0);
  user-select: none;
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

// Language-specific colors (basic highlighting - will be enhanced with proper syntax highlighting)
.hi-code-highlighter.language-rust {
  .hi-code-highlighter-content {
    .hi-code-highlighter-line:nth-child(1n) {
      opacity: 1;
    }
  }
}

// FUI effect - subtle glow
.hi-code-highlighter-language-label {
  box-shadow: 0 0 10px rgba(0, 160, 233, 0.2);
}

.hi-code-highlighter-copy:hover {
  box-shadow: 0 0 15px rgba(0, 160, 233, 0.1);
}

// Theme-specific colors
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

// Copied state animation
.hi-code-highlighter.hi-code-copied {
  .hi-code-highlighter-content {
    opacity: 0.6;
  }
}

.hi-code-highlighter-copy-icon {
  transition: all 0.2s ease;
}

@keyframes copy-success {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

.hi-code-highlighter-copied .hi-code-highlighter-copy-icon {
  animation: copy-success 0.3s ease;
  color: #4caf50;
}
"#
    }

    pub fn name() -> &'static str {
        "code_highlighter"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_code_highlighter_props_default() {
        let props = CodeHighlighterProps::default();
        assert_eq!(props.language, Language::Rust);
        assert_eq!(props.show_line_numbers, true);
        assert_eq!(props.show_language, true);
        assert_eq!(props.show_copy, true);
        assert_eq!(props.wrap, true);
    }

    #[test]
    fn test_language_display_name() {
        assert_eq!(Language::Rust.display_name(), "Rust");
        assert_eq!(Language::Python.display_name(), "Python");
        assert_eq!(Language::Plain.display_name(), "Plain Text");
    }

    #[test]
    fn test_language_class_name() {
        assert_eq!(Language::Rust.class_name(), "language-rust");
        assert_eq!(Language::Python.class_name(), "language-python");
        assert_eq!(Language::Plain.class_name(), "language-plain");
    }

    #[test]
    fn test_code_highlighter_component_name() {
        assert_eq!(CodeHighlighterComponent::name(), "code_highlighter");
    }
}
