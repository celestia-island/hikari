// website/src/components/code_block.rs
// Code block component with syntax highlighting
// Simplified version with default color only (no actual highlighting for now)

use dioxus::prelude::*;

/// Code block component with default styling
/// TODO: Add actual syntax highlighting in the future
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
