//! # Hikari i18n System
//!
//! Internationalization (i18n) system for Hikari UI applications using yuuka
//! for deep nested enum generation.
//!
//! ## Architecture
//!
//! - **[`keys`]** - Language key structures generated with yuuka
//! - **[`loader`]** - TOML and Markdown loader
//! - **[`context`]** - I18n context for theme integration
//!
//! ## Quick Start
//!
//! ```rust,no_run
//! use hikari_i18n::{use_i18n, LanguageSwitcher};
//! use hikari_i18n::context::Language;
//! use dioxus::prelude::*;
//!
//! fn App() -> Element {
//!     let mut language = use_signal(|| Language::English);
//!
//!     rsx! {
//!         LanguageSwitcher {
//!             current_language: language,
//!             on_language_change: move |lang| language.set(lang),
//!         }
//!     }
//! }
//! ```

pub mod context;
pub mod keys;
pub mod loader;

pub use context::*;
pub use keys::*;
