use anyhow::Result;
use std::{env, fs, path::Path};

fn main() -> Result<()> {
    println!("cargo:rerun-if-changed=src/styles");

    let out_dir = env::var("OUT_DIR")?;
    let styles_out_dir = Path::new(&out_dir).join("styles");
    fs::create_dir_all(&styles_out_dir)?;

    let manifest_dir = env::var("CARGO_MANIFEST_DIR")?;
    let css_dir = Path::new(&manifest_dir).join("src/styles/css");

    if css_dir.exists() {
        for entry in fs::read_dir(&css_dir)? {
            let entry = entry?;
            if entry.path().extension().and_then(|s| s.to_str()) == Some("css") {
                let file_name = entry.file_name();
                fs::copy(entry.path(), styles_out_dir.join(&file_name))?;
            }
        }
        return Ok(());
    }

    let theme_styles_dir = Path::new(&manifest_dir).join("../theme/styles");
    if !theme_styles_dir.exists() {
        return Ok(());
    }

    use tairitsu_packager::styles::{CompilerOptions, ScssCompiler};

    let components_dir = Path::new(&manifest_dir).join("src/styles/components");
    let scss_files = discover_scss_files(&components_dir);
    if scss_files.is_empty() {
        return Ok(());
    }

    let components_styles_dir = Path::new(&manifest_dir).join("src/styles");
    let compiler = ScssCompiler::with_options(CompilerOptions {
        minify: true,
        source_map: false,
        load_paths: vec![theme_styles_dir, components_styles_dir],
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
