// hi-components/src/utils/css_vars.rs
// Shared CSS variable override builder

pub struct CssVarEntry {
    pub value: Option<String>,
    pub var_names: &'static [&'static str],
}

impl CssVarEntry {
    pub fn new(value: &Option<String>, var_names: &'static [&'static str]) -> Self {
        Self {
            value: value.clone(),
            var_names,
        }
    }
}

pub fn build_css_vars_style(
    glow_radius_var: &'static str,
    entries: &[CssVarEntry],
    user_css_vars: &Option<std::vec::Vec<(&str, String)>>,
) -> Option<String> {
    let mut s = String::new();
    s.push_str("--hi-glow-radius:var(");
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
}
