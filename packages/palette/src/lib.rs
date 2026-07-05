//! # Hikari Palette
//!
//! A ready-to-use palette system: themed palettes plus **opt-in** color
//! collections, with a small [`Color`] core and zero-cost collection loading.
//!
//! ## What's in the box
//!
//! - **[`Color`] core** — RGB triple with inferred category, `const`-constructible,
//!   serializable. Always present, dependency-light.
//! - **[`themes`]** — ready-to-use themed [`Palette`]s (light, dark, industrial…),
//!   each self-contained and independent of any color collection.
//! - **[`collections`]** — named-color catalogs (e.g. traditional Chinese colors),
//!   **opt-in via Cargo features**. A disabled collection is not compiled in at
//!   all; an enabled one becomes a module of `pub const` values generated at
//!   build time from a TOML file.
//! - **[`classes`]** — type-safe Tailwind-like utility-class enums generated from
//!   SCSS.
//!
//! ## Design philosophy
//!
//! Collections are *data*, not identity. The crate does not brand itself as any
//! single color tradition; each catalog is a pluggable data source. Add the
//! ones you want, ignore the rest — what you don't enable costs zero bytes.
//!
//! ```
//! use hikari_palette::Color;
//!
//! // The core works with no collections enabled.
//! let primary = Color::from_rgb_hex(0xff, 0xb3, 0xa7);
//! assert_eq!(primary.hex(), "#FFB3A7");
//! assert!(primary.is_light());
//! ```
//!
//! ## Using a themed palette
//!
//! ```
//! use hikari_palette::themes::Hikari;
//!
//! let palette = Hikari::palette();
//! assert!(palette.primary.is_light());
//! ```
//!
//! ## Opting into a color collection
//!
//! ```toml
//! # Cargo.toml — only what you ask for is compiled in.
//! hikari-palette = { version = "^0.2", features = ["collection-chinese"] }
//! ```
//!
//! ```rust,ignore
//! use hikari_palette::collections::chinese::粉红;
//! assert_eq!(粉红.hex(), "#FFB3A7");
//! assert_eq!(粉红.name(), Some("粉红"));
//! ```
//!
//! ## Modules
//!
//! - [`colors`] — the [`Color`] core and [`ColorCategory`].
//! - [`themes`] — themed [`Palette`]s and a runtime [`ThemeRegistry`](themes::ThemeRegistry).
//! - [`collections`] — opt-in named-color catalogs.
//! - [`classes`] — auto-generated utility-class enums from SCSS.
//!
//! For the data file format and how to add your own collection, see the
//! [data schema](https://github.com/celestia-island/hikari/blob/dev/packages/palette/data/SCHEMA.md).

pub mod classes;
pub mod color_math;
pub mod colors;
pub mod themes;

pub use classes::*;
pub use color_math::*;
pub use colors::{Color, ColorCategory};
pub use themes::*;

/// Opt-in color collections. Each sub-module is generated from a TOML file in
/// `data/` and is only compiled when its `collection-<name>` Cargo feature is
/// enabled. Disabled collections cost zero bytes.
///
/// See [`colors`](crate::colors) for the core `Color` type and the
/// [data schema](https://github.com/celestia-island/hikari/blob/dev/packages/palette/data/SCHEMA.md)
/// for adding your own collection.
#[cfg(feature = "collections")]
pub mod collections {
    #[cfg(feature = "collection-chinese")]
    pub mod chinese {
        include!(concat!(env!("OUT_DIR"), "/collections/chinese.rs"));
    }
}

