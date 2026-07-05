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
//!   **opt-in via workspace metadata**. A disabled collection is not compiled in
//!   at all; an enabled one becomes a module of `pub const` values generated at
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
//! Collections are selected in the **workspace root** `Cargo.toml`, not via
//! Cargo features:
//!
//! ```toml
//! # Root Cargo.toml of the business project
//! [workspace.metadata.hikari.palette]
//! collections = ["chinese"]
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
/// `data/` and is compiled in only when the consuming workspace requests it via
/// `[workspace.metadata.hikari.palette].collections` in its root `Cargo.toml`.
///
/// The build script emits a `cargo:rustc-cfg=hikari_collection_<name>` flag for
/// each requested collection, and the corresponding module here is gated on that
/// flag. No Cargo features are involved — selection is a property of the
/// consuming workspace.
///
/// Example workspace declaration:
///
/// ```toml
/// # Root Cargo.toml of the business project
/// [workspace.metadata.hikari.palette]
/// collections = ["chinese"]
/// ```
///
/// Then in code:
///
/// ```rust,ignore
/// use hikari_palette::collections::chinese::粉红;
/// ```
///
/// See the [data schema] for adding your own collection.
///
/// [data schema]: https://github.com/celestia-island/hikari/blob/dev/packages/palette/data/SCHEMA.md
#[cfg(any(hikari_collection_chinese))]
pub mod collections {
    #[cfg(hikari_collection_chinese)]
    pub mod chinese {
        include!(concat!(env!("OUT_DIR"), "/collections/chinese.rs"));
    }
}

