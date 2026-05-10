//! # I18n Loader
//!
//! Load and parse TOML language files into dot-path `HashMap` for use with `t!()` macro.

use std::collections::HashMap;

use anyhow::{Context, Result};

/// Flatten a TOML table into a dot-path `HashMap<String, String>`.
///
/// Nested TOML tables become dot-separated keys:
///
/// ```toml
/// [common.button]
/// submit = "Submit"
/// cancel = "Cancel"
/// ```
///
/// Becomes: `{"common.button.submit": "Submit", "common.button.cancel": "Cancel"}`
pub fn load_toml_flat(toml_content: &str) -> Result<HashMap<String, String>> {
    let value: toml::Value =
        toml::from_str(toml_content).context("Failed to parse TOML i18n file")?;

    let mut map = HashMap::new();
    if let Some(table) = value.as_table() {
        flatten_toml_table(table, String::new(), &mut map);
    }
    Ok(map)
}

fn flatten_toml_table(
    table: &toml::map::Map<String, toml::Value>,
    prefix: String,
    output: &mut HashMap<String, String>,
) {
    for (key, value) in table {
        let full_key = if prefix.is_empty() {
            key.clone()
        } else {
            format!("{}.{}", prefix, key)
        };

        match value {
            toml::Value::String(s) => {
                output.insert(full_key, s.clone());
            }
            toml::Value::Table(nested) => {
                flatten_toml_table(nested, full_key, output);
            }
            _ => {
                output.insert(full_key, value.to_string());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_toml_flat_nested() {
        let toml = r#"
[common.button]
submit = "Submit"
cancel = "Cancel"
"#;
        let map = load_toml_flat(toml).unwrap();
        assert_eq!(map.get("common.button.submit"), Some(&"Submit".to_string()));
        assert_eq!(map.get("common.button.cancel"), Some(&"Cancel".to_string()));
    }
}
