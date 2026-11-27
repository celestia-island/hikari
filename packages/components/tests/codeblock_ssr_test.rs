//! SSR contract for the Rust code-highlight card.
//!
//! lagrange renders its own `hi-code-highlight*` markup because the component
//! once emitted the code as an ATTRIBUTE (`code="…"`) instead of text, leaving
//! an empty `<code>` with only the gutter visible. These tests pin what the
//! documented SSR path (`VNode::render_to_html`) actually produces, so the
//! consumer can call the component instead of hand-writing the markup.

use hikari_components::prelude::*;
use hikari_components::production::{CodeHighlight, CodeHighlightProps};

fn render(node: Element) -> String {
    node.render_to_html()
}

fn card() -> String {
    render(CodeHighlight(CodeHighlightProps {
        language: "rust".to_string(),
        code: "fn main() {\n    println!(\"hi\");\n}".to_string(),
        ..Default::default()
    }))
}

/// MUT: emitting the source as an attribute instead of a text child never
/// passes — the text assertions here catch it (the empty-`<code>` defect).
#[test]
fn the_source_renders_as_text_not_an_attribute() {
    let html = card();
    // The source must sit BETWEEN the tags. "present somewhere" is not enough:
    // a bare identifier child renders as `<code code_text="…">` (an ATTRIBUTE
    // with an empty element), which passed a naive `contains` check — the
    // first version of this pin did exactly that and let the mutation through.
    let open = html
        .find("<code")
        .unwrap_or_else(|| panic!("no <code>: {html}"));
    let body_start = html[open..]
        .find('>')
        .map(|i| open + i + 1)
        .unwrap_or_else(|| panic!("unterminated <code>: {html}"));
    let body = &html[body_start..];
    assert!(
        body.starts_with("fn main()"),
        "source is not the <code> element's text: {body}"
    );
    // …and no `code*` attribute carries it instead.
    let tag = &html[open..body_start];
    assert!(
        !tag.contains("fn main"),
        "source smuggled into the <code> tag's attributes: {tag}"
    );
    // The element that carries it is the <code> inside <pre>.
    assert!(html.contains("<pre"), "no <pre>: {html}");
    assert!(html.contains("<code"), "no <code>: {html}");
}

/// The gutter, the header token and the language class are all present, so a
/// host that swaps to this component keeps the shape its CSS targets.
#[test]
fn the_card_renders_its_header_gutter_and_language_hooks() {
    let html = card();
    for needle in [
        "hk-code-highlight",
        "hk-code-highlight-header",
        "hk-code-highlight-language",
        "hk-code-highlight-content",
        "hk-code-highlight-line-numbers",
        "hk-code-highlight-code",
        "language-rust",
    ] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
    // Two source lines means two gutter cells.
    assert_eq!(
        html.matches("hk-code-highlight-line-number\"").count(),
        3,
        "gutter cells: {html}"
    );
}

/// The header slots a consumer needs (`label`, `label_extra`, `actions`,
/// `copy_as_icon`) render through the SSR path too — the reason lagrange had
/// to hand-write the header in the first place.
#[test]
fn the_header_slots_render_through_ssr() {
    let html = render(CodeHighlight(CodeHighlightProps {
        language: "mermaid".to_string(),
        label: Some("flowchart.mmd".to_string()),
        code: "graph TD; A-->B".to_string(),
        copy_as_icon: true,
        ..Default::default()
    }));
    assert!(
        html.contains("flowchart.mmd"),
        "custom label missing: {html}"
    );
    assert!(
        html.contains("hk-code-highlight-actions"),
        "actions cluster missing: {html}"
    );
    // The icon copy form is the family's IconButton, not a text button.
    assert!(
        html.contains("hk-icon-button"),
        "icon copy button missing: {html}"
    );
}

/// A host with its own highlighter keeps ITS spans: pre-highlighted markup
/// wins over the plain-text path, and the card still owns the chrome.
///
/// MUT: preferring `code` over `code_html` never passes — dropping the branch
/// renders the raw source and loses every token span, which this catches.
#[test]
fn pre_highlighted_markup_wins_over_plain_text() {
    let html = render(CodeHighlight(CodeHighlightProps {
        language: "rust".to_string(),
        code: "fn main() {}".to_string(),
        code_html: Some(
            "<span class=\"tok-kw\">fn</span> <span class=\"tok-fn\">main</span>".to_string(),
        ),
        copy_as_icon: true,
        ..Default::default()
    }));
    assert!(html.contains("tok-kw"), "highlight spans dropped: {html}");
    assert!(html.contains("tok-fn"), "highlight spans dropped: {html}");
    // The card's own chrome is still there.
    assert!(
        html.contains("hk-code-highlight-header"),
        "chrome lost: {html}"
    );
    assert!(
        html.contains("hk-code-highlight-line-numbers"),
        "gutter lost: {html}"
    );
}
