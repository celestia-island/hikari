// hi-components/src/display/json_tree.rs
// JsonTree — mirror of the canonical Vue `HkJsonTree`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkJsonTree.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.s-tool-json-tree` / `.s-jt-*` / `.s-jv-*` class names are literal and
// identical in both forms. DOM contract (Vue's render output):
//
//   div.s-tool-json-tree [+class] role="tree" [aria-label]
//     leaf row:      div.s-jt-row  (style: padding-left)
//                      span.s-jt-toggle > span.s-jt-leaf
//                      span.s-jt-key  span.s-jt-colon
//                      span.s-jv-{null|bool|num|str}   span.s-jt-type
//     collapsed:     div.s-jt-row[data-parent]  (style: padding-left)
//                      span.s-jt-toggle[data-parent] > chevron
//                      span.s-jt-key  span.s-jt-colon
//                      span.s-jt-indent  span.s-jt-preview
//     expanded:      div.s-jt-group
//                      div.s-jt-row[data-parent] … span.s-jt-badge.is-open
//                      div.s-jt-children  (style: --guide-left)
//                        …child rows
//     long string:   collapsed → span.s-jv-str.s-jt-clamp + "string (n)"
//                    expanded  → group + badge "string (n)" and one
//                                span.s-jv-str-raw row per line
//
// Delta vs Vue (documented):
//
//   * NO `serde_json` in this crate (the dependency list is deliberately
//     small and this wave may not add crates), so [`json_parse`] is a
//     self-contained RFC 8259 reader: objects / arrays / strings (all
//     escapes incl. `\uXXXX` surrogate pairs) / numbers / `true|false|null`,
//     a 128-level nesting cap, and a `char`-indexed error offset.
//     Recognised divergences from `JSON.parse`:
//       - numbers are the run of `[0-9+-.eE]` handed to `f64::from_str`, so
//         non-strict spellings (`1.`, `+1`) are ACCEPTED, and an overflow
//         (`1e999`) is an ERROR where `JSON.parse` yields `Infinity`;
//       - duplicate object keys are kept in source order (a `Vec` pair
//         list) where `JSON.parse` keeps the last value and reorders
//         integer-like keys first;
//       - [`json_truncate`] counts `char`s where Vue's `truncateStr` counts
//         UTF-16 code units.
//   * `value` takes an already-parsed [`JsonValue`] (Vue accepts any JS
//     value); `text` is parsed with Vue's `tryParseJson` semantics —
//     containers only, silently empty otherwise.
//   * Folding is a controlled prop (`expanded`, Vue keeps a `Set` in a
//     ref). `None` reproduces Vue's initial set (root + direct children);
//     a toggle is reported through `on_toggle` with the node id.
//   * The copy affordance fires `on_copy` with the raw JSON instead of
//     touching the clipboard (no such API on wasm32-wasip2). Forged text
//     is the input; a `value` input is serialised COMPACTLY by
//     [`json_serialize`] (`JSON.stringify(value, null, 2)` in Vue).
//   * Every string reaching the DOM is a text node (tairitsu escapes text
//     children), and no `dangerous_inner_html` host exists in this file —
//     a JSON payload cannot inject markup.

// The parser/mirror branches keep Vue's nesting for readability; clippy's
// collapsible-if rewrite makes the token loops harder to compare line by line.
#![allow(clippy::collapsible_if)]
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct JsonTreeComponent;

/// Vue: `STR_PREVIEW_LEN` — longer strings become collapsible.
pub const JSON_STR_PREVIEW_LEN: usize = 72;
/// Vue: the `truncateStr(s, 20)` step of an inline preview.
pub const JSON_INLINE_STR_LEN: usize = 20;
/// Vue: `slice(0, 3)` in the container preview.
pub const JSON_PREVIEW_ITEMS: usize = 3;
/// Vue props `maxDepth` default.
pub const JSON_TREE_MAX_DEPTH: usize = 8;
/// Vue: `JT_INDENT` / `JT_TOGGLE` — one depth step.
pub const JSON_TREE_INDENT: usize = 14;
/// Vue: `JT_GUIDE_OFFSET` — where the child guide rule sits.
pub const JSON_TREE_GUIDE_OFFSET: usize = JSON_TREE_INDENT / 2;
/// Nesting cap for the reader (not a Vue concept: a defensive bound).
const JSON_PARSE_MAX_DEPTH: usize = 128;

/// A parsed JSON value. Object entries keep their source order (see the
/// header note on the `JSON.parse` divergences).
#[derive(Clone, Debug, PartialEq)]
pub enum JsonValue {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<JsonValue>),
    Object(Vec<(String, JsonValue)>),
}

impl JsonValue {
    pub fn is_container(&self) -> bool {
        matches!(self, JsonValue::Array(_) | JsonValue::Object(_))
    }
}

/// One parse failure. `offset` is a CHARACTER index, not a byte offset.
#[derive(Clone, Debug, PartialEq)]
pub struct JsonParseError {
    pub message: String,
    pub offset: usize,
}

struct JsonParser {
    chars: Vec<char>,
    pos: usize,
    depth: usize,
}

impl JsonParser {
    fn new(source: &str) -> Self {
        Self {
            chars: source.chars().collect(),
            pos: 0,
            depth: 0,
        }
    }

    fn peek(&self) -> Option<char> {
        self.chars.get(self.pos).copied()
    }

    fn bump(&mut self) -> Option<char> {
        let ch = self.peek();
        if ch.is_some() {
            self.pos += 1;
        }
        ch
    }

    fn skip_ws(&mut self) {
        while matches!(self.peek(), Some(' ' | '\t' | '\n' | '\r')) {
            self.pos += 1;
        }
    }

    fn err(&self, message: &str) -> JsonParseError {
        JsonParseError {
            message: message.to_string(),
            offset: self.pos,
        }
    }

    fn parse_value(&mut self) -> Result<JsonValue, JsonParseError> {
        self.skip_ws();
        match self.peek() {
            None => Err(self.err("unexpected end of input")),
            Some('{') => self.parse_object(),
            Some('[') => self.parse_array(),
            Some('"') => Ok(JsonValue::String(self.parse_string()?)),
            Some('t') => {
                self.expect_literal("true")?;
                Ok(JsonValue::Bool(true))
            }
            Some('f') => {
                self.expect_literal("false")?;
                Ok(JsonValue::Bool(false))
            }
            Some('n') => {
                self.expect_literal("null")?;
                Ok(JsonValue::Null)
            }
            Some(ch) if ch == '-' || ch.is_ascii_digit() => self.parse_number(),
            Some(_) => Err(self.err("unexpected character")),
        }
    }

    fn expect_literal(&mut self, literal: &str) -> Result<(), JsonParseError> {
        for want in literal.chars() {
            if self.bump() != Some(want) {
                return Err(self.err("invalid literal"));
            }
        }
        Ok(())
    }

    fn parse_object(&mut self) -> Result<JsonValue, JsonParseError> {
        self.depth += 1;
        if self.depth > JSON_PARSE_MAX_DEPTH {
            return Err(self.err("nesting too deep"));
        }
        self.pos += 1; // '{'
        let mut entries: Vec<(String, JsonValue)> = Vec::new();
        self.skip_ws();
        if self.peek() == Some('}') {
            self.pos += 1;
            self.depth -= 1;
            return Ok(JsonValue::Object(entries));
        }
        loop {
            self.skip_ws();
            if self.peek() != Some('"') {
                return Err(self.err("expected an object key"));
            }
            let key = self.parse_string()?;
            self.skip_ws();
            if self.bump() != Some(':') {
                return Err(self.err("expected ':'"));
            }
            let value = self.parse_value()?;
            entries.push((key, value));
            self.skip_ws();
            match self.bump() {
                Some(',') => continue,
                Some('}') => break,
                _ => return Err(self.err("expected ',' or '}'")),
            }
        }
        self.depth -= 1;
        Ok(JsonValue::Object(entries))
    }

    fn parse_array(&mut self) -> Result<JsonValue, JsonParseError> {
        self.depth += 1;
        if self.depth > JSON_PARSE_MAX_DEPTH {
            return Err(self.err("nesting too deep"));
        }
        self.pos += 1; // '['
        let mut items: Vec<JsonValue> = Vec::new();
        self.skip_ws();
        if self.peek() == Some(']') {
            self.pos += 1;
            self.depth -= 1;
            return Ok(JsonValue::Array(items));
        }
        loop {
            items.push(self.parse_value()?);
            self.skip_ws();
            match self.bump() {
                Some(',') => continue,
                Some(']') => break,
                _ => return Err(self.err("expected ',' or ']'")),
            }
        }
        self.depth -= 1;
        Ok(JsonValue::Array(items))
    }

    fn parse_string(&mut self) -> Result<String, JsonParseError> {
        self.pos += 1; // the caller checked '"'
        let mut out = String::new();
        loop {
            match self.bump() {
                None => return Err(self.err("unterminated string")),
                Some('"') => return Ok(out),
                Some('\\') => match self.bump() {
                    None => return Err(self.err("unterminated escape")),
                    Some('"') => out.push('"'),
                    Some('\\') => out.push('\\'),
                    Some('/') => out.push('/'),
                    Some('b') => out.push('\u{8}'),
                    Some('f') => out.push('\u{c}'),
                    Some('n') => out.push('\n'),
                    Some('r') => out.push('\r'),
                    Some('t') => out.push('\t'),
                    Some('u') => {
                        let high = self.parse_hex4()?;
                        if (0xd800..=0xdbff).contains(&high) {
                            if self.bump() != Some('\\') || self.bump() != Some('u') {
                                return Err(self.err("unpaired surrogate"));
                            }
                            let low = self.parse_hex4()?;
                            if !(0xdc00..=0xdfff).contains(&low) {
                                return Err(self.err("invalid surrogate pair"));
                            }
                            let code = 0x10000 + ((high - 0xd800) << 10) + (low - 0xdc00);
                            out.push(char::from_u32(code).unwrap_or('\u{fffd}'));
                        } else if (0xdc00..=0xdfff).contains(&high) {
                            return Err(self.err("unpaired surrogate"));
                        } else {
                            out.push(char::from_u32(high).unwrap_or('\u{fffd}'));
                        }
                    }
                    Some(_) => return Err(self.err("invalid escape")),
                },
                Some(ch) => out.push(ch),
            }
        }
    }

    fn parse_hex4(&mut self) -> Result<u32, JsonParseError> {
        let mut value: u32 = 0;
        for _ in 0..4 {
            let ch = match self.bump() {
                Some(ch) => ch,
                None => return Err(self.err("truncated \\u escape")),
            };
            let digit = match ch.to_digit(16) {
                Some(digit) => digit,
                None => return Err(self.err("invalid hex digit")),
            };
            value = value * 16 + digit;
        }
        Ok(value)
    }

    fn parse_number(&mut self) -> Result<JsonValue, JsonParseError> {
        let start = self.pos;
        while let Some(ch) = self.peek() {
            if ch.is_ascii_digit() || matches!(ch, '-' | '+' | '.' | 'e' | 'E') {
                self.pos += 1;
            } else {
                break;
            }
        }
        let raw: String = self.chars[start..self.pos].iter().collect();
        match raw.parse::<f64>() {
            Ok(number) if number.is_finite() => Ok(JsonValue::Number(number)),
            _ => Err(self.err("invalid number")),
        }
    }
}

/// Parse JSON text (Vue: `JSON.parse`; see the header's divergence list).
pub fn json_parse(source: &str) -> Result<JsonValue, JsonParseError> {
    let mut parser = JsonParser::new(source);
    let value = parser.parse_value()?;
    parser.skip_ws();
    if parser.pos != parser.chars.len() {
        return Err(parser.err("trailing characters"));
    }
    Ok(value)
}

/// Vue's `tryParseJson`: containers only, `None` on primitives or bad text.
pub fn json_try_parse_container(source: &str) -> Option<JsonValue> {
    match json_parse(source) {
        Ok(value) if value.is_container() => Some(value),
        _ => None,
    }
}

/// JS `String(number)`-compatible rendering for the tree rows.
pub fn json_number_text(value: f64) -> String {
    if !value.is_finite() || value == 0.0 {
        return "0".to_string();
    }
    let abs = value.abs();
    if abs < 1e21 && abs.fract() == 0.0 && abs <= 9_007_199_254_740_992.0 {
        return format!("{}", value as i64);
    }
    format!("{value}")
}

/// `JSON.stringify(string)` — the quoted literal a string row shows.
pub fn json_string_literal(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 2);
    out.push('"');
    for ch in value.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn json_write_value(value: &JsonValue, out: &mut String) {
    match value {
        JsonValue::Null => out.push_str("null"),
        JsonValue::Bool(flag) => out.push_str(if *flag { "true" } else { "false" }),
        JsonValue::Number(number) => out.push_str(&json_number_text(*number)),
        JsonValue::String(text) => out.push_str(&json_string_literal(text)),
        JsonValue::Array(items) => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                json_write_value(item, out);
            }
            out.push(']');
        }
        JsonValue::Object(entries) => {
            out.push('{');
            for (index, (key, item)) in entries.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                out.push_str(&json_string_literal(key));
                out.push(':');
                json_write_value(item, out);
            }
            out.push('}');
        }
    }
}

/// Compact JSON serialisation (the copy payload for a `value` input).
pub fn json_serialize(value: &JsonValue) -> String {
    let mut out = String::new();
    json_write_value(value, &mut out);
    out
}

/// Vue: `truncateStr` — keep `max` characters, append an ellipsis.
pub fn json_truncate(value: &str, max: usize) -> String {
    if value.chars().count() <= max {
        return value.to_string();
    }
    let mut out: String = value.chars().take(max).collect();
    out.push('…');
    out
}

/// Vue: `jsonInlineValue` — the compact form inside a preview.
pub fn json_inline_value(value: &JsonValue) -> String {
    match value {
        JsonValue::Null => "null".to_string(),
        JsonValue::Bool(flag) => flag.to_string(),
        JsonValue::Number(number) => json_number_text(*number),
        JsonValue::String(text) => format!("\"{}\"", json_truncate(text, JSON_INLINE_STR_LEN)),
        JsonValue::Array(items) => format!("Array({})", items.len()),
        JsonValue::Object(entries) => format!("{{{}}}", entries.len()),
    }
}

/// Vue: `buildObjectPreview` — first three entries plus an ellipsis.
pub fn json_object_preview(value: &JsonValue) -> String {
    match value {
        JsonValue::Array(items) => {
            let parts: Vec<String> = items
                .iter()
                .take(JSON_PREVIEW_ITEMS)
                .map(json_inline_value)
                .collect();
            let suffix = if items.len() > JSON_PREVIEW_ITEMS {
                ", …"
            } else {
                ""
            };
            format!("[{}{}]", parts.join(", "), suffix)
        }
        JsonValue::Object(entries) => {
            let parts: Vec<String> = entries
                .iter()
                .take(JSON_PREVIEW_ITEMS)
                .map(|(key, item)| format!("{key}: {}", json_inline_value(item)))
                .collect();
            let suffix = if entries.len() > JSON_PREVIEW_ITEMS {
                ", …"
            } else {
                ""
            };
            format!("{{{}{}}}", parts.join(", "), suffix)
        }
        _ => String::new(),
    }
}

/// One rendered tree node — the Vue `HJsonNode` render model, minus the raw
/// sub-value (the mirror precomputes the row text instead of retaining the
/// whole subtree at every depth).
#[derive(Clone, Debug, PartialEq)]
pub struct JsonNode {
    pub id: usize,
    pub key: Option<String>,
    pub depth: usize,
    pub is_container: bool,
    pub is_array: bool,
    pub is_long_string: bool,
    pub child_count: usize,
    /// The raw string content (the long-string pager splits it on newlines).
    pub string_value: String,
    /// The collapsed container summary.
    pub preview: String,
    /// The leaf text: `null` / `true` / `42` / `"quoted"`.
    pub text: String,
    /// The type hint Vue prints next to a leaf (`null`/`boolean`/…).
    pub type_label: &'static str,
    /// The leaf value class (`s-jv-null`/`s-jv-bool`/`s-jv-num`/`s-jv-str`).
    pub value_class: &'static str,
    pub children: Vec<JsonNode>,
}

fn json_build_node(
    value: &JsonValue,
    key: Option<String>,
    depth: usize,
    max_depth: usize,
    next_id: &mut usize,
) -> JsonNode {
    let is_container = value.is_container();
    let is_array = matches!(value, JsonValue::Array(_));
    let string_value = match value {
        JsonValue::String(text) => text.clone(),
        _ => String::new(),
    };
    let is_long_string =
        matches!(value, JsonValue::String(text) if text.chars().count() > JSON_STR_PREVIEW_LEN);
    let (text, type_label, value_class) = match value {
        JsonValue::Null => ("null".to_string(), "null", "s-jv-null"),
        JsonValue::Bool(flag) => (flag.to_string(), "boolean", "s-jv-bool"),
        JsonValue::Number(number) => (json_number_text(*number), "number", "s-jv-num"),
        JsonValue::String(content) => (json_string_literal(content), "string", "s-jv-str"),
        _ => (String::new(), "", ""),
    };

    let mut children: Vec<JsonNode> = Vec::new();
    let mut child_count = 0usize;
    let mut preview = String::new();
    if is_container {
        let entries: Vec<(String, &JsonValue)> = match value {
            JsonValue::Array(items) => items
                .iter()
                .enumerate()
                .map(|(index, item)| (index.to_string(), item))
                .collect(),
            JsonValue::Object(entries) => entries
                .iter()
                .map(|(entry_key, item)| (entry_key.clone(), item))
                .collect(),
            _ => Vec::new(),
        };
        child_count = entries.len();
        preview = json_object_preview(value);
        if depth < max_depth {
            for (child_key, child_value) in entries {
                children.push(json_build_node(
                    child_value,
                    Some(child_key),
                    depth + 1,
                    max_depth,
                    next_id,
                ));
            }
        }
    }

    // Vue numbers the nodes AFTER recursing (post-order).
    let id = *next_id;
    *next_id += 1;
    JsonNode {
        id,
        key,
        depth,
        is_container,
        is_array,
        is_long_string,
        child_count,
        string_value,
        preview,
        text,
        type_label,
        value_class,
        children,
    }
}

/// Vue: `buildJsonTree` — `None` when the value is not a container.
pub fn json_tree(value: &JsonValue, max_depth: usize) -> Option<JsonNode> {
    if !value.is_container() {
        return None;
    }
    let mut next_id = 0usize;
    Some(json_build_node(value, None, 0, max_depth, &mut next_id))
}

/// Vue: `initialExpandedSet` — the root plus its direct children.
pub fn json_initial_expanded(root: &JsonNode) -> Vec<usize> {
    let mut ids = Vec::with_capacity(root.children.len() + 1);
    ids.push(root.id);
    for child in &root.children {
        ids.push(child.id);
    }
    ids
}

fn json_collect_visible(node: &JsonNode, expanded: &[usize], out: &mut Vec<usize>) {
    out.push(node.id);
    if !node.is_container || !expanded.contains(&node.id) {
        return;
    }
    for child in &node.children {
        json_collect_visible(child, expanded, out);
    }
}

/// The node rows that render for a fold state (a long string's paged lines
/// carry no node id and are not counted here).
pub fn json_visible_rows(root: &JsonNode, expanded: &[usize]) -> Vec<usize> {
    let mut out = Vec::new();
    json_collect_visible(root, expanded, &mut out);
    out
}

#[define_props]
pub struct JsonTreeProps {
    /// Raw JSON text, parsed internally (containers only).
    #[default]
    pub text: String,

    /// Pre-parsed value; takes precedence over `text` (Vue: `value`).
    pub value: Option<JsonValue>,

    /// Child depth to build (Vue default 8).
    #[default(JSON_TREE_MAX_DEPTH)]
    pub max_depth: usize,

    /// Controlled expansion set; `None` uses Vue's initial set.
    pub expanded: Option<Vec<usize>>,

    /// Accessible name for the tree role.
    pub aria_label: Option<String>,

    /// A parent row was clicked (its node id).
    pub on_toggle: Option<EventHandler<usize>>,

    /// A leaf row was clicked (the raw JSON text).
    pub on_copy: Option<EventHandler<String>>,

    #[default]
    pub class: String,
}

struct JsonRenderContext<'a> {
    expanded: &'a [usize],
    on_toggle: &'a Option<EventHandler<usize>>,
    on_copy: &'a Option<EventHandler<String>>,
    copy_text: &'a str,
}

fn json_key_nodes(node: &JsonNode, children: &mut Vec<VNode>) {
    if let Some(key) = &node.key {
        children.push(VNode::Element(Box::new(
            VElement::new("span")
                .class("s-jt-key")
                .child(VNode::Text(VText::new(key))),
        )));
        children.push(VNode::Element(Box::new(
            VElement::new("span")
                .class("s-jt-colon")
                .child(VNode::Text(VText::new(": "))),
        )));
    }
}

fn json_toggle_node(is_parent: bool, is_open: bool) -> VNode {
    let mut toggle = VElement::new("span").class("s-jt-toggle");
    if is_parent {
        let icon = if is_open {
            MdiIcon::ChevronDown
        } else {
            MdiIcon::ChevronRight
        };
        toggle = toggle
            .attr("data-parent", "")
            .child(rsx! { Icon { icon, size: 10 } });
    } else {
        toggle = toggle.child(rsx! { span { class: "s-jt-leaf" } });
    }
    VNode::Element(Box::new(toggle))
}

fn json_text_node(class: &str, text: &str) -> VNode {
    VNode::Element(Box::new(
        VElement::new("span")
            .class(class)
            .child(VNode::Text(VText::new(text))),
    ))
}

fn json_attach_toggle(
    row: VElement,
    id: usize,
    on_toggle: &Option<EventHandler<usize>>,
) -> VElement {
    let handler = on_toggle.clone();
    row.on_click(move |_: MouseEvent| {
        if let Some(handler) = &handler {
            handler.call(id);
        }
    })
}

fn json_attach_copy(
    row: VElement,
    on_copy: &Option<EventHandler<String>>,
    copy_text: &str,
) -> VElement {
    let handler = on_copy.clone();
    let payload = copy_text.to_string();
    row.on_click(move |_: MouseEvent| {
        if let Some(handler) = &handler {
            handler.call(payload.clone());
        }
    })
}

fn json_long_string_length(node: &JsonNode) -> usize {
    node.string_value.chars().count()
}

fn render_json_node(node: &JsonNode, context: &JsonRenderContext<'_>) -> VNode {
    let indent = node.depth * JSON_TREE_INDENT;
    let is_open = context.expanded.contains(&node.id);

    // ── containers ──────────────────────────────────────────────────────
    if node.is_container {
        let badge_text = if node.is_array {
            format!("Array({})", node.child_count)
        } else {
            format!("{{{}}}", node.child_count)
        };
        if !is_open {
            let mut children: Vec<VNode> = Vec::new();
            children.push(json_toggle_node(true, false));
            json_key_nodes(node, &mut children);
            children.push(VNode::Element(Box::new(
                VElement::new("span").class("s-jt-indent"),
            )));
            children.push(json_text_node("s-jt-preview", &node.preview));
            let row = VElement::new("div")
                .class("s-jt-row")
                .attr("data-parent", "")
                .style(format!("padding-left:{indent}px"))
                .children(children);
            return VNode::Element(Box::new(json_attach_toggle(
                row,
                node.id,
                context.on_toggle,
            )));
        }

        let mut head_children: Vec<VNode> = Vec::new();
        head_children.push(json_toggle_node(true, true));
        json_key_nodes(node, &mut head_children);
        head_children.push(json_text_node("s-jt-badge is-open", &badge_text));
        let head = VElement::new("div")
            .class("s-jt-row")
            .attr("data-parent", "")
            .style(format!("padding-left:{indent}px"))
            .children(head_children);

        let mut rows: Vec<VNode> = Vec::with_capacity(node.children.len());
        for child in &node.children {
            rows.push(render_json_node(child, context));
        }
        let body = VElement::new("div")
            .class("s-jt-children")
            .style(format!(
                "--guide-left:{}px",
                indent + JSON_TREE_GUIDE_OFFSET
            ))
            .children(rows);
        let group = VElement::new("div")
            .class("s-jt-group")
            .child(VNode::Element(Box::new(json_attach_toggle(
                head,
                node.id,
                context.on_toggle,
            ))))
            .child(VNode::Element(Box::new(body)));
        return VNode::Element(Box::new(group));
    }

    // ── long strings get their own pager ────────────────────────────────
    if node.is_long_string {
        let length_label = format!("string ({})", json_long_string_length(node));
        if !is_open {
            let mut children: Vec<VNode> = Vec::new();
            children.push(json_toggle_node(true, false));
            json_key_nodes(node, &mut children);
            children.push(VNode::Element(Box::new(
                VElement::new("span").class("s-jt-indent"),
            )));
            children.push(json_text_node(
                "s-jv-str s-jt-clamp",
                &format!(
                    "\"{}\"",
                    json_truncate(&node.string_value, JSON_STR_PREVIEW_LEN)
                ),
            ));
            children.push(json_text_node("s-jt-type", &length_label));
            let row = VElement::new("div")
                .class("s-jt-row")
                .attr("data-parent", "")
                .style(format!("padding-left:{indent}px"))
                .children(children);
            return VNode::Element(Box::new(json_attach_toggle(
                row,
                node.id,
                context.on_toggle,
            )));
        }

        let mut head_children: Vec<VNode> = Vec::new();
        head_children.push(json_toggle_node(true, true));
        json_key_nodes(node, &mut head_children);
        head_children.push(json_text_node("s-jt-badge is-open", &length_label));
        let head = VElement::new("div")
            .class("s-jt-row")
            .attr("data-parent", "")
            .style(format!("padding-left:{indent}px"))
            .children(head_children);

        let mut line_nodes: Vec<VNode> = Vec::new();
        for line in node.string_value.split('\n') {
            // Vue renders an empty line as a single space so the row keeps
            // its line box.
            let text = if line.is_empty() { " " } else { line };
            let children: Vec<VNode> = vec![
                json_toggle_node(false, false),
                json_text_node("s-jv-str-raw", text),
            ];
            let row = VElement::new("div")
                .class("s-jt-row")
                .style(format!(
                    "padding-left:{}px",
                    (node.depth + 1) * JSON_TREE_INDENT
                ))
                .children(children);
            line_nodes.push(VNode::Element(Box::new(json_attach_copy(
                row,
                context.on_copy,
                context.copy_text,
            ))));
        }
        let body = VElement::new("div")
            .class("s-jt-children")
            .style(format!(
                "--guide-left:{}px",
                indent + JSON_TREE_GUIDE_OFFSET
            ))
            .children(line_nodes);
        let group = VElement::new("div")
            .class("s-jt-group")
            .child(VNode::Element(Box::new(json_attach_toggle(
                head,
                node.id,
                context.on_toggle,
            ))))
            .child(VNode::Element(Box::new(body)));
        return VNode::Element(Box::new(group));
    }

    // ── leaves ──────────────────────────────────────────────────────────
    let mut children: Vec<VNode> = vec![json_toggle_node(false, false)];
    json_key_nodes(node, &mut children);
    children.push(json_text_node(node.value_class, &node.text));
    children.push(json_text_node("s-jt-type", node.type_label));
    let row = VElement::new("div")
        .class("s-jt-row")
        .style(format!("padding-left:{indent}px"))
        .children(children);
    VNode::Element(Box::new(json_attach_copy(
        row,
        context.on_copy,
        context.copy_text,
    )))
}

#[component]
pub fn JsonTree(props: JsonTreeProps) -> Element {
    let parsed = match &props.value {
        Some(value) => Some(value.clone()),
        None => {
            if props.text.is_empty() {
                None
            } else {
                json_try_parse_container(&props.text)
            }
        }
    };
    let root = match parsed
        .as_ref()
        .and_then(|value| json_tree(value, props.max_depth))
    {
        Some(root) => root,
        None => return empty_vnode(),
    };
    let expanded = match &props.expanded {
        Some(ids) => ids.clone(),
        None => json_initial_expanded(&root),
    };
    let copy_text = match (&props.value, props.text.is_empty()) {
        (Some(value), _) => json_serialize(value),
        (None, false) => props.text.clone(),
        (None, true) => String::new(),
    };

    let context = JsonRenderContext {
        expanded: &expanded,
        on_toggle: &props.on_toggle,
        on_copy: &props.on_copy,
        copy_text: &copy_text,
    };
    let body = render_json_node(&root, &context);

    let mut root_classes = String::from("s-tool-json-tree");
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }
    let mut element = VElement::new("div")
        .class(root_classes)
        .attr("role", "tree")
        .child(body);
    if let Some(label) = props.aria_label.clone() {
        if !label.is_empty() {
            element = element.attr("aria-label", label);
        }
    }
    VNode::Element(Box::new(element))
}

impl StyledComponent for JsonTreeComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkJsonTree.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "json-tree"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_root() -> JsonNode {
        let value = json_parse(r#"{"a": [1, 2, 3, 4, 5], "b": "x"}"#).unwrap();
        json_tree(&value, JSON_TREE_MAX_DEPTH).unwrap()
    }

    #[test]
    fn json_tree_defaults_match_the_vue_props() {
        let props = JsonTreeProps::default();
        assert_eq!(props.text, "");
        assert!(props.value.is_none());
        assert_eq!(props.max_depth, 8);
        assert!(props.expanded.is_none());
        assert!(props.aria_label.is_none());
        assert!(props.on_toggle.is_none());
        assert!(props.on_copy.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn parse_reads_nested_containers() {
        let value = json_parse(r#"{"a": [1, 2], "b": {"c": null}, "d": true}"#).unwrap();
        match value {
            JsonValue::Object(entries) => {
                assert_eq!(entries.len(), 3);
                assert_eq!(entries[0].0, "a");
                assert_eq!(
                    entries[0].1,
                    JsonValue::Array(vec![JsonValue::Number(1.0), JsonValue::Number(2.0)])
                );
                assert_eq!(entries[2].1, JsonValue::Bool(true));
            }
            other => panic!("expected an object, got {:?}", other),
        }
        assert_eq!(json_parse(" [ ] ").unwrap(), JsonValue::Array(vec![]));
    }

    #[test]
    fn parse_handles_escapes_and_surrogate_pairs() {
        assert_eq!(
            json_parse(r#""a\"b\\c\/d\ne""#).unwrap(),
            JsonValue::String("a\"b\\c/d\ne".to_string())
        );
        assert_eq!(
            json_parse(r#""\uD83D\uDE00""#).unwrap(),
            JsonValue::String("😀".to_string())
        );
        assert_eq!(
            json_parse(r#""\u00e9""#).unwrap(),
            JsonValue::String("é".to_string())
        );
    }

    #[test]
    fn parse_rejects_malformed_text() {
        assert!(json_parse("").is_err());
        assert!(json_parse("{").is_err());
        assert!(json_parse("[1,]").is_err());
        assert!(json_parse("{\"a\" 1}").is_err());
        assert!(json_parse("nope").is_err());
        assert!(json_parse("{} trailing").is_err());
        assert!(json_parse(r#""\uD83D""#).is_err());
        assert!(json_parse("1e999").is_err());
        assert!(json_try_parse_container("42").is_none());
        assert!(json_try_parse_container("").is_none());
        assert!(json_try_parse_container("{}").is_some());
    }

    #[test]
    fn number_text_matches_js_string_conversion() {
        assert_eq!(json_number_text(1.0), "1");
        assert_eq!(json_number_text(1.5), "1.5");
        assert_eq!(json_number_text(-0.0), "0");
        assert_eq!(json_number_text(-2.0), "-2");
        assert_eq!(json_number_text(1.0e-7), "0.0000001");
    }

    #[test]
    fn string_literal_and_serialize_round_trip() {
        assert_eq!(json_string_literal("a\"b\n"), "\"a\\\"b\\n\"");
        assert_eq!(json_string_literal("tab\there"), "\"tab\\there\"");
        assert_eq!(json_string_literal("\u{1}"), "\"\\u0001\"");
        assert_eq!(json_string_literal("plain"), "\"plain\"");
        let value = json_parse(r#"{"a": [1, true, null], "b": "x"}"#).unwrap();
        assert_eq!(json_serialize(&value), r#"{"a":[1,true,null],"b":"x"}"#);
        assert_eq!(json_serialize(&json_parse("[]").unwrap()), "[]");
    }

    #[test]
    fn tree_skips_primitives_and_builds_containers() {
        let scalar = json_parse("42").unwrap();
        assert!(json_tree(&scalar, JSON_TREE_MAX_DEPTH).is_none());
        let root = sample_root();
        assert!(root.is_container);
        assert!(!root.is_array);
        assert_eq!(root.key, None);
        assert_eq!(root.depth, 0);
        assert_eq!(root.child_count, 2);
        assert_eq!(root.children.len(), 2);
        assert_eq!(root.children[0].key.as_deref(), Some("a"));
        assert!(root.children[0].is_array);
        assert_eq!(root.children[0].children.len(), 5);
        assert_eq!(root.children[1].type_label, "string");
        assert_eq!(root.children[1].text, "\"x\"");
        assert_eq!(root.children[1].value_class, "s-jv-str");
        assert_eq!(root.children[1].depth, 1);
    }

    #[test]
    fn tree_honours_max_depth_and_long_strings() {
        let deep = json_parse(r#"{"a": {"b": {"c": 1}}}"#).unwrap();
        let shallow = json_tree(&deep, 0).unwrap();
        assert_eq!(shallow.children.len(), 0);
        assert_eq!(shallow.child_count, 1);

        let long = "x".repeat(JSON_STR_PREVIEW_LEN + 1);
        let parsed = json_parse(&format!(r#"{{"s": "{long}"}}"#)).unwrap();
        let root = json_tree(&parsed, JSON_TREE_MAX_DEPTH).unwrap();
        assert!(root.children[0].is_long_string);
        assert_eq!(root.children[0].string_value.chars().count(), long.len());
        assert_eq!(
            json_truncate(&root.children[0].string_value, JSON_STR_PREVIEW_LEN),
            format!("{}…", "x".repeat(JSON_STR_PREVIEW_LEN))
        );

        let short = "y".repeat(JSON_STR_PREVIEW_LEN);
        let parsed = json_parse(&format!(r#"{{"s": "{short}"}}"#)).unwrap();
        let root = json_tree(&parsed, JSON_TREE_MAX_DEPTH).unwrap();
        assert!(!root.children[0].is_long_string);
    }

    #[test]
    fn previews_elide_past_three_entries() {
        assert_eq!(
            json_object_preview(&json_parse("[1, 2, 3]").unwrap()),
            "[1, 2, 3]"
        );
        assert_eq!(
            json_object_preview(&json_parse("[1, 2, 3, 4, 5]").unwrap()),
            "[1, 2, 3, …]"
        );
        assert_eq!(
            json_object_preview(&json_parse(r#"{"a": 1, "b": true}"#).unwrap()),
            "{a: 1, b: true}"
        );
        assert_eq!(
            json_object_preview(&json_parse(r#"{"a": 1, "b": 2, "c": 3, "d": 4}"#).unwrap()),
            "{a: 1, b: 2, c: 3, …}"
        );
        assert_eq!(
            json_inline_value(&json_parse(r#""abcdefghijklmnopqrstuvwxyz""#).unwrap()),
            "\"abcdefghijklmnopqrst…\""
        );
    }

    #[test]
    fn initial_expansion_and_fold_path() {
        let root = sample_root();
        let expanded = json_initial_expanded(&root);
        assert_eq!(expanded.len(), 3);
        assert_eq!(expanded[0], root.id);
        assert!(expanded.contains(&root.children[0].id));

        // Everything collapsed: only the root row renders.
        assert_eq!(json_visible_rows(&root, &[]).len(), 1);
        // Root only: the two children show, the array stays closed.
        assert_eq!(json_visible_rows(&root, &[root.id]).len(), 3);
        // Vue's initial set adds the direct children too, so the array opens
        // one level: root + array + its 5 items + the string leaf.
        assert_eq!(json_visible_rows(&root, &expanded).len(), 8);
    }

    #[test]
    fn json_tree_renders_the_vue_dom_contract() {
        let html = JsonTree(JsonTreeProps {
            text: r#"{"count": 2, "items": [1, 2]}"#.to_string(),
            aria_label: Some("payload".to_string()),
            class: "my-tree".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("s-tool-json-tree"), "{html}");
        assert!(html.contains("role=\"tree\""), "{html}");
        assert!(html.contains("aria-label=\"payload\""), "{html}");
        assert!(html.contains("my-tree"), "{html}");
        assert!(html.contains("s-jt-row"), "{html}");
        assert!(html.contains("s-jt-key"), "{html}");
        assert!(html.contains("s-jt-colon"), "{html}");
        assert!(html.contains("s-jt-badge is-open"), "{html}");
        assert!(html.contains("s-jt-children"), "{html}");
        assert!(html.contains("--guide-left:7px"), "{html}");
        assert!(html.contains("s-jv-num"), "{html}");
        assert!(html.contains("Array(2)"), "{html}");
        // The root row is a toggle target.
        assert!(html.contains("data-parent"), "{html}");
    }

    #[test]
    fn json_tree_collapsed_root_shows_only_the_preview() {
        let value = json_parse(r#"{"a": 1, "b": 2, "c": 3, "d": 4}"#).unwrap();
        let html = JsonTree(JsonTreeProps {
            value: Some(value),
            expanded: Some(Vec::new()),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("s-jt-preview"), "{html}");
        assert!(html.contains("{a: 1, b: 2, c: 3, …}"), "{html}");
        // Nothing is expanded, so no children container is emitted.
        assert!(!html.contains("s-jt-children"), "{html}");
        assert_eq!(html.matches("s-jt-row").count(), 1, "{html}");
    }

    #[test]
    fn json_tree_renders_a_long_string_pager() {
        // Past the preview threshold (5 + 80 characters) with a newline, so
        // the value collapses to one clamped row and pages open per line.
        let padding = "x".repeat(80);
        let source = format!("{{\"body\": \"head\\n{padding}\"}}");
        let parsed = json_parse(&source).unwrap();
        let root = json_tree(&parsed, JSON_TREE_MAX_DEPTH).unwrap();
        let root_id = root.id;
        let body_id = root.children[0].id;

        let collapsed = JsonTree(JsonTreeProps {
            value: Some(parsed.clone()),
            expanded: Some(vec![root_id]),
            ..Default::default()
        })
        .render_to_html();
        assert!(collapsed.contains("s-jv-str s-jt-clamp"), "{collapsed}");
        assert!(collapsed.contains("string (85)"), "{collapsed}");
        assert!(!collapsed.contains("s-jv-str-raw"), "{collapsed}");

        let paged = JsonTree(JsonTreeProps {
            value: Some(parsed),
            expanded: Some(vec![root_id, body_id]),
            ..Default::default()
        })
        .render_to_html();
        assert!(paged.contains("s-jv-str-raw"), "{paged}");
        assert!(paged.contains("head"), "{paged}");
        assert!(paged.contains("s-jt-badge is-open"), "{paged}");
    }

    #[test]
    fn json_tree_escapes_caller_keys_and_values() {
        let html = JsonTree(JsonTreeProps {
            text: r#"{"<script>": "<img src=x onerror=alert(1)>"}"#.to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("<script>"), "{html}");
        assert!(!html.contains("<img"), "{html}");
        assert!(html.contains("&lt;script&gt;"), "{html}");
        assert!(html.contains("&lt;img"), "{html}");
    }

    #[test]
    fn json_tree_renders_nothing_for_non_containers() {
        assert!(
            JsonTree(JsonTreeProps {
                text: "42".to_string(),
                ..Default::default()
            })
            .render_to_html()
            .is_empty()
        );
        assert!(
            JsonTree(JsonTreeProps::default())
                .render_to_html()
                .is_empty()
        );
        assert!(
            JsonTree(JsonTreeProps {
                text: "not json".to_string(),
                ..Default::default()
            })
            .render_to_html()
            .is_empty()
        );
    }

    #[test]
    fn json_tree_styles_come_from_the_canonical_vue_sheet() {
        let css = JsonTreeComponent::styles();
        assert!(
            css.contains(".s-tool-json-tree") && css.contains(".s-jt-row"),
            "json tree css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored json tree sheet"
        );
    }
}
