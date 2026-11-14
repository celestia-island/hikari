//! hikari-wasm-highlight — the pest-based syntax highlighting component.
//!
//! Each language is a .pest grammar file under src/grammars/; the generic
//! engine (engine.rs) maps pest rule names to hljs CSS classes and renders
//! HTML. Adding a language = adding a .pest file + a mod declaration.

pub mod engine;

#[cfg(target_family = "wasm")]

// ── Pest parser declarations (one per grammar) ──────────────────────

pub mod grammars {
    pub mod python {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/python.pest"]
        pub struct Parser;
    }
    pub mod json {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/json.pest"]
        pub struct Parser;
    }

    use pest::Parser as _;

    /// Parse source text with the given grammar, returning a flat
    /// token stream of (rule_name, text) pairs.
    pub fn tokenize(language: &str, code: &str) -> Option<Vec<(String, String)>> {
        match language {
            "python" | "py" => {
                let pairs = python::Parser::parse(python::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "json" => {
                let pairs = json::Parser::parse(json::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            _ => None,
        }
    }

    /// Flatten the pest pair tree into (rule_name, text) leaves.
    fn flat_tokens<R: pest::RuleType>(pairs: pest::iterators::Pairs<'_, R>) -> Vec<(String, String)> {
        let mut out = Vec::new();
        collect_flat(pairs, &mut out);
        out
    }

    fn collect_flat<R: pest::RuleType>(pairs: pest::iterators::Pairs<'_, R>, out: &mut Vec<(String, String)>) {
        for pair in pairs {
            let inner: Vec<_> = pair.clone().into_inner().collect();
            if inner.is_empty() {
                let rule = format!("{:?}", pair.as_rule()).to_lowercase();
                let text = pair.as_str().to_string();
                out.push((rule, text));
            } else {
                collect_flat(pair.into_inner(), out);
            }
        }
    }

    /// The list of supported languages.
    pub fn supported_languages() -> Vec<String> {
        vec!["python".to_string(), "json".to_string()]
    }
}

// ── Wasm Guest ───────────────────────────────────────────────────────

#[cfg(target_family = "wasm")]
mod bindings {
    use super::Highlight;
    wit_bindgen::generate!({ path: "wit", world: "highlight" });
    export!(Highlight);
}

#[cfg(target_family = "wasm")]
pub struct Highlight;

#[cfg(target_family = "wasm")]
impl bindings::Guest for Highlight {
    fn highlight(code: String, language: String) -> bindings::HighlightResult {
        match grammars::tokenize(&language, &code) {
            Some(tokens) => {
                let html = engine::render_tokens(&tokens);
                bindings::HighlightResult { html: Some(html) }
            }
            None => bindings::HighlightResult { html: None },
        }
    }

    fn languages() -> Vec<String> {
        grammars::supported_languages()
    }
}

// ── Native facade for testing ────────────────────────────────────────

#[cfg(not(target_family = "wasm"))]
pub mod native {
    pub fn highlight(code: &str, language: &str) -> Option<String> {
        let tokens = crate::grammars::tokenize(language, code)?;
        Some(crate::engine::render_tokens(&tokens))
    }

    pub fn languages() -> Vec<String> {
        crate::grammars::supported_languages()
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn highlights_python_keywords() {
        let html = super::native::highlight("def hello(): return 42", "python").unwrap();
        assert!(html.contains("hljs-keyword"), "keyword missing: {html}");
        assert!(html.contains("hljs-number"), "number missing: {html}");
    }

    #[test]
    fn highlights_python_strings() {
        let html = super::native::highlight("x = \"hello\"", "python").unwrap();
        assert!(html.contains("hljs-string"), "string missing: {html}");
    }

    #[test]
    fn highlights_python_comments() {
        let html = super::native::highlight("# comment", "python").unwrap();
        assert!(html.contains("hljs-comment"), "comment missing: {html}");
    }

    #[test]
    fn highlights_json() {
        let html = super::native::highlight("{\"k\": 1}", "json").unwrap();
        assert!(html.contains("hljs-string"), "json string missing: {html}");
        assert!(html.contains("hljs-number"), "json number missing: {html}");
    }

    #[test]
    fn returns_none_for_unknown() {
        assert!(super::native::highlight("code", "cobol").is_none());
    }
}
