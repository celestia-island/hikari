//! Ready-to-use themed palettes.
//!
//! Every palette here is **self-contained**: colors are defined by their hex
//! values directly, with no dependency on any `collections::*` module. This
//! keeps the theming layer decoupled from the (opt-in) color catalogs — you can
//! use any theme without enabling a single collection feature.
//!
//! The BRAND role colors (primary / secondary / accent / background / surface /
//! border / text) keep the chinese-constant hexes, so those surfaces look
//! unchanged. The SEMANTIC trio (success / warning / danger) does not: it follows
//! the canonical perceptual family so the house white ink reads on it — see the
//! note above `Hikari::palette`.

use std::collections::HashMap;
use std::sync::RwLock;

use super::colors::*;

/// Theme mode enumeration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ThemeMode {
    Light,
    Dark,
}

/// A complete color scheme: accent roles, semantic colors, and surface/text
/// colors.
#[derive(Debug, Clone)]
pub struct Palette {
    pub mode: ThemeMode,
    pub primary: Color,
    pub secondary: Color,
    pub accent: Color,
    pub success: Color,
    pub warning: Color,
    pub danger: Color,
    pub background: Color,
    pub surface: Color,
    pub border: Color,
    pub text_primary: Color,
    pub text_secondary: Color,
}

impl Palette {
    /// Contrast color (black or white) for a button variant color, used for
    /// glow effects. Dynamic opacity is derived from the button's brightness.
    pub fn button_glow_color(&self, color: &Color) -> String {
        let (r, g, b, alpha) = color.glow_contrast_dynamic();
        // A glow is drawn ON the page, so it must separate from the palette's
        // own background — not merely from the button. The fill-derived ink
        // stops working when the fills go dark on a light page (a white halo
        // on 月白 sits at ~1.1:1, i.e. invisible), so flip it when it cannot
        // separate.
        let glow = Color::from_rgb_hex(r, g, b);
        if glow.contrast_ratio(&self.background) >= 3.0 {
            return format!("rgba({r}, {g}, {b}, {alpha})");
        }
        let (fr, fg, fb) = if r == 255 { (0, 0, 0) } else { (255, 255, 255) };
        format!("rgba({fr}, {fg}, {fb}, {alpha})")
    }

    /// Ghost-button text color: black for light themes, white for dark.
    pub fn ghost_text_color(&self, alpha: f64) -> String {
        self.ghost_rgba(alpha)
    }

    /// Ghost-button border color (low opacity).
    pub fn ghost_border_color(&self, alpha: f64) -> String {
        self.ghost_rgba(alpha)
    }

    /// Ghost-button glow color.
    pub fn ghost_glow_color(&self, alpha: f64) -> String {
        self.ghost_rgba(alpha)
    }

    /// Focus brightness filter: `"1.2"` to brighten dark buttons on focus,
    /// `"0.8"` to dim light buttons on focus.
    pub fn focus_brightness_filter(&self, color: &Color) -> String {
        if color.brightness() < 0.4 {
            "1.2".to_string()
        } else {
            "0.8".to_string()
        }
    }

    fn ghost_rgba(&self, alpha: f64) -> String {
        let color = match self.mode {
            ThemeMode::Light => Color::from_rgb_hex(0, 0, 0),
            ThemeMode::Dark => Color::from_rgb_hex(255, 255, 255),
        };
        color.rgba(alpha)
    }
}

// === Hikari — Light theme (default) ==========================================
// primary 牡丹粉红 #eea2a4, secondary 苍翠 #519a73, accent 姜黄 #ffc773,
// Semantic trio (success / warning / danger) is DERIVED, not brand: canonical
// OKLCH hues + lightness chosen so the house white ink clears 7:1 (see the
// `semantic_tests` module at the bottom of this file).
// background 月白 #d6ecf0, surface/border 素 #e0f0e9.

/// Hikari — the default light theme.
pub struct Hikari;

impl Hikari {
    #[must_use]
    pub fn palette() -> Palette {
        Palette {
            mode: ThemeMode::Light,
            primary: Color::from_rgb_hex(0xee, 0xa2, 0xa4), // 牡丹粉红
            secondary: Color::from_rgb_hex(0x51, 0x9a, 0x73), // 苍翠
            accent: Color::from_rgb_hex(0xff, 0xc7, 0x73),  // 姜黄
            // Semantic trio — canonical OKLCH hues (success 148°, warning 58°,
            // danger 20°), lightness derived so the house WHITE ink clears 7:1
            // (at that level the perceptual algorithm picks white unambiguously).
            success: Color::from_rgb_hex(0x1f, 0x65, 0x30), // white 7.09:1
            warning: Color::from_rgb_hex(0x89, 0x48, 0x00), // white 7.02:1
            danger: Color::from_rgb_hex(0xa6, 0x29, 0x37),  // white 7.01:1
            background: Color::from_rgb_hex(0xd6, 0xec, 0xf0), // 月白
            surface: Color::from_rgb_hex(0xe0, 0xf0, 0xe9), // 素
            border: Color::from_rgb_hex(0xe0, 0xf0, 0xe9),  // 素
            text_primary: Color::from_rgb_float(0.15, 0.15, 0.15),
            text_secondary: Color::from_rgb_float(0.4, 0.4, 0.4),
        }
    }
}

impl Default for Hikari {
    fn default() -> Self {
        Self
    }
}

// === Tairitsu — Dark theme ===================================================
// primary 鷃蓝 #144a74, secondary/accent 姜黄 #ffc773, background 墨色 #50616d,
// surface/border 黛 #4a4266.

/// Tairitsu — the default dark theme.
pub struct Tairitsu;

impl Tairitsu {
    #[must_use]
    pub fn palette() -> Palette {
        Palette {
            mode: ThemeMode::Dark,
            primary: Color::from_rgb_hex(0x14, 0x4a, 0x74), // 鷃蓝
            secondary: Color::from_rgb_hex(0xff, 0xc7, 0x73), // 姜黄
            accent: Color::from_rgb_hex(0xff, 0xc7, 0x73),  // 姜黄
            // Same canonical semantic trio as the light theme: the ink rule is
            // a property of the fill, not of the mode.
            success: Color::from_rgb_hex(0x1f, 0x65, 0x30), // white 7.09:1
            warning: Color::from_rgb_hex(0x89, 0x48, 0x00), // white 7.02:1
            danger: Color::from_rgb_hex(0xa6, 0x29, 0x37),  // white 7.01:1
            background: Color::from_rgb_hex(0x50, 0x61, 0x6d), // 墨色
            surface: Color::from_rgb_hex(0x4a, 0x42, 0x66), // 黛
            border: Color::from_rgb_hex(0x4a, 0x42, 0x66),  // 黛
            text_primary: Color::from_rgb_float(0.95, 0.95, 0.95),
            text_secondary: Color::from_rgb_float(0.85, 0.85, 0.85),
        }
    }
}

impl Default for Tairitsu {
    fn default() -> Self {
        Self
    }
}

/// Runtime registry for named palettes (built-ins + user-registered).
pub struct ThemeRegistry {
    palettes: RwLock<HashMap<String, Palette>>,
}

impl ThemeRegistry {
    #[must_use]
    pub fn new() -> Self {
        let mut palettes = HashMap::new();
        palettes.insert("hikari".to_string(), Hikari::palette());
        palettes.insert("tairitsu".to_string(), Tairitsu::palette());
        Self {
            palettes: RwLock::new(palettes),
        }
    }

    /// Register a new palette. Errors if the name is already taken.
    pub fn register(&self, name: &str, palette: Palette) -> Result<(), String> {
        let mut palettes = self
            .palettes
            .write()
            .map_err(|e| format!("Failed to acquire write lock: {}", e))?;
        if palettes.contains_key(name) {
            return Err(format!("Palette '{}' already registered", name));
        }
        palettes.insert(name.to_string(), palette);
        Ok(())
    }

    /// Look up a palette by name.
    #[must_use]
    pub fn get(&self, name: &str) -> Option<Palette> {
        self.palettes
            .read()
            .ok()
            .and_then(|palettes| palettes.get(name).cloned())
    }

    /// Replace an existing palette. Errors if the name is unknown.
    pub fn update(&self, name: &str, palette: Palette) -> Result<(), String> {
        let mut palettes = self
            .palettes
            .write()
            .map_err(|e| format!("Failed to acquire write lock: {}", e))?;
        if !palettes.contains_key(name) {
            return Err(format!("Palette '{}' not found", name));
        }
        palettes.insert(name.to_string(), palette);
        Ok(())
    }

    /// List all registered palette names.
    pub fn list(&self) -> Vec<String> {
        self.palettes
            .read()
            .ok()
            .map(|palettes| palettes.keys().cloned().collect())
            .unwrap_or_default()
    }
}

impl Default for ThemeRegistry {
    fn default() -> Self {
        Self::new()
    }
}

static REGISTRY: std::sync::OnceLock<ThemeRegistry> = std::sync::OnceLock::new();

/// The global theme registry.
#[must_use]
pub fn registry() -> &'static ThemeRegistry {
    REGISTRY.get_or_init(ThemeRegistry::new)
}

/// Look up a palette by name from the global registry.
#[must_use]
pub fn get_palette(name: &str) -> Option<Palette> {
    registry().get(name)
}

/// Register a palette in the global registry.
pub fn register_palette(name: &str, palette: Palette) -> Result<(), String> {
    registry().register(name, palette)
}

/// The default theme (Hikari light).
#[must_use]
pub fn default_theme() -> Palette {
    Hikari::palette()
}

/// The light theme (Hikari).
#[must_use]
pub fn light_theme() -> Palette {
    Hikari::palette()
}

/// The dark theme (Tairitsu).
#[must_use]
pub fn dark_theme() -> Palette {
    Tairitsu::palette()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hikari_theme_is_light() {
        let palette = Hikari::palette();
        assert_eq!(palette.mode, ThemeMode::Light);
        assert!(palette.background.is_light());
    }

    #[test]
    fn test_tairitsu_theme_is_dark() {
        let palette = Tairitsu::palette();
        assert_eq!(palette.mode, ThemeMode::Dark);
        assert!(palette.background.is_dark());
    }

    #[test]
    fn test_default_is_hikari() {
        let palette = default_theme();
        assert_eq!(palette.mode, ThemeMode::Light);
    }

    #[test]
    fn test_registry_builtin_palettes() {
        let registry = ThemeRegistry::new();
        assert_eq!(registry.get("hikari").unwrap().mode, ThemeMode::Light);
        assert_eq!(registry.get("tairitsu").unwrap().mode, ThemeMode::Dark);

        let names = registry.list();
        assert_eq!(names.len(), 2, "only the two documented built-ins ship");
        assert!(names.contains(&"hikari".to_string()));
        assert!(names.contains(&"tairitsu".to_string()));
    }

    #[test]
    fn test_registry_register_and_update() {
        let registry = ThemeRegistry::new();
        let custom = Palette {
            mode: ThemeMode::Light,
            primary: Color::from_rgb_hex(0xff, 0xb3, 0xa7),
            secondary: Color::from_rgb_hex(0x7b, 0xcf, 0xa6),
            accent: Color::from_rgb_hex(0xff, 0xc7, 0x73),
            success: Color::from_rgb_hex(0x0e, 0xb8, 0x40),
            warning: Color::from_rgb_hex(0xff, 0xa6, 0x31),
            danger: Color::from_rgb_hex(0xff, 0x4c, 0x00),
            background: Color::from_rgb_hex(0xff, 0xff, 0xff),
            surface: Color::from_rgb_hex(0xff, 0xff, 0xff),
            border: Color::from_rgb_hex(0xc4, 0xd8, 0xda),
            text_primary: Color::from_rgb_float(0.15, 0.15, 0.15),
            text_secondary: Color::from_rgb_float(0.4, 0.4, 0.4),
        };
        registry.register("custom", custom.clone()).unwrap();
        assert_eq!(registry.get("custom").unwrap().primary, custom.primary);

        let updated = Palette {
            mode: ThemeMode::Dark,
            ..custom
        };
        registry.update("custom", updated).unwrap();
        assert_eq!(registry.get("custom").unwrap().mode, ThemeMode::Dark);
    }

    // --- Glow/ghost behavior — value parity with the old chinese-const themes ---

    #[test]
    fn test_palette_button_glow() {
        let hikari = Hikari::palette();
        let tairitsu = Tairitsu::palette();

        // Hikari primary 牡丹粉红 #eea2a4 — light, expects black glow at 0.7.
        assert_eq!(
            hikari.button_glow_color(&hikari.primary),
            "rgba(0, 0, 0, 0.7)"
        );
        // Tairitsu primary 鷃蓝 #144a74 — dark (<0.4), expects white glow at 0.7.
        assert_eq!(
            tairitsu.button_glow_color(&tairitsu.primary),
            "rgba(255, 255, 255, 0.7)"
        );
        // Hikari secondary 苍翠 #519a73 — mid brightness → black glow at 0.6.
        assert_eq!(
            hikari.button_glow_color(&hikari.secondary),
            "rgba(0, 0, 0, 0.6)"
        );
        // Tairitsu secondary 姜黄 #ffc773 — bright → black glow at 0.7.
        assert_eq!(
            tairitsu.button_glow_color(&tairitsu.secondary),
            "rgba(0, 0, 0, 0.7)"
        );
    }

    #[test]
    fn test_palette_ghost_colors() {
        let hikari = Hikari::palette();
        let tairitsu = Tairitsu::palette();
        assert_eq!(hikari.ghost_text_color(0.9), "rgba(0, 0, 0, 0.9)");
        assert_eq!(tairitsu.ghost_text_color(0.9), "rgba(255, 255, 255, 0.9)");
        assert_eq!(hikari.ghost_glow_color(0.2), "rgba(0, 0, 0, 0.2)");
        assert_eq!(tairitsu.ghost_glow_color(0.8), "rgba(255, 255, 255, 0.8)");
    }
}

#[cfg(test)]
mod semantic_tests {
    use super::*;

    /// Canonical semantic hues (OKLCH degrees) — the family the derivation
    /// targets. Chroma is deliberately absent: gamut mapping trims it in 8-bit,
    /// so the assertion that matters is `C > 0.02` (a slot must carry hue).
    const CANONICAL_HUES: [f64; 3] = [148.0, 58.0, 20.0];

    fn semantic_trio(p: &Palette) -> [Color; 3] {
        [p.success.clone(), p.warning.clone(), p.danger.clone()]
    }

    /// Every semantic fill sits on its canonical hue — the derivation must not
    /// drift, and a brand-value edit that ignores the family fails here.
    #[test]
    fn semantic_colors_keep_canonical_hues() {
        for (name, palette) in [
            ("hikari", Hikari::palette()),
            ("tairitsu", Tairitsu::palette()),
        ] {
            for (color, canon_hue) in semantic_trio(&palette).iter().zip(CANONICAL_HUES) {
                let (_, chroma, hue) = color.oklch();
                assert!(
                    chroma > 0.02,
                    "{name}: {} is achromatic (C={chroma:.4}) — a semantic slot must carry hue",
                    color.hex()
                );
                let delta = (hue - canon_hue).abs().min(360.0 - (hue - canon_hue).abs());
                assert!(
                    delta <= 5.0,
                    "{name}: {} hue {hue:.1}° is {delta:.1}° off canonical {canon_hue}°",
                    color.hex()
                );
            }
        }
    }

    /// The house WHITE ink must clear 7:1 on every semantic fill — that is the
    /// level at which the perceptual rule picks white unambiguously.
    #[test]
    fn semantic_fills_carry_readable_white_ink() {
        let white = Color::from_rgb_hex(0xff, 0xff, 0xff);
        for (name, palette) in [
            ("hikari", Hikari::palette()),
            ("tairitsu", Tairitsu::palette()),
        ] {
            for color in semantic_trio(&palette) {
                let ratio = white.contrast_ratio(&color);
                assert!(
                    ratio >= 7.0,
                    "{name}: white on {} is only {ratio:.2}:1 (need >= 7.0)",
                    color.hex()
                );
                assert_eq!(
                    color.solid_ink().hex(),
                    "#FFFFFF",
                    "{name}: {} must take the house white ink",
                    color.hex()
                );
            }
        }
    }

    /// A semantic fill's glow must stay visible ON THE PAGE: the fill-derived
    /// ink flips to white once the fills go dark, and a white halo on 月白 is
    /// invisible, so `button_glow_color` flips it back when it cannot separate
    /// from the palette background.
    #[test]
    fn semantic_glow_separates_from_the_page() {
        for (name, palette) in [
            ("hikari", Hikari::palette()),
            ("tairitsu", Tairitsu::palette()),
        ] {
            for fill in semantic_trio(&palette) {
                let rgba = palette.button_glow_color(&fill);
                let parts: Vec<&str> = rgba
                    .trim_start_matches("rgba(")
                    .trim_end_matches(')')
                    .split(", ")
                    .collect();
                let glow = Color::from_rgb_hex(
                    parts[0].parse().unwrap(),
                    parts[1].parse().unwrap(),
                    parts[2].parse().unwrap(),
                );
                let ratio = glow.contrast_ratio(&palette.background);
                assert!(
                    ratio >= 3.0,
                    "{name}: glow {rgba} on background {} is only {ratio:.2}:1",
                    palette.background.hex()
                );
            }
        }
    }

    /// A semantic slot is a solid FILL and ignores the light/dark mode (user
    /// direction). Anything that paints it as TEXT needs the readable variant:
    /// on a dark page the fill itself is invisible (~1.1:1).
    #[test]
    fn semantic_foreground_variant_reads_on_the_page() {
        for (name, palette) in [
            ("hikari", Hikari::palette()),
            ("tairitsu", Tairitsu::palette()),
        ] {
            for fill in semantic_trio(&palette) {
                let fg = fill.readable_on(&palette.background, 4.5);
                let ratio = fg.contrast_ratio(&palette.background);
                assert!(
                    ratio >= 4.5,
                    "{name}: {} as text on {} is only {ratio:.2}:1",
                    fg.hex(),
                    palette.background.hex()
                );
                // Hue is preserved: the variant is a lightness move, not a hue
                // change.
                let (_, _, want) = fill.oklch();
                let (_, _, got) = fg.oklch();
                let delta = (got - want).abs().min(360.0 - (got - want).abs());
                assert!(
                    delta <= 12.0,
                    "{name}: {} moved {delta:.1}° off {}'s hue",
                    fg.hex(),
                    fill.hex()
                );
            }
        }
    }

    /// The emitted foreground vars must keep the hue family (a tag/link that
    /// changes hue stops reading as "success"/"danger").
    #[test]
    fn semantic_foreground_keeps_the_family_hue() {
        for (name, palette) in [
            ("hikari", Hikari::palette()),
            ("tairitsu", Tairitsu::palette()),
        ] {
            for (fill, canon) in semantic_trio(&palette).iter().zip(CANONICAL_HUES) {
                let fg = fill.readable_on(&palette.background, 4.5);
                let (fg_l, chroma, hue) = fg.oklch();
                let delta = (hue - canon).abs().min(360.0 - (hue - canon).abs());
                // Δh ≤ 8°: a lightness move keeps the family hue (the HSL-based
                // search this replaced drifted 11.2°).
                assert!(
                    delta <= 8.0,
                    "{name}: text variant {} is {delta:.1}° off {canon}°",
                    fg.hex()
                );
                // Chroma: the variant must carry as much as the sRGB gamut
                // allows at its own lightness/hue (the perceptual rule keeps
                // the hue signal; only the gamut may clip it).
                // Expected chroma = min(what the fill had, what the gamut
                // allows at the fg's lightness) — the move must not clip
                // beyond the gamut's own forcing.
                let (_, fill_chroma, _) = fill.oklch();
                let max_c = Color::gamut_chroma(fg_l, hue);
                let expected = fill_chroma.min(max_c);
                assert!(
                    chroma >= expected * 0.95,
                    "{name}: text variant {} carries C={chroma:.4} but the gamut allows {max_c:.4} at its lightness",
                    fg.hex()
                );
            }
        }
    }

    /// The house ink rule must NOT be the WCAG winner: on mid greys the two
    /// disagree (white 3.95 / black 5.32 on #808080), and the contract is that
    /// the FILL is fixed, not the ink rule swapped. `solid_ink` (the ported
    /// house rule) says white there; `readable_ink` (the rejected utility)
    /// says black. This test pins the house answer against that discriminator.
    #[test]
    fn solid_ink_is_the_house_rule_not_the_ratio_winner() {
        let grey = Color::from_rgb_hex(0x80, 0x80, 0x80);
        assert_eq!(
            grey.solid_ink().hex(),
            "#FFFFFF",
            "solid_ink on mid-grey must stay white (the house rule)"
        );
        assert_ne!(
            grey.readable_ink().hex(),
            grey.solid_ink().hex(),
            "the discriminator fill must actually separate the two rules"
        );
    }

    /// The two bundled themes share one semantic family (the ink rule belongs
    /// to the fill, not to the mode).
    #[test]
    fn both_themes_share_the_semantic_family() {
        let light = semantic_trio(&Hikari::palette());
        let dark = semantic_trio(&Tairitsu::palette());
        for (l, d) in light.iter().zip(dark.iter()) {
            assert_eq!(l.hex(), d.hex(), "light/dark semantic fills diverged");
        }
    }
}
