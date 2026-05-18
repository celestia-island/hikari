#[path = "build/mod.rs"]
mod build_icons;

use std::path::PathBuf;

use build_icons::{IconConfig, IconSelection, auto_discovery};

fn main() {
    let is_dynamic = std::env::var("CARGO_FEATURE_DYNAMIC_FETCH").is_ok();

    if is_dynamic {
        println!("cargo:rustc-env=HIKARI_ICON_ROUTE=/api/icons");
    } else {
        println!("cargo:rustc-env=HIKARI_ICON_ROUTE=/static/dynamic-icons");
    }

    let out_dir = std::env::var("OUT_DIR").unwrap();
    let output_file = PathBuf::from(&out_dir).join("mdi_selected.rs");

    match find_workspace_root() {
        Some(workspace_root) => match build_icons(&workspace_root, &output_file) {
            Ok(()) => {}
            Err(e) => {
                eprintln!("Failed to build icons: {}", e);
                eprintln!(
                    "Solution: Run 'just fetch-icons' or 'python3 scripts/icons/fetch_mdi_icons.py' to download icons"
                );
                std::process::exit(1);
            }
        },
        None => {
            eprintln!("No workspace root found, generating empty icon stub");
            write_empty_stub(&output_file);
        }
    }

    println!("cargo:rerun-if-changed=icons/mdi");
}

fn build_icons(
    workspace_root: &std::path::Path,
    output_file: &std::path::Path,
) -> anyhow::Result<()> {
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
        output_file: output_file.to_path_buf(),
    };

    build_icons::build_selected_icons(&config)?;

    Ok(())
}

fn find_workspace_root() -> Option<PathBuf> {
    let mut current = std::env::var("CARGO_MANIFEST_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));

    loop {
        let cargo_toml = current.join("Cargo.toml");
        if cargo_toml.exists()
            && let Ok(content) = std::fs::read_to_string(&cargo_toml)
            && content.contains("[workspace]")
        {
            return Some(current);
        }

        match current.parent() {
            Some(parent) if parent != current => {
                current = parent.to_path_buf();
            }
            _ => return None,
        }
    }
}

fn write_empty_stub(output_file: &std::path::Path) {
    if let Some(parent) = output_file.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let stub = r#"
pub struct PathData {
    pub d: Option<&'static str>,
    pub fill: Option<&'static str>,
    pub stroke: Option<&'static str>,
    pub stroke_width: Option<&'static str>,
    pub stroke_linecap: Option<&'static str>,
    pub stroke_linejoin: Option<&'static str>,
    pub transform: Option<&'static str>,
}

pub struct SvgElem {
    pub tag: &'static str,
    pub attributes: &'static [(&'static str, &'static str)],
}

pub struct IconData {
    pub view_box: Option<&'static str>,
    pub width: Option<&'static str>,
    pub height: Option<&'static str>,
    pub path: Option<&'static str>,
    pub paths: &'static [PathData],
    pub elements: &'static [SvgElem],
}

pub fn get(_name: &str) -> Option<&'static IconData> {
    None
}
"#;
    let _ = std::fs::write(output_file, stub);
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
