//! # Hikari i18n System
//!
//! Internationalization (i18n) system for Hikari UI applications.
//!
//! ## Architecture
//!
//! - **[`keys`]** - Language key structures
//! - **[`loader`]** - TOML and Markdown loader
//! - **[`context`]** - Language definitions and utilities
//!
//! ## Quick Start
//!
//! ```rust,no_run
//! use hikari_i18n::{Language, loader::load_toml};
//!
//! // Load language keys from TOML
//! let keys = load_toml(toml_content).unwrap();
//!
//! // Get language info
//! let lang = Language::English;
//! println!("Language: {}", lang.native_name());
//! println!("Code: {}", lang.code());
//! ```

pub mod context;
pub mod keys;
pub mod loader;
pub mod macros;

pub use context::*;
pub use keys::*;
