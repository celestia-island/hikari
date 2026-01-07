// hikari-components/build.rs
// SCSS build script - compiles SCSS files to CSS using Grass compiler

use std::{env, fs, path::Path};
use grass::Options;

fn main() {
    println!("cargo:rerun-if-changed=src/styles");

    let out_dir = env::var("OUT_DIR").unwrap();
    let styles_out_dir = Path::new(&out_dir).join("styles");

    // 创建输出目录
    fs::create_dir_all(&styles_out_dir).unwrap();

    println!("🔨 Compiling SCSS files with Grass...");

    let scss_files = get_scss_files();

    for (feature_name, files) in scss_files {
        if feature_enabled(&feature_name) {
            for scss_path in files {
                if let Err(e) = compile_scss(scss_path, &styles_out_dir) {
                    eprintln!("   ✗ Failed to compile {}: {}", scss_path, e);
                    std::process::exit(1);
                }
            }
        }
    }

    println!("✅ SCSS compilation complete!");
}

fn get_scss_files() -> Vec<(&'static str, Vec<&'static str>)> {
    vec![
        // Component groups (check group flag)
        (
            "basic",
            vec![
                "src/styles/components/button.scss",
                "src/styles/components/input.scss",
                "src/styles/components/card.scss",
                "src/styles/components/badge.scss",
            ],
        ),
        (
            "feedback",
            vec![
                "src/styles/components/alert.scss",
                "src/styles/components/toast.scss",
                "src/styles/components/tooltip.scss",
            ],
        ),
        (
            "navigation",
            vec![
                "src/styles/components/menu.scss",
                "src/styles/components/tabs.scss",
                "src/styles/components/breadcrumb.scss",
            ],
        ),
        (
            "data",
            vec![
                "src/styles/components/table.scss",
                "src/styles/components/tree.scss",
                "src/styles/components/pagination.scss",
            ],
        ),
        (
            "layout",
            vec![
                "src/styles/components/layout.scss",
                "src/styles/components/header.scss",
                "src/styles/components/aside.scss",
                "src/styles/components/container.scss",
                "src/styles/components/grid.scss",
                "src/styles/components/section.scss",
            ],
        ),
        // Individual components (check specific flag)
        ("button", vec!["src/styles/components/button.scss"]),
        ("input", vec!["src/styles/components/input.scss"]),
        ("card", vec!["src/styles/components/card.scss"]),
        ("badge", vec!["src/styles/components/badge.scss"]),
        ("alert", vec!["src/styles/components/alert.scss"]),
        ("toast", vec!["src/styles/components/toast.scss"]),
        ("tooltip", vec!["src/styles/components/tooltip.scss"]),
        ("menu", vec!["src/styles/components/menu.scss"]),
        ("tabs", vec!["src/styles/components/tabs.scss"]),
        ("breadcrumb", vec!["src/styles/components/breadcrumb.scss"]),
        ("table", vec!["src/styles/components/table.scss"]),
        ("tree", vec!["src/styles/components/tree.scss"]),
        ("pagination", vec!["src/styles/components/pagination.scss"]),
        ("layout-component", vec!["src/styles/components/layout.scss"]),
        ("header", vec!["src/styles/components/header.scss"]),
        ("aside", vec!["src/styles/components/aside.scss"]),
    ]
}

fn feature_enabled(feature: &str) -> bool {
    // First check group flags
    let group_features = ["basic", "feedback", "navigation", "data", "layout"];
    for group in group_features {
        if env::var(format!("CARGO_FEATURE_{}", group.to_uppercase())).is_ok() {
            return true;
        }
    }

    // Then check individual component flags
    env::var(format!("CARGO_FEATURE_{}", feature.to_uppercase())).is_ok()
}

fn compile_scss(input_path: &str, output_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")?;
    let full_path = Path::new(&manifest_dir).join(input_path);

    // Get filename without path and extension
    let css_name = full_path
        .file_name()
        .unwrap()
        .to_string_lossy()
        .replace(".scss", ".css");

    // Set up Grass options with load path for theme package
    let theme_styles_dir = Path::new(&manifest_dir)
        .join("../theme/styles")
        .canonicalize()?;

    let options = Options::default().load_path(&theme_styles_dir);

    // Compile SCSS to CSS using Grass (from_path handles imports correctly)
    let css_content = grass::from_path(&full_path, &options)?;

    // Write to output directory
    let output_path = output_dir.join(&css_name);
    fs::write(&output_path, css_content)?;

    println!("   ✓ Compiled: {} -> {}", input_path, css_name);
    Ok(())
}
