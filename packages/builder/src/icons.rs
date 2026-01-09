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

use anyhow::{anyhow, Context, Result};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};

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

/// Read SVG content from file
fn read_svg_content(workspace_root: &Path, icon_name: &str) -> Result<String> {
    let svg_path = workspace_root.join(format!(
        "packages/builder/generated/mdi_svgs/{}.svg",
        icon_name
    ));

    if !svg_path.exists() {
        return Err(anyhow!("SVG file not found: {:?}", svg_path));
    }

    fs::read_to_string(&svg_path).with_context(|| format!("Failed to read SVG: {:?}", svg_path))
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

    // Module with SVG constants
    output.push_str("/// Selected Material Design Icons SVG content\n");
    output.push_str("pub mod svgs {\n");

    // Generate SVG content constants
    let mut sorted_icons: Vec<_> = selected_icons.iter().collect();
    sorted_icons.sort();

    // Collect SVG data first
    let mut svg_data: Vec<(String, String, String)> = Vec::new();
    for icon_name in &sorted_icons {
        if let Ok(svg_content) = read_svg_content(workspace_root, icon_name) {
            let const_name = icon_name.replace('-', "_").to_uppercase();
            svg_data.push((const_name, (**icon_name).clone(), svg_content));
        }
    }

    // Write SVG constants
    for (const_name, icon_name, svg_content) in &svg_data {
        output.push_str("\n");
        output.push_str("    /// SVG content for '");
        output.push_str(icon_name);
        output.push_str("'\n");
        output.push_str("    pub const ");
        output.push_str(const_name);
        output.push_str(": &str = r#\"");
        output.push_str(svg_content);
        output.push_str("\"#;\n");
    }

    // Get function
    output.push_str("\n");
    output.push_str("    /// Get SVG content by icon name\n");
    output.push_str("    pub fn get(name: &str) -> Option<&'static str> {\n");
    output.push_str("        match name {\n");

    for (const_name, icon_name, _) in &svg_data {
        output.push_str("            \"");
        output.push_str(icon_name);
        output.push_str("\" => Some(");
        output.push_str(const_name);
        output.push_str("),\n");
    }

    output.push_str("            _ => None,\n");
    output.push_str("        }\n");
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
