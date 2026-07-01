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
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub enum Language {
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

impl Default for Language {
    fn default() -> Self {
        Self::English
    }
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
pub fn provide_i18n(language: Language, keys: I18nKeys) {
    CURRENT.with(|c| {
        let mut c = c.borrow_mut();
        c.language = language;
        c.keys = keys;
    });
}

/// Read a clone of the current i18n context.
pub fn use_i18n() -> I18nContext {
    CURRENT.with(|c| c.borrow().clone())
}

pub use loader::*;
