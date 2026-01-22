//! # Hikari Icon Builder
//!
//! Build-time icon selection and packaging system.
//!
//! This module provides on-demand icon compilation, allowing projects to select
//! specific icons to include in the final binary, reducing WASM size and compilation time.
//!
//! ## Features
//!
//! - **Selection by name**: Include specific icons by name
//! - **Selection by tag**: Include all icons in a category (e.g., "Nature", "Account / User")
//! - **Selection by style**: Choose filled, outline, or both
//! - **Auto-discovery**: Read metadata from pre-downloaded MDI assets
//!
//! ## Usage in build.rs
//!
//! ```rust,ignore
//! use hikari_builder::icons::{IconConfig, IconSelection, MdiStyle};
//!
//! fn main() {
//!     let config = IconConfig {
//!         selection: IconSelection::ByName(vec![
//!             "moon-waning-crescent".into(),
//!             "sun".into(),
//!             "account".into(),
//!         ]),
//!         styles: vec![MdiStyle::Filled, MdiStyle::Outline],
//!         output_file: "packages/icons/src/generated/mdi_selected.rs".into(),
//!     };
//!
//!     hikari_builder::icons::build_selected_icons(&config).expect("Failed to build icons");
//! }
//! ```

mod svg_parser;

use anyhow::{anyhow, Context, Result};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};

use quick_xml::events::Event;
pub use svg_parser::{IconData, PathData, PathElement, SvgElem, SvgElement, SvgIcon};

/// Icon source library
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum IconSource {
    /// Material Design Icons (7,447 icons)
    MaterialDesign,
    /// Lucide Icons (~500 icons)
    Lucide,
}

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
    /// Select specific icons by name (e.g., "moon-waning-crescent", "sun")
    ByName(Vec<String>),

    /// Select icons by tag/category (e.g., "Nature", "Account / User")
    ByTag(Vec<String>),

    /// Select icons by base name with both styles
    /// For example: ["moon", "sun"] will include "moon", "moon-outline", "sun", "sun-outline" if they exist
    ByBaseName(Vec<String>),

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

    /// Create a selection by tags/categories
    pub fn tags<I, S>(tags: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        IconSelection::ByTag(tags.into_iter().map(|s| s.into()).collect())
    }

    /// Create a selection by base names (includes both filled and outline)
    pub fn base_names<I, S>(names: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        IconSelection::ByBaseName(names.into_iter().map(|s| s.into()).collect())
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

    /// Icon source library
    pub source: IconSource,
}

impl Default for IconConfig {
    fn default() -> Self {
        Self {
            selection: IconSelection::ByName(vec![]),
            styles: vec![MdiStyle::Filled, MdiStyle::Outline],
            output_file: "packages/icons/src/generated/mdi_selected.rs".into(),
            source: IconSource::MaterialDesign,
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

    /// Select icons by tag
    pub fn tags<I, S>(self, tags: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.selection(IconSelection::tags(tags))
    }

    /// Select icons by base name (both filled and outline)
    pub fn base_names<I, S>(self, names: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.selection(IconSelection::base_names(names))
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

/// MDI metadata loaded from JSON
#[derive(Debug, serde::Deserialize)]
struct MdiMetadata {
    pub by_style: Option<ByStyle>,
    pub by_tag: Option<HashMap<String, Vec<String>>>,
    pub by_base_name: Option<HashMap<String, BaseNameVariants>>,
}

#[derive(Debug, serde::Deserialize)]
struct ByStyle {
    pub filled: Option<Vec<String>>,
    pub outline: Option<Vec<String>>,
}

#[derive(Debug, serde::Deserialize)]
struct BaseNameVariants {
    pub filled: Option<String>,
    pub outline: Option<String>,
}

/// Resolve selected icon names based on the selection strategy
fn resolve_selection(
    selection: &IconSelection,
    styles: &[MdiStyle],
    metadata: &MdiMetadata,
) -> Result<HashSet<String>> {
    let mut selected = HashSet::new();

    match selection {
        IconSelection::ByName(names) => {
            for name in names {
                selected.insert(name.clone());
            }
        }
        IconSelection::ByTag(tags) => {
            let by_tag = metadata
                .by_tag
                .as_ref()
                .ok_or_else(|| anyhow!("Tag metadata not available"))?;

            for tag in tags {
                if let Some(icons) = by_tag.get(tag) {
                    selected.extend(icons.iter().cloned());
                }
            }

            if selected.is_empty() {
                return Err(anyhow!("No icons found for tags: {:?}", tags));
            }
        }
        IconSelection::ByBaseName(base_names) => {
            let by_base_name = metadata
                .by_base_name
                .as_ref()
                .ok_or_else(|| anyhow!("Base name metadata not available"))?;

            for base_name in base_names {
                if let Some(variants) = by_base_name.get(base_name) {
                    // Add filled variant if requested and exists
                    if styles.contains(&MdiStyle::Filled) {
                        if let Some(filled) = &variants.filled {
                            selected.insert(filled.clone());
                        }
                    }
                    // Add outline variant if requested and exists
                    if styles.contains(&MdiStyle::Outline) {
                        if let Some(outline) = &variants.outline {
                            selected.insert(outline.clone());
                        }
                    }
                } else {
                    // If no metadata, try direct names
                    if styles.contains(&MdiStyle::Filled) {
                        selected.insert(base_name.clone());
                    }
                    if styles.contains(&MdiStyle::Outline) {
                        selected.insert(format!("{}-outline", base_name));
                    }
                }
            }
        }
        IconSelection::All => {
            let by_style = metadata
                .by_style
                .as_ref()
                .ok_or_else(|| anyhow!("Style metadata not available"))?;

            if styles.contains(&MdiStyle::Filled) {
                if let Some(filled) = &by_style.filled {
                    selected.extend(filled.iter().cloned());
                }
            }
            if styles.contains(&MdiStyle::Outline) {
                if let Some(outline) = &by_style.outline {
                    selected.extend(outline.iter().cloned());
                }
            }
        }
    }

    Ok(selected)
}

/// Load MDI metadata from the builder's generated directory
fn load_mdi_metadata(workspace_root: &Path) -> Result<MdiMetadata> {
    let metadata_path = workspace_root.join("packages/builder/generated/mdi_styles.json");

    if !metadata_path.exists() {
        return Err(anyhow!(
            "MDI metadata not found at {:?}. Run `python scripts/icons/fetch_mdi_icons.py` first.",
            metadata_path
        ));
    }

    let content = fs::read_to_string(&metadata_path).context("Failed to read MDI metadata")?;

    serde_json::from_str(&content).context("Failed to parse MDI metadata")
}

/// Read and validate SVG content from file
fn read_svg_content(workspace_root: &Path, icon_name: &str) -> Result<String> {
    let svg_path = workspace_root.join(format!(
        "packages/builder/generated/mdi_svgs/{}.svg",
        icon_name
    ));

    if !svg_path.exists() {
        return Err(anyhow!("SVG file not found: {:?}", svg_path));
    }

    let content = fs::read_to_string(&svg_path)
        .with_context(|| format!("Failed to read SVG: {:?}", svg_path))?;

    if let Err(e) = validate_svg_structure(&content) {
        eprintln!("⚠️  Failed to validate SVG '{}': {}", icon_name, e);
        return Err(e);
    }

    Ok(content)
}

/// Validate SVG structure at build time
#[allow(dead_code)]
fn validate_svg_structure(svg: &str) -> Result<()> {
    use quick_xml::Reader;

    let mut reader = Reader::from_str(svg);

    let mut in_svg = false;
    let mut has_path = false;

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => match e.name().as_ref() {
                b"svg" => {
                    in_svg = true;

                    let has_xmlns = e.attributes().any(|attr| {
                        if let Ok(attr) = attr {
                            attr.key.as_ref() == b"xmlns" || attr.key.as_ref() == b"xmlns:svg"
                        } else {
                            false
                        }
                    });

                    if !has_xmlns {
                        return Err(anyhow!("SVG missing required xmlns attribute"));
                    }
                }
                b"path" if in_svg => {
                    has_path = true;
                }
                _ => {}
            },
            Ok(Event::End(ref e)) => {
                if e.name().as_ref() == b"svg" {
                    in_svg = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(anyhow!("XML parsing error: {}", e));
            }
            _ => {}
        }
    }

    if !has_path {
        return Err(anyhow!("SVG missing path element"));
    }

    Ok(())
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

    // Generate icon data using structured types
    let mut sorted_icons: Vec<_> = selected_icons.iter().collect();
    sorted_icons.sort();

    // Collect icon data first
    let mut icon_data: Vec<(String, String, SvgIcon)> = Vec::new();
    for icon_name in &sorted_icons {
        if let Ok(svg_content) = read_svg_content(workspace_root, icon_name) {
            if let Ok(icon) = svg_parser::parse_svg(&svg_content) {
                let const_name = icon_name.replace('-', "_").to_uppercase();
                icon_data.push((const_name, (**icon_name).clone(), icon));
            }
        }
    }

    // Generate structured data
    output.push_str("/// Structured icon data\n");
    output.push_str("pub mod data {\n");
    if !icon_data.is_empty() {
        output.push_str("    use super::IconData;\n");
    }
    output.push_str("\n");

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
            if let Some(s) = &path.stroke {
                output.push_str(" stroke: Some(\"");
                output.push_str(s);
                output.push_str("\"),");
            }
            if let Some(sw) = &path.stroke_width {
                output.push_str(" stroke_width: Some(\"");
                output.push_str(sw);
                output.push_str("\"),");
            }
            if let Some(slc) = &path.stroke_linecap {
                output.push_str(" stroke_linecap: Some(\"");
                output.push_str(slc);
                output.push_str("\"),");
            }
            if let Some(slj) = &path.stroke_linejoin {
                output.push_str(" stroke_linejoin: Some(\"");
                output.push_str(slj);
                output.push_str("\"),");
            }
            if let Some(t) = &path.transform {
                output.push_str(" transform: Some(\"");
                output.push_str(t);
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
        for elem in &icon.elements {
            output.push_str("\n            SvgElem {\n");
            output.push_str("                tag: \"");
            output.push_str(&elem.tag);
            output.push_str("\",\n");
            output.push_str("                attributes: &[");
            for (key, value) in &elem.attributes {
                output.push_str("(\"");
                output.push_str(key);
                output.push_str("\", \"");
                output.push_str(value);
                output.push_str("\"), ");
            }
            output.push_str("],\n");
            output.push_str("            },");
        }
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

/// Build selected icons into a Rust module
///
/// This function:
/// 1. Resolves the selection strategy to a set of icon names
/// 2. Reads the SVG content for each selected icon
/// 3. Generates a Rust module with `pub const` strings for each SVG
/// 4. Writes the output to the configured file
///
/// # Example
///
/// ```rust,ignore
/// use hikari_builder::icons::{IconConfig, IconSelection};
///
/// let config = IconConfig {
///     selection: IconSelection::names(["moon-waning-crescent", "sun"]),
///     styles: vec![MdiStyle::Filled],
///     output_file: "packages/icons/src/generated/my_icons.rs".into(),
///     ..Default::default()
/// };
///
/// build_selected_icons(&config)?;
/// ```
pub fn build_selected_icons(config: &IconConfig) -> Result<()> {
    println!("🎨 Building selected icons...");

    // Find workspace root
    let workspace_root = find_workspace_root()?;

    // Load metadata
    let metadata = load_mdi_metadata(&workspace_root)?;

    // Resolve selection
    let selected = resolve_selection(&config.selection, &config.styles, &metadata)?;

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
        if cargo_toml.exists() {
            if let Ok(content) = fs::read_to_string(&cargo_toml) {
                if content.contains("[workspace]") {
                    return Ok(current);
                }
            }
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

/// Convenience function for building icons with a builder pattern
///
/// # Example
///
/// ```rust,ignore
/// use hikari_builder::icons::{build_icons, MdiStyle};
///
/// build_icons()
///     .names(["moon", "sun", "star"])
///     .styles(vec![MdiStyle::Filled, MdiStyle::Outline])
///     .build()?;
/// ```
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
    fn test_icon_selection_tags() {
        let selection = IconSelection::tags(["Nature", "Account"]);
        assert!(matches!(selection, IconSelection::ByTag(_)));
    }

    #[test]
    fn test_mdi_style_suffix() {
        assert_eq!(MdiStyle::Filled.suffix(), "");
        assert_eq!(MdiStyle::Outline.suffix(), "-outline");
    }
}
