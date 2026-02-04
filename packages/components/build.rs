// hikari-components/build.rs
// SCSS build script - auto-discovers and compiles SCSS files using Grass compiler

use anyhow::Result;
use std::{env, fs, path::Path};

use grass::Options;

fn main() -> Result<()> {
    println!("cargo:rerun-if-changed=src/styles");

    let out_dir = env::var("OUT_DIR")?;
    let styles_out_dir = Path::new(&out_dir).join("styles");

    // 创建输出目录
    fs::create_dir_all(&styles_out_dir)?;

    println!("🔨 Auto-discovering and compiling SCSS files...");

    let manifest_dir_str = env::var("CARGO_MANIFEST_DIR")?;
    let manifest_dir = Path::new(&manifest_dir_str);
    let components_dir = manifest_dir.join("src/styles/components");

    // Auto-discover all .scss files in components directory
    let scss_files = discover_scss_files(&components_dir);

    if scss_files.is_empty() {
        println!("⚠️  No SCSS files found in {}", components_dir.display());
        return Ok(());
    }

    println!("   Found {} SCSS file(s)", scss_files.len());

    // Always compile (in development, we want all styles available)
    for scss_path in scss_files {
        let relative_path = scss_path
            .strip_prefix(manifest_dir)?
            .to_string_lossy()
            .replace('\\', "/");

        compile_scss(&scss_path, &styles_out_dir, &relative_path)?;
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

    files.sort(); // Ensure consistent order
    files
}

fn compile_scss(full_path: &Path, output_dir: &Path, relative_path: &str) -> Result<()> {
    // Get filename without extension
    let css_name = full_path
        .file_name()
        .ok_or_else(|| anyhow::anyhow!("Failed to get filename from path: {:?}", full_path))?
        .to_string_lossy()
        .replace(".scss", ".css");

    // Set up Grass options with load path for theme package
    let manifest_dir_str = env::var("CARGO_MANIFEST_DIR")?;
    let manifest_dir = Path::new(&manifest_dir_str);
    let theme_styles_dir = manifest_dir.join("../theme/styles").canonicalize()?;

    let options = Options::default().load_path(&theme_styles_dir);

    // Compile SCSS to CSS using Grass (from_path handles imports correctly)
    let css_content = grass::from_path(full_path, &options)?;

    // Write to output directory
    let output_path = output_dir.join(&css_name);
    fs::write(&output_path, css_content)?;

    println!("   ✓ Compiled: {} -> {}", relative_path, css_name);
    Ok(())
}
