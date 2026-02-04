// website/src/components/code_block.rs
// Code block component with basic styling
//
// This component provides a code block display with language labels and styling.
// It supports raw text display for code snippets and documentation examples.

use dioxus::prelude::*;

/// Code block component with basic styling
///
/// Displays code with language labels in a styled container.
/// This is a foundational implementation that provides:
/// - Language labeling for code snippets
/// - Styled container with consistent appearance
/// - Raw text display for all programming languages
///
/// # Platform Support
///
/// **WASM (Web)**: Fully supported, renders as pre/code HTML elements
/// **SSR (Server)**: Fully supported, renders on the server
///
/// # Future Enhancements
///
/// Full syntax highlighting is planned for a future release (Phase 2).
/// Potential implementations may include:
/// - Client-side JavaScript libraries (Prism.js, Highlight.js)
/// - Server-side Rust libraries (syntect)
/// - WASM-compiled highlighting engines
///
/// # Examples
///
/// ## Basic usage
///
/// ```rust,no_run
/// # use dioxus::prelude::*;
/// CodeBlock {
///     language: "rust".to_string(),
///     code: r#"fn main() {
///     println!("Hello, Hikari!");
/// }"#.to_string(),
/// }
/// ```
///
/// ## With custom class
///
/// ```rust,no_run
/// # use dioxus::prelude::*;
/// CodeBlock {
///     language: "javascript".to_string(),
///     code: "console.log('Hello');".to_string(),
///     class: "my-custom-class".to_string(),
/// }
/// ```
#[component]
pub fn CodeBlock(
    #[props(into)] language: String,
    #[props(into)] code: String,
    #[props(default)] class: String,
) -> Element {
    rsx! {
        div {
            class: format!("hi-code-block {}", class),

            // Language label
            div {
                class: "hi-code-block-header",
                span {
                    class: "hi-code-block-language",
                    "{language}"
                }
            }

            // Code content
            pre {
                class: "hi-code-block-content",
                code {
                    class: "hi-code-block-code",
                    "{code}"
                }
            }
        }
    }
}
