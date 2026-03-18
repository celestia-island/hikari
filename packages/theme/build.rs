// hikari-theme/build.rs
// SCSS bundle build script using tairitsu-packager

use anyhow::Result;
use std::{env, fs, path::Path};

use tairitsu_packager::styles::ScssCompiler;

fn main() -> Result<()> {
    println!("cargo:rerun-if-changed=styles");
    println!("cargo:rerun-if-changed=tailwind");

    // Build SCSS bundle
    build_scss_bundle()?;

    // Conditionally build Tailwind
    if env::var("CARGO_FEATURE_TAILWIND").is_ok() {
        build_tailwind_bundle()?;
    }

    Ok(())
}

fn build_scss_bundle() -> Result<()> {
    let out_dir = env::var("OUT_DIR")?;
    let styles_dir = Path::new(&out_dir).join("scss");
    fs::create_dir_all(&styles_dir)?;

    let manifest_dir_str = env::var("CARGO_MANIFEST_DIR")?;
    let manifest_dir = Path::new(&manifest_dir_str);
    let scss_dir = manifest_dir.join("styles");

    println!("🔨 Compiling SCSS bundle...");

    // Use tairitsu-packager's compile_scss_files helper
    let result = tairitsu_packager::styles::compile_scss_files(&scss_dir, &styles_dir)?;

    println!("✅ SCSS bundle compiled ({} bytes)", result.css.len());
    Ok(())
}

fn build_tailwind_bundle() -> Result<()> {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR")?;
    let manifest_dir = Path::new(&manifest_dir);
    let package_json = manifest_dir.join("package.json");

    if !package_json.exists() {
        eprintln!("⚠️  Tailwind requested but package.json not found");
        eprintln!("   Run: cd packages/theme && npm install");
        return Ok(());
    }

    let output = std::process::Command::new("npm")
        .args(["run", "build:tailwind"])
        .current_dir(manifest_dir)
        .output()?;

    if !output.status.success() {
        eprintln!("Tailwind build failed:");
        eprintln!("{}", String::from_utf8_lossy(&output.stderr));
        std::process::exit(1);
    }

    println!("✅ Tailwind CSS compiled");
    Ok(())
}
