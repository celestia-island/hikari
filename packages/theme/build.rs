// hikari-theme/build.rs
// SCSS bundle build script using grass directly (no tairitsu-packager dep).

use anyhow::Result;
use std::{env, fs, path::Path};

fn main() -> Result<()> {
    println!("cargo:rerun-if-changed=styles");
    println!("cargo:rerun-if-changed=tailwind");

    build_scss_bundle()?;

    if env::var("CARGO_FEATURE_TAILWIND").is_ok() {
        build_tailwind_bundle()?;
    }

    Ok(())
}

fn build_scss_bundle() -> Result<()> {
    let out_dir = env::var("OUT_DIR")?;
    let styles_out_dir = Path::new(&out_dir).join("scss");
    fs::create_dir_all(&styles_out_dir)?;

    let manifest_dir_str = env::var("CARGO_MANIFEST_DIR")?;
    let manifest_dir = Path::new(&manifest_dir_str);
    let scss_dir = manifest_dir.join("styles");

    println!("cargo:warning=Compiling SCSS bundle...");

    let scss_files = find_scss_files(&scss_dir);
    let mut all_css = String::new();

    for scss_file in &scss_files {
        let mut options = grass::Options::default();
        options = options.load_path(&scss_dir);
        let css = grass::from_path(scss_file, &options)?;
        all_css.push_str(&css);
        all_css.push('\n');
    }

    let output_path = styles_out_dir.join("styles.css");
    fs::write(&output_path, &all_css)?;

    println!(
        "cargo:warning=SCSS bundle compiled: {} bytes",
        all_css.len()
    );
    Ok(())
}

fn find_scss_files(dir: &Path) -> Vec<std::path::PathBuf> {
    let mut files = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("scss") {
                files.push(path);
            }
        }
    }
    files.sort();
    files
}

fn build_tailwind_bundle() -> Result<()> {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR")?;
    let manifest_dir = Path::new(&manifest_dir);
    let package_json = manifest_dir.join("package.json");

    if !package_json.exists() {
        eprintln!("cargo:warning=Tailwind requested but package.json not found");
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

    println!("cargo:warning=Tailwind CSS compiled");
    Ok(())
}
