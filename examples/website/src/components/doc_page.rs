use dioxus::prelude::*;

use crate::components::{Layout, render_markdown};
use _components::layout::Container;

#[derive(Clone, PartialEq, Props)]
pub struct DynamicDocPageProps {
    pub current_route: crate::app::Route,
    pub doc_path: String,
}

#[component]
pub fn DynamicDocPage(props: DynamicDocPageProps) -> Element {
    let doc_content = use_resource(move || {
        let path = props.doc_path.clone();
        async move {
            load_markdown_content(&path).await
        }
    });

    rsx! {
        Layout {
            current_route: props.current_route,

            Container {
                center: true,

                match &*doc_content.read() {
                    Some(Ok(content)) => {
                        rsx! {
                            div {
                                class: "hi-markdown",
                                {render_markdown(content)}
                            }
                        }
                    }
                    Some(Err(e)) => {
                        rsx! {
                            div {
                                class: "markdown-error",
                                style: "padding: 2rem; text-align: center;",
                                h3 { "加载失败" }
                                p { "错误: {e}" }
                            }
                        }
                    }
                    None => {
                        rsx! {
                            div {
                                class: "markdown-loading",
                                style: "padding: 2rem; text-align: center; color: var(--hi-color-text-secondary);",
                                "加载中..."
                            }
                        }
                    }
                }
            }
        }
    }
}

async fn load_markdown_content(path: &str) -> Result<String, String> {
    use web_sys::Request;
    use wasm_bindgen_futures::JsFuture;
    use web_sys::RequestMode;
    use web_sys::Response;

    let url = format!("/docs/{}.md", path);
    
    let mut opts = web_sys::RequestInit::new();
    opts.method("GET");
    opts.mode(RequestMode::Cors);

    let request = Request::new_with_str_and_init(&url, &opts)
        .map_err(|e| format!("Failed to create request: {:?}", e))?;

    let window = web_sys::window().ok_or("No window")?;
    
    let resp_value = JsFuture::from(window.fetch_with_request(&request))
        .await
        .map_err(|e| format!("Fetch failed: {:?}", e))?;

    let resp: Response = resp_value.into();

    if resp.status() == 404 {
        return Err(format!("文档未找到: {}", path));
    }

    if !resp.ok() {
        return Err(format!("HTTP error: {}", resp.status()));
    }

    let text = JsFuture::from(resp.text()
        .map_err(|e| format!("Failed to get text: {:?}", e))?)
        .await
        .map_err(|e| format!("Failed to read response: {:?}", e))?;

    Ok(text.as_string().unwrap_or_default())
}
