// hi-components/src/utils/css_vars.rs
// Shared CSS variable override builder

pub struct CssVarEntry {
    pub value: Option<String>,
    pub var_names: &'static [&'static str],
}

impl CssVarEntry {
    #[must_use]
    pub fn new(value: &Option<String>, var_names: &'static [&'static str]) -> Self {
        Self {
            value: value.clone(),
            var_names,
        }
    }
}

#[must_use]
pub fn build_css_vars_style(
    glow_radius_var: &'static str,
    entries: &[CssVarEntry],
    user_css_vars: &Option<std::vec::Vec<(&str, String)>>,
) -> Option<String> {
    let mut s = String::from("--hi-glow-radius:var(");
    s.push_str(glow_radius_var);
    s.push_str(");");
    for entry in entries {
        if let Some(ref value) = entry.value {
            for var_name in entry.var_names {
                s.push_str(var_name);
                s.push(':');
                s.push_str(value);
                s.push(';');
            }
        }
    }
    if let Some(vars) = user_css_vars {
        for (name, value) in vars {
            s.push_str(name);
            s.push(':');
            s.push_str(value);
            s.push(';');
        }
    }
    Some(s)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_css_var_entry_new_none() {
        let entry = CssVarEntry::new(&None, &["--test"]);
        assert!(entry.value.is_none());
        assert_eq!(entry.var_names, &["--test"]);
    }

    #[test]
    fn test_css_var_entry_new_some() {
        let entry = CssVarEntry::new(&Some("#fff".to_string()), &["--a", "--b"]);
        assert_eq!(entry.value.as_deref(), Some("#fff"));
        assert_eq!(entry.var_names, &["--a", "--b"]);
    }

    #[test]
    fn test_build_css_vars_empty() {
        let result = build_css_vars_style("--hi-radius", &[], &None);
        assert!(result.is_some());
        let s = result.unwrap();
        assert!(s.contains("--hi-glow-radius:var(--hi-radius)"));
    }

    #[test]
    fn test_build_css_vars_with_entries() {
        let entries = vec![CssVarEntry::new(
            &Some("#ff0".to_string()),
            &["--color-1", "--color-2"],
        )];
        let result = build_css_vars_style("--hi-btn-radius", &entries, &None).unwrap();
        assert!(result.contains("--color-1:#ff0;"));
        assert!(result.contains("--color-2:#ff0;"));
    }

    #[test]
    fn test_build_css_vars_skips_none() {
        let entries = vec![CssVarEntry::new(&None, &["--skip-me"])];
        let result = build_css_vars_style("--hi-radius", &entries, &None).unwrap();
        assert!(!result.contains("--skip-me"));
    }

    #[test]
    fn test_build_css_vars_user_vars() {
        let user = vec![("--custom", "42px".to_string())];
        let result = build_css_vars_style("--hi-radius", &[], &Some(user)).unwrap();
        assert!(result.contains("--custom:42px;"));
    }

    #[test]
    fn test_empty_entries_default_style() {
        let result = build_css_vars_style("--my-radius", &[], &None);
        assert!(result.is_some());
        let s = result.unwrap();
        assert!(s.starts_with("--hi-glow-radius:var(--my-radius);"));
        assert_eq!(s.matches(';').count(), 1);
    }

    #[test]
    fn test_single_entry_single_var() {
        let entries = vec![CssVarEntry::new(&Some("red".to_string()), &["--color"])];
        let result = build_css_vars_style("--r", &entries, &None).unwrap();
        assert!(result.contains("--color:red;"));
    }

    #[test]
    fn test_multiple_entries() {
        let entries = vec![
            CssVarEntry::new(&Some("10px".to_string()), &["--spacing"]),
            CssVarEntry::new(&Some("#000".to_string()), &["--bg", "--bg-alt"]),
        ];
        let result = build_css_vars_style("--r", &entries, &None).unwrap();
        assert!(result.contains("--spacing:10px;"));
        assert!(result.contains("--bg:#000;"));
        assert!(result.contains("--bg-alt:#000;"));
    }

    #[test]
    fn test_user_overrides_take_precedence() {
        let entries = vec![CssVarEntry::new(&Some("10px".to_string()), &["--spacing"])];
        let user = vec![("--spacing", "20px".to_string())];
        let result = build_css_vars_style("--r", &entries, &Some(user)).unwrap();
        let entry_pos = result.find("--spacing:10px;").unwrap();
        let override_pos = result.find("--spacing:20px;").unwrap();
        assert!(override_pos > entry_pos);
    }

    #[test]
    fn test_empty_entries_with_user_override() {
        let user = vec![
            ("--font", "sans-serif".to_string()),
            ("--line-height", "1.5".to_string()),
        ];
        let result = build_css_vars_style("--r", &[], &Some(user)).unwrap();
        assert!(result.contains("--font:sans-serif;"));
        assert!(result.contains("--line-height:1.5;"));
    }

    #[test]
    fn test_special_characters_in_values() {
        let entries = vec![CssVarEntry::new(
            &Some("rgba(0, 0, 0, 0.5)".to_string()),
            &["--shadow"],
        )];
        let result = build_css_vars_style("--r", &entries, &None).unwrap();
        assert!(result.contains("--shadow:rgba(0, 0, 0, 0.5);"));
    }
}
