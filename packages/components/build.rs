// hikari-components/build.rs
// SCSS compilation is done at compile-time via tairitsu_macros::scss!
// in each component's StyledComponent::styles() method.
// This build script only handles the fallback case when theme styles
// are unavailable (crates.io consumption without workspace layout).

use std::{env, fs, path::Path};

fn main() {
    let out_dir = env::var("OUT_DIR").unwrap();
    let styles_out_dir = Path::new(&out_dir).join("styles");
    let _ = fs::create_dir_all(&styles_out_dir);

    let manifest_dir_str = env::var("CARGO_MANIFEST_DIR").unwrap();
    let manifest_dir = Path::new(&manifest_dir_str);

    let theme_styles_dir = manifest_dir.join("../theme/styles");
    if !theme_styles_dir.exists() {
        // Generate empty CSS stubs so include_str! in legacy paths resolves.
        let scss_dir = manifest_dir.join("src/styles/components");
        if scss_dir.exists() {
            if let Ok(entries) = fs::read_dir(&scss_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("scss") {
                        let stem = path.file_stem().unwrap().to_string_lossy().to_string();
                        let stub = styles_out_dir.join(format!("{stem}.css"));
                        let _ = fs::write(&stub, "");
                    }
                }
            }
        }
    }
}
