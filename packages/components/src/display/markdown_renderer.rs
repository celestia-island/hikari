// hi-components/src/display/markdown_renderer.rs
// MarkdownRenderer — mirror of the canonical Vue `HkMarkdownRenderer`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkMarkdownRenderer.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.hk-markdown*` / `.hk-md-*` class names are literal and identical in
// both forms. DOM contract (Vue's render output):
//
//   div.hk-markdown [+class]  data-loading="{true|false}" [data-plain]
//     div.hk-markdown-body            (style-free; carries the markup)
//       <h1..h6> <p> <ul>/<ol> <blockquote> <hr> <table>
//       div.hk-md-code-wrap > div.hk-md-code
//         span.hk-md-code-lang?  pre > code.hljs[.language-x]
//       div.hk-md-table-wrap > div.hk-md-table-scroll > table
//     div.hk-markdown-overlay         (loading only)
//       div.hk-spinner …
//
// Delta vs Vue (documented). The Vue component is NOT a simple hand-rolled
// marker parser: it lazy-loads `marked` with `{gfm: true, breaks: true}`,
// overrides the code/table renderers and sanitises with DOMPurify, with
// optional highlight.js colouring. This crate may not add dependencies, so
// the mirror ships a deterministic GFM SUBSET tokenizer + renderer
// ([`markdown_parse`] / [`markdown_inline`] / [`markdown_render`]):
//
//   supported blocks   ATX headings `#`..`######`, fenced code (``` / ~~~)
//                      with an info string, GFM tables (header + delimiter
//                      row; alignment markers are parsed but not emitted),
//                      `-`/`*`/`+` and `1.` lists (FLAT — an indented marker
//                      starts a sibling item, not a nested list),
//                      `>` blockquotes, `---`/`***`/`___` rules, paragraphs
//   supported inline   `**strong**`, `*em*`, `~~strike~~`, `` `code` ``,
//                      `[text](href)`, `![alt](src)`, bare newlines
//                      (`breaks: true` → `<br>`)
//   unsupported        `_underscore_` emphasis (never guessed: `snake_case`
//                      stays literal), nested blocks inside list items,
//                      setext headings, reference links, footnotes, task
//                      lists, HTML passthrough (escaped, never parsed),
//                      highlight.js colouring (no grammar engine — the
//                      `hljs` class is still emitted for host CSS)
//
// Safety: `marked` output is sanitised by DOMPurify in Vue; the mirror has
// no sanitiser because it never emits caller-controlled markup — every
// caller string passes [`md_escape`] before it reaches the innerHTML host,
// fence languages are whitelisted with Vue's own `[a-zA-Z0-9+#._-]{1,32}`
// rule, and every link/image target passes [`markdown_sanitize_url`], which
// rejects active schemes (`javascript:`, `vbscript:`, `data:`, `file:`,
// `blob:`) after DOMPurify's whitespace/case normalisation. Rejected
// targets render as literal text, never as an anchor.

// The parser/mirror branches keep Vue's nesting for readability; clippy's
// collapsible-if rewrite makes the token loops harder to compare line by line.
#![allow(clippy::collapsible_if)]
use crate::feedback::Spinner;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct MarkdownRendererComponent;

/// Escape a caller string for HTML text/attribute position.
pub fn md_escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(ch),
        }
    }
    out
}

/// The URL allow-list Vue delegates to DOMPurify: an active scheme is
/// rejected outright (whitespace is stripped and case folded first, so
/// `java\tscript:` and `JaVaScRiPt:` cannot sneak through), anything else
/// passes through verbatim.
pub fn markdown_sanitize_url(url: &str) -> Option<String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.chars().any(|ch| ch.is_control()) {
        return None;
    }
    let probe: String = trimmed
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .flat_map(|ch| ch.to_lowercase())
        .collect();
    for blocked in ["javascript:", "vbscript:", "data:", "file:", "blob:"] {
        if probe.starts_with(blocked) {
            return None;
        }
    }
    Some(trimmed.to_string())
}

/// Vue whitelists the fence tag with `^[a-zA-Z0-9+#._-]{1,32}$` before it
/// reaches the code-block markup.
pub fn markdown_language_is_safe(lang: &str) -> bool {
    let count = lang.chars().count();
    if count == 0 || count > 32 {
        return false;
    }
    lang.chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '#' | '.' | '_' | '-'))
}

/// One inline span. `Text` and the emphasis bodies are RAW caller text and
/// only become HTML through [`md_escape`] inside
/// [`markdown_inline_html`].
#[derive(Clone, Debug, PartialEq)]
pub enum MdInline {
    Text(String),
    Code(String),
    Strong(String),
    Em(String),
    Strike(String),
    Link { text: String, href: String },
    Image { alt: String, src: String },
    Break,
}

/// One block of the parsed document.
#[derive(Clone, Debug, PartialEq)]
pub enum MdBlock {
    Heading {
        level: u8,
        text: String,
    },
    Paragraph {
        text: String,
    },
    CodeBlock {
        lang: String,
        text: String,
    },
    List {
        ordered: bool,
        start: usize,
        items: Vec<String>,
    },
    Blockquote {
        text: String,
    },
    Table {
        head: Vec<String>,
        rows: Vec<Vec<String>>,
    },
    Rule,
}

fn md_slice(chars: &[char], start: usize, end: usize) -> String {
    chars[start..end].iter().collect()
}

fn md_find_char(chars: &[char], from: usize, needle: char) -> Option<usize> {
    let mut index = from;
    while index < chars.len() {
        if chars[index] == needle {
            return Some(index);
        }
        index += 1;
    }
    None
}

fn md_find_marker(chars: &[char], from: usize, marker: &[char]) -> Option<usize> {
    if marker.is_empty() {
        return None;
    }
    let mut index = from;
    while index + marker.len() <= chars.len() {
        if chars[index..].starts_with(marker) {
            return Some(index);
        }
        index += 1;
    }
    None
}

fn md_flush(buffer: &mut String, out: &mut Vec<MdInline>) {
    if !buffer.is_empty() {
        out.push(MdInline::Text(std::mem::take(buffer)));
    }
}

/// `[label](target)` opening at `open` (which must be `[`).
fn md_parse_link(chars: &[char], open: usize) -> Option<(String, String, usize)> {
    if chars.get(open) != Some(&'[') {
        return None;
    }
    let close = md_find_char(chars, open + 1, ']')?;
    if chars.get(close + 1) != Some(&'(') {
        return None;
    }
    let paren = md_find_char(chars, close + 2, ')')?;
    Some((
        md_slice(chars, open + 1, close),
        md_slice(chars, close + 2, paren).trim().to_string(),
        paren + 1,
    ))
}

fn md_parse_emphasis(chars: &[char], start: usize) -> Option<(MdInline, usize)> {
    if chars[start..].starts_with(&['*', '*']) {
        if let Some(close) = md_find_marker(chars, start + 2, &['*', '*']) {
            if close > start + 2 {
                return Some((
                    MdInline::Strong(md_slice(chars, start + 2, close)),
                    close + 2,
                ));
            }
        }
        return None;
    }
    if chars[start..].starts_with(&['~', '~']) {
        if let Some(close) = md_find_marker(chars, start + 2, &['~', '~']) {
            if close > start + 2 {
                return Some((
                    MdInline::Strike(md_slice(chars, start + 2, close)),
                    close + 2,
                ));
            }
        }
        return None;
    }
    if chars[start] == '*' {
        if let Some(close) = md_find_char(chars, start + 1, '*') {
            if close > start + 1 {
                return Some((MdInline::Em(md_slice(chars, start + 1, close)), close + 1));
            }
        }
    }
    None
}

/// Tokenize the inline span of one block.
pub fn markdown_inline(text: &str) -> Vec<MdInline> {
    let chars: Vec<char> = text.chars().collect();
    let mut out: Vec<MdInline> = Vec::new();
    let mut buffer = String::new();
    let mut index = 0usize;
    while index < chars.len() {
        let ch = chars[index];
        if ch == '`' {
            if let Some(close) = md_find_char(&chars, index + 1, '`') {
                md_flush(&mut buffer, &mut out);
                out.push(MdInline::Code(md_slice(&chars, index + 1, close)));
                index = close + 1;
                continue;
            }
        }
        if ch == '!' && chars.get(index + 1) == Some(&'[') {
            if let Some((alt, target, next)) = md_parse_link(&chars, index + 1) {
                md_flush(&mut buffer, &mut out);
                match markdown_sanitize_url(&target) {
                    Some(src) => out.push(MdInline::Image { alt, src }),
                    None => out.push(MdInline::Text(format!("![{alt}]({target})"))),
                }
                index = next;
                continue;
            }
        }
        if ch == '[' {
            if let Some((label, target, next)) = md_parse_link(&chars, index) {
                md_flush(&mut buffer, &mut out);
                match markdown_sanitize_url(&target) {
                    Some(href) => out.push(MdInline::Link { text: label, href }),
                    None => out.push(MdInline::Text(format!("[{label}]({target})"))),
                }
                index = next;
                continue;
            }
        }
        if ch == '\n' {
            md_flush(&mut buffer, &mut out);
            out.push(MdInline::Break);
            index += 1;
            continue;
        }
        if ch == '*' || ch == '~' {
            if let Some((inline, next)) = md_parse_emphasis(&chars, index) {
                md_flush(&mut buffer, &mut out);
                out.push(inline);
                index = next;
                continue;
            }
        }
        buffer.push(ch);
        index += 1;
    }
    md_flush(&mut buffer, &mut out);
    out
}

/// Render the inline span of one block as escaped HTML.
pub fn markdown_inline_html(inlines: &[MdInline]) -> String {
    let mut html = String::new();
    for inline in inlines {
        match inline {
            MdInline::Text(text) => html.push_str(&md_escape(text)),
            MdInline::Code(code) => {
                html.push_str("<code>");
                html.push_str(&md_escape(code));
                html.push_str("</code>");
            }
            MdInline::Strong(text) => {
                html.push_str("<strong>");
                html.push_str(&markdown_inline_html(&markdown_inline(text)));
                html.push_str("</strong>");
            }
            MdInline::Em(text) => {
                html.push_str("<em>");
                html.push_str(&markdown_inline_html(&markdown_inline(text)));
                html.push_str("</em>");
            }
            MdInline::Strike(text) => {
                html.push_str("<del>");
                html.push_str(&markdown_inline_html(&markdown_inline(text)));
                html.push_str("</del>");
            }
            MdInline::Link { text, href } => {
                html.push_str(&format!(
                    "<a href=\"{}\">{}</a>",
                    md_escape(href),
                    markdown_inline_html(&markdown_inline(text))
                ));
            }
            MdInline::Image { alt, src } => {
                html.push_str(&format!(
                    "<img src=\"{}\" alt=\"{}\">",
                    md_escape(src),
                    md_escape(alt)
                ));
            }
            MdInline::Break => html.push_str("<br>"),
        }
    }
    html
}

fn md_fence_open(line: &str) -> Option<(char, String)> {
    let trimmed = line.trim_start();
    let fence = trimmed.chars().next()?;
    if fence != '`' && fence != '~' {
        return None;
    }
    let run = trimmed.chars().take_while(|ch| *ch == fence).count();
    if run < 3 {
        return None;
    }
    let info: String = trimmed.chars().skip(run).collect();
    Some((fence, info.trim().to_string()))
}

fn md_fence_language(info: &str) -> String {
    info.split_whitespace().next().unwrap_or("").to_string()
}

fn md_heading(line: &str) -> Option<(u8, String)> {
    let trimmed = line.trim_start();
    let hashes = trimmed.chars().take_while(|ch| *ch == '#').count();
    if hashes == 0 || hashes > 6 {
        return None;
    }
    let rest = &trimmed[hashes..];
    if !rest.is_empty() && !rest.starts_with(' ') {
        return None;
    }
    Some((hashes as u8, rest.trim().to_string()))
}

fn md_is_rule(line: &str) -> bool {
    let trimmed = line.trim();
    if trimmed.chars().count() < 3 {
        return false;
    }
    let first = match trimmed.chars().next() {
        Some(ch) => ch,
        None => return false,
    };
    if !matches!(first, '-' | '*' | '_') {
        return false;
    }
    trimmed.chars().all(|ch| ch == first || ch == ' ')
}

fn md_table_cells(line: &str) -> Vec<String> {
    let trimmed = line.trim();
    let trimmed = trimmed.strip_prefix('|').unwrap_or(trimmed);
    let trimmed = trimmed.strip_suffix('|').unwrap_or(trimmed);
    trimmed
        .split('|')
        .map(|cell| cell.trim().to_string())
        .collect()
}

fn md_is_table_delimiter(line: &str) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() || !trimmed.contains('-') {
        return false;
    }
    let cells = md_table_cells(trimmed);
    if cells.is_empty() {
        return false;
    }
    cells.iter().all(|cell| {
        let cell = cell.trim();
        let cell = cell.strip_prefix(':').unwrap_or(cell);
        let cell = cell.strip_suffix(':').unwrap_or(cell);
        !cell.is_empty() && cell.chars().all(|ch| ch == '-')
    })
}

/// `(ordered, start, content)` for a GFM list marker.
fn md_list_marker(line: &str) -> Option<(bool, usize, String)> {
    let trimmed = line.trim_start();
    let first = trimmed.chars().next()?;
    if matches!(first, '-' | '*' | '+') {
        let rest = &trimmed[1..];
        if rest.is_empty() {
            return Some((false, 1, String::new()));
        }
        let content = rest.strip_prefix(' ')?;
        return Some((false, 1, content.trim_start().to_string()));
    }
    let digits = trimmed.chars().take_while(|ch| ch.is_ascii_digit()).count();
    if digits == 0 || digits > 9 {
        return None;
    }
    let rest = &trimmed[digits..];
    let content = rest.strip_prefix(". ")?;
    let start = trimmed[..digits].parse::<usize>().ok()?;
    Some((true, start, content.trim_start().to_string()))
}

fn md_starts_block(lines: &[&str], index: usize) -> bool {
    let line = lines[index];
    if md_fence_open(line).is_some()
        || md_heading(line).is_some()
        || md_is_rule(line)
        || line.trim_start().starts_with('>')
        || md_list_marker(line).is_some()
    {
        return true;
    }
    line.contains('|') && index + 1 < lines.len() && md_is_table_delimiter(lines[index + 1])
}

/// Split markdown text into blocks (see the header for the supported set).
pub fn markdown_parse(source: &str) -> Vec<MdBlock> {
    let lines: Vec<&str> = source.lines().collect();
    let mut blocks: Vec<MdBlock> = Vec::new();
    let mut index = 0usize;
    while index < lines.len() {
        let line = lines[index];
        if line.trim().is_empty() {
            index += 1;
            continue;
        }

        if let Some((fence, info)) = md_fence_open(line) {
            let lang = md_fence_language(&info);
            index += 1;
            let mut body: Vec<&str> = Vec::new();
            while index < lines.len() {
                if let Some((closing, trailing)) = md_fence_open(lines[index]) {
                    if closing == fence && trailing.is_empty() {
                        index += 1;
                        break;
                    }
                }
                body.push(lines[index]);
                index += 1;
            }
            blocks.push(MdBlock::CodeBlock {
                lang,
                text: body.join("\n"),
            });
            continue;
        }

        if let Some((level, text)) = md_heading(line) {
            blocks.push(MdBlock::Heading { level, text });
            index += 1;
            continue;
        }

        if md_is_rule(line) {
            blocks.push(MdBlock::Rule);
            index += 1;
            continue;
        }

        if line.contains('|') && index + 1 < lines.len() && md_is_table_delimiter(lines[index + 1])
        {
            let head = md_table_cells(line);
            index += 2;
            let mut rows: Vec<Vec<String>> = Vec::new();
            while index < lines.len() {
                let row_line = lines[index];
                if row_line.trim().is_empty() || !row_line.contains('|') {
                    break;
                }
                rows.push(md_table_cells(row_line));
                index += 1;
            }
            blocks.push(MdBlock::Table { head, rows });
            continue;
        }

        if line.trim_start().starts_with('>') {
            let mut body: Vec<String> = Vec::new();
            while index < lines.len() {
                let quote_line = lines[index].trim_start();
                match quote_line.strip_prefix('>') {
                    Some(rest) => {
                        body.push(rest.trim_start().to_string());
                        index += 1;
                    }
                    None => break,
                }
            }
            blocks.push(MdBlock::Blockquote {
                text: body.join("\n"),
            });
            continue;
        }

        if let Some((ordered, start, first_content)) = md_list_marker(line) {
            let mut items: Vec<String> = vec![first_content];
            index += 1;
            while index < lines.len() {
                match md_list_marker(lines[index]) {
                    Some((item_ordered, _, content)) if item_ordered == ordered => {
                        items.push(content);
                        index += 1;
                    }
                    _ => break,
                }
            }
            blocks.push(MdBlock::List {
                ordered,
                start,
                items,
            });
            continue;
        }

        let mut paragraph: Vec<String> = Vec::new();
        while index < lines.len() {
            if lines[index].trim().is_empty() {
                break;
            }
            if !paragraph.is_empty() && md_starts_block(&lines, index) {
                break;
            }
            paragraph.push(lines[index].trim().to_string());
            index += 1;
        }
        blocks.push(MdBlock::Paragraph {
            text: paragraph.join("\n"),
        });
    }
    blocks
}

/// Render markdown to the escaped HTML Vue mounts through `innerHTML`.
pub fn markdown_render(source: &str) -> String {
    let mut html = String::new();
    for block in &markdown_parse(source) {
        match block {
            MdBlock::Heading { level, text } => {
                html.push_str(&format!(
                    "<h{level}>{}</h{level}>",
                    markdown_inline_html(&markdown_inline(text))
                ));
            }
            MdBlock::Paragraph { text } => {
                html.push_str(&format!(
                    "<p>{}</p>",
                    markdown_inline_html(&markdown_inline(text))
                ));
            }
            MdBlock::CodeBlock { lang, text } => {
                let safe = markdown_language_is_safe(lang);
                let lang_attr = if safe {
                    format!(" language-{}", md_escape(lang))
                } else {
                    String::new()
                };
                let label = if safe {
                    format!("<span class=\"hk-md-code-lang\">{}</span>", md_escape(lang))
                } else {
                    String::new()
                };
                html.push_str(&format!(
                    "<div class=\"hk-md-code-wrap\"><div class=\"hk-md-code\">{label}<pre><code class=\"hljs{lang_attr}\">{}</code></pre></div></div>",
                    md_escape(text)
                ));
            }
            MdBlock::List {
                ordered,
                start,
                items,
            } => {
                if *ordered {
                    if *start == 1 {
                        html.push_str("<ol>");
                    } else {
                        html.push_str(&format!("<ol start=\"{start}\">"));
                    }
                } else {
                    html.push_str("<ul>");
                }
                for item in items {
                    html.push_str(&format!(
                        "<li>{}</li>",
                        markdown_inline_html(&markdown_inline(item))
                    ));
                }
                html.push_str(if *ordered { "</ol>" } else { "</ul>" });
            }
            MdBlock::Blockquote { text } => {
                html.push_str(&format!(
                    "<blockquote><p>{}</p></blockquote>",
                    markdown_inline_html(&markdown_inline(text))
                ));
            }
            MdBlock::Table { head, rows } => {
                html.push_str(
                    "<div class=\"hk-md-table-wrap\"><div class=\"hk-md-table-scroll\"><table><thead><tr>",
                );
                for cell in head {
                    html.push_str(&format!(
                        "<th>{}</th>",
                        markdown_inline_html(&markdown_inline(cell))
                    ));
                }
                html.push_str("</tr></thead><tbody>");
                for row in rows {
                    html.push_str("<tr>");
                    for cell in row {
                        html.push_str(&format!(
                            "<td>{}</td>",
                            markdown_inline_html(&markdown_inline(cell))
                        ));
                    }
                    html.push_str("</tr>");
                }
                html.push_str("</tbody></table></div></div>");
            }
            MdBlock::Rule => html.push_str("<hr>"),
        }
    }
    html
}

/// Vue's plain fallback: the whole text in one escaped `<pre>`.
pub fn markdown_render_plain(source: &str) -> String {
    format!("<pre class=\"hk-md-plain\">{}</pre>", md_escape(source))
}

#[define_props]
pub struct MarkdownRendererProps {
    /// The markdown source (Vue: required).
    #[default]
    pub content: String,

    /// Plain-text mode: escape the whole source into one `<pre>`
    /// (`data-plain`).
    #[default]
    pub plain: bool,

    /// Show the loading veil over the body (`data-loading`).
    #[default]
    pub loading: bool,

    #[default]
    pub class: String,
}

#[component]
pub fn MarkdownRenderer(props: MarkdownRendererProps) -> Element {
    // Vue falls back to the escaped <pre> when `marked`/DOMPurify are
    // unavailable or the parse throws. The mirror has a single deterministic
    // renderer, so the fallback is only the explicit `plain` path (and the
    // empty-content path, which paints an empty body).
    let html = if props.content.is_empty() {
        String::new()
    } else if props.plain {
        markdown_render_plain(&props.content)
    } else {
        markdown_render(&props.content)
    };

    let body = VElement::new("div")
        .class("hk-markdown-body")
        .dangerous_inner_html(html);

    let mut root_classes = String::from("hk-markdown");
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }
    let mut element = VElement::new("div")
        .class(root_classes)
        .attr("data-loading", if props.loading { "true" } else { "false" })
        .child(VNode::Element(Box::new(body)));
    if props.plain {
        element = element.attr("data-plain", "");
    }
    if props.loading {
        element = element.child(rsx! {
            div {
                class: "hk-markdown-overlay",
                Spinner { center: true }
            }
        });
    }
    VNode::Element(Box::new(element))
}

impl StyledComponent for MarkdownRendererComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkMarkdownRenderer.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "markdown-renderer"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn markdown_renderer_defaults_match_the_vue_props() {
        let props = MarkdownRendererProps::default();
        assert_eq!(props.content, "");
        assert!(!props.plain);
        assert!(!props.loading);
        assert_eq!(props.class, "");
    }

    #[test]
    fn escape_covers_every_markup_character() {
        assert_eq!(md_escape("<script>&\"'"), "&lt;script&gt;&amp;&quot;&#39;");
        assert_eq!(md_escape("plain"), "plain");
    }

    #[test]
    fn url_guard_rejects_active_schemes() {
        assert!(markdown_sanitize_url("javascript:alert(1)").is_none());
        assert!(markdown_sanitize_url(" JaVaScRiPt:alert(1)").is_none());
        assert!(markdown_sanitize_url("java\tscript:alert(1)").is_none());
        assert!(markdown_sanitize_url("vbscript:x").is_none());
        assert!(markdown_sanitize_url("data:text/html,x").is_none());
        assert!(markdown_sanitize_url("").is_none());
        assert_eq!(
            markdown_sanitize_url(" https://example.com/a?b=1 "),
            Some("https://example.com/a?b=1".to_string())
        );
        assert_eq!(
            markdown_sanitize_url("/relative"),
            Some("/relative".to_string())
        );
        assert_eq!(
            markdown_sanitize_url("#anchor"),
            Some("#anchor".to_string())
        );
    }

    #[test]
    fn inline_tokenizes_the_supported_markup() {
        assert_eq!(
            markdown_inline("a **b** c"),
            vec![
                MdInline::Text("a ".to_string()),
                MdInline::Strong("b".to_string()),
                MdInline::Text(" c".to_string())
            ]
        );
        assert_eq!(
            markdown_inline("`x`"),
            vec![MdInline::Code("x".to_string())]
        );
        assert_eq!(
            markdown_inline("~~s~~"),
            vec![MdInline::Strike("s".to_string())]
        );
        assert_eq!(markdown_inline("*e*"), vec![MdInline::Em("e".to_string())]);
        assert_eq!(
            markdown_inline("[t](https://e.com)"),
            vec![MdInline::Link {
                text: "t".to_string(),
                href: "https://e.com".to_string()
            }]
        );
        assert_eq!(
            markdown_inline("![alt](img.png)"),
            vec![MdInline::Image {
                alt: "alt".to_string(),
                src: "img.png".to_string()
            }]
        );
        assert_eq!(
            markdown_inline("a\nb"),
            vec![
                MdInline::Text("a".to_string()),
                MdInline::Break,
                MdInline::Text("b".to_string())
            ]
        );
        // A lone marker stays literal text (no runaway emphasis).
        assert_eq!(
            markdown_inline("a * b"),
            vec![MdInline::Text("a * b".to_string())]
        );
        // Underscore emphasis is deliberately unsupported.
        assert_eq!(
            markdown_inline("snake_case_name"),
            vec![MdInline::Text("snake_case_name".to_string())]
        );
    }

    #[test]
    fn blocks_cover_heading_fence_rule_list_quote_and_table() {
        assert_eq!(
            markdown_parse("# Title\n\ntext"),
            vec![
                MdBlock::Heading {
                    level: 1,
                    text: "Title".to_string()
                },
                MdBlock::Paragraph {
                    text: "text".to_string()
                }
            ]
        );
        assert_eq!(
            markdown_parse("```rust\nfn x() {}\n```"),
            vec![MdBlock::CodeBlock {
                lang: "rust".to_string(),
                text: "fn x() {}".to_string()
            }]
        );
        assert_eq!(markdown_parse("---"), vec![MdBlock::Rule]);
        assert_eq!(
            markdown_parse("- a\n- b"),
            vec![MdBlock::List {
                ordered: false,
                start: 1,
                items: vec!["a".to_string(), "b".to_string()]
            }]
        );
        assert_eq!(
            markdown_parse("3. a\n4. b"),
            vec![MdBlock::List {
                ordered: true,
                start: 3,
                items: vec!["a".to_string(), "b".to_string()]
            }]
        );
        assert_eq!(
            markdown_parse("> quote"),
            vec![MdBlock::Blockquote {
                text: "quote".to_string()
            }]
        );
        assert_eq!(
            markdown_parse("| a | b |\n| --- | --- |\n| 1 | 2 |"),
            vec![MdBlock::Table {
                head: vec!["a".to_string(), "b".to_string()],
                rows: vec![vec!["1".to_string(), "2".to_string()]]
            }]
        );
        assert!(markdown_parse("").is_empty());
    }

    #[test]
    fn paragraph_soft_breaks_stop_at_the_next_block() {
        assert_eq!(
            markdown_parse("one\ntwo\n# heading\nthree"),
            vec![
                MdBlock::Paragraph {
                    text: "one\ntwo".to_string()
                },
                MdBlock::Heading {
                    level: 1,
                    text: "heading".to_string()
                },
                MdBlock::Paragraph {
                    text: "three".to_string()
                }
            ]
        );
    }

    #[test]
    fn render_emits_the_vue_dom_hooks() {
        assert_eq!(markdown_render("# Hi"), "<h1>Hi</h1>");
        let code = markdown_render("```rust\nlet x = 1;\n```");
        assert!(code.contains("hk-md-code-wrap"), "{code}");
        assert!(code.contains("language-rust"), "{code}");
        assert!(code.contains("hk-md-code-lang"), "{code}");
        let table = markdown_render("| a |\n| --- |\n| 1 |");
        assert!(table.contains("hk-md-table-wrap"), "{table}");
        assert!(table.contains("<th>a</th>"), "{table}");
        assert_eq!(markdown_render("- a"), "<ul><li>a</li></ul>");
        assert_eq!(markdown_render("3. a"), "<ol start=\"3\"><li>a</li></ol>");
        assert_eq!(markdown_render("---"), "<hr>");
        assert_eq!(markdown_render(""), "");
    }

    #[test]
    fn render_escapes_html_and_filters_links() {
        let html = markdown_render("<img src=x onerror=alert(1)>");
        assert!(!html.contains("<img"), "{html}");
        assert!(html.contains("&lt;img"), "{html}");

        assert_eq!(markdown_render("`<b>`"), "<p><code>&lt;b&gt;</code></p>");

        let blocked = markdown_render("[x](javascript:alert)");
        assert!(!blocked.contains("<a "), "{blocked}");
        assert!(blocked.contains("javascript:alert"), "{blocked}");

        assert_eq!(
            markdown_render("[x](https://example.com)"),
            "<p><a href=\"https://example.com\">x</a></p>"
        );

        let unsafe_lang = markdown_render("```ru\"st\nx\n```");
        assert!(!unsafe_lang.contains("language-ru\"st"), "{unsafe_lang}");
        assert!(!unsafe_lang.contains("hk-md-code-lang"), "{unsafe_lang}");
    }

    #[test]
    fn language_whitelist_matches_the_vue_regex() {
        assert!(markdown_language_is_safe("rust"));
        assert!(markdown_language_is_safe("c++"));
        assert!(markdown_language_is_safe("c#"));
        assert!(markdown_language_is_safe("objective-c"));
        assert!(!markdown_language_is_safe(""));
        assert!(!markdown_language_is_safe("rust\" onload=\"x"));
        assert!(!markdown_language_is_safe("a b"));
        assert!(!markdown_language_is_safe(&"a".repeat(33)));
    }

    #[test]
    fn plain_render_escapes_the_whole_text() {
        assert_eq!(
            markdown_render_plain("<b>&"),
            "<pre class=\"hk-md-plain\">&lt;b&gt;&amp;</pre>"
        );
    }

    #[test]
    fn markdown_renderer_renders_the_vue_dom_contract() {
        let html = MarkdownRenderer(MarkdownRendererProps {
            content: "# Hello\n\nsome **bold** text".to_string(),
            class: "my-md".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-markdown"), "{html}");
        assert!(html.contains("hk-markdown-body"), "{html}");
        assert!(html.contains("data-loading=\"false\""), "{html}");
        assert!(!html.contains("data-plain"), "{html}");
        assert!(!html.contains("hk-markdown-overlay"), "{html}");
        assert!(html.contains("<h1>Hello</h1>"), "{html}");
        assert!(html.contains("<strong>bold</strong>"), "{html}");
        assert!(html.contains("my-md"), "{html}");
    }

    #[test]
    fn markdown_renderer_overlay_and_plain_modes() {
        let loading = MarkdownRenderer(MarkdownRendererProps {
            content: "text".to_string(),
            loading: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(loading.contains("data-loading=\"true\""), "{loading}");
        assert!(loading.contains("hk-markdown-overlay"), "{loading}");
        assert!(loading.contains("hk-spinner"), "{loading}");

        let plain = MarkdownRenderer(MarkdownRendererProps {
            content: "<b>raw</b>".to_string(),
            plain: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(plain.contains("data-plain"), "{plain}");
        assert!(plain.contains("hk-md-plain"), "{plain}");
        assert!(!plain.contains("<b>raw</b>"), "{plain}");
        assert!(plain.contains("&lt;b&gt;raw&lt;/b&gt;"), "{plain}");
    }

    #[test]
    fn markdown_renderer_refuses_to_inject_markup() {
        let html = MarkdownRenderer(MarkdownRendererProps {
            content: "<script>alert(1)</script>\n\n[click](javascript:alert)".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("<script>"), "{html}");
        assert!(html.contains("&lt;script&gt;"), "{html}");
        assert!(!html.contains("<a "), "{html}");
    }

    #[test]
    fn markdown_renderer_empty_content_paints_an_empty_body() {
        let html = MarkdownRenderer(MarkdownRendererProps::default()).render_to_html();
        assert!(html.contains("hk-markdown-body"), "{html}");
        assert!(!html.contains("<p>"), "{html}");
    }

    #[test]
    fn markdown_renderer_styles_come_from_the_canonical_vue_sheet() {
        let css = MarkdownRendererComponent::styles();
        assert!(
            css.contains(".hk-markdown") && css.contains(".hk-md-code"),
            "markdown css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored markdown sheet"
        );
    }
}
