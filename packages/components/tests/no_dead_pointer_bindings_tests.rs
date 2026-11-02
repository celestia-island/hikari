//! Dead-binding guard for the wasm32-wasip2 event channel (ledger L88).
//!
//! The tairitsu browser glue that hosts these components type-dispatches ONLY
//! the mouse family (`mouseenter`/`mouseleave`/`mousemove`/`mousedown`/
//! `mouseup`/`click`/`dblclick`/`mouseover`/`mouseout`/`contextmenu`/`wheel`),
//! the keyboard family, the focus family and `input`/`change`. Every other DOM
//! event — `pointer*`, `touch*`, `drag*`, … — falls through to
//! `onGenericEvent(listenerId, eventHandle, eventType)`, which carries the
//! type string and a live handle but NO data; the host side
//! (`packages/web/src/wit_platform.rs`) turns that into a `GenericEvent`, so a
//! handler that asked for `PointerEvent` / `TouchEvent` / `DragEvent` never
//! matches its downcast and silently never runs.
//!
//! That failure is INVISIBLE: it does not fail to compile, it does not fail at
//! runtime, it just makes an interaction inert on a real device. A Rust
//! component that binds one of those families therefore looks correct in review
//! and in CI. These two shapes are the whole trap:
//!
//!   1. a builder call — `.on_pointerdown(..)`, `.on_pointerenter(..)`,
//!      `.on_touchstart(..)`, `.on_dragover(..)`;
//!   2. an rsx attribute — `onpointerdown: ..`, `ontouchstart: ..`,
//!      `ondragstart: ..`, `ondrop: ..` (with a value, or in the bare
//!      shorthand form).
//!
//! Binding the MOUSE family instead (`onmousedown` / `on_mousemove` /
//! `on_mouseup` / `onmouseenter` / `on_mouseleave`, and the matching `MouseEvent`
//! handler parameter) is the supported fix while the glue is untyped; the
//! `thread_local` + `buttons == 0` release edge is the supported way to end a
//! drag whose release lands outside the element (there is no document/window
//! listener seam — `tairitsu_vdom::DomOps` is element-scoped).
//!
//! A hit is not necessarily a bug to fix in this crate: the two shapes are also
//! the honest spelling of an interaction that genuinely cannot be preserved
//! (a file `drop` needs `DataTransfer`, a pinch needs distinct pointer ids).
//! Those cases must be DELETED or explicitly allowlisted below with a reason —
//! never left bound-but-dead.

use std::path::{Path, PathBuf};

/// Files that legitimately carry a pointer-typed binding on the wasip2 wire,
/// each with the reason it is allowed to stay.
///
/// These are NOT debt: both entries are deliberate design, re-affirmed after the
/// pointer-stopgap wave converted every other dead binding in this crate to the
/// mouse family. Re-binding either of them would change behaviour, not just
/// silence a warning, so the rows are permanent until the host ships typed
/// pointer dispatch (the upstream getter contract). The guard still fails on any
/// UNLISTED hit, so new dead bindings cannot ride in on these two.
const ALLOWED: &[(&str, &str)] = &[
    // DELIBERATELY POINTER-TYPED: the touch/pen handover discriminates via
    // `PointerEvent.pointer_type`, and the mouse wire cannot synthesise a
    // non-mouse pointer type (see `utils/pointer_synthesis.rs`, which always sets
    // `Mouse`).
    (
        "feedback/tooltip.rs",
        "DELIBERATELY POINTER-TYPED: the touch/pen handover discriminates via \
         PointerEvent::pointer_type, and the mouse wire cannot synthesise a \
         non-mouse pointer type (see utils/pointer_synthesis.rs, which always \
         sets Mouse). Re-binding to the mouse family would silently delete the \
         touch handover on every target. The wasip2 deadness of this binding is \
         the file's declared delta (ledger L88); it revives when the host ships \
         the typed pointer dispatch (tairitsu getter contract, \
         celestia-island/tairitsu#104).",
    ),
    // POINTER-TYPED PER THE VUE CANONICAL: the rail hover machine consumes
    // pointerenter/leave/move exactly as Vue's `HkFaceShell` does.
    (
        "layout/face_shell.rs",
        "POINTER-TYPED PER THE VUE CANONICAL: the rail hover machine consumes \
         pointerenter/leave/move as Vue's HkFaceShell does. Same wire facts as \
         above: cannot be synthesised from mouse events without losing the \
         pointer-type distinction, so it stays typed and dead on wasip2 by \
         declaration (L88), not by oversight.",
    ),
];

/// The rsx attribute / builder name prefixes the glue cannot deliver typed.
/// `drop` is its own name (not a `drag*` prefix) and rides the same data-less
/// channel, so it belongs to the same trap: an `ondrop:` binding can only ever
/// be a `DragEvent` handler that never fires.
const POISONED_FAMILIES: [&str; 4] = ["pointer", "touch", "drag", "drop"];

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
    // `//`, `///` and `//!` lines are prose — the delta notes in the headers
    // discuss these very shapes, so scanning them would flag documentation.
    line.trim_start().starts_with("//")
}

/// The identifier that immediately follows `on` at `idx`, if any.
fn ident_from(text: &str, idx: usize) -> String {
    text[idx..]
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
        .collect()
}

fn poisoned_family(ident: &str) -> bool {
    POISONED_FAMILIES
        .iter()
        .any(|family| ident.starts_with(family))
        // `gotpointercapture` / `lostpointercapture` name the pointer family
        // mid-word; they are just as undeliverable as `onpointer*`.
        || ident.ends_with("pointercapture")
}

/// Classify a code line: `Some("builder")` for `.on_pointer*(` style calls,
/// `Some("rsx attribute")` for `onpointerdown:` / `ondragstart,` style
/// attributes, `None` when the line is clean.
fn dead_binding_kind(line: &str) -> Option<&'static str> {
    if is_doc_line(line) {
        return None;
    }
    let bytes = line.as_bytes();

    // Shape 1: `.on_pointerdown(`, `.on_touchstart(` … (a method call).
    let mut from = 0usize;
    while let Some(offset) = line[from..].find(".on_") {
        let at = from + offset;
        let ident = ident_from(line, at + 4); // skip the ".on_" prefix
        if poisoned_family(&ident) {
            let rest = &line[at + 4 + ident.len()..];
            // Allow whitespace between the method name and the paren.
            if rest.trim_start().starts_with('(') {
                return Some("builder");
            }
        }
        from = at + 4;
        if from >= bytes.len() {
            break;
        }
    }

    // Shape 2: an rsx attribute `onpointerdown: …` / shorthand `ondragstart,`.
    // The `on` must start a token: line start, or right after one of the
    // delimiters rsx uses between attributes.
    let mut search = 0usize;
    while let Some(offset) = line[search..].find("on") {
        let at = search + offset;
        let prev = if at == 0 {
            None
        } else {
            line[..at].chars().next_back()
        };
        let token_start = match prev {
            None => true,
            Some(c) => c.is_whitespace() || matches!(c, '{' | ',' | '(' | '[' | ';'),
        };
        if token_start {
            let ident = ident_from(line, at);
            if ident.len() > 2 && poisoned_family(&ident[2..]) {
                let rest = line[at + ident.len()..].trim_start();
                if rest.starts_with(':') || rest.starts_with(',') || rest.starts_with('}') {
                    return Some("rsx attribute");
                }
            }
        }
        search = at + 2;
        if search >= bytes.len() {
            break;
        }
    }

    None
}

/// The BUILDER SHAPE SPLIT ACROSS LINES: `.on_pointerdown` closing a line with
/// the argument list opening on the next one.
///
/// `rustfmt` wraps a long closure exactly this way, so a strictly line-scoped
/// scan would let a real binding through — and this is the shape an author is
/// most likely to produce when they paste a long handler.
fn split_builder(lines: &[&str], index: usize) -> Option<&'static str> {
    let line = lines.get(index)?;
    if is_doc_line(line) {
        return None;
    }
    let trimmed = line.trim_end();
    let at = trimmed.rfind(".on_")?;
    let ident = ident_from(trimmed, at + 4);
    if ident.is_empty() || !poisoned_family(&ident) {
        return None;
    }
    if at + 4 + ident.len() != trimmed.len() {
        // Something else follows the method name on this line: that is the
        // single-line shape's job, not this one.
        return None;
    }
    // The argument list has to open on one of the next few non-blank lines.
    for candidate in lines.iter().skip(index + 1).take(3) {
        let candidate = candidate.trim_start();
        if candidate.is_empty() {
            continue;
        }
        return candidate
            .starts_with('(')
            .then_some("builder (call split over lines)");
    }
    None
}

/// Every dead-binding finding in `lines`, as `(1-based line, shape)`.
fn dead_findings(lines: &[&str]) -> Vec<(usize, &'static str)> {
    let mut findings = Vec::new();
    for index in 0..lines.len() {
        if let Some(kind) = dead_binding_kind(lines[index]) {
            findings.push((index + 1, kind));
            continue;
        }
        if let Some(kind) = split_builder(lines, index) {
            findings.push((index + 1, kind));
        }
    }
    findings
}

#[test]
fn no_dead_pointer_touch_drag_bindings_outside_the_allowlist() {
    let base = source_root();
    let mut files: Vec<(String, PathBuf)> = Vec::new();
    rust_sources(&base, &base, &mut files);
    files.sort();
    assert!(
        files.len() > 50,
        "the src/ walk found only {} files — the guard is not looking at the tree",
        files.len()
    );

    let allowed: Vec<&str> = ALLOWED.iter().map(|(path, _)| *path).collect();
    let mut violations: Vec<String> = Vec::new();
    for (rel, path) in &files {
        if allowed.contains(&rel.as_str()) {
            continue;
        }
        let source = std::fs::read_to_string(path)
            .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
        let lines: Vec<&str> = source.lines().collect();
        for (line_no, kind) in dead_findings(&lines) {
            violations.push(format!(
                "  packages/components/src/{rel}:{line_no}: {kind} never fires on wasm32-wasip2 (L88)\n      {}",
                lines[line_no - 1].trim()
            ));
        }
    }

    assert!(
        violations.is_empty(),
        "\n{} dead pointer/touch/drag binding(s) found. The tairitsu browser glue \
         types only the mouse family, so these handlers are INERT on a real device \
         (ledger L88).\n\n{}\n\nFix: bind the mouse family \
         (`onmousedown`/`onmousemove`/`onmouseup`/`onmouseenter`/`onmouseleave` with a \
         `MouseEvent` parameter) and end drags from `buttons == 0` on the next move. \
         If the behaviour genuinely cannot be preserved, DELETE the binding and \
         document the delta in the file header. Only a file that another track \
         actively owns may be added to ALLOWED, with its reason.\n",
        violations.len(),
        violations.join("\n")
    );
}

#[test]
fn every_allowlist_entry_states_a_reason_and_names_a_real_file() {
    let base = source_root();
    for (rel, reason) in ALLOWED {
        assert!(
            !reason.trim().is_empty(),
            "allowlist row for `{rel}` must state why the dead binding is tolerated"
        );
        assert!(
            reason.len() > 30,
            "allowlist row for `{rel}` needs a real reason, not a placeholder: {reason:?}"
        );
        let path = base.join(rel);
        assert!(
            path.is_file(),
            "allowlist row for `{rel}` points at a file that no longer exists — prune the row"
        );
    }
}

#[test]
fn the_guard_recognises_both_shapes_and_ignores_documentation() {
    // Positive controls: the two shapes, including the shorthand attribute form
    // and the whitespace-before-paren builder form.
    assert!(
        dead_binding_kind(".on_pointerdown(handler)").is_some(),
        "builder"
    );
    assert!(
        dead_binding_kind("    .on_pointerenter (handler)").is_some(),
        "spaced builder"
    );
    assert!(
        dead_binding_kind(".on_touchstart(move |e: TouchEvent| {").is_some(),
        "touch builder"
    );
    assert!(
        dead_binding_kind("root = root.on_dragover(h)").is_some(),
        "drag builder"
    );
    assert!(
        dead_binding_kind("onpointerdown: move |e| {}").is_some(),
        "rsx attr"
    );
    assert!(
        dead_binding_kind("            onpointerenter: handler,").is_some(),
        "indented rsx attr"
    );
    assert!(
        dead_binding_kind("        ondragstart,").is_some(),
        "shorthand rsx attr"
    );
    assert!(
        dead_binding_kind("                ondrop: on_drop,").is_some(),
        "drop attr"
    );
    assert!(
        dead_binding_kind("        ondrop,").is_some(),
        "shorthand drop attr"
    );
    assert!(
        dead_binding_kind("        onlostpointercapture: h").is_some(),
        "capture attr"
    );

    // Negative controls: live mouse bindings, the generic register, and prose.
    assert!(
        dead_binding_kind("onmousedown: handler,").is_none(),
        "mouse attr is live"
    );
    assert!(
        dead_binding_kind(".on_mouseenter(move |e: MouseEvent| {").is_none(),
        "mouse builder"
    );
    assert!(
        dead_binding_kind(".on_event(\"pointercancel\", h)").is_none(),
        "generic register"
    );
    assert!(
        dead_binding_kind("onclick: move |_e: MouseEvent| {}").is_none(),
        "click"
    );
    assert!(
        dead_binding_kind("// the `on_pointer_*` props keep their Vue names").is_none(),
        "documentation must not trip the guard"
    );
    assert!(
        dead_binding_kind("//     `onpointerdown` never fires here (L88)").is_none(),
        "documentation must not trip the guard"
    );
}

#[test]
fn the_guard_catches_a_builder_call_split_over_lines() {
    // `rustfmt` wraps a long handler between the method name and its argument
    // list, which is the shape a strictly line-scoped scan missed.
    let split = [
        "    root = root.on_pointerdown",
        "        (move |event: PointerEvent| {",
        "            drag = true;",
        "        });",
    ];
    assert_eq!(
        dead_findings(&split),
        vec![(1, "builder (call split over lines)")],
        "a wrapped `.on_pointerdown` call must still be caught"
    );

    // A blank line between the name and the paren keeps the same meaning.
    let split_blank = ["    .on_touchstart", "", "        (handler)"];
    assert_eq!(
        dead_findings(&split_blank),
        vec![(1, "builder (call split over lines)")]
    );

    // Negative controls: the live mouse equivalent, and a poisoned NAME that is
    // not being called (a bare field / prose), must stay clean.
    let live = [
        "    root = root.on_mousedown",
        "        (move |e: MouseEvent| {})",
    ];
    assert!(dead_findings(&live).is_empty(), "mouse builder is live");
    let not_a_call = [
        "    let on_pointer_down = props.on_pointer_down.clone();",
        "",
    ];
    assert!(
        dead_findings(&not_a_call).is_empty(),
        "copying a pointer-typed PROP is not a binding"
    );
}
