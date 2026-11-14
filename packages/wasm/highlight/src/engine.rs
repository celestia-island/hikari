//! engine.rs — the generic pest-based highlighting engine.
//!
//! Takes a stream of pest pairs (from any language grammar) and produces
//! an hljs-compatible HTML string. Rule names map directly to CSS classes:
//! a rule named `kw` → `hljs-keyword`, `string` → `hljs-string`, etc.
//! This engine is written once; each language grammar plugs into it.

use std::fmt::Write as _;

/// Map a pest rule name to an hljs CSS class. Returns None for rules
/// that should render as plain text (whitespace, `other`, punctuation).
pub fn rule_to_css(rule: &str) -> Option<&'static str> {
    match rule {
        "kw" | "kw_control" | "kw_decl" | "kw_type" => Some("hljs-keyword"),
        "string" | "string_part" => Some("hljs-string"),
        "comment" | "doc_comment" => Some("hljs-comment"),
        "number" => Some("hljs-number"),
        "func_def" | "func_call" | "class_def" | "type_def" => Some("hljs-title"),
        "attr" | "decorator" | "annotation" => Some("hljs-meta"),
        "builtin" | "builtin_const" => Some("hljs-built_in"),
        "type" | "typename" => Some("hljs-type"),
        "variable" | "param" => Some("hljs-params"),
        "operator" => Some("hljs-symbol"),
        "punctuation" => Some("hljs-punctuation"),
        // Structural language rules (diff, markdown, etc.)
        "added" => Some("hljs-addition"),
        "removed" => Some("hljs-deletion"),
        "header" => Some("hljs-meta"),
        "meta" => Some("hljs-meta"),
        "heading" => Some("hljs-section"),
        "attr_name" => Some("hljs-attr"),
        "regexp" => Some("hljs-regexp"),
        "escape" => Some("hljs-subst"),
        "tag" => Some("hljs-tag"),
        "attr_name" => Some("hljs-attr"),
        "attr_value" => Some("hljs-string"),
        _ => None,
    }
}

/// HTML-escape text content.
fn escape_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            _ => out.push(c),
        }
    }
    out
}

/// Render a flat sequence of (rule_name, text) tokens into hljs HTML.
/// Adjacent tokens with the same CSS class are merged into one span.
pub fn render_tokens(tokens: &[(String, String)]) -> String {
    let mut html = String::new();
    let mut prev_class: Option<&str> = None;
    let mut span_open = false;

    for (rule, text) in tokens {
        let css = rule_to_css(rule);
        if css != prev_class {
            if span_open {
                html.push_str("</span>");
                span_open = false;
            }
            if let Some(cls) = css {
                let _ = write!(html, "<span class=\"{}\">", cls);
                span_open = true;
            }
            prev_class = css;
        }
        html.push_str(&escape_html(text));
    }
    if span_open {
        html.push_str("</span>");
    }
    html
}
