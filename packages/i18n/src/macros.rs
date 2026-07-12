//! # I18n Macros
//!
//! Convenience macro for accessing i18n text from the thread-local context.

/// Translate a key with a fallback default.
///
/// Reads the current thread-local i18n context and looks up the dotted-path
/// key. Falls back to the provided default string if the key is missing.
///
/// ## Usage
///
/// ```rust,no_run
/// use hikari_i18n::i18n;
///
/// let label = i18n!("hikari.code.copy", "Copy");
/// ```
#[macro_export]
macro_rules! i18n {
    ($key:expr, $fallback:expr) => {
        $crate::t($key, $fallback)
    };
    ($key:expr) => {
        $crate::t($key, $key)
    };
}
