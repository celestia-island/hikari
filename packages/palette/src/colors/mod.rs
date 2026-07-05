//! Color primitives and (opt-in) color collections.
//!
//! The palette crate ships with a small, dependency-light [`Color`] core.
//! Named-color catalogs (traditional Chinese colors, etc.) are **opt-in**:
//! each lives in a TOML file under `data/` and is compiled in only when you
//! enable the corresponding `collection-<name>` Cargo feature. Disabled
//! collections cost zero bytes in the binary.
//!
//! ## Constructing a color
//!
//! ```
//! use hikari_palette::Color;
//!
//! // From RGB — category is inferred.
//! let primary = Color::from_rgb_hex(0xff, 0xb3, 0xa7);
//! assert_eq!(primary.hex(), "#FFB3A7");
//!
//! // From a float tuple in [0, 1].
//! let dim = Color::from_rgb_float(0.15, 0.15, 0.15);
//! assert!(dim.is_dark());
//! ```
//!
//! ## Using a color collection
//!
//! Enable the collection in the workspace root and import the generated module:
//!
//! ```toml
//! # Root Cargo.toml
//! [workspace.metadata.hikari.palette]
//! collections = ["chinese"]
//! ```
//!
//! ```rust,ignore
//! use hikari_palette::collections::chinese::粉红;
//! assert_eq!(粉红.hex(), "#FFB3A7");
//! ```
//!
//! ## Adding your own collection
//!
//! Drop a `data/<name>.toml` next to the others (see `data/SCHEMA.md`) and add
//! a matching `collection-<name>` feature. The build script does the rest.

mod impl_;
#[cfg(test)]
mod tests;

use serde::{Deserialize, Serialize};

/// Hue-based classification for grouping and theming hints.
///
/// Categories are *inferred* from RGB by [`ColorCategory::infer`]; they are a
/// UX convenience, not a precise color-space label.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ColorCategory {
    Red,
    Orange,
    Yellow,
    Green,
    Cyan,
    Blue,
    Purple,
    White,
    Black,
    Gray,
    /// A color whose hue is ambiguous (e.g. very low-saturation mid-tones).
    Custom,
}

impl ColorCategory {
    /// Best-effort hue classification from RGB, derived from the HSL hue angle.
    ///
    /// - Near-white → `White`, near-black → `Black`.
    /// - Very low saturation mid-tones → `Gray`.
    /// - Otherwise the hue angle (in degrees) picks a sector:
    ///   `Red` (<18 or ≥348), `Orange` [18,48), `Yellow` [48,80),
    ///   `Green` [80,160), `Cyan` [160,200), `Blue` [200,260), `Purple` [260,348).
    ///
    /// This is a UX grouping hint, not a precise colorimetric label.
    #[must_use]
    pub const fn infer(r: u8, g: u8, b: u8) -> Self {
        let mx = Self::max3(r, g, b);
        let mn = Self::min3(r, g, b);

        if mx >= 240 && mn >= 240 {
            return Self::White;
        }
        if mx <= 32 {
            return Self::Black;
        }
        let delta = mx - mn;
        if delta <= 24 {
            return if mx >= 128 { Self::Gray } else { Self::Black };
        }

        // Compute HSL hue in degrees [0, 360) using fixed-point (milliunits ×1000).
        let r = r as i32;
        let g = g as i32;
        let b = b as i32;
        let mx = mx as i32;
        let delta = delta as i32;
        // chroma-relative channel distance, scaled by 60000/delta → degrees×1000
        let hue_milli: i32 = if mx == r {
            // 60 * (g - b) / delta
            60000 * (g - b) / delta
        } else if mx == g {
            // 60 * (b - r) / delta + 120
            60000 * (b - r) / delta + 120_000
        } else {
            // 60 * (r - g) / delta + 240
            60000 * (r - g) / delta + 240_000
        };
        // Normalize to [0, 360000).
        let hue = ((hue_milli % 360_000) + 360_000) % 360_000; // milli-degrees
        let deg = hue / 1000; // [0, 359]

        // Sector boundaries (degrees).
        if deg < 18 || deg >= 348 {
            Self::Red
        } else if deg < 48 {
            Self::Orange
        } else if deg < 80 {
            Self::Yellow
        } else if deg < 160 {
            Self::Green
        } else if deg < 200 {
            Self::Cyan
        } else if deg < 260 {
            Self::Blue
        } else {
            Self::Purple
        }
    }

    const fn max3(a: u8, b: u8, c: u8) -> u8 {
        let m = if a >= b { a } else { b };
        if m >= c { m } else { c }
    }
    const fn min3(a: u8, b: u8, c: u8) -> u8 {
        let m = if a <= b { a } else { b };
        if m <= c { m } else { c }
    }
}

/// A single color: RGB triple, inferred category, and optional source name.
///
/// `Color` is `Copy`, `const`-constructible via [`Color::from_rgb_hex`], and
/// serializable. Collection constants (when a `collection-*` feature is on)
/// attach their source name via [`Color::with_name`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Color {
    /// Human-readable name from the originating collection, if any.
    /// `None` for ad-hoc colors built via [`Color::from_rgb_hex`].
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub name: Option<&'static str>,
    pub rgb: (u8, u8, u8),
    pub category: ColorCategory,
}
