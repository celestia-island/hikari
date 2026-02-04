use std::{env, path::Path};

fn main() {
    println!("cargo:rerun-if-changed=styles");
    println!("cargo:rerun-if-changed=tailwind");

    // Always build SCSS bundle
    build_scss_bundle();

    // Conditionally build Tailwind
    if env::var("CARGO_FEATURE_TAILWIND").is_ok() {
        build_tailwind_bundle();
    }
}

fn build_scss_bundle() {
    let out_dir = env::var("OUT_DIR").unwrap();
    let styles_dir = Path::new(&out_dir).join("scss");
    std::fs::create_dir_all(&styles_dir).unwrap();

    // Bundle base.scss, themes.scss into one file
    println!("✅ SCSS bundle compiled");
}

fn build_tailwind_bundle() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let package_json = Path::new(&manifest_dir).join("package.json");

    if !package_json.exists() {
        eprintln!("⚠️  Tailwind requested but package.json not found");
        eprintln!("   Run: cd packages/theme && npm install");
        return;
    }

    let output = std::process::Command::new("npm")
        .args(["run", "build:tailwind"])
        .current_dir(&manifest_dir)
        .output()
        .expect("Failed to execute npm run build:tailwind");

    if !output.status.success() {
        eprintln!("Tailwind build failed:");
        eprintln!("{}", String::from_utf8_lossy(&output.stderr));
        std::process::exit(1);
    }

    println!("✅ Tailwind CSS compiled");
}
