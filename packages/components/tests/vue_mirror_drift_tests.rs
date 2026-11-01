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
        // W3 data-viz + data-table family
        ".hk-bar-chart",
        ".hk-donut",
        ".hk-treemap",
        ".hk-treemap-stage",
        ".hk-calendar-heatmap",
        ".hk-stat-card",
        ".hk-gauge-ring",
        ".hk-waterfall",
        ".hk-table-host",
        ".hk-tree",
        ".hk-filter-bar",
        ".hk-filter-chip-anchor",
        ".hk-filter-panel",
        ".hk-filter-trigger",
        ".hk-selection-grid",
        ".hk-selection-waterfall",
        ".hk-card-list",
        ".hk-pill-group-pill",
        // W5 layout + nav family
        ".hk-page-header",
        ".hk-titlebar",
        ".hk-window-controls",
        ".hk-status-row",
        ".hk-status-pill",
        ".hk-dock-bar",
        ".hk-share-bar",
        ".hk-step-flow",
        ".hk-pane-holder",
        ".hk-sidebar-rail-host",
        ".hk-affix-chip",
        ".hk-header-picker",
        ".hk-locale-picker-trigger",
        ".hk-nav-item",
        // W4 display + media family
        ".hk-empty-state",
        ".hk-qr-card",
        ".hk-skeleton",
        ".hk-timeline",
        ".hk-infinite-tail-sentinel",
        ".hk-load-more",
        ".hk-crossfade",
        ".hk-list-pop-move",
        ".hk-tc",
        ".hk-hover-reveal",
        ".hk-media-player",
        ".hk-media-slider",
        ".hk-media-controls",
        ".hk-media-visualizer",
        ".hk-modal-content.hk-image-lightbox",
        ".hk-image-preview",
        ".hk-image-viewer",
        ".hk-terminal",
        ".hk-modal-body-scroll",
        ".hk-markdown",
        ".hk-diff-viewer",
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

/// A vendored sheet must be pulled into the bundle ONCE. The failure mode is a
/// sheet that another sheet already `@use`s being imported again: Sass then
/// emits its rules a second time (R3 measured HkPickerPane at 3×, +5.8 KB).
#[test]
fn no_vendored_sheet_is_pulled_in_twice() {
    let mirror = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/styles/vue-mirror");
    let index_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/styles/index.scss");
    let index = std::fs::read_to_string(&index_path).expect("read index.scss");
    let mut files = Vec::new();
    collect_files(&mirror, &mut files);

    // Sheets that some other vendored sheet `@use`s.
    let mut used_by: Vec<String> = Vec::new();
    for file in &files {
        if file.extension().and_then(|e| e.to_str()) != Some("scss") {
            continue;
        }
        let source = std::fs::read_to_string(file).expect("read sheet");
        for line in source.lines() {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix("@use") {
                let name = rest
                    .trim()
                    .trim_start_matches("\"")
                    .trim_start_matches("'")
                    .split(['"', '\''])
                    .next()
                    .unwrap_or("")
                    .to_string();
                if name.ends_with(".scss") {
                    used_by.push(name);
                } else {
                    // Sass partials are written `@use "x"` for `_x.scss`.
                    used_by.push(format!("{name}.scss"));
                }
            }
        }
    }

    // No duplicate direct imports.
    let direct: Vec<&str> = index
        .lines()
        .filter_map(|line| line.trim().strip_prefix("@import"))
        .collect();
    let mut seen = std::collections::BTreeSet::new();
    for line in &direct {
        assert!(
            seen.insert(line.to_string()),
            "duplicate @import in index.scss: {line}"
        );
    }

    // A sheet loaded through @use must not ALSO be imported directly.
    for name in used_by {
        let basename = name.trim_start_matches("./");
        let already_used = index.contains(&format!("vue-mirror/components/{basename}"));
        assert!(
            !already_used,
            "{basename} is @use'd by another vendored sheet but also directly imported \
             in index.scss — Sass would emit its rules twice"
        );
    }
}

/// A legacy sheet and a mirrored sheet must not paint the SAME class: with the
/// mirrored imports landing last, a leftover legacy rule silently overrides the
/// Vue geometry (R3 mutation M6 restored `components/table.scss` and every gate
/// stayed green while the bundle grew).
#[test]
fn legacy_sheets_do_not_share_classes_with_the_mirrors() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let legacy_dir = root.join("src/styles/components");
    let mirror_dir = root.join("src/styles/vue-mirror");
    let mut legacy_files = Vec::new();
    collect_files(&legacy_dir, &mut legacy_files);
    let mut mirror_files = Vec::new();
    collect_files(&mirror_dir, &mut mirror_files);

    let classes_in = |files: &[std::path::PathBuf]| -> std::collections::BTreeSet<String> {
        let mut set = std::collections::BTreeSet::new();
        for file in files {
            if file.extension().and_then(|e| e.to_str()) != Some("scss") {
                continue;
            }
            let Ok(source) = std::fs::read_to_string(file) else {
                continue;
            };
            for line in source.lines() {
                let line = line.trim();
                if !line.starts_with('.') {
                    continue;
                }
                let name: String = line[1..]
                    .chars()
                    .take_while(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
                    .collect();
                if name.starts_with("hk-") {
                    set.insert(name);
                }
            }
        }
        set
    };

    // Known dual-source debt from earlier waves (each entry is retired with
    // the family that owns it). NEW overlaps must fail here.
    const KNOWN_DUAL_SOURCES: [&str; 8] = [
        "hk-breadcrumb-dropdown-item",
        "hk-card",
        "hk-card-hoverable",
        "hk-icon",
        "hk-icon-button",
        "hk-icon-button-icon",
        "hk-input-wrapper",
        "hk-menu-divider",
    ];
    let legacy = classes_in(&legacy_files);
    let mirrored = classes_in(&mirror_files);
    let clash: Vec<&String> = legacy
        .intersection(&mirrored)
        .filter(|name| !KNOWN_DUAL_SOURCES.contains(&name.as_str()))
        .collect();
    assert!(
        clash.is_empty(),
        "legacy sheets and mirrored sheets paint the same classes: {clash:?} — \
         retire the legacy rule (or rename) so the Vue geometry wins"
    );
}

/// Every localized key the mirrored components ask `hikari_i18n` for must
/// exist in the English bundle. A typo silently falls back to the literal, so
/// only a sentinel can catch it (R3 mutation M7 changed a key back to the
/// pre-wave namespace and the whole suite stayed green).
#[test]
fn mirrored_i18n_keys_exist_in_the_english_bundle() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let components_dir = root.join("src");
    let bundle_path = root.join("../i18n/src/locales/en/components.toml");
    let Ok(bundle) = std::fs::read_to_string(&bundle_path) else {
        // The i18n crate is a sibling checkout; skip when it is absent.
        return;
    };
    let mut files = Vec::new();
    collect_files(&components_dir, &mut files);
    let mut missing: Vec<String> = Vec::new();
    for file in &files {
        if file.extension().and_then(|e| e.to_str()) != Some("rs") {
            continue;
        }
        let Ok(source) = std::fs::read_to_string(file) else {
            continue;
        };
        for line in source.lines() {
            let Some(at) = line.find("components.hk.") else {
                continue;
            };
            let rest = &line[at + "components.hk.".len()..];
            let key: String = rest
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric() || *c == '.' || *c == '-' || *c == '_')
                .collect();
            // A key built by concatenation ends with a dot here; the real
            // suffix is resolved at runtime.
            if key.is_empty() || key.ends_with('.') {
                continue;
            }
            // The bundle lists keys as `hk.<key> = "…"` under `[components]`.
            let needle = format!("hk.{key} =");
            if !bundle.contains(&needle) {
                missing.push(format!("{}: components.hk.{key}", file.display()));
            }
        }
    }
    assert!(
        missing.is_empty(),
        "these keys are not in the English bundle (typos fall back silently): {missing:#?}"
    );

    // Present keys must ALSO agree with the English literal the code falls back
    // to — a same-key-different-text drift otherwise hides behind the fallback
    // (R2 caught `hk.imageLightbox.title` that way).
    let mut mismatched: Vec<String> = Vec::new();
    for file in files {
        if file.extension().and_then(|e| e.to_str()) != Some("rs") {
            continue;
        }
        let Ok(source) = std::fs::read_to_string(&file) else {
            continue;
        };
        for line in source.lines() {
            let Some(at) = line.find("components.hk.") else {
                continue;
            };
            let rest = &line[at + "components.hk.".len()..];
            let key: String = rest
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric() || *c == '.' || *c == '-' || *c == '_')
                .collect();
            if key.is_empty() || key.ends_with('.') {
                continue;
            }
            // The literal right after the key, when the call passes one.
            let after = &rest[key.len()..];
            let Some(comma) = after.find(',') else {
                continue;
            };
            let tail = after[comma + 1..].trim_start();
            if !tail.starts_with('"') {
                continue;
            }
            let literal: String = tail[1..].chars().take_while(|c| *c != '"').collect();
            if literal.is_empty() || literal.contains('{') || !literal.is_ascii() {
                continue;
            }
            let needle = format!("hk.{key} = \"{literal}\"");
            if !bundle.contains(&needle) {
                mismatched.push(format!("{key}: code=\"{literal}\""));
            }
        }
    }
    assert!(
        mismatched.is_empty(),
        "bundle text disagrees with the code's English fallback: {mismatched:#?}"
    );
}
