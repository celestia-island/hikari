//! Value audit for the `change` channel (ledger L127).
//!
//! `onchange:` used to be a binding that compiled but never ran: `rsx` typed it
//! as `ChangeEvent` while the glue routed `change` into the `input` callback.
//! tairitsu 0.5.25 typed the delivery, and 0.5.26 + glue 0.5.4 fill
//! `ChangeEvent.value` from the target's `value` property through the
//! `html-input-element` getter. So every `onchange:` binding in this crate is
//! LIVE and receives a real string — which is the hazard this guard exists for,
//! because "a real string" is not the same as "what the user just did":
//!
//!   * the wire exposes `value`, not `checked` / `selectedIndex` / `FileList`.
//!     For a checkbox or a radio the committed value is a CONSTANT (`"on"`, or
//!     the element's `value` attribute) and says nothing about the click; a
//!     handler that forwards it writes junk into host state.
//!   * a file input's `value` is the browser FAKE PATH (`C:\fakepath\a.png`),
//!     never a name a host can open, and it is ONE path even for a `multiple`
//!     input — so it must be reduced to a leaf name, never split on `,`.
//!   * a cleared extension control really does commit `""`, so a "reject empty"
//!     guard that was honest on the value-blind wire now swallows a user action.
//!
//! The guard has two halves, and both are needed:
//!
//!   1. **Inventory.** Every binding must be registered in [`BINDINGS`] with the
//!      control it renders and how its handler treats the committed value.
//!      Adding a binding, deleting one, or changing whether a handler reads the
//!      value without updating the registry is a failure; each row also states
//!      when it can be deleted.
//!   2. **Completeness.** The registry is only as good as the parser that fills
//!      it, so a lexical pass counts every `onchange` in an attribute position —
//!      in code AND in the `"onchange":` string spelling — after stripping
//!      comments and string literals. Any spelling the parser does not
//!      understand makes the two counts disagree, which is a failure: a shape
//!      the audit cannot see must not be silently invisible.
//!
//! The registry is the inventory: at the time of writing there are **16**
//! `onchange:` attribute bindings. The "17" that #1042's follow-up counted was a
//! substring `rg`, which also matched `entry/number_input.rs`'s
//! `pub onchange: Option<EventHandler<f64>>` PROP declaration — an API field,
//! not a wire binding. That one occurrence is the [`NON_BINDING_OCCURRENCES`]
//! list, with its reason.
//!
//! One comment in this file is a pin, not decoration: a gate must be a ROUTE in
//! code, so every scan below runs on a view of the source with comments and
//! string literals blanked. A `//` note, a `/* … */` block, or a string that
//! happens to spell `.value` cannot satisfy (or trip) anything.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

/// The control a binding sits on. It decides which reading of the committed
/// value is legitimate, because `ChangeEvent` only carries the DOM `value`.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Control {
    /// `type=checkbox` / `type=radio`: `value` is a constant, so the only
    /// honest source of the new state is the component's own props.
    Checkbox,
    Radio,
    /// `<select>`: `value` IS the selection (the only option key that matters).
    Select,
    /// `<input type=file>`: `value` is the browser fake path.
    File,
    /// `<input type=date>`: `value` is the ISO day, `""` when cleared.
    Date,
    /// `<input type=datetime-local>`: `value` is the local date+time, `""` clear.
    DateTime,
    /// `<input type=number>`: `value` is the field's text.
    Number,
}

/// How a handler treats the committed value. Each reading variant names the
/// gate that must appear in the handler body — that is the pin: deleting the
/// gate (or emitting the raw value) reds this test.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum ValueUse {
    /// The handler never reads the committed value; it derives the new state
    /// from its own props/signals. Correct for `Checkbox` / `Radio` (their
    /// `value` is a constant) and for a toggle that recomputes from state.
    Ignored,
    /// The value is parsed/validated and only an accepted value is emitted.
    Parsed(&'static str),
    /// The value is reduced to a file leaf name before it crosses the boundary.
    LeafNames(&'static str),
    /// The value IS the model and is passed through verbatim.
    Verbatim(&'static str),
}

struct Binding {
    /// Path under `src/`, the same spelling the pointer guard uses.
    file: &'static str,
    /// The component function the binding lives in (stable across line shifts).
    site: &'static str,
    /// The handler expression as written on the binding line — the second half
    /// of the key, so a new binding in a registered file cannot borrow a row.
    handler: &'static str,
    /// Readable row name used in failure messages. Rows that share a key are
    /// distinguished by OCCURRENCE ORDER (so both table checkboxes are audited),
    /// not by this text.
    label: &'static str,
    control: Control,
    value_use: ValueUse,
    /// When this row may be deleted. Never blank: the registry is auditable
    /// inventory, and a reviewer must be able to tell a debt from a deliberate
    /// registration.
    retire_when: &'static str,
}

const BINDINGS: &[Binding] = &[
    Binding {
        file: "basic/checkbox.rs",
        site: "Checkbox",
        handler: "handle_change",
        label: "checkbox / radio input",
        control: Control::Checkbox,
        value_use: ValueUse::Ignored,
        retire_when: "Delete when the binding is removed, or re-register with a \
                      Parsed/Verbatim gate if the handler ever wants the payload. \
                      A checkbox's `value` is a constant, so a read here is a bug \
                      to fix rather than a row to retire.",
    },
    Binding {
        file: "basic/date_picker.rs",
        site: "DatePicker",
        handler: "on_native_change",
        label: "native <input type=date>",
        control: Control::Date,
        value_use: ValueUse::Parsed("native_change_emission"),
        retire_when: "Delete the row when the native branch is removed (the \
                      prop defaults to false: phones use the calendar sheet), or \
                      when the gate is inlined into the handler — the pin then \
                      moves onto the inline expression.",
    },
    Binding {
        file: "basic/date_time_picker.rs",
        site: "DateTimePicker",
        handler: "on_native_change",
        label: "native <input type=date|datetime-local>",
        control: Control::DateTime,
        value_use: ValueUse::Parsed("parse_native_input_value"),
        retire_when: "Delete when the native branch is removed (same default-off \
                      prop as HkDatePicker). The empty case is NOT a clear here: \
                      Vue re-syncs the field to the model instead, so reformat \
                      the gate before retiring it.",
    },
    Binding {
        file: "basic/file_browser_dialog.rs",
        site: "FileBrowserDialog",
        handler: "move |event: ChangeEvent| {",
        label: "extension filter <select>",
        control: Control::Select,
        value_use: ValueUse::Verbatim("filter_change_emission"),
        retire_when: "Delete the row when the filter select is dropped or the \
                      handler stops emitting its selection. `\"\"` is the \"All\" \
                      option's key, so re-adding an empty guard would be a \
                      regression, not a retirement.",
    },
    Binding {
        file: "basic/file_field.rs",
        site: "FileField",
        handler: "on_change",
        label: "hidden native file input",
        control: Control::File,
        value_use: ValueUse::LeafNames("picked_files_from_change_value"),
        retire_when: "Delete the leaf-name indirection once `tairitsu-vdom` hands \
                      a handler the file list. The glue already has it (`getFiles` \
                      returns the live FileList handle; WIT \
                      `html-input-element.get-files`), so the missing link is the \
                      Rust event, not upstream work in the glue.",
    },
    Binding {
        file: "basic/file_upload.rs",
        site: "FileUpload",
        handler: "on_change",
        label: "transparent native file input",
        control: Control::File,
        value_use: ValueUse::LeafNames("upload_leaf_names"),
        retire_when: "Delete the leaf-name indirection once `tairitsu-vdom` hands \
                      a handler the file list: the wire's value is one fake path, \
                      so a multi pick reports one name today. The glue already \
                      returns the live FileList handle; the missing link is the \
                      Rust event exposing it.",
    },
    Binding {
        file: "basic/radio_group.rs",
        site: "RadioGroup",
        handler: "handle_change",
        label: "radio input",
        control: Control::Radio,
        value_use: ValueUse::Ignored,
        retire_when: "Delete when the binding is removed. The emitted value is the \
                      option's own `value` prop, which is what a radio's DOM \
                      `value` would have said anyway — reading it from the event \
                      would make the mirror depend on a constant.",
    },
    Binding {
        file: "basic/switch.rs",
        site: "Switch",
        handler: "handle_change",
        label: "switch checkbox input",
        control: Control::Checkbox,
        value_use: ValueUse::Ignored,
        retire_when: "Delete when the binding is removed; the state comes from \
                      `toggled(checked)` because the wire has no `checked` getter. \
                      The track's `click` path is the second spelling of the same \
                      toggle and must not start reading a payload either.",
    },
    Binding {
        file: "data/pagination.rs",
        site: "Pagination",
        handler: "handle_size_change",
        label: "page-size <select>",
        control: Control::Select,
        value_use: ValueUse::Parsed("parse::<u32>()"),
        retire_when: "Delete when the size changer is dropped or its options stop \
                      being numeric keys. The parse is the gate: an unparseable \
                      commit must stay a no-op rather than a `0` page size.",
    },
    Binding {
        file: "data/selection.rs",
        site: "Selection",
        handler: "handle_change",
        label: "per-row checkbox",
        control: Control::Checkbox,
        value_use: ValueUse::Ignored,
        retire_when: "Delete when the selection column is removed. The new set is \
                      recomputed from the component's own `selected` signal, so a \
                      payload read here would be the constant \"on\", not the row.",
    },
    Binding {
        file: "data/selection.rs",
        site: "Selection",
        handler: "handle_select_all",
        label: "select-all checkbox",
        control: Control::Checkbox,
        value_use: ValueUse::Ignored,
        retire_when: "Delete when the selection column is removed. The intent is \
                      \"invert the all-selected state\", which comes from the \
                      signal, so the committed value carries nothing to read.",
    },
    Binding {
        file: "data/selection.rs",
        site: "RowSelection",
        handler: "handle_change",
        label: "row selection toggle",
        control: Control::Checkbox,
        value_use: ValueUse::Ignored,
        retire_when: "Delete when the toggle is removed. It reports the row key it \
                      already owns, so the payload is unused by construction.",
    },
    Binding {
        file: "data/table.rs",
        site: "Table",
        handler: "move |_event: ChangeEvent| {",
        label: "header select-all checkbox",
        control: Control::Checkbox,
        value_use: ValueUse::Ignored,
        retire_when: "Delete when the table's selection column is removed. The new \
                      key set comes from `table_toggle_all`, so the constant \
                      checkbox `value` must never reach the host.",
    },
    Binding {
        file: "data/table.rs",
        site: "Table",
        handler: "move |_event: ChangeEvent| {",
        label: "row checkbox",
        control: Control::Checkbox,
        value_use: ValueUse::Ignored,
        retire_when: "Delete when the table's selection column is removed. The new \
                      key set comes from `table_toggle_row`; the binding ignores \
                      its event because a checkbox has no committed value.",
    },
    Binding {
        file: "entry/number_input.rs",
        site: "NumberInput",
        handler: "on_field_change",
        label: "number field commit channel",
        control: Control::Number,
        value_use: ValueUse::Parsed("number_input_commit_parse"),
        retire_when: "Delete when the commit channel is folded back into a single \
                      emit (the documented [D] split). The parse rejects an empty \
                      payload on purpose: the live channel already reported it.",
    },
    Binding {
        file: "entry/transfer.rs",
        site: "Transfer",
        handler: "handle_toggle_all",
        label: "panel select-all checkbox",
        control: Control::Checkbox,
        value_use: ValueUse::Ignored,
        retire_when: "Delete when the transfer panel's header checkbox is removed. \
                      It emits keys from `all_selected` and the filtered item list, \
                      so the committed value is never part of the answer.",
    },
];

/// `onchange` occurrences that are NOT bindings, each with the reason it is
/// allowed. This list is the only place a non-binding `onchange` may live, and
/// every entry counts as one occurrence in the completeness check.
const NON_BINDING_OCCURRENCES: &[(&str, &str)] = &[(
    "entry/number_input.rs",
    "the mirror's own `pub onchange: Option<EventHandler<f64>>` PROP declaration \
     — an API field, not a wire binding",
)];

fn source_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .canonicalize()
        .expect("the crate's src/ directory must exist next to Cargo.toml")
}

/// Every `.rs` file under `src/`, relative to `src/`, in a stable order.
fn rust_sources(dir: &Path, base: &Path, out: &mut Vec<(String, PathBuf)>) {
    let entries = std::fs::read_dir(dir).unwrap_or_else(|e| panic!("read {}: {e}", dir.display()));
    for entry in entries {
        let entry = entry.expect("readable dir entry");
        let path = entry.path();
        if path.is_dir() {
            rust_sources(&path, base, out);
        } else if path.extension().is_some_and(|ext| ext == "rs") {
            let rel = path
                .strip_prefix(base)
                .expect("path lives under src/")
                .to_string_lossy()
                .replace('\\', "/");
            out.push((rel, path));
        }
    }
}

/// A source file as two line-aligned views.
///
/// `code` blanks every comment **and** every string / char / raw-string
/// literal; `plain` blanks only comments. Both keep line structure (and column
/// widths), so a finding in either view points at the original line.
///
/// Why two: a gate or a read must only be found in `code` (a comment naming the
/// helper is documentation, a string spelling `.value` is not a read), while an
/// attribute name written as a string — `"onchange":` — only survives in
/// `plain`, and it is exactly one of the spellings the parser must not miss.
fn strip_prose(source: &str) -> (Vec<String>, Vec<String>) {
    let chars: Vec<char> = source.chars().collect();
    let count = chars.len();
    let mut comment = vec![false; count];
    let mut literal = vec![false; count];
    let mut index = 0usize;
    let blank = |mask: &mut Vec<bool>, from: usize, to: usize| {
        for flag in mask.iter_mut().take(to.min(count)).skip(from) {
            *flag = true;
        }
    };
    while index < count {
        let ch = chars[index];
        // `//` to end of line.
        if ch == '/' && chars.get(index + 1) == Some(&'/') {
            let start = index;
            while index < count && chars[index] != '\n' {
                index += 1;
            }
            blank(&mut comment, start, index);
            continue;
        }
        // `/* … */`, possibly across lines.
        if ch == '/' && chars.get(index + 1) == Some(&'*') {
            let start = index;
            index += 2;
            while index < count && !(chars[index] == '*' && chars.get(index + 1) == Some(&'/')) {
                index += 1;
            }
            index = (index + 2).min(count);
            blank(&mut comment, start, index);
            continue;
        }
        // `r"…"`, `r#"…"#`, `r##"…"##` (only where `r` starts a token).
        let after_ident =
            index > 0 && (chars[index - 1].is_alphanumeric() || chars[index - 1] == '_');
        if ch == 'r' && !after_ident {
            let mut cursor = index + 1;
            let mut hashes = 0usize;
            while cursor < count && chars[cursor] == '#' {
                hashes += 1;
                cursor += 1;
            }
            if chars.get(cursor) == Some(&'"') {
                let start = index;
                cursor += 1;
                while cursor < count {
                    if chars[cursor] == '"' {
                        let closed =
                            (0..hashes).all(|offset| chars.get(cursor + 1 + offset) == Some(&'#'));
                        if closed {
                            cursor += 1 + hashes;
                            break;
                        }
                    }
                    cursor += 1;
                }
                index = cursor;
                blank(&mut literal, start, index);
                continue;
            }
        }
        // `"…"` with escapes.
        if ch == '"' {
            let start = index;
            index += 1;
            while index < count {
                if chars[index] == '\\' {
                    index += 2;
                    continue;
                }
                if chars[index] == '"' {
                    index += 1;
                    break;
                }
                index += 1;
            }
            blank(&mut literal, start, index);
            continue;
        }
        // `'x'` / `'\x'` is a char literal; a bare `'` (a lifetime) is code.
        if ch == '\'' {
            if chars.get(index + 2) == Some(&'\'') && chars.get(index + 1) != Some(&'\\') {
                blank(&mut literal, index, index + 3);
                index += 3;
                continue;
            }
            if chars.get(index + 1) == Some(&'\\') && chars.get(index + 3) == Some(&'\'') {
                blank(&mut literal, index, index + 4);
                index += 4;
                continue;
            }
        }
        index += 1;
    }

    let mut code_lines: Vec<String> = Vec::new();
    let mut plain_lines: Vec<String> = Vec::new();
    let mut code = String::new();
    let mut plain = String::new();
    for (at, &ch) in chars.iter().enumerate() {
        if ch == '\n' {
            code_lines.push(std::mem::take(&mut code));
            plain_lines.push(std::mem::take(&mut plain));
            continue;
        }
        if comment[at] {
            code.push(' ');
            plain.push(' ');
        } else if literal[at] {
            code.push(' ');
            plain.push(ch);
        } else {
            code.push(ch);
            plain.push(ch);
        }
    }
    code_lines.push(code);
    plain_lines.push(plain);
    (code_lines, plain_lines)
}

/// 1-based lines where `needle` sits in an **attribute position**: not part of a
/// longer identifier, not a field access (`props.onchange`), and followed by `:`
/// (the ordinary spelling) or `,` (the shorthand `onchange,` = `onchange: onchange`).
fn attribute_occurrences(code: &str, needle: &str) -> Vec<usize> {
    let mut lines = Vec::new();
    for (at, _) in code.match_indices(needle) {
        let before = code[..at].chars().next_back();
        if before.is_some_and(|c| c.is_alphanumeric() || c == '_' || c == '.') {
            continue;
        }
        let rest = code[at + needle.len()..].trim_start();
        if matches!(rest.chars().next(), Some(':') | Some(',')) {
            lines.push(code[..at].matches('\n').count() + 1);
        }
    }
    lines
}

/// 1-based lines where an attribute name is written as a **string literal**
/// (`"onchange": …`) — the spelling that lives in `plain`, not in `code`.
fn quoted_attribute_occurrences(plain: &str, name: &str) -> Vec<usize> {
    let needle = format!("\"{name}\"");
    let mut lines = Vec::new();
    for (at, _) in plain.match_indices(&needle) {
        let rest = plain[at + needle.len()..].trim_start();
        if rest.starts_with(':') {
            lines.push(plain[..at].matches('\n').count() + 1);
        }
    }
    lines
}

/// The handler expression on an `onchange:` binding line, or `None` when the
/// line is not a binding. Run on `code`, so a trailing comment or a string is
/// already blank and cannot leak into the key.
fn binding_handler(line: &str) -> Option<String> {
    let rest = line.trim_start().strip_prefix("onchange")?;
    let rest = rest.trim_start().strip_prefix(':')?.trim_start();
    // `trim_end` first: a stripped trailing comment leaves spaces after the
    // comma, so the order matters for `onchange: handler, // note`.
    Some(rest.trim_end().trim_end_matches(',').trim_end().to_string())
}

/// The top-level `pub fn NAME` a line sits under — the component, not the
/// closure. `None` when the binding appears before any component fn.
fn enclosing_site(lines: &[&str], index: usize) -> Option<String> {
    let mut site = None;
    for line in &lines[..=index] {
        if let Some(rest) = line.strip_prefix("pub fn ") {
            let name: String = rest
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
                .collect();
            if !name.is_empty() {
                site = Some(name);
            }
        }
    }
    site
}

fn indentation(line: &str) -> usize {
    line.len() - line.trim_start().len()
}

/// The handler body, as inclusive line indices, so the audit can prove what the
/// handler does with the committed value instead of trusting its name.
///
/// Two shapes, both closed by a `}` at the *same* indentation as the line that
/// opened them — a shallower `}` would be an inner block:
///
///   1. an inline closure on the binding line: `onchange: move |e: ChangeEvent| { … },`
///   2. a named handler bound earlier in the same function: `let on_change = move |e: ChangeEvent| { … };`
fn handler_region(lines: &[&str], index: usize, handler: &str) -> Option<(usize, usize)> {
    let open_indent = indentation(lines[index]);
    if handler.starts_with("move |") || handler.starts_with('|') {
        return (index + 1..lines.len())
            .find(|&i| {
                indentation(lines[i]) == open_indent && lines[i].trim_start().starts_with('}')
            })
            .map(|end| (index, end));
    }
    let name: String = handler
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
        .collect();
    if name.is_empty() {
        return None;
    }
    let def = (0..index).rev().find(|&i| {
        lines[i]
            .trim_start()
            .strip_prefix("let ")
            .is_some_and(|rest| {
                rest.starts_with(&name) && rest[name.len()..].trim_start().starts_with('=')
            })
    })?;
    let def_indent = indentation(lines[def]);
    (def + 1..lines.len())
        .find(|&i| indentation(lines[i]) == def_indent && lines[i].trim_start().starts_with('}'))
        .map(|end| (def, end))
}

/// How many code lines of the handler read the committed value.
fn reads_committed_value(lines: &[&str], region: (usize, usize)) -> usize {
    lines[region.0..=region.1]
        .iter()
        .filter(|line| line.contains(".value"))
        .count()
}

/// Does the handler's CODE route the value through `gate`?
fn routes_through(lines: &[&str], region: (usize, usize), gate: &str) -> bool {
    lines[region.0..=region.1]
        .iter()
        .any(|line| line.contains(gate))
}

/// Patterns a handler of this disposition must NOT contain.
///
/// A gate has to be a ROUTE, not a mention: calling the reducer and then
/// emitting the raw value beside it would still satisfy a substring check, so
/// the reducer's own parsing steps are forbidden in a handler that claims to
/// use it.
fn forbidden_for(value_use: ValueUse) -> &'static [&'static str] {
    match value_use {
        // The reducer owns the parsing; `split` in the handler means the raw
        // value is being cut up beside it (and a comma is legal in a name).
        ValueUse::LeafNames(_) => &["split"],
        ValueUse::Parsed(_) | ValueUse::Verbatim(_) | ValueUse::Ignored => &[],
    }
}

/// The key of a registered binding: file, component fn, handler expression.
#[derive(PartialEq, Eq, PartialOrd, Ord, Debug, Clone)]
struct Found {
    file: String,
    site: String,
    handler: String,
}

impl std::fmt::Display for Found {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} ({}, `{}`)", self.file, self.site, self.handler)
    }
}

/// One `onchange` occurrence in the tree, with the line it sits on.
///
/// The line is the occurrence identity: two bindings can share a
/// `(file, site, handler)` key — `data/table.rs` has exactly that shape — and a
/// lookup by key alone would audit the first one twice while never looking at
/// the second.
struct Extracted {
    found: Found,
    /// 0-based line index of the binding.
    line: usize,
    /// The original lines, for human-readable failure messages.
    lines: Vec<String>,
    /// The same lines with comments and literals blanked — the only text the
    /// scans are allowed to trust.
    code: Vec<String>,
}

fn extract(files: &[(String, PathBuf)]) -> Vec<Extracted> {
    let mut found = Vec::new();
    for (rel, path) in files {
        let source = std::fs::read_to_string(path)
            .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
        let (code_lines, _) = strip_prose(&source);
        let code: Vec<&str> = code_lines.iter().map(String::as_str).collect();
        for (index, line) in code.iter().enumerate() {
            let Some(handler) = binding_handler(line) else {
                continue;
            };
            let site = enclosing_site(&code, index).unwrap_or_else(|| {
                panic!("{rel}:{} binds `onchange` outside any `pub fn` — the audit cannot name the component", index + 1)
            });
            found.push(Extracted {
                found: Found {
                    file: rel.clone(),
                    site,
                    handler,
                },
                line: index,
                lines: source.lines().map(str::to_string).collect(),
                code: code_lines.clone(),
            });
        }
    }
    found
}

fn registered_multiset() -> BTreeMap<Found, usize> {
    let mut registered = BTreeMap::new();
    for binding in BINDINGS {
        *registered
            .entry(Found {
                file: binding.file.to_string(),
                site: binding.site.to_string(),
                handler: binding.handler.to_string(),
            })
            .or_insert(0) += 1;
    }
    registered
}

/// Registry rows grouped by their key, in declaration order. Rows sharing a key
/// are consumed one per occurrence, so a duplicated key audits both sites.
fn rows_by_key() -> BTreeMap<Found, Vec<&'static Binding>> {
    let mut rows: BTreeMap<Found, Vec<&'static Binding>> = BTreeMap::new();
    for binding in BINDINGS {
        rows.entry(Found {
            file: binding.file.to_string(),
            site: binding.site.to_string(),
            handler: binding.handler.to_string(),
        })
        .or_default()
        .push(binding);
    }
    rows
}

/// Compare what the tree actually binds against what the registry claims.
///
/// Both directions matter: an unregistered binding is the "next value-blind
/// `onchange`" this guard exists to stop, and a row whose binding is gone is a
/// stale claim that would let the rule rot. Kept separate from the test body so
/// it can be pinned against a synthetic mismatch instead of being assumed
/// correct because it happened to print nothing.
fn inventory_problems(
    found: &BTreeMap<Found, usize>,
    registered: &BTreeMap<Found, usize>,
) -> Vec<String> {
    let mut problems: Vec<String> = Vec::new();
    for (binding, count) in found {
        let expected = registered.get(binding).copied().unwrap_or(0);
        if expected == 0 {
            problems.push(format!(
                "  UNREGISTERED {binding} ×{count}\n      \
                 Add a row to BINDINGS stating the control and how the handler \
                 treats `ChangeEvent.value`. The wire delivers the DOM `value` \
                 (tairitsu 0.5.26), which is a CONSTANT for a checkbox/radio and \
                 the FAKE PATH for a file input — forwarding it unmapped writes \
                 junk into host state (ledger L127)."
            ));
        } else if expected != *count {
            problems.push(format!(
                "  COUNT MISMATCH {binding}: found ×{count}, registered ×{expected}"
            ));
        }
    }
    for (binding, count) in registered {
        let actual = found.get(binding).copied().unwrap_or(0);
        if actual == 0 {
            problems.push(format!(
                "  STALE ROW {binding} ×{count}: the binding no longer exists — \
                 delete the row (its `retire_when` said when)"
            ));
        } else if actual != *count {
            problems.push(format!(
                "  COUNT MISMATCH {binding}: registered ×{count}, found ×{actual}"
            ));
        }
    }
    problems
}

#[test]
fn every_onchange_binding_is_registered_and_every_row_is_real() {
    let base = source_root();
    let mut files = Vec::new();
    rust_sources(&base, &base, &mut files);
    files.sort();
    assert!(
        files.len() > 50,
        "the src/ walk found only {} files — the audit is not looking at the tree",
        files.len()
    );

    let mut found: BTreeMap<Found, usize> = BTreeMap::new();
    for extracted in extract(&files) {
        *found.entry(extracted.found).or_insert(0) += 1;
    }
    let registered = registered_multiset();

    let problems = inventory_problems(&found, &registered);
    assert!(
        problems.is_empty(),
        "\n{} change-binding audit problem(s):\n\n{}\n",
        problems.len(),
        problems.join("\n")
    );

    assert_eq!(
        BINDINGS.len(),
        found.values().sum::<usize>(),
        "the registry and the tree disagree on the binding count"
    );
}

#[test]
fn no_onchange_spelling_escapes_the_inventory() {
    // The registry is only as good as the parser that fills it. Count every
    // `onchange` in an attribute position — the canonical `onchange:` form, the
    // `"onchange":` string spelling, a whole element on one line, and the
    // `onchange,` shorthand — after blanking comments and literals, and require
    // the count to equal the parsed bindings plus the registered non-binding
    // occurrences. A spelling the parser does not know makes the two disagree,
    // so "I wrote it in a shape the guard cannot see" fails instead of passing.
    let base = source_root();
    let mut files = Vec::new();
    rust_sources(&base, &base, &mut files);
    files.sort();

    let extracted = extract(&files);
    let mut parsed_per_file: BTreeMap<&str, usize> = BTreeMap::new();
    for item in &extracted {
        *parsed_per_file.entry(item.found.file.as_str()).or_insert(0) += 1;
    }

    let mut problems: Vec<String> = Vec::new();
    let mut total_seen = 0usize;
    let mut total_parsed = 0usize;
    for (rel, path) in &files {
        let source = std::fs::read_to_string(path)
            .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
        let (code, plain) = strip_prose(&source);
        let code = code.join("\n");
        let plain = plain.join("\n");
        let mut seen = attribute_occurrences(&code, "onchange");
        seen.extend(quoted_attribute_occurrences(&plain, "onchange"));
        seen.sort_unstable();

        let parsed = parsed_per_file.get(rel.as_str()).copied().unwrap_or(0);
        let allowed = NON_BINDING_OCCURRENCES
            .iter()
            .filter(|(file, _)| file == rel)
            .count();
        total_seen += seen.len();
        total_parsed += parsed;
        if seen.len() != parsed + allowed {
            let seen_count = seen.len();
            problems.push(format!(
                "  {rel}: {seen_count} `onchange` occurrence(s) at line(s) {seen:?} but {parsed} \
                 registered binding(s) + {allowed} declared non-binding occurrence(s). \
                 A shape this audit does not parse is invisible to it \u{2014} write the \
                 canonical `onchange: handler,` form, or extend the parser and register \
                 the row.",
            ));
        }
    }

    assert!(
        problems.is_empty(),
        "\n{} `onchange` occurrence(s) outside the inventory:\n\n{}\n\n\
         (Parsed bindings: {}, declared non-binding occurrences: {}.)\n",
        problems.len(),
        problems.join("\n"),
        total_parsed,
        total_seen - total_parsed
    );
}

#[test]
fn every_registered_binding_reads_the_value_the_way_it_claims() {
    let base = source_root();
    let mut files = Vec::new();
    rust_sources(&base, &base, &mut files);
    files.sort();

    // Every occurrence is paired with its own registry row: a key can repeat
    // (two checkboxes in the same component), and consuming rows in occurrence
    // order is what stops the second site from being audited as the first.
    let rows = rows_by_key();
    let mut used: BTreeMap<Found, usize> = BTreeMap::new();
    let mut audited: BTreeMap<(String, usize), String> = BTreeMap::new();
    let mut checked = 0usize;
    for extracted in extract(&files) {
        let found = &extracted.found;
        let same_key = rows
            .get(found)
            .unwrap_or_else(|| panic!("no registry row for {found}"));
        let slot = used.entry(found.clone()).or_insert(0);
        let binding = *same_key.get(*slot).unwrap_or_else(|| {
            panic!(
                "{}:{}: more `onchange` occurrences ({}) than registry rows ({}) for this \
                 key — add a row for the new site",
                found.file,
                extracted.line + 1,
                *slot + 1,
                same_key.len()
            )
        });
        *slot += 1;
        let code: Vec<&str> = extracted.code.iter().map(String::as_str).collect();
        let index = extracted.line;
        if let Some(previous) =
            audited.insert((found.file.clone(), index), binding.label.to_string())
        {
            panic!(
                "{}:{}: audited twice (as `{previous}` and `{}`) — each occurrence must \
                 map to its own row",
                found.file,
                index + 1,
                binding.label
            );
        }

        let region = handler_region(&code, index, &found.handler).unwrap_or_else(|| {
            panic!(
                "{}:{}: the handler body for `{}` could not be delimited — the audit \
                 cannot prove what it does with `ChangeEvent.value`, so it must fail \
                 rather than pass vacuously",
                found.file,
                index + 1,
                found.handler
            )
        });
        let reads = reads_committed_value(&code, region);
        let body = extracted.lines[region.0..=region.1].join("\n");

        match binding.value_use {
            ValueUse::Ignored => {
                assert_eq!(
                    reads,
                    0,
                    "{} ({}): the registry says the handler ignores the committed \
                     value, but its code reads `.value` (lines {}-{}):\n{body}\n\
                     A {}'s DOM `value` is not the user's action — recompute the \
                     state from props (ledger L127).",
                    found.file,
                    binding.label,
                    region.0 + 1,
                    region.1 + 1,
                    match binding.control {
                        Control::Checkbox => "checkbox",
                        Control::Radio => "radio",
                        Control::Select => "select",
                        Control::File => "file input",
                        Control::Date => "date input",
                        Control::DateTime => "datetime input",
                        Control::Number => "number input",
                    }
                );
            }
            ValueUse::Parsed(gate) | ValueUse::LeafNames(gate) | ValueUse::Verbatim(gate) => {
                assert!(
                    reads > 0,
                    "{} ({}): the registry says the handler consumes the committed \
                     value, but nothing in its code (lines {}-{}) reads `.value`: \
                     it has gone value-blind and the control is inert.\n{body}",
                    found.file,
                    binding.label,
                    region.0 + 1,
                    region.1 + 1
                );
                assert!(
                    routes_through(&code, region, gate),
                    "{} ({}): the committed value must go through `{gate}` in the \
                     handler's CODE (a comment naming it does not count), which is \
                     missing from lines {}-{}:\n{body}",
                    found.file,
                    binding.label,
                    region.0 + 1,
                    region.1 + 1
                );
                for forbidden in forbidden_for(binding.value_use) {
                    assert!(
                        !routes_through(&code, region, forbidden),
                        "{} ({}): the handler routes through `{gate}` but still \
                         contains `{forbidden}` — the gate has to own the parsing, \
                         otherwise the raw value is emitted beside it (lines {}-{}):\n{body}",
                        found.file,
                        binding.label,
                        region.0 + 1,
                        region.1 + 1
                    );
                }
            }
        }

        // The control decides which readings are legitimate at all. A checkbox
        // or radio has a CONSTANT `value`; a file input has a fake path.
        match binding.control {
            Control::Checkbox | Control::Radio => assert_eq!(
                binding.value_use,
                ValueUse::Ignored,
                "{} ({}): a {} commits a constant `value`, so a handler that reads \
                 it can only emit the same constant — register it as Ignored.",
                found.file,
                binding.label,
                if matches!(binding.control, Control::Radio) {
                    "radio"
                } else {
                    "checkbox"
                }
            ),
            Control::File => assert!(
                matches!(binding.value_use, ValueUse::LeafNames(_)),
                "{} ({}): a file input's committed value is the browser fake path; \
                 the handler must reduce it to a leaf name.",
                found.file,
                binding.label
            ),
            Control::Select | Control::Date | Control::DateTime | Control::Number => {}
        }
        checked += 1;
    }
    assert_eq!(
        checked,
        BINDINGS.len(),
        "every registry row must be checked against the source"
    );
    assert_eq!(
        audited.len(),
        checked,
        "each audited occurrence must be a distinct line: {} rows vs {} distinct sites",
        checked,
        audited.len()
    );
    for (key, same_key) in &rows {
        assert_eq!(
            used.get(key).copied().unwrap_or(0),
            same_key.len(),
            "{key}: {} registry row(s) never matched an occurrence — a duplicated key \
             must have one row per site",
            same_key.len() - used.get(key).copied().unwrap_or(0)
        );
    }
}

#[test]
fn duplicate_keys_are_audited_once_per_occurrence() {
    // `data/table.rs` has two `onchange:` bindings with the SAME
    // (file, component, handler) key. Looking a row up by that triple and
    // taking the first match would audit the header checkbox twice and never
    // look at the row checkbox, so the pairing is pinned here: each occurrence
    // must land on its own line and consume its own row.
    let base = source_root();
    let mut files = Vec::new();
    rust_sources(&base, &base, &mut files);
    files.sort();

    let rows = rows_by_key();
    let mut used: BTreeMap<Found, usize> = BTreeMap::new();
    let mut lines_seen: BTreeMap<(String, usize), ()> = BTreeMap::new();
    for extracted in extract(&files) {
        let same_key = rows
            .get(&extracted.found)
            .unwrap_or_else(|| panic!("no registry row for {}", extracted.found));
        let slot = used.entry(extracted.found.clone()).or_insert(0);
        let _binding = same_key.get(*slot).unwrap_or_else(|| {
            panic!(
                "{}:{}: occurrence {} has no registry row",
                extracted.found.file,
                extracted.line + 1,
                *slot + 1
            )
        });
        *slot += 1;
        assert!(
            lines_seen
                .insert((extracted.found.file.clone(), extracted.line), ())
                .is_none(),
            "{}:{}: the same line was paired twice",
            extracted.found.file,
            extracted.line + 1
        );
    }

    for (key, same_key) in &rows {
        assert_eq!(
            used.get(key).copied().unwrap_or(0),
            same_key.len(),
            "{}: {} row(s) never matched an occurrence",
            key,
            same_key.len() - used.get(key).copied().unwrap_or(0)
        );
    }

    // The duplicated key is the live sample: it must resolve to two DISTINCT
    // lines in the same file, one per row.
    let table_lines: Vec<usize> = lines_seen
        .keys()
        .filter(|(file, _)| file == "data/table.rs")
        .map(|(_, line)| *line)
        .collect();
    assert_eq!(
        table_lines.len(),
        2,
        "the two table checkboxes must be two audited sites, got {table_lines:?}"
    );
    assert_ne!(
        table_lines[0], table_lines[1],
        "the two table checkboxes must be different lines"
    );
}

#[test]
fn every_row_states_when_it_can_be_deleted() {
    for binding in BINDINGS {
        let text = binding.retire_when.trim();
        let words = text.split_whitespace().count();
        assert!(
            text.len() > 60 && words >= 12,
            "{} ({}): `retire_when` must be a real sentence about when the row goes \
             away (trimmed length > 60, at least 12 words; got {} chars / {words} \
             words): {:?}",
            binding.file,
            binding.label,
            text.len(),
            binding.retire_when
        );
        assert!(
            !binding.label.trim().is_empty(),
            "{}: a row needs a readable label",
            binding.file
        );
        let path = source_root().join(binding.file);
        assert!(
            path.is_file(),
            "{} ({}): the row points at a file that no longer exists — prune it",
            binding.file,
            binding.label
        );
    }
}

#[test]
fn the_lexical_scan_sees_every_spelling_and_ignores_prose() {
    // The four spellings the reference count must catch. Three of them are
    // shapes the line-start parser does NOT see, which is exactly why the
    // completeness check exists rather than another regex in the parser.
    let canonical = "input {\n    onchange: on_change,\n}\n";
    assert_eq!(
        attribute_occurrences(&strip_prose(canonical).0.join("\n"), "onchange"),
        vec![2]
    );

    let one_line = "    input { type: \"file\", onchange: on_change, multiple: true }\n";
    assert_eq!(
        attribute_occurrences(&strip_prose(one_line).0.join("\n"), "onchange"),
        vec![1]
    );

    let shorthand = "    input {\n        onchange,\n    }\n";
    assert_eq!(
        attribute_occurrences(&strip_prose(shorthand).0.join("\n"), "onchange"),
        vec![2]
    );

    let quoted = "    input {\n        \"onchange\": move |e: ChangeEvent| {},\n    }\n";
    let (code, plain) = strip_prose(quoted);
    assert!(
        attribute_occurrences(&code.join("\n"), "onchange").is_empty(),
        "the string spelling lives in `plain`, not in `code`"
    );
    assert_eq!(
        quoted_attribute_occurrences(&plain.join("\n"), "onchange"),
        vec![2]
    );

    // Prose and lookalikes are not occurrences: a line comment, a block comment
    // (one line and across lines), a string that spells the name WITHOUT being
    // an attribute, a field access, and a longer identifier.
    let prose = "    // onchange: on_change,\n    /* onchange, */\n    /*\n     * onchange:\n     */\n    let s = \"onchange\";\n    props.onchange;\n    let durationchange = 1;\n";
    let (code, plain) = strip_prose(prose);
    assert!(
        attribute_occurrences(&code.join("\n"), "onchange").is_empty(),
        "comments, strings and field accesses are not occurrences"
    );
    assert!(
        quoted_attribute_occurrences(&plain.join("\n"), "onchange").is_empty(),
        "a string literal that is not followed by `:` is not an attribute name"
    );

    // A binding whose line ends in a comment still parses, and the comment must
    // not leak into the handler key (a stripped line keeps the comment's spaces,
    // so the comma is not the last character any more).
    let with_note = "    onchange: handle_change, // the commit channel\n";
    let (code, _) = strip_prose(with_note);
    assert_eq!(binding_handler(&code[0]), Some("handle_change".to_string()));

    // A string that CONTAINS comment markers must not swallow the code after it.
    let tricky = "    let url = \"http://example.com/a\";\n    onchange: on_change,\n";
    assert_eq!(
        attribute_occurrences(&strip_prose(tricky).0.join("\n"), "onchange"),
        vec![2]
    );

    // A raw string with `#` delimiters keeps its quotes from desyncing the scan.
    let raw = "    let css = r#\"content: \"x\"\"#;\n    onchange: on_change,\n";
    assert_eq!(
        attribute_occurrences(&strip_prose(raw).0.join("\n"), "onchange"),
        vec![2]
    );
}

#[test]
fn the_region_and_gate_scans_follow_code_not_prose() {
    // The handler body is delimited by a `}` at the opening indentation — an
    // inner block's `}` must not close it early.
    let inline = [
        "            onchange: move |_event: ChangeEvent| {",
        "                if x {",
        "                    y();",
        "                }",
        "            },",
    ];
    assert_eq!(
        handler_region(&inline[..], 0, "move |_event: ChangeEvent| {"),
        Some((0, 4))
    );

    let named = [
        "    let on_change = move |event: ChangeEvent| {",
        "        if empty {",
        "            return;",
        "        }",
        "        handler.call(event.value);",
        "    };",
        "    input { onchange: on_change }",
        "            onchange: on_change,",
    ];
    assert_eq!(handler_region(&named[..], 7, "on_change"), Some((0, 5)));

    // Prose has three spellings and none of them is a gate.
    let prose_only = [
        "    let on_change = move |e: ChangeEvent| {",
        "        // `upload_leaf_names` would reduce this, but we skip it",
        "        let names: Vec<String> = e.value.split(',').map(String::from).collect();",
        "    };",
    ];
    let (code, _) = strip_prose(&prose_only.join("\n"));
    let code: Vec<&str> = code.iter().map(String::as_str).collect();
    assert!(!routes_through(&code, (0, 3), "upload_leaf_names"));

    let block_inline = [
        "    let on_change = move |e: ChangeEvent| {",
        "        /* upload_leaf_names would reduce this */",
        "        handler.call(e.value);",
        "    };",
    ];
    let (code, _) = strip_prose(&block_inline.join("\n"));
    let code: Vec<&str> = code.iter().map(String::as_str).collect();
    assert!(
        !routes_through(&code, (0, 3), "upload_leaf_names"),
        "a one-line block comment must not satisfy a gate"
    );

    let block_multi = [
        "    let on_change = move |e: ChangeEvent| {",
        "        /*",
        "         * upload_leaf_names",
        "         */",
        "        handler.call(e.value);",
        "    };",
    ];
    let (code, _) = strip_prose(&block_multi.join("\n"));
    let code: Vec<&str> = code.iter().map(String::as_str).collect();
    assert!(
        !routes_through(&code, (0, 5), "upload_leaf_names"),
        "a multi-line block comment must not satisfy a gate"
    );

    let trailing = [
        "    let on_change = move |e: ChangeEvent| {",
        "        handler.call(e.value); // upload_leaf_names would be right",
        "    };",
    ];
    let (code, _) = strip_prose(&trailing.join("\n"));
    let code: Vec<&str> = code.iter().map(String::as_str).collect();
    assert!(
        !routes_through(&code, (0, 2), "upload_leaf_names"),
        "a trailing line comment must not satisfy a gate"
    );

    // A gate that is only MENTIONED is not a route: the reducer is called and
    // the value is still cut up beside it, which the forbidden pattern catches.
    let mention_only = [
        "    let on_change = move |e: ChangeEvent| {",
        "        let _ = upload_leaf_names(&e.value);",
        "        let names: Vec<String> = e.value.split(',').map(String::from).collect();",
        "    };",
    ];
    let (code, _) = strip_prose(&mention_only.join("\n"));
    let code: Vec<&str> = code.iter().map(String::as_str).collect();
    assert!(routes_through(&code, (0, 3), "upload_leaf_names"));
    assert!(
        forbidden_for(ValueUse::LeafNames("upload_leaf_names"))
            .iter()
            .any(|pattern| routes_through(&code, (0, 3), pattern)),
        "a handler that splits beside the reducer must hit a forbidden pattern"
    );
    assert!(forbidden_for(ValueUse::Ignored).is_empty());

    // A string that spells `.value` is not a read; a real read is.
    let stringy = [
        "    let on_change = move |e: ChangeEvent| {",
        "        let _ = \".value\";",
        "    };",
    ];
    let (code, _) = strip_prose(&stringy.join("\n"));
    let code: Vec<&str> = code.iter().map(String::as_str).collect();
    assert_eq!(
        reads_committed_value(&code, (0, 2)),
        0,
        "a string literal spelling `.value` is not a read"
    );
    let real = [
        "    let on_change = move |e: ChangeEvent| {",
        "        handler.call(e.value);",
        "    };",
    ];
    let (code, _) = strip_prose(&real.join("\n"));
    let code: Vec<&str> = code.iter().map(String::as_str).collect();
    assert_eq!(reads_committed_value(&code, (0, 2)), 1);
}

#[test]
fn a_new_or_removed_binding_is_reported_by_the_inventory_comparison() {
    // The comparison is the load-bearing half of this guard, so pin it against
    // synthetic mismatches: a broken comparison must not be able to report
    // "no problems" for a tree that gained or lost a binding.
    let registered = registered_multiset();
    assert!(
        inventory_problems(&registered, &registered).is_empty(),
        "a matching inventory must produce no problems"
    );

    let mut extra = registered.clone();
    *extra
        .entry(Found {
            file: "basic/new_component.rs".to_string(),
            site: "NewComponent".to_string(),
            handler: "handle_change".to_string(),
        })
        .or_insert(0) += 1;
    let problems = inventory_problems(&extra, &registered);
    assert_eq!(
        problems.len(),
        1,
        "an extra binding must be reported: {problems:?}"
    );
    assert!(
        problems[0].contains("UNREGISTERED") && problems[0].contains("new_component"),
        "the report must name the unregistered binding: {}",
        problems[0]
    );

    let mut missing = registered.clone();
    let victim = missing.keys().next().expect("a non-empty registry").clone();
    missing.remove(&victim);
    let problems = inventory_problems(&missing, &registered);
    assert_eq!(
        problems.len(),
        1,
        "a deleted binding must be reported: {problems:?}"
    );
    assert!(
        problems[0].contains("STALE ROW") && problems[0].contains(&victim.file),
        "the report must name the stale row: {}",
        problems[0]
    );

    // A duplicated binding in a registered file is a count mismatch, not silence
    // (the two table checkboxes are the live example of a duplicated key).
    let mut doubled = registered.clone();
    let shared = doubled
        .iter()
        .find(|(_, count)| **count > 1)
        .map(|(key, _)| key.clone())
        .expect("the registry keeps at least one duplicated key");
    *doubled.get_mut(&shared).expect("present") += 1;
    let problems = inventory_problems(&doubled, &registered);
    assert!(
        problems
            .iter()
            .any(|problem| problem.contains("COUNT MISMATCH")),
        "a third copy of a duplicated binding must be reported: {problems:?}"
    );
}
