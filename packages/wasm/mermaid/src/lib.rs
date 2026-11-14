//! hikari-wasm-mermaid — the mermaid parser component.

pub mod mermaid;

#[cfg(target_family = "wasm")]
mod bindings {
    use super::Mermaid;
    wit_bindgen::generate!({ path: "wit", world: "mermaid" });
    export!(Mermaid);
}

#[cfg(target_family = "wasm")]
pub struct Mermaid;

#[cfg(target_family = "wasm")]
impl bindings::Guest for Mermaid {
    fn parse(source: String) -> bindings::ParseResult {
        match mermaid::parse(&source) {
            Ok(diagram) => {
                let json = serde_json::to_string(&diagram)
                    .unwrap_or_else(|e| format!("{{\"error\":\"serialize: {e}\"}}"));
                bindings::ParseResult { json: Some(json) }
            }
            Err(_) => bindings::ParseResult { json: None },
        }
    }
}

#[cfg(not(target_family = "wasm"))]
pub mod native {
    pub fn parse(source: &str) -> Option<String> {
        crate::mermaid::parse(source)
            .ok()
            .and_then(|d| serde_json::to_string(&d).ok())
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn parses_a_graph() {
        let json = super::native::parse("graph TD\n  A --> B").unwrap();
        assert!(json.contains("A"));
        assert!(json.contains("B"));
    }

    #[test]
    fn returns_none_on_garbage() {
        assert!(super::native::parse("not a diagram at all").is_none());
    }
}
