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
