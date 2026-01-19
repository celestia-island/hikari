//! Build script for website
//!
//! This script:
//! 1. Generates bulk import mod.rs files using include! macros
//! 2. Copies index.html to public/
//! 3. Sets up development environment
//!
//! # IMPORTANT: Path Configuration
//!
//! Filesystem paths used here MUST match those defined in `src/paths.rs`:
//! - `public/assets` → assets_fs
//! - `public/styles` → styles_fs
//!
//! HTML paths in `index.html` must also match paths in `src/paths.rs`:
//! - `/assets/*` → assets_mount
//! - `/styles/*` → styles_mount

use std::{
    path::{absolute as path_absolute, Path},
    process::Command,
};

/// Filesystem paths (MUST match src/paths.rs::STATIC_PATHS)
#[allow(dead_code)]
const PUBLIC_DIR: &str = "public";

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

    // Create public directory paths (using lexical paths)
    let root_public_dir = workspace_root.join("public");
    let images_dir = root_public_dir.join("images");

    println!("cargo:warning=📂 Root public dir: {:?}", root_public_dir);

    // Ensure root public/images directory exists
    if let Err(e) = std::fs::create_dir_all(&images_dir) {
        println!("cargo:warning=⚠️  Failed to create public/images/: {}", e);
    }

    // Copy index.html to root public/
    let index_src = manifest_path.join("index.html");
    let index_dst = root_public_dir.join("index.html");

    println!(
        "cargo:warning=📄 Copying: {:?} -> {:?}",
        index_src, index_dst
    );

    if index_src.exists() {
        match std::fs::copy(&index_src, &index_dst) {
            Ok(bytes) => {
                println!(
                    "cargo:warning=📄 Copied index.html to public/ ({} bytes)",
                    bytes
                );
                // Verify it actually exists
                if index_dst.exists() {
                    println!(
                        "cargo:warning=✅ Verification: index.html exists at {:?}",
                        index_dst
                    );
                } else {
                    println!(
                        "cargo:warning=❌ ERROR: index.html NOT found at {:?}",
                        index_dst
                    );
                }
            }
            Err(e) => println!("cargo:warning=⚠️  Failed to copy index.html: {}", e),
        }
    } else {
        println!("cargo:warning=⚠️  index.html not found at {:?}", index_src);
    }

    // Copy logo.png to root public/images/
    let logo_src = workspace_root.join("docs/logo.png");
    let logo_dst = images_dir.join("logo.png");

    println!(
        "cargo:warning=🖼️  Copying: {:?} -> {:?}",
        logo_src, logo_dst
    );

    if logo_src.exists() {
        match std::fs::copy(&logo_src, &logo_dst) {
            Ok(bytes) => {
                println!(
                    "cargo:warning=🖼️  Copied logo.png to public/images/ ({} bytes)",
                    bytes
                );
                if logo_dst.exists() {
                    println!(
                        "cargo:warning=✅ Verification: logo.png exists at {:?}",
                        logo_dst
                    );
                } else {
                    println!(
                        "cargo:warning=❌ ERROR: logo.png NOT found at {:?}",
                        logo_dst
                    );
                }
            }
            Err(e) => println!("cargo:warning=⚠️  Failed to copy logo.png: {}", e),
        }
    } else {
        println!(
            "cargo:warning=⚠️  logo.png not found at {:?} (optional)",
            logo_src
        );
    }

    // Check CSS bundle
    let css_bundle_path = root_public_dir.join("styles/bundle.css");

    println!(
        "cargo:warning=🎨 Checking CSS bundle at {:?}",
        css_bundle_path
    );

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
        println!("cargo:warning=⚠️  Run 'just build-dev' to generate it");
    }

    println!("cargo:warning=✅ website build completed!");

    // Tell cargo to rerun build.rs if these files change
    println!("cargo:rerun-if-changed=index.html");
    println!("cargo:rerun-if-changed=../../docs/logo.png");
    println!("cargo:rerun-if-changed=../../scripts/generate_bulk_imports.py");
    println!("cargo:rerun-if-changed=src/components");
    println!("cargo:rerun-if-changed=src/pages");
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
