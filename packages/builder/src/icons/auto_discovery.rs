//! Auto-discovery of icon usage in workspace source code
//!
//! This module scans the workspace for all MdiIcon usage and automatically
//! generates a selection list for the build system.

use anyhow::{Context, Result};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::Path,
};

/// Scanned icon usage information
#[derive(Debug, Clone)]
pub struct IconUsage {
    /// Icons found in use statements like `MdiIcon::Search`
    pub icons: HashSet<String>,
    /// File locations where each icon is used
    pub locations: HashMap<String, Vec<String>>,
}

/// Scan the workspace for MdiIcon usage
pub fn scan_icon_usage(workspace_root: &Path) -> Result<IconUsage> {
    let mut icons = HashSet::new();
    let mut locations: HashMap<String, Vec<String>> = HashMap::new();

    // Common package directories to scan
    let scan_dirs = vec![
        workspace_root.join("packages/components/src"),
        workspace_root.join("packages/extra-components/src"),
        workspace_root.join("examples"),
        workspace_root.join("apps"),
    ];

    for scan_dir in &scan_dirs {
        if !scan_dir.exists() {
            continue;
        }

        // Recursively scan for .rs files
        scan_directory(scan_dir, &mut icons, &mut locations)?;
    }

    // Also scan mdi_minimal.rs to get the enum definitions
    let mdi_minimal_path = workspace_root.join("packages/icons/src/mdi_minimal.rs");
    if mdi_minimal_path.exists() {
        extract_enum_variants(&mdi_minimal_path, &mut icons)?;
    }

    Ok(IconUsage { icons, locations })
}

/// Recursively scan directory for Rust files
fn scan_directory(
    dir: &Path,
    icons: &mut HashSet<String>,
    locations: &mut HashMap<String, Vec<String>>,
) -> Result<()> {
    let entries =
        fs::read_dir(dir).with_context(|| format!("Failed to read directory: {:?}", dir))?;

    for entry in entries {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            // Skip target directory
            if path.file_name().is_some_and(|n| n == "target") {
                continue;
            }
            scan_directory(&path, icons, locations)?;
        } else if path.extension().is_some_and(|e| e == "rs") {
            scan_file(&path, icons, locations)?;
        }
    }

    Ok(())
}

/// Scan a single Rust file for MdiIcon usage
fn scan_file(
    file_path: &Path,
    icons: &mut HashSet<String>,
    locations: &mut HashMap<String, Vec<String>>,
) -> Result<()> {
    let content = fs::read_to_string(file_path)
        .with_context(|| format!("Failed to read file: {:?}", file_path))?;

    // Pattern 1: MdiIcon::XXX
    let mdi_icon_pattern = regex::Regex::new(r"MdiIcon::(\w+)")?;
    for cap in mdi_icon_pattern.captures_iter(&content) {
        if let Some(icon_name) = cap.get(1) {
            let icon_name = camel_to_kebab(icon_name.as_str());
            icons.insert(icon_name.clone());

            let location = format!("{:?}", file_path);
            locations.entry(icon_name).or_default().push(location);
        }
    }

    // Pattern 2: Icon { icon: MdiIcon::XXX }
    let icon_prop_pattern = regex::Regex::new(r"icon:\s*MdiIcon::(\w+)")?;
    for cap in icon_prop_pattern.captures_iter(&content) {
        if let Some(icon_name) = cap.get(1) {
            let icon_name = camel_to_kebab(icon_name.as_str());
            icons.insert(icon_name.clone());

            let location = format!("{:?}", file_path);
            locations.entry(icon_name).or_default().push(location);
        }
    }

    // Pattern 3: mdi::XXX shortcut functions
    let mdi_shortcut_pattern = regex::Regex::new(r"mdi::(\w+)\(")?;
    for cap in mdi_shortcut_pattern.captures_iter(&content) {
        if let Some(func_name) = cap.get(1) {
            // Map shortcut function names to icon names
            let icon_name = match func_name.as_str() {
                "Moon" => "moon-waning-crescent",
                "Sun" => "white-balance-sunny",
                "Settings" => "cog",
                "Account" => "account",
                "Home" => "home",
                "Search" => "magnify",
                "Close" => "close",
                "Check" => "check",
                "Menu" => "menu",
                "Bell" => "bell-outline",
                "Star" => "star",
                "Heart" => "heart",
                "Calendar" => "calendar",
                "Clock" => "clock-outline",
                "ChevronLeft" => "chevron-left",
                "ChevronRight" => "chevron-right",
                "ChevronUp" => "chevron-up",
                "ChevronDown" => "chevron-down",
                "User" => "account",
                "X" => "close",
                "Award" => "trophy-award",
                "Book" => "book",
                "Badge" => "alert",
                _ => {
                    // Try camel case conversion for unknown shortcuts
                    &camel_to_kebab(func_name.as_str())
                }
            };

            icons.insert(icon_name.to_string());

            let location = format!("{:?}", file_path);
            locations
                .entry(icon_name.to_string())
                .or_default()
                .push(location);
        }
    }

    Ok(())
}

/// Extract icon names from MdiIcon enum definition
fn extract_enum_variants(file_path: &Path, icons: &mut HashSet<String>) -> Result<()> {
    let content = fs::read_to_string(file_path)
        .with_context(|| format!("Failed to read file: {:?}", file_path))?;

    // Find enum variants in the MdiIcon enum
    let mut in_mdi_icon_enum = false;
    let mut in_display_impl = false;

    for line in content.lines() {
        // Start of MdiIcon enum
        if line.contains("pub enum MdiIcon") {
            in_mdi_icon_enum = true;
            continue;
        }

        // End of MdiIcon enum (when we reach another pub item)
        if in_mdi_icon_enum && (line.trim().starts_with("impl") || line.trim().starts_with("pub")) {
            in_mdi_icon_enum = false;
        }

        // Start of Display impl
        if line.contains("impl std::fmt::Display for MdiIcon") {
            in_display_impl = true;
            continue;
        }

        // End of Display impl
        if in_display_impl && line.trim() == "}" {
            in_display_impl = false;
            continue;
        }

        // Extract icon names from Display impl
        if in_display_impl && let Some(icon_name) = extract_icon_from_display(line) {
            icons.insert(icon_name);
        }
    }

    Ok(())
}

/// Extract icon name from a Display impl line
fn extract_icon_from_display(line: &str) -> Option<String> {
    // Pattern: MdiIcon::ChevronLeft => write!(f, "chevron-left")
    if let Some(start) = line.find("write!(f, \"") {
        let remaining = &line[start + 11..];
        if let Some(end) = remaining.find("\")") {
            return Some(remaining[..end].to_string());
        }
    }
    None
}

/// Convert CamelCase to kebab-case
/// Example: ChevronLeft -> chevron-left
fn camel_to_kebab(camel: &str) -> String {
    let mut kebab = String::new();
    let mut prev_was_lower = false;

    for (i, c) in camel.chars().enumerate() {
        if c.is_uppercase() {
            if i > 0
                && (prev_was_lower
                    || (i + 1 < camel.len()
                        && camel
                            .chars()
                            .nth(i + 1)
                            .is_some_and(|next| next.is_lowercase())))
            {
                kebab.push('-');
            }
            kebab.extend(c.to_lowercase());
            prev_was_lower = false;
        } else {
            kebab.push(c);
            prev_was_lower = true;
        }
    }

    kebab
}

/// Generate a build.rs-friendly selection vector
pub fn generate_selection(usage: &IconUsage) -> Vec<String> {
    let mut icons: Vec<_> = usage.icons.iter().cloned().collect();
    icons.sort();
    icons
}

/// Print usage report for debugging
pub fn print_usage_report(usage: &IconUsage) {
    println!("🔍 Icon Auto-Discovery Report");
    println!("   Total unique icons found: {}", usage.icons.len());
    println!();

    if usage.icons.is_empty() {
        println!("   No icon usage detected in workspace.");
    } else {
        println!("   Icons discovered:");
        let mut sorted_icons: Vec<_> = usage.icons.iter().collect();
        sorted_icons.sort();

        for icon in sorted_icons {
            if let Some(locs) = usage.locations.get(icon) {
                println!("     - {} ({} uses)", icon, locs.len());
            }
        }
    }
    println!();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_camel_to_kebab() {
        assert_eq!(camel_to_kebab("ChevronLeft"), "chevron-left");
        assert_eq!(camel_to_kebab("MoonWaningCrescent"), "moon-waning-crescent");
        assert_eq!(camel_to_kebab("WhiteBalanceSunny"), "white-balance-sunny");
        assert_eq!(camel_to_kebab("ViewColumn"), "view-column");
        assert_eq!(camel_to_kebab("TextBoxEdit"), "text-box-edit");
    }

    #[test]
    fn test_extract_icon_from_display() {
        assert_eq!(
            extract_icon_from_display("MdiIcon::ChevronLeft => write!(f, \"chevron-left\"),"),
            Some("chevron-left".to_string())
        );
        assert_eq!(
            extract_icon_from_display(
                "MdiIcon::MoonWaningCrescent => write!(f, \"moon-waning-crescent\"),"
            ),
            Some("moon-waning-crescent".to_string())
        );
        assert_eq!(extract_icon_from_display("random text"), None);
    }
}
