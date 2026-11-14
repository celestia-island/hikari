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

    #[test]
    fn arrow_order_matters() {
        let json = super::native::parse(
            "sequenceDiagram\n  A-->>B: dotted reply",
        ).unwrap();
        assert!(json.contains("\"from\":\"A\""));
        assert!(json.contains("\"to\":\"B\""));
        assert!(json.contains("\"arrowKind\":\"dotted-open\""));
    }

    #[test]
    fn pie_strips_quotes_and_validates() {
        let json = super::native::parse(
            "pie\n  \"Alpha\" : 40\n  Beta: -5",
        ).unwrap();
        assert!(json.contains("\"label\":\"Alpha\""));
        assert!(!json.contains("Beta"));
    }

    #[test]
    fn parses_class() {
        let src = "classDiagram\n  class Animal {\n    +name: String\n    +speak() void\n  }\n  Dog <|-- Animal";
        let json = super::native::parse(src).unwrap();
        assert!(json.contains("\"kind\":\"class\""));
        assert!(json.contains("Animal"));
        assert!(json.contains("\"relType\":\"inheritance\""));
    }

    #[test]
    fn parses_quadrant() {
        let src = "quadrantChart\n  x-axis Low --> High\n  y-axis Bottom --> Top\n  Point A: [0.5, 0.7]";
        let json = super::native::parse(src).unwrap();
        assert!(json.contains("\"kind\":\"quadrant\""));
        assert!(json.contains("Point A"));
    }
}
