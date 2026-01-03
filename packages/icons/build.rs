use std::{env, path::Path};

fn main() {
    println!("cargo:rerun-if-changed=../../../scripts/build_lucide_assets.py");
    println!("cargo:rerun-if-changed=../../../scripts/generate_lucide_icons.py");
    println!("cargo:rerun-if-changed=assets");

    if env::var("CARGO_FEATURE_EMBEDDED").is_ok() {
        let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let assets_dir = Path::new(&manifest_dir).join("assets");
        let json_file = assets_dir.join("lucide_svgs.json");

        if !json_file.exists() {
            eprintln!("⚠️  Lucide SVG assets not found");
            eprintln!("   Run: cd packages/icons && npm run build");
            eprintln!("   Or run: python scripts/build_lucide_assets.py");
        } else {
            println!("✅ Lucide SVG assets ready");
        }
    }
}
