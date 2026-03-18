//! # Hikari Icon Builder
//!
//! Build-time icon selection and packaging system.
//!
//! This module provides on-demand icon compilation, allowing projects to select
//! specific icons to include in the final binary, reducing WASM size and compilation time.
//!
//! ## Usage in build.rs
//!
//! ```rust,ignore
//! use hikari_builder::icons::{build_selected_icons, IconSelection};
//!
//! fn main() {
//!     let selection = IconSelection::ByName(vec![
//!         "moon-waning-crescent".into(),
//!         "sun".into(),
//!     ]);
//!
//!     build_selected_icons(&IconConfig {
//!         selection,
//!         output_file: "src/generated/icons.rs".into(),
//!         ..Default::default()
//!     }).expect("Failed to build icons");
//! }
//! ```

pub mod auto_discovery;
mod svg_parser;

use anyhow::{Context, Result, anyhow};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

pub use svg_parser::{IconData, PathData, PathElement, SvgElem, SvgElement, SvgIcon};

/// Icon style variant for Material Design Icons
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum MdiStyle {
    /// Filled style (default, no suffix)
    Filled,
    /// Outline style (has -outline suffix)
    Outline,
}

impl MdiStyle {
    /// Get the file suffix for this style
    pub fn suffix(self) -> &'static str {
        match self {
            MdiStyle::Filled => "",
            MdiStyle::Outline => "-outline",
        }
    }
}

/// Icon selection strategy
#[derive(Clone, Debug)]
pub enum IconSelection {
    /// Select specific icons by name
    ByName(Vec<String>),
    /// Select all icons (not recommended due to size)
    All,
}

impl IconSelection {
    /// Create a selection by specific icon names
    pub fn names<I, S>(names: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        IconSelection::ByName(names.into_iter().map(|s| s.into()).collect())
    }
}

/// Icon build configuration
pub struct IconConfig {
    /// Which icons to include
    pub selection: IconSelection,

    /// Which styles to include (for MDI icons that have both)
    pub styles: Vec<MdiStyle>,

    /// Output file path for generated Rust code
    pub output_file: PathBuf,
}

impl Default for IconConfig {
    fn default() -> Self {
        Self {
            selection: IconSelection::ByName(vec![]),
            styles: vec![MdiStyle::Filled, MdiStyle::Outline],
            output_file: "src/generated/mdi_selected.rs".into(),
        }
    }
}

/// Builder for IconConfig
pub struct IconConfigBuilder {
    config: IconConfig,
}

impl IconConfigBuilder {
    /// Create a new builder with default configuration
    pub fn new() -> Self {
        Self {
            config: IconConfig::default(),
        }
    }

    /// Set the icon selection
    pub fn selection(mut self, selection: IconSelection) -> Self {
        self.config.selection = selection;
        self
    }

    /// Select specific icons by name
    pub fn names<I, S>(self, names: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.selection(IconSelection::names(names))
    }

    /// Set which styles to include
    pub fn styles(mut self, styles: Vec<MdiStyle>) -> Self {
        self.config.styles = styles;
        self
    }

    /// Set the output file path
    pub fn output(mut self, path: impl AsRef<Path>) -> Self {
        self.config.output_file = path.as_ref().to_path_buf();
        self
    }

    /// Build the configuration
    pub fn build(self) -> IconConfig {
        self.config
    }
}

impl Default for IconConfigBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Build selected icons into a Rust module
///
/// This function:
/// 1. Resolves the selection strategy to a set of icon names
/// 2. Reads the SVG content for each selected icon
/// 3. Generates a Rust module with icon data
/// 4. Writes the output to the configured file
pub fn build_selected_icons(config: &IconConfig) -> Result<()> {
    println!("🎨 Building selected icons...");

    // Find workspace root
    let workspace_root = find_workspace_root()?;

    // Resolve selection
    let selected = match &config.selection {
        IconSelection::ByName(names) => names.iter().cloned().collect::<HashSet<_>>(),
        IconSelection::All => {
            // Scan all available icons
            scan_available_icons(&workspace_root)?
        }
    };

    if selected.is_empty() {
        println!("⚠️  No icons selected!");
        return Ok(());
    }

    println!("   Selected {} icons", selected.len());

    // Generate Rust module
    let rust_code = generate_icon_module(&selected, &workspace_root)?;

    // Write output
    let output_path = &config.output_file;
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::write(output_path, rust_code)?;

    // Debug: Show generated file size
    if let Ok(metadata) = std::fs::metadata(output_path) {
        println!("   Generated file size: {} bytes", metadata.len());
    }

    println!("   Output: {:?}", output_path);
    println!("✅ Icon build complete!");

    Ok(())
}

/// Find workspace root by looking for Cargo.toml with [workspace]
fn find_workspace_root() -> Result<PathBuf> {
    let mut current = std::env::var("CARGO_MANIFEST_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));

    loop {
        let cargo_toml = current.join("Cargo.toml");
        if cargo_toml.exists()
            && let Ok(content) = fs::read_to_string(&cargo_toml)
            && content.contains("[workspace]")
        {
            return Ok(current);
        }

        match current.parent() {
            Some(parent) if parent != current => {
                current = parent.to_path_buf();
            }
            _ => {
                return Err(anyhow!("Workspace root not found"));
            }
        }
    }
}

/// Scan for available icons in icons/mdi/ directory
pub fn scan_available_icons(workspace_root: &Path) -> Result<HashSet<String>> {
    let icons_dir = workspace_root.join("icons/mdi");
    let mut icons = HashSet::new();

    if !icons_dir.exists() {
        return Err(anyhow!(
            "Icons directory not found: {:?}. Run 'python scripts/icons/fetch_mdi_icons.py' first.",
            icons_dir
        ));
    }

    for entry in fs::read_dir(&icons_dir)
        .with_context(|| format!("Failed to read icons directory: {:?}", icons_dir))?
    {
        let entry = entry?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("svg")
            && let Some(file_name) = path.file_stem().and_then(|s| s.to_str())
        {
            icons.insert(file_name.to_string());
        }
    }

    Ok(icons)
}

/// Read and parse SVG content from file
fn read_svg_content(workspace_root: &Path, icon_name: &str) -> Result<String> {
    let svg_path = workspace_root.join(format!("icons/mdi/{}.svg", icon_name));

    if !svg_path.exists() {
        return Err(anyhow!("SVG file not found: {:?}", svg_path));
    }

    fs::read_to_string(&svg_path)
        .with_context(|| format!("Failed to read SVG: {:?}", svg_path))
}

/// Generate Rust code for selected icons
fn generate_icon_module(selected_icons: &HashSet<String>, workspace_root: &Path) -> Result<String> {
    let mut output = String::new();

    // Header
    output.push_str("// Auto-generated by hikari_builder::icons\n");
    output.push_str("// DO NOT EDIT - This file is generated at build time\n");
    output.push_str("//\n");
    output.push_str("// Total selected icons: ");
    output.push_str(&selected_icons.len().to_string());
    output.push_str("\n\n");
    output.push_str("#![allow(non_camel_case_types)]\n");
    output.push_str("#![allow(non_snake_case)]\n");
    output.push_str("#![allow(dead_code)]\n\n");

    // Type definitions
    output.push_str("/// Path data for generating Rust constants\n");
    output.push_str("#[derive(Copy, Clone, Debug)]\n");
    output.push_str("pub struct PathData {\n");
    output.push_str("    pub d: Option<&'static str>,\n");
    output.push_str("    pub fill: Option<&'static str>,\n");
    output.push_str("    pub stroke: Option<&'static str>,\n");
    output.push_str("    pub stroke_width: Option<&'static str>,\n");
    output.push_str("    pub stroke_linecap: Option<&'static str>,\n");
    output.push_str("    pub stroke_linejoin: Option<&'static str>,\n");
    output.push_str("    pub transform: Option<&'static str>,\n");
    output.push_str("}\n\n");

    output.push_str("/// SVG element for generating Rust constants\n");
    output.push_str("#[derive(Copy, Clone, Debug)]\n");
    output.push_str("pub struct SvgElem {\n");
    output.push_str("    pub tag: &'static str,\n");
    output.push_str("    pub attributes: &'static [(&'static str, &'static str)],\n");
    output.push_str("}\n\n");

    output.push_str("/// Icon data for generating Rust constants\n");
    output.push_str("#[derive(Copy, Clone, Debug)]\n");
    output.push_str("pub struct IconData {\n");
    output.push_str("    pub view_box: Option<&'static str>,\n");
    output.push_str("    pub width: Option<&'static str>,\n");
    output.push_str("    pub height: Option<&'static str>,\n");
    output.push_str("    pub path: Option<&'static str>,\n");
    output.push_str("    pub paths: &'static [PathData],\n");
    output.push_str("    pub elements: &'static [SvgElem],\n");
    output.push_str("}\n\n");

    // Collect icon data
    let mut sorted_icons: Vec<_> = selected_icons.iter().collect();
    sorted_icons.sort();

    let mut icon_data: Vec<(String, String, SvgIcon)> = Vec::new();
    for icon_name in &sorted_icons {
        match read_svg_content(workspace_root, icon_name) {
            Ok(svg_content) => match svg_parser::parse_svg(&svg_content) {
                Ok(icon) => {
                    let const_name = icon_name.replace('-', "_").to_uppercase();
                    icon_data.push((const_name, (**icon_name).clone(), icon));
                }
                Err(e) => {
                    eprintln!("⚠️  Failed to parse SVG for '{}': {}", icon_name, e);
                }
            },
            Err(e) => {
                eprintln!("⚠️  Failed to read SVG for '{}': {}", icon_name, e);
            }
        }
    }

    if icon_data.is_empty() {
        eprintln!(
            "⚠️  No icon data was generated! Selected {} icons but parsed 0.",
            sorted_icons.len()
        );
    }

    // Generate structured data
    output.push_str("/// Structured icon data\n");
    output.push_str("pub mod data {\n");
    if !icon_data.is_empty() {
        output.push_str("    use super::IconData;\n");
    }
    output.push('\n');

    for (const_name, icon_name, icon) in &icon_data {
        output.push_str("    /// Icon data for '");
        output.push_str(icon_name);
        output.push_str("'\n");
        output.push_str("    pub const ");
        output.push_str(const_name);
        output.push_str(": IconData = IconData {\n");

        // view_box
        output.push_str("        view_box: ");
        if let Some(vb) = &icon.view_box {
            output.push_str("Some(\"");
            output.push_str(vb);
            output.push_str("\"),\n");
        } else {
            output.push_str("None,\n");
        }

        // width
        output.push_str("        width: ");
        if let Some(w) = &icon.width {
            output.push_str("Some(\"");
            output.push_str(w);
            output.push_str("\"),\n");
        } else {
            output.push_str("None,\n");
        }

        // height
        output.push_str("        height: ");
        if let Some(h) = &icon.height {
            output.push_str("Some(\"");
            output.push_str(h);
            output.push_str("\"),\n");
        } else {
            output.push_str("None,\n");
        }

        // path
        output.push_str("        path: ");
        if let Some(p) = &icon.path {
            output.push_str("Some(\"");
            output.push_str(p);
            output.push_str("\"),\n");
        } else {
            output.push_str("None,\n");
        }

        // paths
        output.push_str("        paths: &[");
        for path in &icon.paths {
            output.push_str("\n            PathData {");
            if let Some(d) = &path.d {
                output.push_str(" d: Some(\"");
                output.push_str(d);
                output.push_str("\"),");
            }
            if let Some(f) = &path.fill {
                output.push_str(" fill: Some(\"");
                output.push_str(f);
                output.push_str("\"),");
            }
            output.push_str(" },");
        }
        if icon.paths.is_empty() {
            output.push_str("],\n");
        } else {
            output.push_str("\n        ],\n");
        }

        // elements
        output.push_str("        elements: &[");
        if icon.elements.is_empty() {
            output.push_str("],\n");
        } else {
            output.push_str("\n        ],\n");
        }

        output.push_str("    };\n");
    }

    output.push_str("}\n\n");

    // Get function
    output.push_str("/// Get icon data by name\n");
    output.push_str("pub fn get(name: &str) -> Option<&'static IconData> {\n");
    output.push_str("    match name {\n");

    for (const_name, icon_name, _) in &icon_data {
        output.push_str("        \"");
        output.push_str(icon_name);
        output.push_str("\" => Some(&data::");
        output.push_str(const_name);
        output.push_str("),\n");
    }

    output.push_str("        _ => None,\n");
    output.push_str("    }\n");
    output.push_str("}\n");

    Ok(output)
}

/// Convenience function for building icons with a builder pattern
pub fn build_icons() -> IconConfigBuilder {
    IconConfigBuilder::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_icon_selection_names() {
        let selection = IconSelection::names(["moon", "sun"]);
        assert!(matches!(selection, IconSelection::ByName(_)));
    }

    #[test]
    fn test_mdi_style_suffix() {
        assert_eq!(MdiStyle::Filled.suffix(), "");
        assert_eq!(MdiStyle::Outline.suffix(), "-outline");
    }
}
