use std::collections::HashSet;
use std::fs;
use std::path::Path;

use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct IconUsage {
    pub icons: HashSet<String>,
}

pub fn scan_icon_usage(workspace_root: &Path) -> Result<IconUsage> {
    let mut icons = HashSet::new();

    let scan_dirs = [
        workspace_root.join("packages/components/src"),
        workspace_root.join("packages/extra-components/src"),
        workspace_root.join("examples"),
    ];

    for scan_dir in &scan_dirs {
        if scan_dir.exists() {
            scan_directory(scan_dir, &mut icons)?;
        }
    }

    let mdi_minimal_path = workspace_root.join("packages/icons/src/mdi_minimal.rs");
    if mdi_minimal_path.exists() {
        extract_enum_variants(&mdi_minimal_path, &mut icons)?;
    }

    Ok(IconUsage { icons })
}

fn scan_directory(dir: &Path, icons: &mut HashSet<String>) -> Result<()> {
    let entries =
        fs::read_dir(dir).with_context(|| format!("Failed to read directory: {:?}", dir))?;

    for entry in entries {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            if path.file_name().is_some_and(|n| n == "target") {
                continue;
            }
            scan_directory(&path, icons)?;
        } else if path.extension().is_some_and(|e| e == "rs") {
            scan_file(&path, icons)?;
        }
    }

    Ok(())
}

fn scan_file(file_path: &Path, icons: &mut HashSet<String>) -> Result<()> {
    let content = fs::read_to_string(file_path)
        .with_context(|| format!("Failed to read file: {:?}", file_path))?;

    let mdi_icon_pattern = regex::Regex::new(r"MdiIcon::(\w+)")?;
    for cap in mdi_icon_pattern.captures_iter(&content) {
        if let Some(icon_name) = cap.get(1) {
            icons.insert(camel_to_kebab(icon_name.as_str()));
        }
    }

    let mdi_shortcut_pattern = regex::Regex::new(r"mdi::(\w+)\(")?;
    for cap in mdi_shortcut_pattern.captures_iter(&content) {
        if let Some(func_name) = cap.get(1) {
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
                _ => &camel_to_kebab(func_name.as_str()),
            };
            icons.insert(icon_name.to_string());
        }
    }

    Ok(())
}

fn extract_enum_variants(file_path: &Path, icons: &mut HashSet<String>) -> Result<()> {
    let content = fs::read_to_string(file_path)
        .with_context(|| format!("Failed to read file: {:?}", file_path))?;

    let mut in_display_impl = false;

    for line in content.lines() {
        if line.contains("impl std::fmt::Display for MdiIcon") {
            in_display_impl = true;
            continue;
        }

        if in_display_impl && line.trim() == "}" {
            in_display_impl = false;
            continue;
        }

        if in_display_impl && let Some(icon_name) = extract_icon_from_display(line) {
            icons.insert(icon_name);
        }
    }

    Ok(())
}

fn extract_icon_from_display(line: &str) -> Option<String> {
    if let Some(start) = line.find("write!(f, \"") {
        let remaining = &line[start + 11..];
        if let Some(end) = remaining.find("\")") {
            return Some(remaining[..end].to_string());
        }
    }
    None
}

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

pub fn generate_selection(usage: &IconUsage) -> Vec<String> {
    let mut icons: Vec<_> = usage.icons.iter().cloned().collect();
    icons.sort();
    icons
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
