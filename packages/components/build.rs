// hikari-components/build.rs
// SCSS 编译脚本 - 使用 Grass 在编译时转换 SCSS 为 CSS

use std::env;
use std::fs;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=src/styles");

    let out_dir = env::var("OUT_DIR").unwrap();
    let styles_dir = Path::new(&out_dir).join("styles");

    // 创建输出目录
    fs::create_dir_all(&styles_dir).unwrap();

    println!("🔨 Compiling SCSS files...");
    println!("   Output directory: {}", styles_dir.display());

    // 组件 SCSS 文件列表
    let scss_files = vec![
        // 基础组件
        "src/styles/components/button.scss",
        "src/styles/components/input.scss",
        "src/styles/components/card.scss",
        "src/styles/components/badge.scss",
        // 数据组件
        "src/styles/components/table.scss",
        "src/styles/components/tree.scss",
        "src/styles/components/pagination.scss",
        "src/styles/components/virtual-scroll.scss",
        "src/styles/components/collapse.scss",
        "src/styles/components/drag.scss",
        "src/styles/components/sort.scss",
        "src/styles/components/filter.scss",
        "src/styles/components/selection.scss",
        // 反馈组件
        "src/styles/components/alert.scss",
        "src/styles/components/toast.scss",
        "src/styles/components/tooltip.scss",
        // 导航组件
        "src/styles/components/menu.scss",
        "src/styles/components/tabs.scss",
        "src/styles/components/breadcrumb.scss",
    ];

    // 编译每个 SCSS 文件
    for scss_path in scss_files {
        let css_name = scss_path
            .rsplit('/')
            .next()
            .unwrap()
            .replace(".scss", ".css");

        match compile_scss(scss_path, &styles_dir, &css_name) {
            Ok(_) => println!("   ✓ Compiled: {}", css_name),
            Err(e) => {
                eprintln!("   ✗ Failed to compile {}: {}", scss_path, e);
                std::process::exit(1);
            }
        }
    }

    println!("✅ SCSS compilation complete!");
}

fn compile_scss(
    input_path: &str,
    output_dir: &Path,
    output_name: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let scss_content = fs::read_to_string(input_path)?;

    // 获取 theme SCSS 文件的路径
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let theme_vars = Path::new(&manifest_dir)
        .join("../theme/styles/variables.scss");
    let theme_mixins = Path::new(&manifest_dir)
        .join("../theme/styles/mixins.scss");

    // 读取 theme 文件内容
    let vars_content = fs::read_to_string(&theme_vars)?;
    let mut mixins_content = fs::read_to_string(&theme_mixins)?;

    // 移除 mixins.scss 中的 @use 语句（因为我们会先内联 variables）
    mixins_content = mixins_content.replace("@use './variables.scss' as *;", "// variables already inlined above");

    // 按正确顺序内联文件
    // 1. variables.scss (没有 @use 依赖)
    // 2. mixins.scss (依赖 variables，已移除 @use)
    // 3. 组件内容 (移除了 @use 语句)
    let inlined_content = format!(
        "// --- variables.scss (inlined) ---\n{}\n\n\
         // --- mixins.scss (inlined) ---\n{}\n\n\
         // --- component styles ---\n{}",
        vars_content,
        mixins_content,
        scss_content
            .replace("@use '../../../../theme/styles/variables.scss' as *;", "")
            .replace("@use '../../../../theme/styles/mixins.scss' as *;", "")
    );

    // 编译 SCSS 为 CSS（不需要 load_path）
    let grass_options = grass::Options::default();
    let css_content = grass::from_string(inlined_content, &grass_options)?;

    // 写入编译后的 CSS
    let output_path = output_dir.join(output_name);
    fs::write(&output_path, css_content)?;

    Ok(())
}
