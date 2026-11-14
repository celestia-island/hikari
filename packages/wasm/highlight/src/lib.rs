//! hikari-wasm-highlight — the pest-based syntax highlighting component.
//!
//! Each language is a .pest grammar file under src/grammars/; the generic
//! engine (engine.rs) maps pest rule names to hljs CSS classes and renders
//! HTML. Adding a language = adding a .pest file + a mod declaration.

pub mod engine;


// ── Pest parser declarations (one per grammar) ──────────────────────

pub mod grammars {
    pub mod julia {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/Julia.pest"]
        pub struct Parser;
    }
    pub mod bash {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/bash.pest"]
        pub struct Parser;
    }
    pub mod c {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/c.pest"]
        pub struct Parser;
    }
    pub mod cmake {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/cmake.pest"]
        pub struct Parser;
    }
    pub mod cpp {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/cpp.pest"]
        pub struct Parser;
    }
    pub mod crystal {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/crystal.pest"]
        pub struct Parser;
    }
    pub mod csharp {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/csharp.pest"]
        pub struct Parser;
    }
    pub mod css {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/css.pest"]
        pub struct Parser;
    }
    pub mod dart {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/dart.pest"]
        pub struct Parser;
    }
    pub mod elixir {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/elixir.pest"]
        pub struct Parser;
    }
    pub mod go {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/go.pest"]
        pub struct Parser;
    }
    pub mod graphql {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/graphql.pest"]
        pub struct Parser;
    }
    pub mod java {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/java.pest"]
        pub struct Parser;
    }
    pub mod javascript {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/javascript.pest"]
        pub struct Parser;
    }
    pub mod json {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/json.pest"]
        pub struct Parser;
    }
    pub mod kotlin {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/kotlin.pest"]
        pub struct Parser;
    }
    pub mod lua {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/lua.pest"]
        pub struct Parser;
    }
    pub mod makefile {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/makefile.pest"]
        pub struct Parser;
    }
    pub mod markdown {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/markdown.pest"]
        pub struct Parser;
    }
    pub mod matlab {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/matlab.pest"]
        pub struct Parser;
    }
    pub mod nim {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/nim.pest"]
        pub struct Parser;
    }
    pub mod perl {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/perl.pest"]
        pub struct Parser;
    }
    pub mod php {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/php.pest"]
        pub struct Parser;
    }
    pub mod powershell {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/powershell.pest"]
        pub struct Parser;
    }
    pub mod protobuf {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/protobuf.pest"]
        pub struct Parser;
    }
    pub mod python {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/python.pest"]
        pub struct Parser;
    }
    pub mod r {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/r.pest"]
        pub struct Parser;
    }
    pub mod ruby {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/ruby.pest"]
        pub struct Parser;
    }
    pub mod rust {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/rust.pest"]
        pub struct Parser;
    }
    pub mod scala {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/scala.pest"]
        pub struct Parser;
    }
    pub mod sql {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/sql.pest"]
        pub struct Parser;
    }
    pub mod swift {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/swift.pest"]
        pub struct Parser;
    }
    pub mod typescript {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/typescript.pest"]
        pub struct Parser;
    }
    pub mod vbnet {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/vbnet.pest"]
        pub struct Parser;
    }
    pub mod vim {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/vim.pest"]
        pub struct Parser;
    }
    pub mod xml {
        use pest_derive::Parser;
        #[derive(Parser)]
        #[grammar = "grammars/xml.pest"]
        pub struct Parser;
    }

    use pest::Parser as _;

    pub fn tokenize(language: &str, code: &str) -> Option<Vec<(String, String)>> {
        match language {
            "julia" => {
                let pairs = julia::Parser::parse(julia::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "bash" => {
                let pairs = bash::Parser::parse(bash::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "c" => {
                let pairs = c::Parser::parse(c::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "cmake" => {
                let pairs = cmake::Parser::parse(cmake::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "cpp" => {
                let pairs = cpp::Parser::parse(cpp::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "crystal" => {
                let pairs = crystal::Parser::parse(crystal::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "csharp" => {
                let pairs = csharp::Parser::parse(csharp::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "css" => {
                let pairs = css::Parser::parse(css::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "dart" => {
                let pairs = dart::Parser::parse(dart::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "elixir" => {
                let pairs = elixir::Parser::parse(elixir::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "go" => {
                let pairs = go::Parser::parse(go::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "graphql" => {
                let pairs = graphql::Parser::parse(graphql::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "java" => {
                let pairs = java::Parser::parse(java::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "javascript" => {
                let pairs = javascript::Parser::parse(javascript::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "json" => {
                let pairs = json::Parser::parse(json::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "kotlin" => {
                let pairs = kotlin::Parser::parse(kotlin::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "lua" => {
                let pairs = lua::Parser::parse(lua::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "makefile" => {
                let pairs = makefile::Parser::parse(makefile::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "markdown" => {
                let pairs = markdown::Parser::parse(markdown::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "matlab" => {
                let pairs = matlab::Parser::parse(matlab::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "nim" => {
                let pairs = nim::Parser::parse(nim::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "perl" => {
                let pairs = perl::Parser::parse(perl::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "php" => {
                let pairs = php::Parser::parse(php::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "powershell" => {
                let pairs = powershell::Parser::parse(powershell::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "protobuf" => {
                let pairs = protobuf::Parser::parse(protobuf::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "python" => {
                let pairs = python::Parser::parse(python::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "r" => {
                let pairs = r::Parser::parse(r::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "ruby" => {
                let pairs = ruby::Parser::parse(ruby::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "rust" => {
                let pairs = rust::Parser::parse(rust::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "scala" => {
                let pairs = scala::Parser::parse(scala::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "sql" => {
                let pairs = sql::Parser::parse(sql::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "swift" => {
                let pairs = swift::Parser::parse(swift::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "typescript" => {
                let pairs = typescript::Parser::parse(typescript::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "vbnet" => {
                let pairs = vbnet::Parser::parse(vbnet::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "vim" => {
                let pairs = vim::Parser::parse(vim::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            "xml" => {
                let pairs = xml::Parser::parse(xml::Rule::tokens, code).ok()?;
                Some(flat_tokens(pairs))
            }
            _ => None,
        }
    }
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
    pub fn supported_languages() -> Vec<String> {
        vec![
            "julia".to_string(),
            "bash".to_string(),
            "c".to_string(),
            "cmake".to_string(),
            "cpp".to_string(),
            "crystal".to_string(),
            "csharp".to_string(),
            "css".to_string(),
            "dart".to_string(),
            "elixir".to_string(),
            "go".to_string(),
            "graphql".to_string(),
            "java".to_string(),
            "javascript".to_string(),
            "json".to_string(),
            "kotlin".to_string(),
            "lua".to_string(),
            "makefile".to_string(),
            "markdown".to_string(),
            "matlab".to_string(),
            "nim".to_string(),
            "perl".to_string(),
            "php".to_string(),
            "powershell".to_string(),
            "protobuf".to_string(),
            "python".to_string(),
            "r".to_string(),
            "ruby".to_string(),
            "rust".to_string(),
            "scala".to_string(),
            "sql".to_string(),
            "swift".to_string(),
            "typescript".to_string(),
            "vbnet".to_string(),
            "vim".to_string(),
            "xml".to_string(),
        ]
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
