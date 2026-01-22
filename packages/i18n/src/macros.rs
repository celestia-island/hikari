//! # I18n Macros
//!
//! Convenience macro for accessing i18n text.

/// Macro to access i18n text from context
///
/// ## Usage
///
/// ```rust,no_run
/// use hikari_i18n::{i18n, use_i18n};
///
/// fn Component() {
///     let i18n_ctx = use_i18n();
///     let text = i18n!(i18n_ctx, keys.common.button.submit);
/// }
/// ```
#[macro_export]
macro_rules! i18n {
    ($context:expr, $key:expr) => {
        &$key
    };
}
