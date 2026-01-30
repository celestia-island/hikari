// website/src/components/dynamic_markdown.rs
// Dynamic Markdown renderer with content fetching

use dioxus::prelude::*;

/// Dynamic Markdown Renderer component
/// Fetches markdown content from a URL and renders it
#[component]
pub fn DynamicMarkdownRenderer(
    #[props(into)] doc_path: String,
    #[props(default)] class: String,
) -> Element {
    let path = doc_path.clone();
    let doc_content = use_future(move || async move {
        load_markdown_content_from_public(path).await
    });

    rsx! {
        div {
            class: format!("hi-markdown {}", class),
            match &*doc_content {
                Some(content) => {
                    {render_simple_markdown(content)}
                }
                None => {
                    div {
                        class: "markdown-error",
                        h3 { "加载文档失败" }
                        p { "文档路径: {doc_path}" }
                    }
                }
            }
        }
    }
}

/// Load markdown content from public/docs
async fn load_markdown_content_from_public(path: String) -> Option<String> {
    use gloo_net::http::Request;

    let url = format!("/docs/{}", path);

    let request = Request::get(&url);

    match request.send().await {
        Ok(response) => {
            if response.ok() {
                Some(response.text().await.unwrap_or_default())
            } else {
                None
            }
        }
        Err(_) => None,
    }
}

/// Simple markdown renderer for dynamic content
/// This is a simplified version - in production use full markdown parser
fn render_simple_markdown(content: &str) -> Element {
    rsx! {
        div {
            class: "hi-markdown-content",
            pre {
                class: "hi-code-block",
                "{content}"
            }
        }
    }
}
