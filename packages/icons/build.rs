//! Build script for hikari-icons
//!
//! Generates selected MDI icons at build time.

use std::path::PathBuf;

use hikari_builder::icons::{auto_discovery, IconConfig, IconSelection, MdiStyle};

fn main() {
    println!("cargo:warning=🎨 hikari-icons: Building selected MDI icons...");

    // Check if dynamic-fetch feature is enabled
    let is_dynamic = std::env::var("CARGO_FEATURE_DYNAMIC_FETCH").is_ok();

    if is_dynamic {
        println!("cargo:warning=🌐 Dynamic icon fetching enabled");

        // Generate shared icon route
        let icon_route = "/api/icons";

        // Set environment variable for compile-time use (removes icon_route.txt dependency)
        println!("cargo:rustc-env=HIKARI_ICON_ROUTE={}", icon_route);

        println!("cargo:warning=   Icon route: {}", icon_route);
        println!(
            "cargo:warning=   Render-service should serve icons at: {}",
            icon_route
        );
    } else {
        // Set default icon route when dynamic-fetch is disabled
        let icon_route = "/static/dynamic-icons";
        println!("cargo:rustc-env=HIKARI_ICON_ROUTE={}", icon_route);
    }

    // Find workspace root
    let workspace_root = find_workspace_root();

    // Try to auto-discover icon usage
    let icon_selection = if let Ok(usage) = auto_discovery::scan_icon_usage(&workspace_root) {
        if !usage.icons.is_empty() {
            println!(
                "cargo:warning=🔍 Auto-discovered {} icons from workspace",
                usage.icons.len()
            );
            auto_discovery::print_usage_report(&usage);
            let selection = auto_discovery::generate_selection(&usage);
            IconSelection::ByName(selection)
        } else {
            println!("cargo:warning=⚠️  No icon usage detected, using default icon set");
            get_default_icon_selection()
        }
    } else {
        println!("cargo:warning=⚠️  Auto-discovery failed, using default icon set");
        get_default_icon_selection()
    };

    let config = IconConfig {
        selection: icon_selection,
        styles: vec![MdiStyle::Filled, MdiStyle::Outline],
        output_file: "src/generated/mdi_selected.rs".into(),
        ..Default::default()
    };

    match hikari_builder::icons::build_selected_icons(&config) {
        Ok(()) => {
            println!("cargo:warning=✅ MDI icons built successfully");
            let generated_path = std::path::Path::new("src/generated/mdi_selected.rs");
            if let Ok(content) = std::fs::read_to_string(generated_path) {
                let line_count = content.lines().count();
                if line_count > 50 {
                    println!("cargo:warning=   Generated {} lines", line_count);
                } else {
                    println!(
                        "cargo:warning=⚠️  Generated only {} lines - file may be incomplete!",
                        line_count
                    );
                }
            }
        }
        Err(e) => {
            eprintln!("❌ BUILD ERROR: Failed to build MDI icons");
            eprintln!("   Error: {}", e);
            eprintln!("");
            eprintln!(
                "   Solution: Run 'python scripts/icons/fetch_mdi_icons.py' to download icons"
            );
            eprintln!("");
            eprintln!("   This is required because icons are fetched at build time");
            eprintln!("   from the generated cache directory.");
            eprintln!("");
            eprintln!("   Cache location: packages/builder/generated/mdi_svgs/");
            std::process::exit(1);
        }
    }

    println!("cargo:rerun-if-changed=../../packages/builder/generated/mdi_svgs");
    println!("cargo:rerun-if-changed=../../packages/builder/generated/mdi_styles.json");
}

fn find_workspace_root() -> PathBuf {
    let mut current = std::env::var("CARGO_MANIFEST_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));

    loop {
        let cargo_toml = current.join("Cargo.toml");
        if cargo_toml.exists() {
            if let Ok(content) = std::fs::read_to_string(&cargo_toml) {
                if content.contains("[workspace]") {
                    return current;
                }
            }
        }

        match current.parent() {
            Some(parent) if parent != current => {
                current = parent.to_path_buf();
            }
            _ => {
                panic!("Workspace root not found");
            }
        }
    }
}

fn get_default_icon_selection() -> IconSelection {
    IconSelection::ByName(vec![
        "chevron-left".into(),
        "chevron-right".into(),
        "chevron-up".into(),
        "chevron-down".into(),
        "chevron-double-right".into(),
        "menu".into(),
        "close".into(),
        "magnify".into(),
        "cog".into(),
        "check".into(),
        "gesture-tap".into(),
        "translate".into(),
        "play".into(),
        "pause".into(),
        "volume-high".into(),
        "volume-mute".into(),
        "fullscreen".into(),
        "fullscreen-exit".into(),
        "format-bold".into(),
        "format-italic".into(),
        "format-underline".into(),
        "format-align-left".into(),
        "format-align-center".into(),
        "format-align-right".into(),
        "format-list-numbered".into(),
        "alert".into(),
        "information".into(),
        "bell".into(),
        "bell-outline".into(),
        "mail".into(),
        "chat".into(),
        "palette".into(),
        "auto-fix".into(),
        "lightning-bolt".into(),
        "package".into(),
        "home".into(),
        "view-column".into(),
        "image".into(),
        "cube-outline".into(),
        "account".into(),
        "calendar".into(),
        "clock-outline".into(),
        "book".into(),
        "credit-card".into(),
        "text-box-edit".into(),
        "format-list-bulleted".into(),
        "moon-waning-crescent".into(),
        "white-balance-sunny".into(),
        "gesture-tap".into(),
        "graph".into(),
        "heart".into(),
        "star".into(),
        "trophy-award".into(),
    ])
}
