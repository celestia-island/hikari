// packages/components/src/production/code_highlight.rs
// Code highlighting component with Arknights + FUI styling
//
// NOTE: This component provides a styled code display with line numbers
// and copy functionality. The `language-{lang}` class is added to the code
// element for integration with external syntax highlighters like Prism.js
// or highlight.js. For built-in Rust-based highlighting, consider
// integrating with syntect.

use dioxus::prelude::*;
use gloo::timers::callback::Timeout;
use palette::classes::{ClassesBuilder, CodeHighlightClass};
use wasm_bindgen::prelude::*;

use crate::styled::StyledComponent;

// Helper function to copy text to clipboard
#[wasm_bindgen(inline_js = r#"
export function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
    } else {
        // Fallback to execCommand
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return Promise.resolve(success);
    }
}
"#)]
extern "C" {
    fn copyToClipboard(text: &str) -> js_sys::Promise;
}

// Rust wrapper for the JS function
fn copy_to_clipboard(text: &str) -> bool {
    let _promise = copyToClipboard(text);
    // We can't easily await in this context, so assume success
    // The actual copy happens asynchronously
    true
}

/// CodeHighlight component type wrapper (for StyledComponent)
pub struct CodeHighlightComponent;

/// Code highlighting component with Arknights + FUI styling
#[derive(Clone, PartialEq, Props)]
pub struct CodeHighlightProps {
    #[props(default)]
    pub language: String,

    pub code: String,

    #[props(default = true)]
    pub line_numbers: bool,

    #[props(default = true)]
    pub copyable: bool,

    #[props(default)]
    pub max_height: Option<String>,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,
}

#[component]
pub fn CodeHighlight(props: CodeHighlightProps) -> Element {
    let mut copied = use_signal(|| false);
    let lines: Vec<&str> = props.code.lines().collect();
    let line_count = lines.len();

    let container_classes = ClassesBuilder::new()
        .add(CodeHighlightClass::Container)
        .add_raw(&props.class)
        .build();

    let header_classes = ClassesBuilder::new()
        .add(CodeHighlightClass::Header)
        .build();

    let language_classes = ClassesBuilder::new()
        .add(CodeHighlightClass::Language)
        .build();

    let copy_classes = ClassesBuilder::new()
        .add(CodeHighlightClass::CopyButton)
        .build();

    let code_classes = ClassesBuilder::new().add(CodeHighlightClass::Code).build();

    let line_classes = ClassesBuilder::new()
        .add(CodeHighlightClass::LineNumbers)
        .build();

    let content_classes = ClassesBuilder::new()
        .add(CodeHighlightClass::Content)
        .build();

    let max_height_style = if let Some(ref height) = props.max_height {
        format!("max-height: {}; overflow-y: auto; {}", height, props.style)
    } else {
        props.style.clone()
    };

    let code_for_copy = props.code.clone();

    // Computed button class with copied state
    let button_class = {
        let base = copy_classes.clone();
        let copied_state = *copied.read();
        if copied_state {
            format!("{} copied hi-code-highlight-copy-copied", base)
        } else {
            base
        }
    };

    let button_text = if *copied.read() {
        "已复制"
    } else {
        "复制"
    };

    rsx! {
        div {
            class: "{container_classes}",

            div {
                class: "{header_classes}",

                div {
                    class: "{language_classes}",
                    "{props.language}"
                }

                if props.copyable {
                    button {
                        class: "{button_class}",
                        onclick: move |_| {
                            if copy_to_clipboard(&code_for_copy) {
                                copied.set(true);
                                let mut copied_signal = copied.clone();
                                Timeout::new(2000, move || {
                                    copied_signal.set(false);
                                }).forget();
                            }
                        },
                        "{button_text}"
                    }
                }
            }

            div {
                class: "{content_classes}",
                style: "{max_height_style}",

                if props.line_numbers {
                    div {
                        class: "{line_classes}",
                        for i in 1..=line_count {
                            div {
                                class: "hi-code-highlight-line-number",
                                "{i}"
                            }
                        }
                    }
                }

                pre {
                    class: "{code_classes}",
                    code {
                        class: "language-{props.language}",
                        "{props.code}"
                    }
                }
            }
        }
    }
}

impl StyledComponent for CodeHighlightComponent {
    fn styles() -> &'static str {
        r#"
.hi-code-highlight {
    background-color: var(--hi-color-bg-container);
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.hi-code-highlight-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: var(--hi-color-bg-elevated);
    border-bottom: 1px solid var(--hi-color-border);
}

.hi-code-highlight-language {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--hi-color-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.hi-code-highlight-copy {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    background-color: transparent;
    border: 1px solid var(--hi-color-border);
    border-radius: 4px;
    color: var(--hi-color-text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
}

.hi-code-highlight-copy:hover {
    background-color: var(--hi-color-primary);
    color: white;
    border-color: var(--hi-color-primary);
    box-shadow: 0 0 8px var(--hi-color-primary-glow);
}

.hi-code-highlight-copy.hi-code-highlight-copy-copied,
.hi-code-highlight-copy.copied {
    background-color: var(--hi-color-primary);
    color: white;
    box-shadow: 0 0 12px var(--hi-color-primary-glow);
    opacity: 1;
}

.hi-code-highlight-content {
    display: flex;
    background-color: var(--hi-color-bg-container);
}

.hi-code-highlight-line-numbers {
    padding: 1rem 0.5rem;
    background-color: var(--hi-color-bg-elevated);
    border-right: 1px solid var(--hi-color-border);
    text-align: right;
    user-select: none;
}

.hi-code-highlight-line-number {
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--hi-color-text-tertiary);
}

.hi-code-highlight-code {
    flex: 1;
    padding: 1rem;
    overflow-x: auto;
    background-color: transparent;
    border: none;
}

.hi-code-highlight-code code {
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--hi-color-text-primary);
}

/* Basic syntax highlighting colors */
.token-comment,
.token-prolog,
.token-doctype,
.token-cdata {
    color: var(--hi-color-text-tertiary);
    font-style: italic;
}

.token-punctuation {
    color: var(--hi-color-text-secondary);
}

.token-property,
.token-tag,
.token.boolean,
.token.number,
.token.constant,
.token.symbol {
    color: var(--hi-color-primary);
}

.token-selector,
.token.attr-name,
.token.string,
.token.char,
.token.builtin,
.token.inserted {
    color: #a5d6ff;
}

.token-operator,
.token.entity,
.token.url,
.language-css .token.string,
.style .token.string {
    color: #f1fa8c;
}

.token-atrule,
.token.attr-value,
.token.keyword {
    color: #d4a5ff;
}

.token-function,
.token.class-name {
    color: #6ee7b7;
}

.token-regex,
.token.important,
.token.variable {
    color: #fca5a5;
}

.token.deleted {
    color: #ff6b6b;
}
"#
    }

    fn name() -> &'static str {
        "code-highlight"
    }
}
