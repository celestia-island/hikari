use std::path::Path;
use std::{env, fs};

use anyhow::Result;

fn main() -> Result<()> {
    println!("cargo:rerun-if-changed=src/styles");

    let out_dir = env::var("OUT_DIR")?;
    let styles_out_dir = Path::new(&out_dir).join("styles");
    fs::create_dir_all(&styles_out_dir)?;

    let manifest_dir = env::var("CARGO_MANIFEST_DIR")?;
    let manifest_dir = Path::new(&manifest_dir);

    let theme_styles_dir = find_theme_styles_dir(manifest_dir);

    let components_dir = manifest_dir.join("src/styles/components");
    let scss_files = discover_scss_files(&components_dir);
    if scss_files.is_empty() {
        return Ok(());
    }

    let Some(theme_dir) = theme_styles_dir else {
        eprintln!("Theme styles not found, skipping SCSS compilation");
        return Ok(());
    };

    use tairitsu_packager::styles::{CompilerOptions, ScssCompiler};

    let components_styles_dir = manifest_dir.join("src/styles");
    let compiler = ScssCompiler::with_options(CompilerOptions {
        minify: true,
        source_map: false,
        load_paths: vec![theme_dir, components_styles_dir],
    });

    for scss_path in &scss_files {
        let css_name = scss_path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .replace(".scss", ".css");
        let css_content = compiler.compile_file(scss_path)?;
        fs::write(styles_out_dir.join(&css_name), css_content)?;
    }

    Ok(())
}

fn find_theme_styles_dir(manifest_dir: &Path) -> Option<std::path::PathBuf> {
    let local = manifest_dir.join("../theme/styles");
    if local.exists() {
        return Some(local);
    }

    let output = std::process::Command::new("cargo")
        .args(["metadata", "--format-version=1"])
        .current_dir(manifest_dir)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let metadata: serde_json::Value = serde_json::from_slice(&output.stdout).ok()?;
    let packages = metadata.get("packages")?.as_array()?;

    for pkg in packages {
        if pkg.get("name")?.as_str()? == "hikari-theme" {
            let manifest_path = pkg.get("manifest_path")?.as_str()?;
            let theme_dir = Path::new(manifest_path).parent()?.join("styles");
            if theme_dir.exists() {
                return Some(theme_dir);
            }
        }
    }

    None
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
