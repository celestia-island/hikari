//! Trait for converting theme identifiers to string

/// Trait for converting theme identifiers to string
///
/// Components can define their own enums that implement this trait,
/// providing type-safe theme selection without string literals.
///
/// # Example
///
/// ```rust
/// use hikari_components::IntoThemeName;
///
/// enum MyThemes {
///     Light,
///     Dark,
/// }
///
/// impl IntoThemeName for MyThemes {
///     fn as_theme_name(&self) -> String {
///         match self {
///             MyThemes::Light => "hikari".to_string(),
///             MyThemes::Dark => "tairitsu".to_string(),
///         }
///     }
/// }
///
/// // Now you can use MyThemes::Light instead of "hikari"
/// ThemeProvider { palette: MyThemes::Light } { }
/// ```
pub trait IntoThemeName: std::fmt::Display + 'static {
    fn as_theme_name(&self) -> String;
}

/// Default implementation for String (backwards compatibility)
///
/// Note: This implementation is discouraged. Use &'static str or
/// a custom enum implementing IntoThemeName instead.
impl IntoThemeName for String {
    fn as_theme_name(&self) -> String {
        self.clone()
    }
}

/// Default implementation for &str (backwards compatibility)
impl IntoThemeName for &'static str {
    fn as_theme_name(&self) -> String {
        (*self).to_string()
    }
}
