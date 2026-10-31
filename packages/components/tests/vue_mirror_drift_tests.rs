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
        let (mirror_rel, upstream_rel) = line.split_once('\t').unwrap_or_else(|| {
            panic!("manifest row is not <mirror>\\t<upstream>: {line:?}")
        });
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
fn strip_provenance_header(source: &str) -> &str {
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
    for row in read_manifest() {
        let mirror_path = mirror_root().join(&row.mirror_rel);
        let text = std::fs::read_to_string(&mirror_path)
            .unwrap_or_else(|e| panic!("read {}: {e}", mirror_path.display()));
        assert!(
            text.contains("do not hand-edit here."),
            "mirror {} lost its provenance header",
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
        let upstream = std::fs::read_to_string(&upstream_path).unwrap_or_else(|e| {
            panic!("read upstream {}: {e}", upstream_path.display())
        });
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

fn collect_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let entries = std::fs::read_dir(dir).unwrap_or_else(|e| {
        panic!("read_dir {}: {e}", dir.display())
    });
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_files(&path, out);
        } else {
            out.push(path);
        }
    }
}
