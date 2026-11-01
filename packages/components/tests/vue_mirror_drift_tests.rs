//! Vendored-mirror drift guard for the canonical Vue component sheets.
//!
//! The Rust crate compiles the SAME stylesheets as the Vue library: the
//! canonical sheets live in `packages/vue/src`, and byte-identical vendored
//! copies live under `src/styles/vue-mirror/` (with one provenance header).
//! `scripts/sync-vue-mirror.py` refreshes the copies; THIS test fails on any
//! drift, on a missing provenance header, on a mirror file the sync
//! manifest does not know about, or on a manifest row whose files are gone.
//!
//! The upstream paths only exist in a repo checkout (a crates.io sdist
//! carries the mirrors but not `packages/vue`), so the byte comparison is
//! skipped there — the mirror-integrity assertions still run everywhere.

use std::path::{Path, PathBuf};

fn crate_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn vue_src() -> PathBuf {
    crate_root().join("..").join("vue").join("src")
}

fn mirror_root() -> PathBuf {
    crate_root().join("src").join("styles").join("vue-mirror")
}

struct MirrorRow {
    mirror_rel: String,
    upstream_rel: String,
}

fn read_manifest() -> Vec<MirrorRow> {
    let manifest = mirror_root().join("manifest.tsv");
    let text = std::fs::read_to_string(&manifest)
        .unwrap_or_else(|e| panic!("read {}: {e}", manifest.display()));
    let mut rows = Vec::new();
    for line in text.lines() {
        if line.trim().is_empty() || line.trim_start().starts_with('#') {
            continue;
        }
        let (mirror_rel, upstream_rel) = line
            .split_once('\t')
            .unwrap_or_else(|| panic!("manifest row is not <mirror>\\t<upstream>: {line:?}"));
        rows.push(MirrorRow {
            mirror_rel: mirror_rel.trim().to_string(),
            upstream_rel: upstream_rel.trim().to_string(),
        });
    }
    assert!(
        !rows.is_empty(),
        "vue-mirror manifest.tsv must list at least one pair"
    );
    rows
}

/// Strip the provenance header: everything through the
/// "do not hand-edit here." marker line plus following blank lines.
/// The remainder must equal the upstream byte-for-byte.
/// The EXACT provenance header every mirror must carry (kept in sync with
/// `scripts/sync-vue-mirror.py`). Requiring a byte-exact header — instead of
/// just finding the marker line anywhere — stops junk above the marker from
/// slipping into the comparison unnoticed.
const EXPECTED_HEADER: &str =
    "// VENDORED MIRROR — byte-identical re-copy of the canonical Vue sheet
// under packages/vue/src (the Vue library is the design-system source of
// truth; the Rust crate compiles this copy so both forms ship the same
// CSS, and so the crates.io sdist — which cannot reach ../vue — stays
// self-contained).
//
// Edit the upstream sheet, then: python3 scripts/sync-vue-mirror.py
// Drift guard: packages/components/tests/vue_mirror_drift_tests.rs
// VENDORED MIRROR — do not hand-edit here.
";

fn strip_provenance_header(source: &str) -> &str {
    assert!(
        source.starts_with(EXPECTED_HEADER),
        "mirror provenance header changed — regenerate it with scripts/sync-vue-mirror.py"
    );
    let marker = source
        .lines()
        .position(|line| line.contains("do not hand-edit here."))
        .expect("mirror file must carry the provenance header marker line");
    // Rebuild from the byte offset so the comparison is byte-exact (the
    // header always ends with a newline-terminated marker line).
    let offset = source
        .match_indices('\n')
        .nth(marker)
        .map(|(i, _)| i + 1)
        .expect("marker line is newline-terminated");
    let body = &source[offset..];
    let mut cut = 0;
    for line in body.split_inclusive('\n') {
        if line.trim().is_empty() {
            cut += line.len();
        } else {
            break;
        }
    }
    &body[cut..]
}

#[test]
fn mirrors_are_absent_from_manifest_never() {
    // Every committed file under vue-mirror/ (except the manifest itself)
    // must be a manifest row, so a stray hand-made copy cannot silently
    // join the bundle.
    let manifest_name = "manifest.tsv";
    let mut observed: Vec<PathBuf> = Vec::new();
    collect_files(&mirror_root(), &mut observed);
    let known: Vec<String> = read_manifest()
        .iter()
        .map(|row| row.mirror_rel.replace('\\', "/"))
        .collect();
    for file in &observed {
        let rel = file
            .strip_prefix(mirror_root())
            .expect("walk stays under mirror root")
            .to_string_lossy()
            .replace('\\', "/");
        if rel == manifest_name {
            // The manifest itself is sync machinery, not a mirror row.
            continue;
        }
        assert!(
            known.iter().any(|k| k == &rel),
            "file under vue-mirror/ is not in manifest.tsv (run scripts/sync-vue-mirror.py): {rel}"
        );
    }
}

#[test]
fn manifest_rows_exist_and_carry_provenance_headers() {
    // This runs in EVERY layout (including a crates.io sdist, where the
    // upstream tree is absent): the header must be byte-exact, so tampering
    // above the marker cannot hide behind a skipped byte comparison.
    for row in read_manifest() {
        let mirror_path = mirror_root().join(&row.mirror_rel);
        let text = std::fs::read_to_string(&mirror_path)
            .unwrap_or_else(|e| panic!("read {}: {e}", mirror_path.display()));
        assert!(
            text.starts_with(EXPECTED_HEADER),
            "mirror {} does not carry the exact provenance header",
            row.mirror_rel
        );
    }
}

#[test]
fn mirror_bodies_match_their_upstream_sheets() {
    let upstream_root = vue_src();
    if !upstream_root.is_dir() {
        // crates.io sdist (or a vendored crate copy): the mirrors are
        // self-contained there; the byte check needs the repo checkout.
        return;
    }
    for row in read_manifest() {
        let mirror_path = mirror_root().join(&row.mirror_rel);
        let upstream_path = upstream_root.join(&row.upstream_rel);
        let upstream = std::fs::read_to_string(&upstream_path)
            .unwrap_or_else(|e| panic!("read upstream {}: {e}", upstream_path.display()));
        let mirror = std::fs::read_to_string(&mirror_path)
            .unwrap_or_else(|e| panic!("read {}: {e}", mirror_path.display()));
        let mirror_body = strip_provenance_header(&mirror);
        assert!(
            mirror_body == upstream,
            "vue-mirror/{} drifted from packages/vue/src/{} — edit the upstream sheet and run scripts/sync-vue-mirror.py",
            row.mirror_rel,
            row.upstream_rel
        );
    }
}

/// Every `var(--x)` WITHOUT a fallback in a mirrored component sheet must be
/// defined by one of the bundled token base sheets (`tokens.scss` /
/// `scale.scss`). A fallback-less reference to an undefined property is
/// invalid at computed-value time — the same class of silent breakage the
/// Vue host avoids because it always ships those two layers.
#[test]
fn mirror_var_references_resolve_against_the_bundled_token_sheets() {
    // Known-positive guard: both directions must find something, otherwise a
    // broken pattern would silently pass this test (zero-output reads as
    // "no problem").
    // Definitions can live in a base sheet OR locally in any mirrored
    // partial (a rule that sets the custom property and later reads it).
    let mut definitions = std::collections::HashSet::new();
    let mut base_definitions = 0usize;
    for base in ["tokens.scss", "scale.scss"] {
        let text = std::fs::read_to_string(mirror_root().join(base))
            .unwrap_or_else(|e| panic!("read {base}: {e}"));
        for line in text.lines() {
            let trimmed = line.trim_start();
            if let Some(rest) = trimmed.strip_prefix("--")
                && let Some(name) = rest.split(':').next()
            {
                definitions.insert(format!("--{}", name.trim()));
                base_definitions += 1;
            }
        }
    }
    assert!(
        base_definitions > 50,
        "token base sheets must define the runtime vocabulary (found {base_definitions})"
    );
    // The `--hi-*` family is owned by the THEME layer (hikari-theme's
    // `styles/*.scss`, emitted by the theme provider in both forms). Pull its
    // definitions in when the repo checkout is present (a sdist ships the
    // mirror but not the theme crate; the mirror-local definitions above keep
    // the guard meaningful there).
    let theme_styles = crate_root().join("..").join("theme").join("styles");
    if theme_styles.is_dir()
        && let Ok(entries) = std::fs::read_dir(&theme_styles)
    {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_some_and(|ext| ext == "scss")
                && let Ok(text) = std::fs::read_to_string(&path)
            {
                for line in text.lines() {
                    let trimmed = line.trim_start();
                    if let Some(rest) = trimmed.strip_prefix("--")
                        && let Some(name) = rest.split(':').next()
                    {
                        definitions.insert(format!("--{}", name.trim()));
                    }
                }
            }
        }
    }

    let mut referenced_without_fallback = 0usize;
    let dir = mirror_root().join("components");
    let mut sheets: Vec<std::path::PathBuf> = std::fs::read_dir(&dir)
        .expect("read vue-mirror/components")
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "scss"))
        .collect();
    sheets.sort();

    // Local definitions count too (a `*-vars` partial legitimately declares the
    // per-site tokens its consumer reads). Collect them from every mirrored
    // sheet up front — the approximation is deliberate: the guard answers
    // "does the mirrored tree define it anywhere", not "@use reachability".
    for path in &sheets {
        let text = std::fs::read_to_string(path)
            .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
        for line in text.lines() {
            let trimmed = line.trim_start();
            if let Some(rest) = trimmed.strip_prefix("--")
                && let Some(name) = rest.split(':').next()
            {
                definitions.insert(format!("--{}", name.trim()));
            }
        }
    }
    for path in sheets {
        let text = std::fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
        // Local definitions inside the partial itself count as resolved.
        let clean = strip_scss_comments(&text);
        for line in clean.lines() {
            let trimmed = line.trim_start();
            if let Some(rest) = trimmed.strip_prefix("--")
                && let Some(name) = rest.split(':').next()
            {
                definitions.insert(format!("--{}", name.trim()));
            }
        }
        let mut rest = clean.as_str();
        while let Some(start) = rest.find("var(--") {
            rest = &rest[start + 4..];
            let name_end = rest.find([')', ',']).unwrap_or(rest.len());
            let name = &rest[..name_end];
            let has_fallback = rest[name_end..].starts_with(',');
            if !has_fallback {
                referenced_without_fallback += 1;
                assert!(
                    definitions.contains(name),
                    "{} references {name} without a fallback, but neither tokens.scss nor scale.scss defines it",
                    path.file_name().unwrap().to_string_lossy()
                );
            }
        }
    }
    assert!(
        referenced_without_fallback > 0,
        "expected fallback-less token references in the mirrored sheets (pattern check)"
    );
}

/// The registry-only CSS path must ship the same shared layers the builder
/// bundle does: both canonical token sheets and the mirrored chrome the
/// family surfaces render from. Without these a registry host silently
/// renders unstyled buttons/closes and collapsed spacing.
#[test]
fn registry_bundle_ships_the_shared_tokens_and_chrome() {
    use hikari_components::StyleRegistry;

    let mut registry = StyleRegistry::default();
    registry.register_all();
    let bundle = registry.css_bundle();

    // Canonical token layers (tokens.scss + scale.scss).
    for needle in [
        "--color-primary:",
        "--space-4",
        "--radius-sm",
        "--text-base",
    ] {
        assert!(
            bundle.contains(needle),
            "registry bundle is missing the canonical token {needle}"
        );
    }
    // One stable class per mirrored family + the chrome they depend on. The
    // list must grow with the sync table: a sheet that is vendored but never
    // registered reds here (R3 found 17 unguarded sheets without it).
    for needle in [
        ".hk-alert",
        ".hk-modal",
        ".hk-window-close",
        ".hk-btn",
        ".hk-avatar",
        ".hk-badge",
        ".hk-card",
        ".hk-checkbox",
        ".hk-input",
        ".hk-icon-button",
        ".hk-icon-group",
        ".hk-icon-chip",
        ".hk-label",
        ".hk-radio",
        ".hk-select",
        ".hk-slider",
        ".hk-switch",
        ".hk-textarea",
        ".hk-corner-badge",
        ".hk-spinner",
        ".hk-progress-ring",
        ".hk-toast",
        ".hk-tooltip",
        ".hk-drawer",
        ".hk-popover",
        ".hk-loading-veil",
        ".hk-message-box",
        ".hk-confirm-dialog",
        ".hk-persistent-toast",
        // W2b advanced-input family
        ".hk-number-input-steppers",
        ".hk-otp-wrapper",
        ".hk-phone-input",
        ".hk-tag-input-wrapper",
        ".hk-template-field",
        ".hk-token-input",
        ".hk-color-picker",
        ".hk-dp",
        ".hk-dtp",
        ".hk-date-tag",
        ".hk-slider-field",
        ".hk-search-input",
        ".hk-file-field",
        ".hk-file-picker-field",
        ".hk-file-browser",
        ".hk-rolling-number",
        ".hk-fab",
        ".hk-timezone-globe",
    ] {
        assert!(
            bundle.contains(needle),
            "registry bundle is missing {needle}"
        );
    }
    assert!(
        !bundle.contains("CSS generation failed"),
        "a mirrored sheet failed to compile into the registry bundle"
    );

    // Deterministic concatenation: the same registry renders the same bytes.
    // Compare digests so a failure prints hashes, not two 300 KB bundles.
    let mut second = StyleRegistry::default();
    second.register_all();
    let digest = |text: &str| -> u64 {
        use std::hash::{Hash, Hasher};
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        text.hash(&mut hasher);
        hasher.finish()
    };
    assert_eq!(
        (bundle.len(), digest(&bundle)),
        (second.css_bundle().len(), digest(&second.css_bundle())),
        "registry bundle concatenation must be deterministic"
    );
}

/// Strip SCSS comments so `var(--x)` mentions inside prose do not count as
/// references (a doc comment is not a declaration site).
fn strip_scss_comments(source: &str) -> String {
    let mut out = String::with_capacity(source.len());
    let mut chars = source.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '/' && chars.peek() == Some(&'*') {
            chars.next();
            let mut prev = '\0';
            for n in chars.by_ref() {
                if prev == '*' && n == '/' {
                    break;
                }
                if n == '\n' {
                    out.push('\n');
                }
                prev = n;
            }
            continue;
        }
        if c == '/' && chars.peek() == Some(&'/') {
            for n in chars.by_ref() {
                if n == '\n' {
                    out.push('\n');
                    break;
                }
            }
            continue;
        }
        out.push(c);
    }
    out
}

fn collect_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let entries =
        std::fs::read_dir(dir).unwrap_or_else(|e| panic!("read_dir {}: {e}", dir.display()));
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_files(&path, out);
        } else {
            out.push(path);
        }
    }
}
