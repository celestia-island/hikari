//! # Hikari i18n System
//!
//! Internationalization (i18n) system for Hikari UI applications.
//!
//! Re-exports [`tairitsu_web::i18n`] for a unified i18n experience.
//! Translation files (TOML) remain in the Hikari repository under `locales/`.
//!
//! ## Architecture
//!
//! - **[`Language`]** — Type-safe locale (9 languages)
//! - **[`I18nProvider`]** — Reactive context-based locale provider
//! - **[`I18nState`]** — Core state: current locale + all translations
//! - **[`provide_i18n`]** — Shorthand to provide i18n context
//! - **[`use_locale`]** — Get current locale from context
//! - **[`set_locale`]** — Switch locale at runtime
//! - **[`translate`]** — Lookup key → `Option<String>`
//! - **[`translate_or_key`]** — Lookup key → `String` (key as fallback)
//! - **[`t!`]** — Macro: `t!("common.button.submit")` → `String`
//! - **[`tr!`]** — Macro: `tr!("common.button.submit")` → `Option<String>`
//! - **[`loader`]** — TOML loader (Hikari-specific)
//!
//! ## Quick Start
//!
//! ```rust,no_run
//! use hikari_i18n::{Language, loader::load_toml_flat, provide_i18n, t, set_locale};
//!
//! // Load translations
//! let mut translations = std::collections::HashMap::new();
//! translations.insert(Language::English, load_toml_flat(include_str!("../../locales/en/strings.toml")).unwrap());
//! translations.insert(Language::ChineseSimplified, load_toml_flat(include_str!("../../locales/zhs/strings.toml")).unwrap());
//!
//! // Provide i18n context (call once at app root)
//! provide_i18n(Language::English, translations);
//!
//! // Use translations
//! let text = t!("common.button.submit"); // → "Submit"
//! set_locale(Language::ChineseSimplified);
//! let text = t!("common.button.submit"); // → "提交"
//! ```

pub use tairitsu_web::i18n::{
    provide_i18n, set_locale, translate, translate_or_key, use_locale, I18nProvider, I18nState,
    Language, TextDirection,
};

pub mod loader;

pub use loader::*;
