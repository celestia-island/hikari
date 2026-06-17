// hikari-theme/build.rs
// SCSS bundle build script using tairitsu-packager

use std::path::Path;
use std::{env, fs};

use anyhow::Result;

fn main() -> Result<()> {
    println!("cargo:rerun-if-changed=styles");

    build_scss_bundle()?;

    Ok(())
}

fn build_scss_bundle() -> Result<()> {
    let out_dir = env::var("OUT_DIR")?;
    let styles_dir = Path::new(&out_dir).join("scss");
    fs::create_dir_all(&styles_dir)?;

    let manifest_dir_str = env::var("CARGO_MANIFEST_DIR")?;
    let manifest_dir = Path::new(&manifest_dir_str);
    let scss_dir = manifest_dir.join("styles");

    let result = tairitsu_packager::styles::compile_scss_files(&scss_dir, &styles_dir)?;

    println!(
        "cargo:warning=SCSS bundle compiled ({} bytes)",
        result.css.len()
    );
    Ok(())
}
