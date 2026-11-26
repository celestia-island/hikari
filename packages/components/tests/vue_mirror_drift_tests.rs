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
///
/// Escape hatch: `INTENTIONALLY_UNRESOLVED` names references a HOST is
/// expected to provide, deliberately left undefined by the library —
/// defining them (here OR as a fallback) would defeat the documented
/// behavior. Each entry carries the pointer to the intent; a name lands
/// here only with that rationale in the sheet. First real occupant:
/// #1106's HkStepFlow sticky-header knob (IACVT — a default would poison
/// the pin's `background` on engines without color-mix, because the knob
/// itself is defined and therefore WINS over the base surface's own
/// fallback; see the comment block at the reference site).
const INTENTIONALLY_UNRESOLVED: &[(&str, &str)] = &[(
    "--hk-stepflow-sticky-bg",
    "packages/vue/src/components/HkStepFlow.scss",
)];

#[test]
fn mirror_var_references_resolve_against_the_bundled_token_sheets() {
    // Known-positive guard: both directions must find something, otherwise a
    // broken pattern would silently pass this test (zero-output reads as
    // "no problem").
    let definitions = bundled_token_definitions();
    let mut referenced_without_fallback = 0usize;
    let dir = mirror_root().join("components");
    let mut sheets: Vec<std::path::PathBuf> = std::fs::read_dir(&dir)
        .expect("read vue-mirror/components")
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "scss"))
        .collect();
    sheets.sort();

    for path in sheets {
        let text = std::fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
        let clean = strip_scss_comments(&text);
        let mut rest = clean.as_str();
        while let Some(start) = rest.find("var(--") {
            rest = &rest[start + 4..];
            let name_end = rest.find([')', ',']).unwrap_or(rest.len());
            let name = &rest[..name_end];
            let has_fallback = rest[name_end..].starts_with(',');
            if !has_fallback {
                referenced_without_fallback += 1;
                assert!(
                    definitions.contains(name)
                        || INTENTIONALLY_UNRESOLVED.iter().any(|(v, _)| *v == name),
                    "{} references {name} without a fallback, but no bundled token layer defines it and it is not on the intentionally-unresolved list",
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

/// The custom-property names the bundled token layers define: the mirrored
/// base sheets (`tokens.scss` / `scale.scss`), the crate's own stylesheet
/// tree under `src/styles` (the compiled `index.scss` entry ships the legacy
/// `--hi-*` families; the mirrored component partials may declare the
/// per-site token their consumer reads), and the theme crate's `styles/`
/// (when the repo checkout is present — a sdist ships the crate but not the
/// theme; the crate-local definitions keep the guard meaningful there). The
/// raw-text walk is the same deliberate over-approximation the guards below
/// have always used: "does the shipped tree define it anywhere", not
/// "@use reachability". MUT:mut-defwalk-rawstyles — removing the raw
/// `src/styles` leg fails on partial-local definitions (HkBadge's border).
fn bundled_token_definitions() -> std::collections::HashSet<String> {
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
    // The crate's own stylesheet tree (the `index.scss` entry point the
    // builder compiles the bundle from, plus every partial under it).
    let styles_root = crate_root().join("src").join("styles");
    let mut stack = vec![styles_root];
    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(&dir)
            .unwrap_or_else(|e| panic!("read {}: {e}", dir.display()))
            .flatten()
        {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.extension().is_some_and(|ext| ext == "scss")
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
    // The `--hi-*` family is owned by the THEME layer (hikari-theme's
    // `styles/*.scss`, emitted by the theme provider in both forms).
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
    definitions
}

/// Line indexes (0-based, matching `text.lines().enumerate()`) inside
/// `#[cfg(test)]`-gated items. Test fixtures never execute in production and
/// deliberately reference undefined names (pass-through probes like
/// `var(--x)`), so scanning them would demand definitions no runtime ever
/// needs. A region ends at the closing brace of the attributed item,
/// recognized by its indentation — rustfmt keeps a block's brace aligned
/// with its item, so the close of the gated item is a bare `}` at the same
/// indent as the attribute. MUT:mut-testskip-fixtures — gating is
/// load-bearing: with the skip off, the scan fails on the fixture probes
/// (`--x`, `--rail-w`, `--_hk-dock-gap-{edge}`).
fn test_only_lines(text: &str) -> std::collections::HashSet<usize> {
    let mut gated = std::collections::HashSet::new();
    let mut in_region = false;
    let mut region_indent = 0usize;
    for (idx, line) in text.lines().enumerate() {
        let trimmed = line.trim_start();
        if !in_region && trimmed.starts_with("#[cfg(test)]") {
            in_region = true;
            region_indent = line.len() - line.trim_start().len();
            gated.insert(idx);
            continue;
        }
        if in_region {
            if trimmed == "}" && line.len() - trimmed.len() == region_indent {
                in_region = false;
                gated.insert(idx);
            } else {
                gated.insert(idx);
            }
        }
    }
    gated
}

/// The crate's own `.rs` component bodies consume `var(--hi-...)` directly,
/// with or without a fallback. Those bodies are NOT `.scss`, so the
/// mirrored-sheet walks above never see them: fallback-less legacy
/// references in production `.rs` were invisible to every gate until this
/// scan existed. Every referenced name must resolve against the bundled
/// layers, against the file's own emitted CSS (a body that declares the
/// very names it reads is a self-contained pair), or onto the
/// intentionally-unresolved escape hatch — otherwise the reference is
/// invalid at computed-value time on every theme. MUT:mut-rs-scan-detect —
/// a bogus production name fails naming its file (M1), dropping the
/// same-file definition collection fails on terminal's `--hk-terminal-fg`
/// and code_highlight's `--code-syntax-*` (M3).
#[test]
fn crate_rs_token_references_resolve_against_the_bundled_token_sheets() {
    let definitions = bundled_token_definitions();
    let mut files: Vec<std::path::PathBuf> = Vec::new();
    let mut stack = vec![crate_root().join("src")];
    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(&dir)
            .unwrap_or_else(|e| panic!("read {}: {e}", dir.display()))
            .flatten()
        {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.extension().is_some_and(|ext| ext == "rs") {
                files.push(path);
            }
        }
    }
    assert!(
        files.len() > 100,
        "the crate source walk must find the real tree (found {} files)",
        files.len()
    );

    let mut references = 0usize;
    let mut offenders: Vec<String> = Vec::new();
    for path in &files {
        let text = std::fs::read_to_string(path)
            .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
        let test_lines = test_only_lines(&text);
        // Component-local definitions: emitted CSS inside the same `.rs`
        // body (inline `style` chains, a themed sheet constant) may declare
        // the names that body reads.
        let mut local_definitions: std::collections::HashSet<String> =
            std::collections::HashSet::new();
        for (idx, line) in text.lines().enumerate() {
            if test_lines.contains(&idx) {
                continue;
            }
            // Comment-blind collection would let a documented or
            // commented-out `--name:` example mask a real broken
            // reference elsewhere in the file.
            if line.trim_start().starts_with("//") {
                continue;
            }
            let mut rest = line;
            while let Some(pos) = rest.find("--") {
                rest = &rest[pos + 2..];
                let name_len = rest
                    .find(|c: char| !(c.is_ascii_alphanumeric() || c == '-' || c == '_'))
                    .unwrap_or(rest.len());
                let (name, tail) = rest.split_at(name_len);
                if name_len > 0 && tail.starts_with(':') {
                    local_definitions.insert(format!("--{name}"));
                }
            }
        }
        for (idx, line) in text.lines().enumerate() {
            if test_lines.contains(&idx) {
                continue;
            }
            let trimmed = line.trim_start();
            if trimmed.starts_with("//") {
                continue;
            }
            let mut rest = trimmed;
            while let Some(pos) = rest.find("var(--") {
                rest = &rest[pos + 4..];
                let name_end = rest.find([')', ',']).unwrap_or(rest.len());
                let name = &rest[..name_end];
                let has_fallback = rest[name_end..].starts_with(',');
                if !has_fallback
                    && !definitions.contains(name)
                    && !local_definitions.contains(name)
                    && !INTENTIONALLY_UNRESOLVED.iter().any(|(v, _)| *v == name)
                {
                    offenders.push(format!(
                        "{} references {name} without a fallback and without a definition",
                        path.display()
                    ));
                }
                references += 1;
            }
        }
    }
    assert!(
        references > 20,
        "the scan must find the crate's real token references (found {references})"
    );
    assert!(
        definitions.contains("--hi-color-bg-container"),
        "the #1496 surface alias must stay defined by the bundled token sheets"
    );
    assert!(
        offenders.is_empty(),
        "crate .rs bodies reference token names that no bundled layer defines: {offenders:?}"
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
        ".hk-sort",
        ".hk-filter-bar",
        ".hk-filter-chip",
        ".hk-filter-panel",
        ".hk-filter-trigger",
        ".hk-pagination",
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
        ".hk-corner-badge-anchor",
        ".hk-spinner",
        ".hk-progress-ring",
        ".hk-toast",
        ".hk-tooltip",
        // The touch half of the tooltip story: the top-docked hint bar
        // (`runtime/touchHint.scss`, registered by `feedback::touch_hint`).
        ".hk-touch-hint-bar",
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
        // W7 scene3d family
        ".hk-board",
        ".hk-board3d",
        ".hk-node-canvas",
        ".hk-kanban",
        ".hk-draggable-grid",
        ".hk-draggable-list",
        ".hk-minimap",
        ".hk-minimap3d-canvas",
        ".hk-zoom-toolbar",
        ".hk-windowed-item",
        ".hk-star-system-chip",
        ".hk-blank-canvas",
        // W6 overlay + auth family. The retired tile family's needles
        // (`.hk-alt-signin`, `.s-auth-methods-divider`) are GONE with the
        // 2026-11-26 divider removal — the bundle must NOT ship them.
        ".hk-adaptive-dialog-drawer-header",
        ".hk-popup-select-wrapper",
        ".hk-floating-layer",
        // The ambient HUD family (the screen-identify host + card).
        ".hk-ambient-layer",
        ".hk-screen-identify",
        ".s-auth-form",
        ".s-auth-submit",
        ".hk-pwd-box",
        ".s-captcha-modal",
        ".s-captcha-widget",
        ".s-cookie-consent",
        ".hk-template-field",
        // The shared `s-*` shell sheet (the five sheet-less mirrors' geometry)
        ".s-admin-shell",
        ".s-status-bar",
        ".hk-menu-flag",
        // W9 final gap family
        ".hk-expansion-panel",
        ".hk-kw-search",
        ".hk-localized-input",
        ".hk-menu-identity-item",
        ".hk-menu-list",
        ".hk-modal-breadcrumb",
        ".hk-search-trigger",
        ".hk-section-card",
        ".hk-solar-setting",
        ".hk-step-guide",
        ".hk-tag-dot__dot",
        ".hk-user-picker-field",
        // W8 theme + misc family
        ".s-about-modal",
        ".s-theme-toggle",
        // HkAddTile — vendored since the theme panel's customize entry
        // became the standard tile (#1222); the panel's styles() compiles
        // this sheet, so the registry bundle must carry the table.
        ".hk-add-tile",
        ".hk-add-tile--compact",
        ".hk-wallpaper",
        ".hk-splash",
        ".hk-logo",
        ".hk-copy",
        ".hk-corner-badge-anchor",
        ".hk-error-landing",
        ".hk-settings",
        ".s-secret-modal",
        ".hk-divider",
        ".hk-template-field",
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
        // The rail flip's flight layer + clones (single-glyph contract):
        // the sheet half of `useRailIconFlight` (see `sidebar_rail_swap.rs`,
        // which declares why the choreography itself is not portable).
        ".hk-sidebar-rail-flight",
        ".hk-sidebar-rail-flight-clone",
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

    // The retired methods/divider family must NOT ship (2026-11-26
    // divider removal).
    //
    // What each selector can actually tell us, and why they are NOT the
    // same kind of pin:
    //
    // - `.hk-alt-signin` and `.s-auth-methods-divider` existed ONLY in the
    //   deleted sheets (HkAltSignIn / HkThirdPartySignInCard /
    //   HkAuthMethodList), so their absence from the bundle is a real
    //   regression signal: re-registering a retired sheet in
    //   `OVERLAY_SHEETS` puts its selectors back in this string and the
    //   assertion below goes red.
    // - `.s-auth-methods` does NOT behave that way. comment-gate-ok: it explains why this loop is narrowed; the pins are named below. It also lives in the
    //   vendored `admin-tokens.scss` (the shared `s-*` chrome layer this
    //   bundle always carries). comment-gate-ok: rationale for the narrowed loop, pins named in the next lines. so it is absent from the bundle only while
    //   that sheet omits it — the loop is not what guards the deleted
    //   sheets for it. Its real pins are the rule-level assertions in the
    //   Vue suite (`HkAuthCard.test.tsx` / `HkLoginFlow.test.tsx` assert no
    //   `.s-auth-methods {` rule survives) and the Rust DOM contract
    //   (`!html.contains("s-auth-methods")` in `auth_card.rs` /
    //   `sign_in_card.rs`).
    //
    // The sheet-provenance half (no retired sheet may come back into the
    // registry) is asserted separately below, where it can be checked
    // against the mirror directory rather than inferred from a selector
    // string.
    // MUT:retired-auth-sheets-return (re-registering any retired sheet
    // resurrects its selectors in the bundle and this goes red).
    for retired in [".hk-alt-signin", ".s-auth-methods-divider"] {
        assert!(
            !bundle.contains(retired),
            "registry bundle still ships the retired selector {retired}"
        );
    }

    // The provenance half: the three sheets PR #1569 deleted must stay
    // deleted from BOTH sides — the mirror directory the crate compiles
    // and the upstream Vue source the sync script copies from. This is the
    // assertion that actually fails if someone resurrects a retired sheet
    // (adding it back to `OVERLAY_SHEETS` in scripts/sync-vue-mirror.py
    // puts the mirror file here and reddens this arm). comment-gate-ok: the arm below is the pin and was mutation-verified. the selector loop
    // above only catches the subset those sheets uniquely owned. comment-gate-ok: scope note for the narrower selector loop above.
    let upstream = vue_src().join("components");
    for retired_sheet in [
        "HkAltSignIn.scss",
        "HkThirdPartySignInCard.scss",
        "HkAuthMethodList.scss",
    ] {
        let mirrored = mirror_root().join("components").join(retired_sheet);
        assert!(
            !mirrored.exists(),
            "retired sheet {retired_sheet} came back into the vendored mirror"
        );
        // The upstream source only exists in a repo checkout (a crates.io
        // sdist carries the mirrors alone), so skip that half there.
        if upstream.is_dir() {
            assert!(
                !upstream.join(retired_sheet).exists(),
                "retired sheet {retired_sheet} came back into packages/vue"
            );
        }
    }

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
    const KNOWN_DUAL_SOURCES: [&str; 12] = [
        "hk-breadcrumb-dropdown-item",
        "hk-card",
        "hk-card-hoverable",
        "hk-icon",
        "hk-icon-button",
        "hk-icon-button-icon",
        "hk-input-wrapper",
        "hk-menu-divider",
        // Retired later with the legacy tabs/menu sheets (W8 theme wave).
        "hk-menu-item-icon",
        "hk-tabs",
        // Dead block inside the legacy image.scss (no Rust user); retires with it.
        "hk-logo",
        // Legacy menu.scss also paints hk-menu-list; retires with that sheet.
        "hk-menu-list",
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
        // Whole-source scan (rustfmt splits long `t(` calls across lines).
        let mut cursor = 0usize;
        while let Some(offset) = source[cursor..].find("components.hk.") {
            let at = cursor + offset;
            let rest = &source[at + "components.hk.".len()..];
            let key: String = rest
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric() || *c == '.' || *c == '-' || *c == '_')
                .collect();
            cursor = at + "components.hk.".len() + key.len();
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
            let translated = literal
                .chars()
                .any(|c| ('\u{3000}'..='\u{9fff}').contains(&c));
            if literal.is_empty() || translated {
                continue;
            }
            // Placeholder keys ({x}) compare with the placeholders stripped:
            // the surrounding copy must still agree (R3 M7 found them skipped).
            let strip = |text: &str| text.replace(['{', '}'], "");
            let needle = format!("hk.{key} = \"{}\"", strip(&literal));
            let bundle_stripped = bundle.replace(['{', '}'], "");
            if !bundle_stripped.contains(&needle) {
                mismatched.push(format!("{key}: code=\"{literal}\""));
            }
        }
    }
    assert!(
        mismatched.is_empty(),
        "bundle text disagrees with the code's English fallback: {mismatched:#?}"
    );
}

/// Every locale's `components.toml` must carry the SAME `hk.*` key set —
/// a locale missing a key (or carrying an extra one) silently diverges at
/// runtime: the English drift guard above only reads the en bundle, and
/// the en-literal comparison only checks keys the Rust sources reference.
/// Values are host-trust (untranslated keys stay permitted); the KEY SET
/// is not. Proven load-bearing by the close-out round's N4 mutation (a
/// zh-Hant value change — and, by the same blindness, any key drift —
/// left the whole suite green before this test existed).
#[test]
fn localized_component_bundles_carry_the_same_hk_keyset() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let locales_dir = root.join("../i18n/src/locales");
    let Ok(entries) = std::fs::read_dir(&locales_dir) else {
        // The i18n crate is a sibling checkout; skip when it is absent.
        return;
    };
    let mut reference: Option<(String, Vec<String>)> = None;
    let mut diverged: Vec<String> = Vec::new();
    let mut checked = 0usize;
    let mut locale_dirs: Vec<_> = entries
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| path.is_dir())
        .collect();
    locale_dirs.sort();
    for dir in locale_dirs {
        let bundle_path = dir.join("components.toml");
        let Ok(bundle) = std::fs::read_to_string(&bundle_path) else {
            continue;
        };
        let mut keys: Vec<String> = bundle
            .lines()
            .filter_map(|line| line.strip_prefix("hk."))
            .filter_map(|line| line.split(" =").next())
            .map(|key| key.trim().to_string())
            .filter(|key| !key.is_empty())
            .collect();
        keys.sort();
        checked += 1;
        match &reference {
            None => {
                reference = Some((
                    dir.file_name().unwrap().to_string_lossy().into_owned(),
                    keys,
                ))
            }
            Some((reference_locale, reference_keys)) => {
                let locale = dir.file_name().unwrap().to_string_lossy().into_owned();
                if keys != *reference_keys {
                    let missing: Vec<&String> = reference_keys
                        .iter()
                        .filter(|k| !keys.contains(k))
                        .collect();
                    let extra: Vec<&String> = keys
                        .iter()
                        .filter(|k| !reference_keys.contains(k))
                        .collect();
                    diverged.push(format!(
                        "{locale} vs {reference_locale}: missing {missing:?}, extra {extra:?}"
                    ));
                }
            }
        }
    }
    assert!(
        checked > 0,
        "no components.toml bundles found under {}",
        locales_dir.display()
    );
    assert!(
        diverged.is_empty(),
        "localized bundles diverge in their hk.* key set: {diverged:#?}"
    );
}

/// The screen-identify family's localized strings must BYTE-EQUAL the
/// canonical Vue dictionary (`hk.screenIdentify.<key>` ↔
/// `hikari::screenIdentify.<key>`). The solar test below established the
/// pattern for one shared surface; this family is the second one — a Vue-side
/// value edit must land on both sides together or this goes red.
#[test]
fn localized_screen_identify_values_match_the_vue_canonical_bundle() {
    let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let crate_locales = manifest.join("../i18n/src/locales");
    let vue_locales = manifest.join("../vue/src/i18n/locales");
    if !crate_locales.is_dir() || !vue_locales.is_dir() {
        // Vendored sdist: neither upstream tree ships; mirrors self-contained.
        return;
    }
    let mut mismatches: Vec<String> = Vec::new();
    let mut checked = 0usize;
    let mut locale_dirs: Vec<_> = std::fs::read_dir(&crate_locales)
        .expect("crate locales dir readable")
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| path.is_dir())
        .collect();
    locale_dirs.sort();
    for dir in locale_dirs {
        let locale = dir.file_name().unwrap().to_string_lossy().into_owned();
        let crate_path = dir.join("components.toml");
        let vue_path = vue_locales.join(&locale).join("components.json");
        let (Ok(crate_text), Ok(vue_text)) = (
            std::fs::read_to_string(&crate_path),
            std::fs::read_to_string(&vue_path),
        ) else {
            mismatches.push(format!("{locale}: bundle files unreadable"));
            continue;
        };
        for line in crate_text.lines() {
            let Some(rest) = line.strip_prefix("hk.screenIdentify.") else {
                continue;
            };
            let Some((key, raw_value)) = rest.split_once(" = ") else {
                continue;
            };
            let Some(value) = raw_value
                .strip_prefix('"')
                .and_then(|v| v.strip_suffix('"'))
            else {
                mismatches.push(format!("{locale}/{key}: unparseable crate line {line:?}"));
                continue;
            };
            let needle = format!("\"hikari::screenIdentify.{key}\": \"");
            let Some(vline) = vue_text.lines().find(|l| l.contains(&needle)) else {
                mismatches.push(format!("{locale}/{key}: missing from the vue bundle"));
                continue;
            };
            let Some(vue_value) = vline
                .split(&needle)
                .nth(1)
                .and_then(|tail| tail.strip_suffix("\",").or_else(|| tail.strip_suffix('"')))
            else {
                mismatches.push(format!("{locale}/{key}: unparseable vue line {vline:?}"));
                continue;
            };
            checked += 1;
            if vue_value != value {
                mismatches.push(format!("{locale}/{key}: crate={value:?} vue={vue_value:?}"));
            }
        }
    }
    assert!(
        checked > 0,
        "no screenIdentify keys compared — the extraction shapes drifted"
    );
    assert!(
        mismatches.is_empty(),
        "crate screenIdentify values drifted from the vue canonical: {mismatches:#?}"
    );
}

/// Every locale's crate solar strings must BYTE-EQUAL the canonical Vue
/// dictionary (`hk.solarLocationSetting.<key>` ↔
/// `hikari::theme.solar.<key>`): the two forms are one product surface,
/// so a value may only change on both sides together. The keyset gate
/// above proves presence and the en literal guard only pins the code
/// fallbacks — this closes the non-en VALUE gap the solar wave's
/// close-out rounds recorded (round 5 caught the fr hemisphere gender
/// regressing exactly through it).
#[test]
fn localized_solar_values_match_the_vue_canonical_bundle() {
    let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let crate_locales = manifest.join("../i18n/src/locales");
    let vue_locales = manifest.join("../vue/src/i18n/locales");
    if !crate_locales.is_dir() || !vue_locales.is_dir() {
        // The i18n / vue checkouts are siblings; a vendored sdist copy
        // carries neither upstream tree — the mirrors are self-contained.
        return;
    }
    let mut mismatches: Vec<String> = Vec::new();
    let mut checked = 0usize;
    let mut locale_dirs: Vec<_> = std::fs::read_dir(&crate_locales)
        .expect("crate locales dir readable")
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| path.is_dir())
        .collect();
    locale_dirs.sort();
    for dir in locale_dirs {
        let locale = dir.file_name().unwrap().to_string_lossy().into_owned();
        let crate_path = dir.join("components.toml");
        let vue_path = vue_locales.join(&locale).join("platform.json");
        let (Ok(crate_text), Ok(vue_text)) = (
            std::fs::read_to_string(&crate_path),
            std::fs::read_to_string(&vue_path),
        ) else {
            mismatches.push(format!("{locale}: bundle files unreadable"));
            continue;
        };
        for line in crate_text.lines() {
            let Some(rest) = line.strip_prefix("hk.solarLocationSetting.") else {
                continue;
            };
            let Some((key, raw_value)) = rest.split_once(" = ") else {
                continue;
            };
            let Some(value) = raw_value
                .strip_prefix('"')
                .and_then(|v| v.strip_suffix('"'))
            else {
                mismatches.push(format!("{locale}/{key}: unparseable crate line {line:?}"));
                continue;
            };
            let needle = format!("\"hikari::theme.solar.{key}\": \"");
            let Some(vline) = vue_text.lines().find(|l| l.contains(&needle)) else {
                mismatches.push(format!("{locale}/{key}: missing from the vue bundle"));
                continue;
            };
            let Some(vue_value) = vline
                .split(&needle)
                .nth(1)
                .and_then(|tail| tail.strip_suffix("\",").or_else(|| tail.strip_suffix('"')))
            else {
                mismatches.push(format!("{locale}/{key}: unparseable vue line {vline:?}"));
                continue;
            };
            checked += 1;
            if vue_value != value {
                mismatches.push(format!("{locale}/{key}: crate={value:?} vue={vue_value:?}"));
            }
        }
    }
    assert!(
        checked > 0,
        "no solar keys compared — the extraction shapes drifted"
    );
    assert!(
        mismatches.is_empty(),
        "crate solar values drifted from the vue canonical: {mismatches:#?}"
    );
}

/// The corner-badge sheet keys ALL of its geometry on `data-placement`
/// (2026-11-05: the four corner overlays plus the two side placements).
/// A hand-rolled Rust host that still emits the retired `data-corner`
/// attribute silently loses every inset rule — the mark falls back to its
/// static position and only the base translate applies. The filter/search
/// trigger dots shipped that way until the mirror review caught it, and
/// their unit tests were actively ratifying the dead attribute; this guard
/// couples the emitters to the sheet's vocabulary from now on.
#[test]
fn corner_badge_hosts_speak_the_sheets_data_placement_vocabulary() {
    let src = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut files = Vec::new();
    collect_files(&src, &mut files);
    let mut offenders = Vec::new();
    for file in &files {
        if file.extension().and_then(|e| e.to_str()) != Some("rs") {
            continue;
        }
        let source = std::fs::read_to_string(file).expect("read rust source");
        if source.contains("hk-corner-badge") && source.contains("data-corner") {
            offenders.push(file.display().to_string());
        }
    }
    assert!(
        offenders.is_empty(),
        "corner-badge geometry is keyed on data-placement; these sources still \
         carry data-corner (update the emitters and their doc contracts): {offenders:?}"
    );
}
