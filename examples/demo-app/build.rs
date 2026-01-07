//! Build script for demo-app
//!
//! This script:
//! 1. Copies CSS bundle from workspace root
//! 2. Copies index.html to public/
//! 3. Sets up the development environment
//!
//! # IMPORTANT: Path Configuration
//!
//! Filesystem paths used here MUST match those defined in `src/paths.rs`:
//! - `public/assets` → assets_fs
//! - `public/styles` → styles_fs
//!
//! HTML paths in `index.html` must also match the paths in `src/paths.rs`:
//! - `/assets/*` → assets_mount
//! - `/styles/*` → styles_mount

use std::path::{Path, absolute as path_absolute};

/// Filesystem paths (MUST match src/paths.rs::STATIC_PATHS)
const PUBLIC_DIR: &str = "public";

fn main() {
    println!("cargo:warning=🏗️  demo-app build starting...");

    // Get current working directory for debugging
    if let Ok(cwd) = std::env::current_dir() {
        println!("cargo:warning=📂 Current dir: {:?}", cwd);
    }

    // Get the manifest directory
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set");
    let manifest_path = Path::new(&manifest_dir);

    println!("cargo:warning=📂 CARGO_MANIFEST_DIR: {:?}", manifest_dir);

    // Workspace root is two levels up from examples/demo-app
    // Use lexical path (not canonicalize) to avoid UNC path issues
    let workspace_root = manifest_path.join("../..");

    println!("cargo:warning=📂 Workspace root (relative): {:?}", workspace_root);

    // Use absolute() instead of canonicalize() to avoid UNC paths on Windows
    // UNC paths (\\?\...) don't work properly with some file operations
    let workspace_root = if let Ok(abs) = path_absolute(&workspace_root) {
        abs
    } else {
        workspace_root.clone()
    };

    println!("cargo:warning=📂 Workspace root (resolved): {:?}", workspace_root);

    // Create public directory paths (using lexical paths)
    let public_dir = workspace_root.join("public");
    let images_dir = public_dir.join("images");

    println!("cargo:warning=📂 Public dir: {:?}", public_dir);

    // Ensure public/images directory exists
    if let Err(e) = std::fs::create_dir_all(&images_dir) {
        println!("cargo:warning=⚠️  Failed to create public/images/: {}", e);
    }

    // Copy index.html to public/
    let index_src = manifest_path.join("index.html");
    let index_dst = public_dir.join("index.html");

    println!("cargo:warning=📄 Copying: {:?} -> {:?}", index_src, index_dst);

    if index_src.exists() {
        match std::fs::copy(&index_src, &index_dst) {
            Ok(bytes) => {
                println!("cargo:warning=📄 Copied index.html to public/ ({} bytes)", bytes);
                // Verify it actually exists
                if index_dst.exists() {
                    println!("cargo:warning=✅ Verification: index.html exists at {:?}", index_dst);
                } else {
                    println!("cargo:warning=❌ ERROR: index.html NOT found at {:?}", index_dst);
                }
            },
            Err(e) => println!("cargo:warning=⚠️  Failed to copy index.html: {}", e),
        }
    } else {
        println!("cargo:warning=⚠️  index.html not found at {:?}", index_src);
    }

    // Copy logo.png to public/images/
    let logo_src = workspace_root.join("docs/logo.png");
    let logo_dst = images_dir.join("logo.png");

    println!("cargo:warning=🖼️  Copying: {:?} -> {:?}", logo_src, logo_dst);

    if logo_src.exists() {
        match std::fs::copy(&logo_src, &logo_dst) {
            Ok(bytes) => {
                println!("cargo:warning=🖼️  Copied logo.png to public/images/ ({} bytes)", bytes);
                if logo_dst.exists() {
                    println!("cargo:warning=✅ Verification: logo.png exists at {:?}", logo_dst);
                } else {
                    println!("cargo:warning=❌ ERROR: logo.png NOT found at {:?}", logo_dst);
                }
            },
            Err(e) => println!("cargo:warning=⚠️  Failed to copy logo.png: {}", e),
        }
    } else {
        println!("cargo:warning=⚠️  logo.png not found at {:?} (optional)", logo_src);
    }

    println!("cargo:warning=✅ demo-app build completed!");

    // Tell cargo to rerun build.rs if these files change
    println!("cargo:rerun-if-changed=index.html");
    println!("cargo:rerun-if-changed=../../docs/logo.png");
}
