// hikari-components/build.rs
// SCSS build script using grass directly (no tairitsu-packager dep).

use anyhow::Result;
use std::{env, fs, path::Path};

fn main() -> Result<()> {
    println!("cargo:rerun-if-changed=src/styles");

    let out_dir = env::var("OUT_DIR")?;
    let styles_out_dir = Path::new(&out_dir).join("styles");
    fs::create_dir_all(&styles_out_dir)?;

    let manifest_dir_str = env::var("CARGO_MANIFEST_DIR")?;
    let manifest_dir = Path::new(&manifest_dir_str);

    // Check if theme styles are available (they won't be when consumed from
    // crates.io without the workspace layout). Skip SCSS compilation if not.
    let theme_styles_dir = manifest_dir.join("../theme/styles");
    if !theme_styles_dir.exists() {
        // Generate empty CSS stubs for every SCSS file so include_str! resolves.
        let scss_dir = manifest_dir.join("src/styles/components");
        if scss_dir.exists() {
            if let Ok(entries) = fs::read_dir(&scss_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("scss") {
                        let stem = path.file_stem().unwrap().to_string_lossy().to_string();
                        let stub = styles_out_dir.join(format!("{stem}.css"));
                        fs::write(&stub, "")?;
                    }
                }
            }
        }
        return Ok(());
    }

    println!("🔨 Compiling component SCSS files...");

    let components_dir = manifest_dir.join("src/styles/components");
    let scss_files = discover_scss_files(&components_dir);

    if scss_files.is_empty() {
        return Ok(());
    }

    // Theme styles dir for resolving bare @use imports like 'variables'.
    let opts = grass::Options::default()
        .load_path(&theme_styles_dir)
        .load_path(manifest_dir.join("src/styles"));

    for scss_path in &scss_files {
        let css_name = scss_path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .replace(".scss", ".css");

        let css = grass::from_path(scss_path, &opts)?;

        let output_path = styles_out_dir.join(&css_name);
        fs::write(&output_path, css)?;
    }

    println!("✅ SCSS compilation complete!");
    Ok(())
}

fn discover_scss_files(dir: &Path) -> Vec<std::path::PathBuf> {
    let mut files = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("scss") {
                files.push(path);
            }
        }
    }
    files.sort();
    files
}
