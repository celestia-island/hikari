#[path = "build/mod.rs"]
mod build_icons;

use std::path::PathBuf;

use build_icons::{auto_discovery, IconConfig, IconSelection, MdiStyle};

fn main() {
    let is_dynamic = std::env::var("CARGO_FEATURE_DYNAMIC_FETCH").is_ok();

    if is_dynamic {
        println!("cargo:rustc-env=HIKARI_ICON_ROUTE=/api/icons");
    } else {
        println!("cargo:rustc-env=HIKARI_ICON_ROUTE=/static/dynamic-icons");
    }

    let workspace_root = find_workspace_root();

    match build_icons(&workspace_root) {
        Ok(()) => {}
        Err(e) => {
            eprintln!("Failed to build icons: {}", e);
            eprintln!(
                "Solution: Run 'python scripts/icons/fetch_mdi_icons.py' to download icons"
            );
            std::process::exit(1);
        }
    }

    println!("cargo:rerun-if-changed=icons/mdi");
}

fn build_icons(workspace_root: &std::path::Path) -> anyhow::Result<()> {
    let icon_selection = if let Ok(usage) = auto_discovery::scan_icon_usage(workspace_root) {
        if !usage.icons.is_empty() {
            IconSelection::ByName(auto_discovery::generate_selection(&usage))
        } else {
            get_default_icon_selection()
        }
    } else {
        get_default_icon_selection()
    };

    let config = IconConfig {
        selection: icon_selection,
        styles: vec![MdiStyle::Filled, MdiStyle::Outline],
        output_file: "src/generated/mdi_selected.rs".into(),
    };

    build_icons::build_selected_icons(&config)
}

fn find_workspace_root() -> PathBuf {
    let mut current = std::env::var("CARGO_MANIFEST_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));

    loop {
        let cargo_toml = current.join("Cargo.toml");
        if cargo_toml.exists()
            && let Ok(content) = std::fs::read_to_string(&cargo_toml)
            && content.contains("[workspace]")
        {
            return current;
        }

        match current.parent() {
            Some(parent) if parent != current => {
                current = parent.to_path_buf();
            }
            _ => panic!("Workspace root not found"),
        }
    }
}

fn get_default_icon_selection() -> IconSelection {
    IconSelection::ByName(vec![
        "chevron-left".into(),
        "chevron-right".into(),
        "chevron-up".into(),
        "chevron-down".into(),
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
        "graph".into(),
        "heart".into(),
        "star".into(),
        "trophy-award".into(),
    ])
}
