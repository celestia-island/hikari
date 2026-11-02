// hi-components/src/basic/template_text.rs
// TemplateText — mirror of the canonical Vue `HkTemplateText`: the read-only
// half of the fill-template surfaces. A `{{ token }}` template renders as
// literal text runs plus one inline chip per token, so a stored template reads
// the same in a row / card / detail view as it does in the editor that produced
// it.
//
// The stylesheet is the SAME sheet the Vue library compiles
// (`packages/vue/src/components/HkTemplateField.scss` — Vue ships NO
// `HkTemplateText.scss`; this component imports the field's sheet), vendored
// under `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`, compiled with `no_hash` so the
// `.hk-template-text*` / `.hk-tpl-chip` class names are literal and identical
// in both forms. The DOM contract below mirrors the Vue render output:
//
//   span.hk-template-text [data-multiline="true"]
//     ── per parsed segment, in source order ──
//     span.hk-template-text-run            (kind = "text")
//       {the verbatim text run, escaped}
//     span.hk-tpl-chip                     (kind = "token")
//          [data-unknown=""]               (the vocabulary does NOT carry it)
//          data-static=""
//          [title]                         (vocabulary description)
//       {{ name }}                         (the canonical display spelling)
//
// The grammar is `templateGrammar.ts`, ported exactly: only `{{ word }}` with a
// bare identifier inside (`[A-Za-z0-9_]+`) is a token; pipes, dotted paths and
// spaces INSIDE the identifier stay literal text, so a richer engine grammar is
// never silently rewritten by merely rendering through this component.
// [`parse_template`] / [`serialize_template`] are BYTE-EXACT inverses (a token
// segment carries the exact source it was parsed from, `{{name}}` /
// `{{ name }}` / `{{  name }}` all stay verbatim), and the chip always renders
// the canonical `{{ name }}` spelling whatever spacing storage holds.
//
// Deltas vs Vue (documented, not accidental):
//   * `content` is `required` in Vue (a missing one warns); the Rust prop
//     defaults to `""`, which parses to zero segments (an empty shell span).
//   * [`template_token_index`] keeps `name -> Option<description>` instead of
//     Vue's `name -> def` map: the renderer reads the description ONLY (the
//     chip `title`); every other vocabulary field is menu-side. "Last entry
//     wins" is preserved.
//   * NO SEGMENT KEYS: Vue keys the two span kinds by list index so a content
//     edit diffs; this mirror emits an unkeyed fragment (tairitsu's `rsx!`
//     builds `VNode::Fragment`, which carries no per-child key here). The
//     rendered DOM is identical — only a hypothetical patch-reuse hint is gone.
//   * `data-unknown` / `data-static` are EMPTY-VALUE attributes exactly like
//     Vue (`data-*={cond ? undefined : ""}`): presence carries the state, so
//     the mirror emits `data-unknown=""` only for an unknown token and
//     `data-static=""` always.
//   * the vocabulary is a plain `Vec<TemplateTokenDef>`; Vue's `label` / `group`
//     fields are accepted for prop parity and are inert in the renderer, exactly
//     as they are in Vue's read-only path.

use std::collections::HashMap;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TemplateTextComponent;

/// One vocabulary entry the host knows how to fill (Vue: `HkTemplateTokenDef`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TemplateTokenDef {
    /// The bare identifier spelled inside the braces (`md5_email`).
    pub name: String,

    /// Human label for menus; defaults to `name` menu-side. Inert here (the
    /// read-only path never renders it).
    pub label: Option<String>,

    /// What the value is / how the host computes it — the chip's `title`.
    pub description: Option<String>,

    /// Optional grouping key for menus. Inert here.
    pub group: Option<String>,
}

/// One parsed segment of a fill template (Vue: the `{kind:"text"}` /
/// `{kind:"token"}` union members).
#[derive(Clone, PartialEq, Debug)]
pub enum TemplateSegment {
    /// A literal run, verbatim.
    Text(String),

    /// A whole token: the bare identifier plus the EXACT source text it was
    /// parsed from (`raw`), so serialization stays byte-exact.
    Token { token: String, raw: String },
}

impl TemplateSegment {
    /// The exact source text this segment occupies — the inverse mapping
    /// [`serialize_template`] concatenates.
    pub fn raw(&self) -> &str {
        match self {
            TemplateSegment::Text(text) => text,
            TemplateSegment::Token { raw, .. } => raw,
        }
    }
}

/// JavaScript's `\s`: the whitespace set `templateGrammar.ts`'s `\s*` accepts
/// around a token name (`\t`…`\r`, space, NBSP, the Ogham/Unicode spaces,
/// U+2028/U+2029, the narrow/no-break spaces, ideographic space and the BOM).
pub fn is_template_whitespace(ch: char) -> bool {
    matches!(
        ch,
        '\u{0009}'
            | '\u{000A}'
            | '\u{000B}'
            | '\u{000C}'
            | '\u{000D}'
            | '\u{0020}'
            | '\u{00A0}'
            | '\u{1680}'
            | '\u{2000}'
            ..='\u{200A}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202F}'
                | '\u{205F}'
                | '\u{3000}'
                | '\u{FEFF}'
    )
}

/// `[A-Za-z0-9_]` — the identifier class the grammar allows inside the braces.
fn is_template_name_char(ch: char) -> bool {
    ch.is_ascii_alphanumeric() || ch == '_'
}

/// Match `\{\{\s*([A-Za-z0-9_]+)\s*\}\}` at `start` (which must hold the two
/// opening braces). Returns the bare identifier and the exclusive end index, or
/// `None` when the braces do not close over a bare identifier.
fn match_template_token(chars: &[char], start: usize) -> Option<(String, usize)> {
    let mut cursor = start + 2;
    while cursor < chars.len() && is_template_whitespace(chars[cursor]) {
        cursor += 1;
    }
    let name_start = cursor;
    while cursor < chars.len() && is_template_name_char(chars[cursor]) {
        cursor += 1;
    }
    // `([A-Za-z0-9_]+)` needs at least one character.
    if cursor == name_start {
        return None;
    }
    let name_end = cursor;
    while cursor < chars.len() && is_template_whitespace(chars[cursor]) {
        cursor += 1;
    }
    if cursor + 1 < chars.len() && chars[cursor] == '}' && chars[cursor + 1] == '}' {
        Some((chars[name_start..name_end].iter().collect(), cursor + 2))
    } else {
        None
    }
}

/// Split a fill template into literal text and whole tokens (Vue:
/// `parseTemplate`). Adjacent text runs merge; the empty string parses to an
/// empty list.
pub fn parse_template(text: &str) -> Vec<TemplateSegment> {
    let chars: Vec<char> = text.chars().collect();
    let mut segments: Vec<TemplateSegment> = Vec::new();
    // `pending` is where the not-yet-flushed text run starts; anything before
    // the next token (or the end) becomes one text segment.
    let mut pending = 0usize;
    let mut cursor = 0usize;
    while cursor < chars.len() {
        if chars[cursor] == '{'
            && cursor + 1 < chars.len()
            && chars[cursor + 1] == '{'
            && let Some((token, end)) = match_template_token(&chars, cursor)
        {
            if cursor > pending {
                segments.push(TemplateSegment::Text(
                    chars[pending..cursor].iter().collect(),
                ));
            }
            segments.push(TemplateSegment::Token {
                token,
                raw: chars[cursor..end].iter().collect(),
            });
            cursor = end;
            pending = end;
            continue;
        }
        cursor += 1;
    }
    if pending < chars.len() {
        segments.push(TemplateSegment::Text(chars[pending..].iter().collect()));
    }
    segments
}

/// Fold segments back into the template string (Vue: `serializeTemplate`) —
/// byte-exact by construction: text runs pass through, tokens re-emit `raw`.
pub fn serialize_template(segments: &[TemplateSegment]) -> String {
    let mut out = String::new();
    for segment in segments {
        out.push_str(segment.raw());
    }
    out
}

/// The canonical display spelling of a token name for chips and menus
/// (Vue: `formatTokenDisplay`, `md5_email` → `{{ md5_email }}`).
pub fn format_token_display(token: &str) -> String {
    format!("{{{{ {token} }}}}")
}

/// Build the `name -> description` lookup the renderer needs (Vue:
/// `templateTokenIndex`, last entry wins). A def without a usable description
/// still ENTERS the map with `None`, because map membership is also the
/// chip's known/unknown test (`data-unknown`).
pub fn template_token_index(defs: &[TemplateTokenDef]) -> HashMap<String, Option<String>> {
    let mut index: HashMap<String, Option<String>> = HashMap::new();
    for def in defs {
        let description = def
            .description
            .clone()
            .filter(|description| !description.is_empty());
        index.insert(def.name.clone(), description);
    }
    index
}

#[define_props]
pub struct TemplateTextProps {
    /// The raw template string, verbatim from storage (Vue: `content`,
    /// required there; `""` here parses to an empty shell).
    #[default]
    pub content: String,

    /// Vocabulary for descriptions / unknown marking. Optional (Vue default
    /// `[]`).
    pub tokens: Vec<TemplateTokenDef>,

    /// Wrap as a block (long URLs in narrow columns) instead of one inline run
    /// — the shell's `data-multiline`.
    #[default]
    pub multiline: bool,
}

#[component]
pub fn TemplateText(props: TemplateTextProps) -> Element {
    let segments = parse_template(&props.content);
    let index = template_token_index(&props.tokens);

    let mut nodes: Vec<VNode> = Vec::with_capacity(segments.len());
    for segment in segments {
        match segment {
            TemplateSegment::Text(text) => {
                nodes.push(rsx! {
                    span { class: "hk-template-text-run", "{text}" }
                });
            }
            TemplateSegment::Token { token, .. } => {
                // Vue: `data-unknown={index.has(token) ? undefined : ""}` and
                // `title={index.get(token)?.description || undefined}`.
                let known = index.contains_key(&token);
                let title = index.get(&token).cloned().flatten();
                let data_unknown = if known { None } else { Some(String::new()) };
                let display = format_token_display(&token);
                nodes.push(rsx! {
                    span {
                        class: "hk-tpl-chip",
                        "data-unknown": data_unknown,
                        "data-static": "",
                        title: title,
                        "{display}"
                    }
                });
            }
        }
    }

    // Vue: `data-multiline={props.multiline || undefined}`.
    let data_multiline = if props.multiline { Some("true") } else { None };

    rsx! {
        span { class: "hk-template-text", "data-multiline": data_multiline,
            {VNode::Fragment(nodes)}
        }
    }
}

impl StyledComponent for TemplateTextComponent {
    fn styles() -> &'static str {
        // HkTemplateText imports `./HkTemplateField.scss` (Vue ships no
        // HkTemplateText.scss): the chipped text's own rules
        // (`.hk-template-text`, `.hk-template-text-run`, `.hk-tpl-chip` and the
        // `[data-unknown]` face) live in that shared table, so the mirror
        // compiles the SAME vendored sheet. NOTE: a future HkTemplateField
        // mirror must agree on ONE registry name for this sheet, or the bundle
        // carries it twice (css_bundle concatenates per registration name).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTemplateField.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "template-text"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn token_segment(token: &str, raw: &str) -> TemplateSegment {
        TemplateSegment::Token {
            token: token.to_string(),
            raw: raw.to_string(),
        }
    }

    #[test]
    fn template_text_defaults_match_the_vue_props() {
        let props = TemplateTextProps::default();
        // Vue: `content` is required; the Rust prop takes the empty template.
        assert_eq!(props.content, "");
        assert!(props.tokens.is_empty());
        assert!(!props.multiline);
    }

    #[test]
    fn template_text_parses_the_grammar_exactly() {
        // Vue: `content: ""` → no segments.
        assert!(parse_template("").is_empty());

        // Lone text is one run.
        assert_eq!(
            parse_template("hello"),
            vec![TemplateSegment::Text("hello".to_string())]
        );

        // A token keeps its exact source text.
        assert_eq!(
            parse_template("a {{ md5_email }} b"),
            vec![
                TemplateSegment::Text("a ".to_string()),
                token_segment("md5_email", "{{ md5_email }}"),
                TemplateSegment::Text(" b".to_string()),
            ]
        );

        // Every spacing variant parses, and the raw spelling survives.
        for raw in ["{{name}}", "{{ name }}", "{{  name }}", "{{\tname\n}}"] {
            assert_eq!(
                parse_template(raw),
                vec![token_segment("name", raw)],
                "{raw:?} must parse to one token"
            );
        }

        // Identifiers are `[A-Za-z0-9_]` only — digits and underscores included.
        assert_eq!(
            parse_template("{{ a_1 }}"),
            vec![token_segment("a_1", "{{ a_1 }}")]
        );

        // Adjacent tokens produce no empty text run between them.
        assert_eq!(
            parse_template("{{a}}{{b}}"),
            vec![token_segment("a", "{{a}}"), token_segment("b", "{{b}}"),]
        );

        // Conservative grammar: anything else stays literal text — untouched
        // so a richer engine grammar is never silently rewritten.
        for literal in [
            "{{}}",            // no identifier
            "{{ a b }}",       // space inside the braces
            "{{ a.b }}",       // dotted path
            "{{ a | upper }}", // filter/pipe
            "{{a",             // unclosed
            "a}}",             // stray close
            "{ {a} }",         // split braces
        ] {
            assert_eq!(
                parse_template(literal),
                vec![TemplateSegment::Text(literal.to_string())],
                "{literal:?} must stay literal"
            );
        }
    }

    #[test]
    fn template_text_round_trips_byte_exactly() {
        for source in [
            "",
            "plain",
            "{{name}}",
            "{{ name }} tail",
            "{{a}}{{b}}",
            "前缀 {{ token_1 }} 后缀",
            "{{ a b }} {{c}}",
            "line1\nline2 {{x}}\r\n",
        ] {
            let segments = parse_template(source);
            assert_eq!(serialize_template(&segments), source, "{source:?}");
        }
    }

    #[test]
    fn template_text_display_spelling_is_canonical() {
        assert_eq!(format_token_display("md5_email"), "{{ md5_email }}");
        // `parse` keeps the source; the chip always shows the canonical form.
        assert_eq!(
            serialize_template(&parse_template("{{md5_email}}")),
            "{{md5_email}}"
        );
    }

    #[test]
    fn template_text_token_index_is_last_wins_and_membership_is_the_unknown_test() {
        let defs = vec![
            TemplateTokenDef {
                name: "email".to_string(),
                description: Some("first".to_string()),
                ..Default::default()
            },
            TemplateTokenDef {
                name: "email".to_string(),
                description: Some("Email address".to_string()),
                ..Default::default()
            },
            // A def with no description is still KNOWN (only the title is
            // absent) — Vue's `index.has(token)` drives `data-unknown`.
            TemplateTokenDef {
                name: "bare".to_string(),
                ..Default::default()
            },
            // An empty description behaves like none (Vue: `|| undefined`).
            TemplateTokenDef {
                name: "blank".to_string(),
                description: Some(String::new()),
                ..Default::default()
            },
        ];
        let index = template_token_index(&defs);
        assert_eq!(
            index.get("email").cloned().flatten(),
            Some("Email address".to_string())
        );
        assert!(index.contains_key("bare"));
        assert_eq!(index.get("bare").cloned().flatten(), None);
        assert_eq!(index.get("blank").cloned().flatten(), None);
        assert!(!index.contains_key("unknown"));
    }

    #[test]
    fn template_text_whitespace_set_matches_javascript() {
        for ch in [
            ' ', '\t', '\n', '\r', '\u{000B}', '\u{000C}', '\u{00A0}', '\u{3000}',
        ] {
            assert!(is_template_whitespace(ch), "{ch:?} is JS whitespace");
        }
        for ch in ['a', '_', '0', '{', '}', '\u{200B}'] {
            assert!(!is_template_whitespace(ch), "{ch:?} is not JS whitespace");
        }
    }

    #[test]
    fn template_text_renders_the_vue_dom_contract() {
        let html = TemplateText(TemplateTextProps {
            content: "Hi {{ email }}!".to_string(),
            tokens: vec![TemplateTokenDef {
                name: "email".to_string(),
                description: Some("Email address".to_string()),
                ..Default::default()
            }],
            multiline: true,
        })
        .render_to_html();
        // The shell carries the block marker, the run and chip the segment
        // classes, and the chip its canonical display spelling plus the
        // vocabulary description as `title`.
        assert!(html.contains(r#"class="hk-template-text""#), "{html}");
        assert!(html.contains(r#"data-multiline="true""#), "{html}");
        assert!(html.contains(r#"class="hk-template-text-run""#), "{html}");
        assert!(html.contains(">Hi <"), "{html}");
        assert!(html.contains(r#"class="hk-tpl-chip""#), "{html}");
        assert!(html.contains(r#"title="Email address""#), "{html}");
        assert!(html.contains("{{ email }}"), "{html}");
        assert!(html.contains(r#"data-static="""#), "{html}");
        // A KNOWN token carries no `data-unknown` marker.
        assert!(!html.contains("data-unknown"), "{html}");

        // An unknown token is marked instead of hidden, exactly Vue's
        // `data-unknown=""`.
        let html = TemplateText(TemplateTextProps {
            content: "{{ mystery }}".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"data-unknown="""#), "{html}");
        assert!(!html.contains(r#"data-multiline"#), "{html}");
    }

    #[test]
    fn template_text_styles_come_from_the_canonical_vue_sheet() {
        let css = TemplateTextComponent::styles();
        for class in [".hk-template-text", ".hk-template-text-run", ".hk-tpl-chip"] {
            assert!(
                css.contains(class),
                "template-text css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored template sheet"
        );
    }
}
