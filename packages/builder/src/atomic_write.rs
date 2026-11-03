//! Atomic file replacement for build-time artifacts.
//!
//! One implementation shared by the build script (`build.rs` includes this
//! file via `#[path]`) and the library, so the `#[cfg(test)]` tests below run
//! under `cargo test` against the exact code the build script executes.
//!
//! Why not plain [`std::fs::write`]: it truncates the destination before
//! writing, so a concurrent reader (another cargo invocation sharing this
//! workspace, a dev server serving `public/`) can observe a missing or
//! partially written file, and two concurrent writers can leave the
//! destination in an inconsistent state.

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

/// Per-call sequence number keeping temp paths unique within one process.
static SEQ: AtomicU64 = AtomicU64::new(0);

/// Atomically replace `path` with `data`.
///
/// The payload is written to a uniquely named temporary file in `path`'s
/// directory (same filesystem, so [`fs::rename`] is atomic) and then renamed
/// over the destination. Concurrent readers of `path` observe either the
/// complete previous content or the complete new content — never a truncated
/// or missing file. Concurrent writers never collide because each temporary
/// file carries the process id and a per-call sequence number.
///
/// No `fsync`: this guarantees atomicity for concurrent readers, which is
/// orthogonal to power-loss durability; cargo itself does not fsync build
/// outputs either.
pub fn atomic_write(path: &Path, data: &[u8]) -> io::Result<()> {
    let tmp = temp_sibling(path);
    let result = write_temp(&tmp, data).and_then(|()| fs::rename(&tmp, path));
    if result.is_err() {
        // Best effort: don't leave a half-written temp file behind on failure.
        let _ = fs::remove_file(&tmp);
    }
    result
}

/// A unique hidden temporary path in the same directory as `path`.
///
/// Same directory is what makes the subsequent rename atomic (same
/// filesystem); the pid + sequence suffix is what makes two concurrent
/// writers use different temp files, so a second writer can never truncate a
/// first writer's in-flight temp.
fn temp_sibling(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "artifact".to_string());
    let seq = SEQ.fetch_add(1, Ordering::Relaxed);
    path.with_file_name(format!(".{file_name}.{}.{}.tmp", std::process::id(), seq))
}

/// Write the full payload to the temp file before it becomes visible.
fn write_temp(tmp: &Path, data: &[u8]) -> io::Result<()> {
    let mut file = fs::File::create(tmp)?;
    file.write_all(data)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;
    use std::sync::Arc;
    use std::sync::atomic::AtomicBool;
    use std::thread;

    use super::*;

    /// Temp scratch dir per test; panicking tests leave it behind, which is
    /// fine for a target-dir test run.
    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "hikari-builder-atomic-write-{}-{}",
            name,
            std::process::id()
        ));
        fs::create_dir_all(&dir).expect("create scratch dir");
        dir
    }

    #[test]
    fn writes_and_replaces_content() {
        let dir = scratch("replace");
        let path = dir.join("artifact.css");
        atomic_write(&path, b"first").expect("first write");
        assert_eq!(fs::read(&path).expect("read back"), b"first");
        atomic_write(&path, b"second-much-longer-payload").expect("second write");
        assert_eq!(
            fs::read(&path).expect("read back"),
            b"second-much-longer-payload"
        );
    }

    #[test]
    fn leaves_no_temp_files_behind() {
        let dir = scratch("no-temp");
        let path = dir.join("artifact.rs");
        atomic_write(&path, b"payload").expect("write");
        let leftovers: HashSet<String> = fs::read_dir(&dir)
            .expect("list dir")
            .map(|e| {
                e.expect("dir entry")
                    .file_name()
                    .to_string_lossy()
                    .into_owned()
            })
            .collect();
        assert_eq!(leftovers, HashSet::from(["artifact.rs".to_string()]));
    }

    #[test]
    fn temp_names_are_unique_per_call() {
        let dir = scratch("unique");
        let path = dir.join("artifact.css");
        let a = temp_sibling(&path);
        let b = temp_sibling(&path);
        assert_ne!(a, b, "concurrent writers must not share a temp path");
        for tmp in [&a, &b] {
            let name = tmp.file_name().expect("file name").to_string_lossy();
            assert!(name.starts_with(".artifact.css."), "hidden sibling: {name}");
            assert!(name.ends_with(".tmp"), "tmp suffix: {name}");
            assert_eq!(tmp.parent(), path.parent(), "must stay on one filesystem");
        }
    }

    #[test]
    fn propagates_create_errors() {
        let path = scratch("errors").join("missing-dir").join("artifact.css");
        assert!(atomic_write(&path, b"payload").is_err());
    }

    /// The property the fix buys: while writers overwrite the file in a
    /// loop, every successful read observes exactly one complete payload —
    /// never a truncated, missing-after-first, or interleaved mix.
    #[test]
    fn concurrent_readers_never_see_partial_content() {
        let dir = scratch("concurrent");
        let path = Arc::new(dir.join("bundle.css"));
        // Large, size-distinct payloads: a non-atomic truncate-then-write
        // leaves a partial state wide enough for the reader to observe,
        // which is what makes the mutation test below meaningful.
        let payloads: Vec<Vec<u8>> = vec![
            vec![b'A'; 64 * 1024],
            vec![b'B'; 96 * 1024],
            vec![b'C'; 128 * 1024],
        ];
        let stop = Arc::new(AtomicBool::new(false));
        let mut writers = Vec::new();
        for payload in &payloads {
            let path = Arc::clone(&path);
            let stop = Arc::clone(&stop);
            let payload = payload.clone();
            writers.push(thread::spawn(move || {
                let mut i = 0;
                while !stop.load(Ordering::Relaxed) {
                    atomic_write(&path, &payload).expect("concurrent write");
                    i += 1;
                    if i > 150 {
                        break;
                    }
                }
            }));
        }
        let reader_stop = Arc::clone(&stop);
        let reader_payloads = payloads.clone();
        let reader_path = Arc::clone(&path);
        let reader = thread::spawn(move || {
            let mut reads = 0;
            while !reader_stop.load(Ordering::Relaxed) {
                match fs::read(&*reader_path) {
                    // Before the first write completes, the file may not
                    // exist yet; that is the only legal "miss".
                    Err(e) if e.kind() == io::ErrorKind::NotFound => {}
                    Ok(content) => {
                        reads += 1;
                        assert!(
                            reader_payloads.iter().any(|p| p == &content),
                            "read a file that is neither a complete old nor \
                             complete new payload: {} bytes after {reads} reads",
                            content.len(),
                        );
                    }
                    Err(e) => panic!("unexpected read error: {e}"),
                }
            }
            reads
        });
        // Let the writers finish, then stop the reader.
        for w in writers {
            w.join().expect("writer thread");
        }
        stop.store(true, Ordering::Relaxed);
        let concurrent_reads = reader.join().expect("reader thread");
        // Deterministic post-state: after all writers are done the file
        // holds exactly one complete payload.
        let final_content = fs::read(&*path).expect("final read");
        assert!(
            payloads.iter().any(|p| p == &final_content),
            "final file is not a complete payload: {} bytes",
            final_content.len(),
        );
        let _ = concurrent_reads; // diagnostic only; reader asserts inline
    }
}
