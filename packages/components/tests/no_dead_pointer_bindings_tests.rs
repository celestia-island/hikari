//! Dead-binding guard for the wasm32-wasip2 event channel (ledger L67).
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

/// Files that may still carry a dead binding, each with the reason it is
/// allowed. An entry is a DEBT marker, not a licence: when the file is
/// converted (or the upstream tairitsu glue starts typing `pointer*`), delete
/// the row. An entry that outlives its need costs nothing here — this guard
/// fails on unlisted hits, not on unused rows.
///
/// Both rows below belong to the CATCH-UP TRACK working in those directories in
/// the same wave; this track is hard-excluded from touching them. When that
/// track lands its conversion, drop the rows.
const ALLOWED: &[(&str, &str)] = &[
    (
        "feedback/tooltip.rs",
        "OWNED BY THE CATCH-UP TRACK (hard-excluded from this track): its \
         `onpointerdown` touch/long-press path is being converted there, so the \
         file is not ours to edit in this wave.",
    ),
    (
        "layout/face_shell.rs",
        "OWNED BY THE CATCH-UP TRACK (hard-excluded from this track): its \
         `onpointerenter` / `onpointerleave` / `onpointermove` hover trail is \
         being converted there, so the file is not ours to edit in this wave.",
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
        for (index, line) in source.lines().enumerate() {
            if let Some(kind) = dead_binding_kind(line) {
                violations.push(format!(
                    "  packages/components/src/{rel}:{}: {kind} never fires on wasm32-wasip2 (L67)\n      {}",
                    index + 1,
                    line.trim()
                ));
            }
        }
    }

    assert!(
        violations.is_empty(),
        "\n{} dead pointer/touch/drag binding(s) found. The tairitsu browser glue \
         types only the mouse family, so these handlers are INERT on a real device \
         (ledger L67).\n\n{}\n\nFix: bind the mouse family \
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
        dead_binding_kind("//     `onpointerdown` never fires here (L67)").is_none(),
        "documentation must not trip the guard"
    );
}
