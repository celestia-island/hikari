// hikari-components/build.rs
// SCSS 编译脚本 - 使用 Grass 在编译时转换 SCSS 为 CSS
// 支持根据 feature flags 条件编译

use std::{env, fs, path::Path};

fn main() {
    println!("cargo:rerun-if-changed=styles");

    let out_dir = env::var("OUT_DIR").unwrap();
    let styles_dir = Path::new(&out_dir).join("styles");

    // 创建输出目录
    fs::create_dir_all(&styles_dir).unwrap();

    println!("🔨 Compiling SCSS files...");

    let scss_files = get_scss_files();

    for (feature_name, files) in scss_files {
        if feature_enabled(&feature_name) {
            for scss_path in files {
                if let Err(e) = compile_scss(scss_path, &styles_dir) {
                    eprintln!("   ✗ Failed to compile {} (feature: {}): {}", scss_path, feature_name, e);
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
                "styles/components/button.scss",
                "styles/components/input.scss",
                "styles/components/card.scss",
                "styles/components/badge.scss",
            ],
        ),
        (
            "feedback",
            vec![
                "styles/components/alert.scss",
                "styles/components/toast.scss",
                "styles/components/tooltip.scss",
            ],
        ),
        (
            "navigation",
            vec![
                "styles/components/menu.scss",
                "styles/components/tabs.scss",
                "styles/components/breadcrumb.scss",
            ],
        ),
        (
            "data",
            vec![
                "styles/components/table.scss",
                "styles/components/tree.scss",
                "styles/components/pagination.scss",
                "styles/components/virtual-scroll.scss",
                "styles/components/collapse.scss",
                "styles/components/drag.scss",
                "styles/components/sort.scss",
                "styles/components/filter.scss",
                "styles/components/selection.scss",
            ],
        ),
        // Individual components (check specific flag)
        ("button", vec!["styles/components/button.scss"]),
        ("input", vec!["styles/components/input.scss"]),
        ("card", vec!["styles/components/card.scss"]),
        ("badge", vec!["styles/components/badge.scss"]),
        ("alert", vec!["styles/components/alert.scss"]),
        ("toast", vec!["styles/components/toast.scss"]),
        ("tooltip", vec!["styles/components/tooltip.scss"]),
        ("menu", vec!["styles/components/menu.scss"]),
        ("tabs", vec!["styles/components/tabs.scss"]),
        ("breadcrumb", vec!["styles/components/breadcrumb.scss"]),
        ("table", vec!["styles/components/table.scss"]),
        ("tree", vec!["styles/components/tree.scss"]),
        ("pagination", vec!["styles/components/pagination.scss"]),
        (
            "virtual-scroll",
            vec!["styles/components/virtual-scroll.scss"],
        ),
        ("collapse", vec!["styles/components/collapse.scss"]),
        ("drag", vec!["styles/components/drag.scss"]),
        ("sort", vec!["styles/components/sort.scss"]),
        ("filter", vec!["styles/components/filter.scss"]),
        ("selection", vec!["styles/components/selection.scss"]),
    ]
}

fn feature_enabled(feature: &str) -> bool {
    // Check specific feature flag
    let feature_var = format!("CARGO_FEATURE_{}", feature.to_uppercase().replace("-", "_"));
    env::var(&feature_var).is_ok()
}

fn compile_scss(input_path: &str, output_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    // Normalize path separators
    let normalized_path = input_path.replace('/', std::path::MAIN_SEPARATOR_STR);
    let full_path = Path::new(&manifest_dir).join(&normalized_path);

    if !full_path.exists() {
        return Err(format!("File not found: {}", full_path.display()).into());
    }

    let scss_content = fs::read_to_string(&full_path)?;

    // 获取 theme SCSS 文件的路径
    let theme_vars = Path::new(&manifest_dir).join("../theme/styles/variables.scss");
    let theme_mixins = Path::new(&manifest_dir).join("../theme/styles/mixins.scss");

    // 读取 theme 文件内容
    let vars_content = fs::read_to_string(&theme_vars)?;
    let mut mixins_content = fs::read_to_string(&theme_mixins)?;

    // 移除 mixins.scss 中的 @use 语句（因为我们会先内联 variables）
    mixins_content = mixins_content.replace(
        "@use './variables.scss' as *;",
        "// variables already inlined above",
    );

    // 按正确顺序内联文件
    let inlined_content = format!(
        "// --- variables.scss (inlined) ---\n{}\n\n\
         // --- mixins.scss (inlined) ---\n{}\n\n\
         // --- component styles ---\n{}",
        vars_content,
        mixins_content,
        scss_content
            .replace("@use '../../../theme/styles/variables.scss' as *;", "")
            .replace("@use '../../../../theme/styles/variables.scss' as *;", "")
            .replace("@use '../../../theme/styles/mixins.scss' as *;", "")
            .replace("@use '../../../../theme/styles/mixins.scss' as *;", "")
    );

    // 编译 SCSS 为 CSS（不需要 load_path）
    let grass_options = grass::Options::default();
    let css_content = grass::from_string(inlined_content, &grass_options)?;

    // 写入编译后的 CSS
    let css_name = input_path
        .rsplit('/')
        .next()
        .unwrap()
        .replace(".scss", ".css");
    let output_path = output_dir.join(&css_name);
    fs::write(&output_path, css_content)?;

    println!("   ✓ Compiled: {}", css_name);
    Ok(())
}
