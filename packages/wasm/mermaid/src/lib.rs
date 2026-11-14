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
        match mermaid::parse_any(&source) {
            Some(json) => bindings::ParseResult { json: Some(json) },
            None => bindings::ParseResult { json: None },
        }
    }
}

#[cfg(not(target_family = "wasm"))]
pub mod native {
    pub fn parse(source: &str) -> Option<String> {
        crate::mermaid::parse_any(source)
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

    #[test]
    fn parses_pie() {
        let src = "pie\n  title Test Pie\n  \"A\" : 30\n  \"B\" : 70";
        let json = super::native::parse(src).unwrap();
        assert!(json.contains("\"kind\":\"pie\""));
        assert!(json.contains("A"));
    }

    #[test]
    fn parses_gantt() {
        let src = "gantt\n  title Project\n  section Design\n  Task1 :a1, 2024-01-01, 5d";
        let json = super::native::parse(src).unwrap();
        assert!(json.contains("\"kind\":\"gantt\""));
        assert!(json.contains("Design"));
    }

    #[test]
    fn parses_sequence() {
        let src = "sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi";
        let json = super::native::parse(src).unwrap();
        assert!(json.contains("\"kind\":\"sequence\""));
        assert!(json.contains("Alice"));
    }
}
