//! # I18n Loader
//!
//! Load and parse TOML translation files.

use anyhow::{Context, Result};

// Re-export the consolidated type so callers can `use hikari_i18n::loader::I18nKeys`.
pub use crate::I18nKeys;

/// Parse a TOML translation document into an [`I18nKeys`] table.
pub fn load_toml(toml_content: &'static str) -> Result<I18nKeys> {
    toml::from_str(toml_content).context("Failed to parse TOML i18n file")
}
