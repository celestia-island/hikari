//! Build script for website.
//!
//! It keeps website-local source assets ready for tairitsu-packager by
//! checking the staged `public/` directory and optionally running auxiliary
//! generation scripts when they exist.

use std::{path::{Path, absolute as path_absolute}, process::Command};

fn main() {
    println!("cargo:warning=🏗️  website build starting...");

    // Get workspace root first
    let workspace_root = get_workspace_root();

    // Step 1: Generate bulk import mod.rs files
    println!("cargo:warning=📦 Generating bulk imports...");
    let script_path = workspace_root.join("scripts/generate_bulk_imports.py");

    if script_path.exists() {
        match Command::new("python")
            .arg(&script_path)
            .current_dir(&workspace_root)
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    println!("cargo:warning=✅ Bulk imports generated successfully");
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    println!(
                        "cargo:warning=⚠️  Failed to generate bulk imports: {}",
                        stderr
                    );
                }
            }
            Err(e) => println!(
                "cargo:warning=⚠️  Failed to run generate_bulk_imports.py: {}",
                e
            ),
        }
    } else {
        println!(
            "cargo:warning=⚠️  generate_bulk_imports.py not found at {:?}",
            script_path
        );
    }

    // Get current working directory for debugging
    if let Ok(cwd) = std::env::current_dir() {
        println!("cargo:warning=📂 Current dir: {:?}", cwd);
    }

    // Get manifest directory
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set");
    let manifest_path = Path::new(&manifest_dir);

    println!("cargo:warning=📂 CARGO_MANIFEST_DIR: {:?}", manifest_dir);

    // Workspace root is two levels up from examples/website
    // Use lexical path (not canonicalize) to avoid UNC path issues
    let workspace_root = manifest_path.join("../..");

    println!(
        "cargo:warning=📂 Workspace root (relative): {:?}",
        workspace_root
    );

    // Use absolute() instead of canonicalize() to avoid UNC paths on Windows
    // UNC paths (\\?\...) don't work properly with some file operations
    let workspace_root = if let Ok(abs) = path_absolute(&workspace_root) {
        abs
    } else {
        workspace_root.clone()
    };

    println!(
        "cargo:warning=📂 Workspace root (resolved): {:?}",
        workspace_root
    );

    let staged_public_dir = manifest_path.join("public");
    let css_bundle_path = staged_public_dir.join("styles/bundle.css");

    println!(
        "cargo:warning=📂 Website staged public dir: {:?}",
        staged_public_dir
    );
    println!(
        "cargo:warning=🎨 Checking CSS bundle at {:?}",
        css_bundle_path
    );

    if let Err(e) = std::fs::create_dir_all(staged_public_dir.join("styles")) {
        println!(
            "cargo:warning=⚠️  Failed to create staged public/styles directory: {}",
            e
        );
    }

    if css_bundle_path.exists() {
        if let Ok(metadata) = css_bundle_path.metadata() {
            let size = metadata.len();
            println!("cargo:warning=🎨 CSS bundle found: {} bytes", size);
            if size == 0 {
                println!(
                    "cargo:warning=⚠️  CSS bundle is empty! Run 'just build-dev' to regenerate"
                );
            }
        }
    } else {
        println!(
            "cargo:warning=⚠️  CSS bundle not found at {:?}",
            css_bundle_path
        );
        println!(
            "cargo:warning=⚠️  Run 'tairitsu build' or 'just dev' to generate it"
        );
    }

    println!("cargo:warning=✅ website build completed!");

    // Tell cargo to rerun build.rs if these files change
    println!("cargo:rerun-if-changed=public");
    println!("cargo:rerun-if-changed=../../scripts/generate_bulk_imports.py");
    println!("cargo:rerun-if-changed=src/components");
    println!("cargo:rerun-if-changed=src/pages");
    println!("cargo:rerun-if-changed=../../docs");
}

/// Get workspace root directory
fn get_workspace_root() -> std::path::PathBuf {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set");
    let manifest_path = Path::new(&manifest_dir);

    // Workspace root is two levels up from examples/website
    let workspace_root = manifest_path.join("../..");

    if let Ok(abs) = path_absolute(&workspace_root) {
        abs
    } else {
        workspace_root
    }
}
