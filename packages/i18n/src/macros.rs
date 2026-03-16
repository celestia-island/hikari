//! # I18n Macros
//!
//! Convenience macro for accessing i18n text.

/// Macro to access i18n text from context
///
/// ## Usage
///
/// ```rust,no_run
/// use hikari_i18n::{I18nContext, i18n};
///
/// fn get_text(i18n_ctx: &I18nContext) -> &str {
///     i18n!(i18n_ctx, keys.common.button.submit)
/// }
/// ```
#[macro_export]
macro_rules! i18n {
    ($context:expr, $key:expr) => {
        &$key
    };
}
