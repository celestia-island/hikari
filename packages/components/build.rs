// hikari-components/build.rs
// CSS build script - copies CSS files to OUT_DIR for compile-time inclusion

use std::{env, fs, path::Path};

fn main() {
    println!("cargo:rerun-if-changed=styles");

    let out_dir = env::var("OUT_DIR").unwrap();
    let styles_out_dir = Path::new(&out_dir).join("styles");

    // 创建输出目录
    fs::create_dir_all(&styles_out_dir).unwrap();

    println!("🔨 Copying CSS files...");

    let css_files = get_css_files();

    for (feature_name, files) in css_files {
        if feature_enabled(&feature_name) {
            for css_path in files {
                if let Err(e) = copy_css(css_path, &styles_out_dir) {
                    eprintln!("   ✗ Failed to copy {}: {}", css_path, e);
                    std::process::exit(1);
                }
            }
        }
    }

    println!("✅ CSS file copy complete!");
}

fn get_css_files() -> Vec<(&'static str, Vec<&'static str>)> {
    vec![
        // Component groups (check group flag)
        (
            "basic",
            vec![
                "styles/components/button.css",
                "styles/components/input.css",
                "styles/components/card.css",
                "styles/components/badge.css",
            ],
        ),
        (
            "feedback",
            vec![
                "styles/components/alert.css",
                "styles/components/toast.css",
                "styles/components/tooltip.css",
            ],
        ),
        (
            "navigation",
            vec![
                "styles/components/menu.css",
                "styles/components/tabs.css",
                "styles/components/breadcrumb.css",
            ],
        ),
        (
            "data",
            vec![
                "styles/components/table.css",
                "styles/components/tree.css",
                "styles/components/pagination.css",
                "styles/components/virtual-scroll.css",
                "styles/components/collapse.css",
                "styles/components/drag.css",
                "styles/components/sort.css",
                "styles/components/filter.css",
                "styles/components/selection.css",
            ],
        ),
        // Individual components (check specific flag)
        ("button", vec!["styles/components/button.css"]),
        ("input", vec!["styles/components/input.css"]),
        ("card", vec!["styles/components/card.css"]),
        ("badge", vec!["styles/components/badge.css"]),
        ("alert", vec!["styles/components/alert.css"]),
        ("toast", vec!["styles/components/toast.css"]),
        ("tooltip", vec!["styles/components/tooltip.css"]),
        ("menu", vec!["styles/components/menu.css"]),
        ("tabs", vec!["styles/components/tabs.css"]),
        ("breadcrumb", vec!["styles/components/breadcrumb.css"]),
        ("table", vec!["styles/components/table.css"]),
        ("tree", vec!["styles/components/tree.css"]),
        ("pagination", vec!["styles/components/pagination.css"]),
        ("virtual-scroll", vec!["styles/components/virtual-scroll.css"]),
        ("collapse", vec!["styles/components/collapse.css"]),
        ("drag", vec!["styles/components/drag.css"]),
        ("sort", vec!["styles/components/sort.css"]),
        ("filter", vec!["styles/components/filter.css"]),
        ("selection", vec!["styles/components/selection.css"]),
    ]
}

fn feature_enabled(feature: &str) -> bool {
    // First check group flags
    let group_features = ["basic", "feedback", "navigation", "data"];
    for group in group_features {
        if env::var(format!("CARGO_FEATURE_{}", group.to_uppercase())).is_ok() {
            return true;
        }
    }

    // Then check individual component flags
    env::var(format!("CARGO_FEATURE_{}", feature.to_uppercase())).is_ok()
}

fn copy_css(input_path: &str, output_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let full_path = Path::new(&manifest_dir).join(input_path);

    let css_content = fs::read_to_string(&full_path)?;

    // Get filename without path
    let css_name = full_path
        .file_name()
        .unwrap()
        .to_string_lossy()
        .into_owned();

    // Write to output directory
    let output_path = output_dir.join(&css_name);
    fs::write(&output_path, css_content)?;

    println!("   ✓ Copied: {}", css_name);
    Ok(())
}
