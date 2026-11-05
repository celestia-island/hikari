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
//!     never a name a host can open — it must be reduced to its leaf name, and
//!     the `FileList` behind it is not on the wire at all.
//!   * a cleared extension control really does commit `""`, so a "reject empty"
//!     guard that was honest on the value-blind wire now swallows a user action.
//!
//! Every binding must be registered in [`BINDINGS`] with the control it renders
//! and how its handler treats the committed value. Adding a binding, deleting
//! one, or changing whether a handler reads the value without updating the
//! registry is a failure — and each row states when it can be deleted.
//!
//! The registry is the inventory: at the time of writing there are **16**
//! `onchange:` attribute bindings. The "17" that #1042's follow-up counted was
//! a substring `rg`, which also matched `entry/number_input.rs`'s
//! `pub onchange: Option<EventHandler<f64>>` PROP declaration — an API field,
//! not a wire binding, so it is deliberately not a row here.

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
    /// The value is reduced to file leaf names before it crosses the boundary.
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
    /// Readable row name; also the only thing distinguishing identical keys.
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
        retire_when: "Delete the leaf-name indirection when the glue exposes the \
                      input's `FileList` (a `get-files` member on \
                      `html-input-element`); the value is then a real name list \
                      and the fake-path reduction becomes dead code.",
    },
    Binding {
        file: "basic/file_upload.rs",
        site: "FileUpload",
        handler: "on_change",
        label: "transparent native file input",
        control: Control::File,
        value_use: ValueUse::LeafNames("upload_leaf_names"),
        retire_when: "Delete the leaf-name indirection when the glue exposes the \
                      input's `FileList`: `multiple` currently reaches the handler \
                      as one fake path, i.e. one name for an N-file pick, and the \
                      real list removes that delta too.",
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

fn is_doc_line(line: &str) -> bool {
    line.trim_start().starts_with("//")
}

/// The handler expression on an `onchange:` binding line, or `None` when the
/// line is not a binding. Prose is excluded: the file headers discuss these very
/// shapes, and would otherwise register as inventory.
fn binding_handler(line: &str) -> Option<String> {
    if is_doc_line(line) {
        return None;
    }
    let trimmed = line.trim_start();
    let rest = trimmed.strip_prefix("onchange")?;
    let mut rest = rest.trim_start();
    rest = rest.strip_prefix(':')?.trim_start();
    Some(rest.trim_end_matches(',').trim_end().to_string())
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

/// How many lines of the handler read the committed value. Doc lines are prose,
/// so a comment that explains the read is not a read.
fn reads_committed_value(lines: &[&str], region: (usize, usize)) -> usize {
    lines[region.0..=region.1]
        .iter()
        .filter(|line| !is_doc_line(line))
        .filter(|line| line.contains(".value"))
        .count()
}

/// Does the handler's CODE route the value through `gate`? Doc lines are
/// skipped on purpose: a comment that names the helper is documentation, and a
/// pin satisfied by prose is the "pins a string, not the behaviour" false green
/// this guard has to avoid.
fn routes_through(lines: &[&str], region: (usize, usize), gate: &str) -> bool {
    lines[region.0..=region.1]
        .iter()
        .filter(|line| !is_doc_line(line))
        .any(|line| line.contains(gate))
}

/// One `onchange:` binding found in the tree.
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

fn extract(files: &[(String, PathBuf)]) -> Vec<(Found, Vec<String>)> {
    let mut found = Vec::new();
    for (rel, path) in files {
        let source = std::fs::read_to_string(path)
            .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
        let lines: Vec<&str> = source.lines().collect();
        for (index, line) in lines.iter().enumerate() {
            let Some(handler) = binding_handler(line) else {
                continue;
            };
            let site = enclosing_site(&lines, index).unwrap_or_else(|| {
                panic!("{rel}:{} binds `onchange` outside any `pub fn` — the audit cannot name the component", index + 1)
            });
            found.push((
                Found {
                    file: rel.clone(),
                    site,
                    handler,
                },
                lines.iter().map(|line| line.to_string()).collect(),
            ));
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

fn binding_for(found: &Found) -> &'static Binding {
    BINDINGS
        .iter()
        .find(|binding| {
            binding.file == found.file
                && binding.site == found.site
                && binding.handler == found.handler
        })
        .unwrap_or_else(|| panic!("no registry row for {found}"))
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
    for (binding, _) in extract(&files) {
        *found.entry(binding).or_insert(0) += 1;
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
fn every_registered_binding_reads_the_value_the_way_it_claims() {
    let base = source_root();
    let mut files = Vec::new();
    rust_sources(&base, &base, &mut files);
    files.sort();

    let mut checked = 0usize;
    for (found, lines) in extract(&files) {
        let binding = binding_for(&found);
        let lines: Vec<&str> = lines.iter().map(String::as_str).collect();
        let index = lines
            .iter()
            .enumerate()
            .find(|(i, line)| {
                binding_handler(line).is_some_and(|handler| {
                    handler == found.handler
                        && enclosing_site(&lines, *i).as_deref() == Some(found.site.as_str())
                })
            })
            .map(|(i, _)| i)
            .unwrap_or_else(|| panic!("{}: no line matches the registered key", found.file));

        let region = handler_region(&lines, index, &found.handler).unwrap_or_else(|| {
            panic!(
                "{}:{}: the handler body for `{}` could not be delimited — the audit \
                 cannot prove what it does with `ChangeEvent.value`, so it must fail \
                 rather than pass vacuously",
                found.file,
                index + 1,
                found.handler
            )
        });
        let reads = reads_committed_value(&lines, region);
        let body = lines[region.0..=region.1].join("\n");

        match binding.value_use {
            ValueUse::Ignored => {
                assert_eq!(
                    reads,
                    0,
                    "{} ({}): the registry says the handler ignores the committed \
                     value, but its body reads `.value` (lines {}-{}):\n{body}\n\
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
                     value, but nothing in its body (lines {}-{}) reads `.value`: \
                     it has gone value-blind and the control is inert.\n{body}",
                    found.file,
                    binding.label,
                    region.0 + 1,
                    region.1 + 1
                );
                assert!(
                    routes_through(&lines, region, gate),
                    "{} ({}): the committed value must go through `{gate}` in the \
                     handler's CODE (a comment naming it does not count), which is \
                     missing from lines {}-{}:\n{body}",
                    found.file,
                    binding.label,
                    region.0 + 1,
                    region.1 + 1
                );
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
                 the handler must reduce it to leaf names.",
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
}

#[test]
fn every_row_states_when_it_can_be_deleted() {
    for binding in BINDINGS {
        assert!(
            binding.retire_when.len() > 60,
            "{} ({}): `retire_when` must say concretely when the row goes away: {:?}",
            binding.file,
            binding.label,
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
fn the_extractor_sees_the_shapes_and_ignores_prose() {
    // Positive controls: the binding shapes the audit must catch.
    assert_eq!(
        binding_handler("                    onchange: on_change,"),
        Some("on_change".to_string())
    );
    assert_eq!(
        binding_handler("                onchange: handle_change,"),
        Some("handle_change".to_string())
    );
    assert_eq!(
        binding_handler("onchange: move |_event: ChangeEvent| {"),
        Some("move |_event: ChangeEvent| {".to_string())
    );
    assert_eq!(
        binding_handler("    onchange:on_native_change,"),
        Some("on_native_change".to_string())
    );

    // Negative controls: prose and other attributes are not inventory.
    assert_eq!(
        binding_handler("//   * `input.hk-switch-input` type=checkbox [checked] (onchange)"),
        None
    );
    assert_eq!(binding_handler("// onchange: on_change,"), None);
    assert_eq!(binding_handler("oninput: on_field_input,"), None);
    assert_eq!(
        binding_handler("pub onchange: Option<EventHandler<f64>>,"),
        None
    );

    // The site is the component, not the closure or the loop.
    let lines = [
        "pub fn Table(props: TableProps) -> Element {",
        "        for row in rows {",
        "            input {",
        "                onchange: handle,",
        "            }",
        "        }",
    ];
    assert_eq!(enclosing_site(&lines, 3).as_deref(), Some("Table"));

    // The region closes on the handler's own closing brace, not an inner block.
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
    let region = handler_region(&named[..], 7, "on_change").expect("named handler region");
    assert_eq!(region, (0, 5));

    // The read counter follows code, not documentation.
    let reads = [
        "    let on_change = {",
        "        // event.value is a fake path",
        "        use(&e.value);",
        "    };",
    ];
    assert_eq!(reads_committed_value(&reads[..], (0, 3)), 1);

    // A gate satisfied only by a comment is NOT a gate: that is the false green
    // this pin exists to prevent (the helper being named in prose while the
    // handler emits the raw value).
    let prose_only = [
        "    let on_change = move |e: ChangeEvent| {",
        "        // `upload_leaf_names` would reduce this, but we skip it",
        "        let names: Vec<String> = e.value.split(',').map(String::from).collect();",
        "    };",
    ];
    assert!(!routes_through(
        &prose_only[..],
        (0, 3),
        "upload_leaf_names"
    ));
    let real = [
        "    let on_change = move |e: ChangeEvent| {",
        "        let names = upload_leaf_names(&e.value, multiple);",
        "    };",
    ];
    assert!(routes_through(&real[..], (0, 2), "upload_leaf_names"));
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
