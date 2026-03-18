// hikari-components/build.rs
// SCSS build script using tairitsu-packager's ScssCompiler

use anyhow::Result;
use std::{env, fs, path::Path};

use tairitsu_packager::styles::ScssCompiler;

fn main() -> Result<()> {
    println!("cargo:rerun-if-changed=src/styles");

    let out_dir = env::var("OUT_DIR")?;
    let styles_out_dir = Path::new(&out_dir).join("styles");

    // Create output directory
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

    // Create compiler with default options (minify enabled)
    let compiler = ScssCompiler::new();

    // Compile each SCSS file
    for scss_path in scss_files {
        let relative_path = scss_path
            .strip_prefix(manifest_dir)?
            .to_string_lossy()
            .replace('\\', "/");

        compile_scss(&compiler, &scss_path, &styles_out_dir, &relative_path)?;
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

fn compile_scss(compiler: &ScssCompiler, full_path: &Path, output_dir: &Path, relative_path: &str) -> Result<()> {
    // Get filename without extension
    let css_name = full_path
        .file_name()
        .ok_or_else(|| anyhow::anyhow!("Failed to get filename from path: {:?}", full_path))?
        .to_string_lossy()
        .replace(".scss", ".css");

    // Compile SCSS to CSS using tairitsu-packager's compiler
    let css_content = compiler.compile_file(full_path)?;

    // Write to output directory
    let output_path = output_dir.join(&css_name);
    fs::write(&output_path, css_content)?;

    println!("   ✓ Compiled: {} -> {}", relative_path, css_name);
    Ok(())
}
