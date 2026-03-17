//! Trait for converting theme identifiers to string

///
///
///
///
///
///
pub trait IntoThemeName: std::fmt::Display + 'static {
    fn as_theme_name(&self) -> String;
}

///
impl IntoThemeName for String {
    fn as_theme_name(&self) -> String {
        self.clone()
    }
}

impl IntoThemeName for &'static str {
    fn as_theme_name(&self) -> String {
        (*self).to_string()
    }
}
