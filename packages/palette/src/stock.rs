//! The stock `default` theme as the SINGLE SOURCE OF TRUTH for the web-ui
//! lane's token table (hikari#1546 Phase 2, user direction 2026-11-25: the
//! table moves to Rust, TypeScript consumes the generated JSON — the de-Vue
//! lane starts by moving the DATA, not the rendering).
//!
//! What lives here vs what stays computed:
//! - THIS module: the 18 authored slots per mode (the palette a designer
//!   would edit) — the data.
//! - `packages/vue/src/theme/presets.ts` `tokensToCSSVars`: the ~10 derived
//!   slots (`onPrimary`, `textSecondary/tertiary`, per-tone `on*` inks and
//!   `*-fg` pairs) — the derivation, which needs the OKLCH contrast search
//!   and stays beside the runtime for now (Phase 2 endgame moves it too).
//!
//! The values are migrated VERBATIM from the table `presets.ts` used to
//! hand-write (2026-11-25): light is the historical pink/paper scheme, dark
//! the Nord-derived black-blue one. They are NOT the `Hikari` / `Tairitsu`
//! palettes below — those are the components-side aesthetic family (a
//! different, older look); the web preset and the components palettes are
//! siblings, not one derived from the other. Only the semantic quartet
//! (success/error/warning/info) is shared by both families by design —
//! pinned by `stock_snapshot.rs` against those palettes directly.
//!
//! Consumption:
//! - a snapshot test serializes [`stock_default`] and compares it
//!   byte-for-byte with `packages/vue/src/theme/stock-preset.json`, the
//!   artifact TypeScript imports (`REGEN_STOCK_JSON=1` rewrites it);
//! - `presets.ts` builds `themePresets.default` from that JSON, so a value
//!   edited here without a regen fails the Rust test, and a JSON edit
//!   without this module fails nothing but changes the shipped palette —
//!   the two-sided lock is: Rust test pins JSON-to-code, review pins
//!   code-to-intent.

use serde::Serialize;

/// One authored color: the channel triple the web lane formats as
/// `r g b` (its cssvars are consumed through `rgb(var(--color-x))`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct StockRgb {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

/// The 18 authored slots of one scheme, named exactly as the web lane's
/// `ThemeSchemeTokens` (camelCase via serde rename — the JSON IS the
/// contract between the two languages; idiomatic-Rust field names would
/// force every consumer to translate).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StockTokenScheme {
    pub primary: StockRgb,
    pub secondary: StockRgb,
    pub accent: StockRgb,
    pub text: StockRgb,
    pub muted: StockRgb,
    pub border: StockRgb,
    pub focused_border: StockRgb,
    pub background: StockRgb,
    pub surface: StockRgb,
    pub selected_background: StockRgb,
    pub selected_text: StockRgb,
    pub status_bar_background: StockRgb,
    /// Solid semantic fills ignore the mode by user direction — the same
    /// canonical quartet in both schemes, shared with the components-side
    /// palettes below.
    pub success: StockRgb,
    pub error: StockRgb,
    pub warning: StockRgb,
    pub info: StockRgb,
    /// Ink ON solid brand/semantic fills. The pale Nord primary needs the
    /// near-black pair (white on it is ~1.9:1).
    pub on_solid_text: StockRgb,
    pub on_solid_icon: StockRgb,
}

/// The stock `default` preset, exactly as the web lane's
/// `ThemePreset` shapes it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct StockTheme {
    pub id: String,
    pub name: String,
    pub dark: StockTokenScheme,
    pub light: StockTokenScheme,
}

const fn rgb(r: u8, g: u8, b: u8) -> StockRgb {
    StockRgb { r, g, b }
}

/// The stock `default` theme — the values the web lane has always shipped.
/// The `name` rides the web lane's ThemePreset.name convention: a literal
/// string OR a message key resolvable in hikari's own i18n catalog. The
/// stock theme is every host's factory line, so it ships the CATALOG KEY
/// (`hikari::theme.defaultThemeName`) — the panel resolves names through
/// `t()`, which translates keyed names per locale and passes literal
/// strings through unchanged. A literal "Default" here rendered the
/// factory row untranslated on every non-English face (2026-11-25 user
/// report: the docs-site theme dialog showed "Default" under a Chinese
/// UI); chest's own brand presets have shipped the keyed name since the
/// theme-i18n wave (2026-10-08).
#[must_use]
pub fn stock_default() -> StockTheme {
    StockTheme {
        id: "default".to_string(),
        name: "hikari::theme.defaultThemeName".to_string(),
        // Nord-derived black-blue: the pale Polar Water primary (#88C0D0)
        // keeps the near-black on-solid ink pair (white on it is ~1.9:1).
        dark: StockTokenScheme {
            primary: rgb(136, 192, 208),
            secondary: rgb(143, 188, 187),
            accent: rgb(94, 129, 172),
            text: rgb(247, 249, 252),
            muted: rgb(180, 180, 180),
            border: rgb(128, 128, 128),
            focused_border: rgb(136, 192, 208),
            background: rgb(22, 27, 38),
            surface: rgb(34, 40, 54),
            selected_background: rgb(70, 70, 85),
            selected_text: rgb(248, 248, 250),
            status_bar_background: rgb(34, 40, 54),
            success: rgb(31, 101, 48),
            error: rgb(166, 41, 55),
            warning: rgb(137, 72, 0),
            info: rgb(0, 98, 116),
            on_solid_text: rgb(46, 52, 64),
            on_solid_icon: rgb(46, 52, 64),
        },
        // The historical pink/paper scheme. Same canonical semantic quartet
        // (solid fills ignore the mode), house white ink on the fills.
        light: StockTokenScheme {
            primary: rgb(214, 51, 132),
            secondary: rgb(156, 106, 222),
            accent: rgb(230, 167, 0),
            text: rgb(30, 30, 30),
            muted: rgb(80, 80, 80),
            border: rgb(128, 128, 128),
            focused_border: rgb(214, 51, 132),
            background: rgb(245, 245, 240),
            surface: rgb(255, 255, 255),
            selected_background: rgb(200, 200, 205),
            selected_text: rgb(40, 40, 45),
            status_bar_background: rgb(230, 230, 225),
            success: rgb(31, 101, 48),
            error: rgb(166, 41, 55),
            warning: rgb(137, 72, 0),
            info: rgb(0, 98, 116),
            on_solid_text: rgb(255, 255, 255),
            on_solid_icon: rgb(255, 255, 255),
        },
    }
}
