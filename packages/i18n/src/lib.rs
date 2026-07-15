//! # Hikari i18n System
//!
//! Internationalization (i18n) for Hikari UI applications.
//!
//! This crate owns the i18n types directly (it no longer re-exports from a
//! separate crate). It provides:
//!
//! - [`Language`] — the supported languages, with code / endonym / direction.
//! - [`TextDirection`] — LTR / RTL.
//! - [`I18nKeys`] — a translation table (dotted-path keys).
//! - [`I18nContext`] / [`provide_i18n`] / [`use_i18n`] — a thread-local active
//!   locale, for component integration.
//! - [`loader`] / [`macros`] — TOML loading and the `i18n!` helper.
//!
//! ## Quick start
//!
//! ```no_run
//! use hikari_i18n::{Language, loader::load_toml, provide_i18n, use_i18n};
//!
//! let keys = load_toml(include_str!("en.toml")).unwrap();
//! provide_i18n(Language::English, keys);
//!
//! let i18n = use_i18n();
//! println!("Language: {} ({})", i18n.language.native_name(), i18n.language.code());
//! ```

pub mod loader;
pub mod macros;

use std::cell::RefCell;

/// Text direction for a script.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextDirection {
    Ltr,
    Rtl,
}

/// A supported language.
///
/// The variants line up with the single directory name used per language across
/// the celestia-island documentation sites (see [`Language::code`]).
#[derive(
    Debug, Default, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize,
)]
pub enum Language {
    #[default]
    English,
    ChineseSimplified,
    ChineseTraditional,
    Japanese,
    Korean,
    French,
    Spanish,
    Russian,
    Arabic,
}

impl Language {
    /// All supported languages.
    pub const ALL: &[Language] = &[
        Self::English,
        Self::ChineseSimplified,
        Self::ChineseTraditional,
        Self::Japanese,
        Self::Korean,
        Self::French,
        Self::Spanish,
        Self::Russian,
        Self::Arabic,
    ];

    /// Directory identifier used across the ecosystem's docs (`en`, `zhs`, …).
    pub fn code(&self) -> &'static str {
        match self {
            Self::English => "en",
            Self::ChineseSimplified => "zhs",
            Self::ChineseTraditional => "zht",
            Self::Japanese => "ja",
            Self::Korean => "ko",
            Self::French => "fr",
            Self::Spanish => "es",
            Self::Russian => "ru",
            Self::Arabic => "ar",
        }
    }

    /// The language's endonym (its own name for itself).
    pub fn native_name(&self) -> &'static str {
        match self {
            Self::English => "English",
            Self::ChineseSimplified => "简体中文",
            Self::ChineseTraditional => "繁體中文",
            Self::Japanese => "日本語",
            Self::Korean => "한국어",
            Self::French => "Français",
            Self::Spanish => "Español",
            Self::Russian => "Русский",
            Self::Arabic => "العربية",
        }
    }

    /// Text direction for this language.
    pub fn direction(&self) -> TextDirection {
        match self {
            Self::Arabic => TextDirection::Rtl,
            _ => TextDirection::Ltr,
        }
    }

    /// Look up a language by its [`code`](Self::code).
    pub fn from_code(code: &str) -> Option<Self> {
        Self::ALL.iter().copied().find(|l| l.code() == code)
    }
}

/// Translation table. Keys are dotted paths such as `"common.button.submit"`.
pub type I18nKeys = toml::Table;

/// Snapshot of the active locale and its translation table.
#[derive(Debug, Clone, Default)]
pub struct I18nContext {
    pub language: Language,
    pub keys: I18nKeys,
}

thread_local! {
    static CURRENT: RefCell<I18nContext> = RefCell::new(I18nContext::default());
}

/// Install an i18n context for the current thread.
///
/// The user's translation keys are merged with hikari's built-in component
/// strings. Keys under the `hikari.*` namespace are hikari's own — if the
/// user provides the same keys, their values override the defaults.
pub fn provide_i18n(language: Language, keys: I18nKeys) {
    CURRENT.with(|c| {
        let mut c = c.borrow_mut();
        c.language = language;
        // Start with hikari's built-in defaults for this language, then
        // overlay the user's keys (user wins on conflict).
        let mut merged = hikari_default_keys(&language);
        merge_keys(&mut merged, keys);
        c.keys = merged;
    });
}

/// Read a clone of the current i18n context.
pub fn use_i18n() -> I18nContext {
    CURRENT.with(|c| c.borrow().clone())
}

// ── translation lookup ────────────────────────────────────────────────────

/// Look up a dotted-path key in a translation table.
///
/// `lookup(keys, "common.button.submit")` walks `keys["common"]["button"]["submit"]`
/// and returns the string value. Returns `None` if any segment is missing or
/// the final value is not a string.
pub fn lookup<'a>(keys: &'a I18nKeys, dotted_key: &str) -> Option<&'a str> {
    let mut current = keys;
    let segments: Vec<&str> = dotted_key.split('.').collect();
    for (i, segment) in segments.iter().enumerate() {
        let val = current.get(*segment)?;
        if i == segments.len() - 1 {
            return val.as_str();
        }
        current = val.as_table()?;
    }
    None
}

/// Translate a key using the current thread-local i18n context.
///
/// Falls back to `fallback` if the key is not found. This is the primary
/// function hikari components should call:
///
/// ```no_run
/// use hikari_i18n::t;
/// let label = t("hikari.code.copy", "Copy");
/// ```
pub fn t(dotted_key: &str, fallback: &str) -> String {
    CURRENT.with(|c| {
        let c = c.borrow();
        lookup(&c.keys, dotted_key).unwrap_or(fallback).to_string()
    })
}

/// Translate a key with the current language for locale-aware logic.
pub fn t_lang(dotted_key: &str, fallback: &str) -> (String, Language) {
    CURRENT.with(|c| {
        let c = c.borrow();
        let val = lookup(&c.keys, dotted_key).unwrap_or(fallback).to_string();
        (val, c.language)
    })
}

// ── hikari built-in component strings ─────────────────────────────────────

/// Returns the default translation keys for hikari's own component strings
/// in the given language. These are namespaced under `hikari.*` to avoid
/// collision with the user's app strings.
///
/// Users can override any of these by providing the same key in their own
/// translation table passed to [`provide_i18n`].
fn hikari_default_keys(language: &Language) -> I18nKeys {
    let toml_str = match language {
        Language::ChineseSimplified => include_str!("../locales/zh-CHS/hikari_components.toml"),
        Language::ChineseTraditional => include_str!("../locales/zh-CHT/hikari_components.toml"),
        Language::Japanese => include_str!("../locales/ja-JP/hikari_components.toml"),
        Language::Korean => include_str!("../locales/ko-KR/hikari_components.toml"),
        Language::French => include_str!("../locales/fr-FR/hikari_components.toml"),
        Language::Spanish => include_str!("../locales/es-ES/hikari_components.toml"),
        Language::Russian => include_str!("../locales/ru-RU/hikari_components.toml"),
        Language::Arabic => include_str!("../locales/ar-SA/hikari_components.toml"),
        // English and unknown → default English
        Language::English => include_str!("../locales/en-US/hikari_components.toml"),
    };
    toml::from_str(toml_str).unwrap_or_default()
}

/// Recursively merge `overlay` into `base`. Values in `overlay` override
/// values in `base`. Tables are merged recursively; non-table values are
/// replaced.
fn merge_keys(base: &mut I18nKeys, overlay: I18nKeys) {
    for (key, val) in overlay {
        match (base.get_mut(&key), val) {
            (Some(toml::Value::Table(base_sub)), toml::Value::Table(overlay_sub)) => {
                merge_keys(base_sub, overlay_sub);
            }
            (_, val) => {
                base.insert(key, val);
            }
        }
    }
}

pub use loader::*;
