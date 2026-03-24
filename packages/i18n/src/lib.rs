//! # Hikari i18n System
//!
//! Internationalization (i18n) system for Hikari UI applications.
//!
//! This package re-exports [`tairitsu_i18n`] for a unified i18n experience.
//! Translation files remain in the Hikari repository.
//!
//! ## Architecture
//!
//! - **[`Language`]** - Language definitions and utilities (re-exported from tairitsu_i18n)
//! - **[`I18nKeys`]** - Language key structures (re-exported from tairitsu_i18n)
//! - **[`I18nContext`]** - I18n context for component integration (re-exported from tairitsu_i18n)
//! - **[`provide_i18n`]** - Provide i18n context to component tree (re-exported from tairitsu_i18n)
//! - **[`use_i18n`]** - Consume i18n context in components (re-exported from tairitsu_i18n)
//! - **[`loader`]** - TOML and Markdown loader (Hikari-specific)
//!
//! ## Quick Start
//!
//! ```rust,no_run
//! use hikari_i18n::{Language, loader::load_toml, provide_i18n, use_i18n};
//!
//! // Load language keys from TOML
//! let keys = load_toml(toml_content).unwrap();
//!
//! // Provide i18n context
//! provide_i18n(Language::English, keys);
//!
//! // In your component
//! fn component() {
//!     let i18n = use_i18n();
//!     let submit_text = &i18n.keys.common.button.submit;
//!     println!("Language: {}", i18n.language.native_name());
//!     println!("Code: {}", i18n.language.code());
//! }
//! ```

// Re-export tairitsu_i18n for unified API
pub use tairitsu_i18n::{I18nContext, I18nKeys, Language, TextDirection, provide_i18n, use_i18n};

// Hikari-specific modules
pub mod loader;
pub mod macros;

// Re-export loader for convenience
pub use loader::*;
