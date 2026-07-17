//! Build script for hikari-icons
//!
//! Generates the selected MDI icon set at build time. Selection is configured
//! in the consuming workspace's root `Cargo.toml`:
//!
//! ```toml
//! [workspace.metadata.hikari.icons]
//! # Optional explicit icon list. Omit to auto-discover icons used in source.
//! set = ["chevron-left", "menu", "close"]
//! # Fetch icons at runtime over HTTP instead of embedding them. Default false.
//! dynamic-fetch = false
//! ```
//!
//! The build script turns these into `cargo:rustc-cfg` flags so no Cargo
//! features are involved — the same pattern hikari-palette uses.

use std::path::PathBuf;

use hikari_builder::icons::{IconConfig, IconSelection, MdiStyle, auto_discovery};

/// Stub emitted when icons can't be generated (no workspace root). Provides
/// the same public API surface as the generated file so downstream consumers
/// compile, just without icon data.
const STUB_MDI_SELECTED: &str = r#"// stub — no icons available outside the hikari workspace
#[derive(Copy, Clone, Debug)]
pub struct PathData {
    pub d: Option<&'static str>,
    pub fill: Option<&'static str>,
    pub stroke: Option<&'static str>,
    pub stroke_width: Option<&'static str>,
    pub stroke_linecap: Option<&'static str>,
    pub stroke_linejoin: Option<&'static str>,
    pub transform: Option<&'static str>,
}
#[derive(Copy, Clone, Debug)]
pub struct SvgElem {
    pub tag: &'static str,
    pub attributes: &'static [(&'static str, &'static str)],
}
#[derive(Copy, Clone, Debug)]
pub struct IconData {
    pub view_box: Option<&'static str>,
    pub width: Option<&'static str>,
    pub height: Option<&'static str>,
    pub path: Option<&'static str>,
    pub paths: &'static [PathData],
    pub elements: &'static [SvgElem],
}
pub mod data {}
pub fn get(_name: &str) -> Option<IconData> { None }
"#;

fn main() {
    println!("cargo:warning=Building icons...");

    // Declare the custom cfg up front so the unexpected-cfg lint is satisfied
    // regardless of whether dynamic-fetch is active.
    println!("cargo::rustc-check-cfg=cfg(hikari_icons_dynamic_fetch)");

    let manifest_dir =
        std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR must be set by Cargo");

    // Read icon configuration from the workspace root, if any.
    let workspace_root = find_workspace_root(&manifest_dir);
    let config = read_icon_config(&workspace_root);

    // Surface dynamic-fetch as a cfg flag (replaces the old Cargo feature).
    if config.dynamic_fetch {
        println!("cargo:warning=Dynamic icon fetching enabled");
        println!("cargo:rustc-cfg=hikari_icons_dynamic_fetch");
        println!("cargo:rustc-env=HIKARI_ICON_ROUTE=/api/icons");
    } else {
        println!("cargo:rustc-env=HIKARI_ICON_ROUTE=/static/dynamic-icons");
    }

    // Build icons. Development checkouts keep the SVGs under
    // <workspace>/icons/mdi (populated by scripts/icons/fetch_mdi_icons.py).
    // Without them — a fresh clone, or a crates.io consumer build where there
    // is no hikari workspace at all — fall back to the packed archive
    // committed inside this crate so icon data is always available.
    let packed_path = PathBuf::from(&manifest_dir).join("resources/mdi_icons.dat");
    let svg_dir_usable = workspace_root
        .as_ref()
        .map(|root| root.join("icons/mdi"))
        .map(|dir| {
            std::fs::read_dir(&dir)
                .map(|mut entries| entries.next().is_some())
                .unwrap_or(false)
        })
        .unwrap_or(false);

    if svg_dir_usable {
        let root = workspace_root
            .as_ref()
            .expect("a usable icons/mdi directory implies a workspace root");
        match build_icons(root, &config) {
            Ok(()) => {
                println!("cargo:warning=Icons built successfully");
            }
            Err(e) => {
                eprintln!("BUILD ERROR: Failed to build icons");
                eprintln!("  Error: {}", e);
                eprintln!();
                eprintln!(
                    "  Solution: Run 'python scripts/icons/fetch_mdi_icons.py' to download icons"
                );
                std::process::exit(1);
            }
        }
    } else if packed_path.exists() {
        let names = packed_selection(&workspace_root, &config);
        let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR set by Cargo");
        let output = std::path::Path::new(&out_dir).join("mdi_selected.rs");
        match hikari_builder::icons::build_icons_from_packed(
            &packed_path,
            names.as_deref(),
            &output,
        ) {
            Ok(count) => {
                println!(
                    "cargo:warning=No icons/mdi directory — embedded {count} icons from the packed archive"
                );
            }
            Err(e) => {
                eprintln!("BUILD ERROR: Failed to build icons from the packed archive");
                eprintln!("  Error: {}", e);
                std::process::exit(1);
            }
        }
    } else {
        // No SVGs and no packed archive (broken packaging): emit a stub
        // mdi_selected.rs with the expected type definitions so the include!
        // and pub use in lib.rs resolve. No icon data is available.
        println!("cargo:warning=No icon sources at all — emitting the empty stub");
        let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR set by Cargo");
        let stub = std::path::Path::new(&out_dir).join("mdi_selected.rs");
        let _ = std::fs::write(&stub, STUB_MDI_SELECTED);
    }

    println!("cargo:rerun-if-changed=../../packages/builder/generated/mdi_svgs");
    println!("cargo:rerun-if-changed=../../packages/builder/generated/mdi_styles.json");
    println!("cargo:rerun-if-changed=resources/mdi_icons.dat");
}

/// Icon selection for the packed-archive build: explicit `set` >
/// auto-discovered usage > `None` (embed the whole archive).
fn packed_selection(
    workspace_root: &Option<PathBuf>,
    config: &IconBuildConfig,
) -> Option<Vec<String>> {
    if let Some(names) = &config.explicit_set
        && !names.is_empty() {
            return Some(names.clone());
        }
    let root = workspace_root.as_ref()?;
    auto_discovery::scan_icon_usage(root)
        .ok()
        .filter(|usage| !usage.icons.is_empty())
        .map(|usage| auto_discovery::generate_selection(&usage))
}

/// Parsed `[workspace.metadata.hikari.icons]` configuration.
#[derive(Default)]
struct IconBuildConfig {
    /// Explicit icon set, if `set = [...]` was declared. `None` → auto-discover.
    explicit_set: Option<Vec<String>>,
    /// Whether to fetch icons at runtime instead of embedding them.
    dynamic_fetch: bool,
}


fn read_icon_config(workspace_root: &Option<PathBuf>) -> IconBuildConfig {
    let Some(root) = workspace_root else {
        return IconBuildConfig::default();
    };
    let Ok(content) = std::fs::read_to_string(root.join("Cargo.toml")) else {
        return IconBuildConfig::default();
    };

    let mut cfg = IconBuildConfig::default();
    let mut in_table = false;
    for raw in content.lines() {
        let line = raw.trim();
        if line.starts_with('[') {
            in_table = line == "[workspace.metadata.hikari.icons]";
            continue;
        }
        if !in_table {
            continue;
        }
        if let Some(rest) = line.strip_prefix("set") {
            if let Some(arr) = rest.trim_start().strip_prefix('=') {
                cfg.explicit_set = Some(parse_string_array(arr.trim()));
            }
        } else if let Some(rest) = line.strip_prefix("dynamic-fetch")
            && let Some(val) = rest.trim_start().strip_prefix('=') {
                cfg.dynamic_fetch = matches!(val.trim(), "true" | "True" | "TRUE");
            }
    }
    cfg
}

fn build_icons(workspace_root: &std::path::Path, config: &IconBuildConfig) -> anyhow::Result<()> {
    // Selection priority: explicit `set` from metadata > auto-discovery > default.
    let icon_selection = if let Some(names) = &config.explicit_set {
        if !names.is_empty() {
            println!(
                "cargo:warning=Using {} icons from [workspace.metadata.hikari.icons].set",
                names.len()
            );
            IconSelection::ByName(names.clone())
        } else {
            // Explicit empty list → fall back to default (don't generate nothing).
            get_default_icon_selection()
        }
    } else if let Ok(usage) = auto_discovery::scan_icon_usage(workspace_root) {
        if !usage.icons.is_empty() {
            println!("cargo:warning=Auto-discovered {} icons", usage.icons.len());
            IconSelection::ByName(auto_discovery::generate_selection(&usage))
        } else {
            get_default_icon_selection()
        }
    } else {
        get_default_icon_selection()
    };

    let cfg = IconConfig {
        selection: icon_selection,
        styles: vec![MdiStyle::Filled, MdiStyle::Outline],
        output_file: format!(
            "{}/mdi_selected.rs",
            std::env::var("OUT_DIR").expect("OUT_DIR set by Cargo")
        )
        .into(),
    };

    hikari_builder::icons::build_selected_icons(&cfg)
}

/// Walk up from this crate's manifest dir to find the workspace root (the first
/// ancestor whose `Cargo.toml` contains a `[workspace]` table).
fn find_workspace_root(manifest_dir: &str) -> Option<PathBuf> {
    let mut current = PathBuf::from(manifest_dir);
    loop {
        let cargo_toml = current.join("Cargo.toml");
        if cargo_toml.exists()
            && let Ok(content) = std::fs::read_to_string(&cargo_toml)
                && content.contains("[workspace]") {
                    return Some(current);
                }
        match current.parent() {
            Some(parent) if parent != current => current = parent.to_path_buf(),
            _ => return None,
        }
    }
}

/// Parse a `["a", "b"]` literal into a Vec of trimmed strings.
fn parse_string_array(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut in_str = false;
    for ch in s.chars() {
        if in_str {
            if ch == '"' {
                out.push(cur.trim().to_string());
                cur.clear();
                in_str = false;
            } else {
                cur.push(ch);
            }
        } else if ch == '"' {
            in_str = true;
        } else if ch == ']' {
            break;
        }
    }
    out
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
