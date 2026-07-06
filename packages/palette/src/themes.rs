//! Ready-to-use themed palettes.
//!
//! Every palette here is **self-contained**: colors are defined by their hex
//! values directly, with no dependency on any `collections::*` module. This
//! keeps the theming layer decoupled from the (opt-in) color catalogs — you can
//! use any theme without enabling a single collection feature.
//!
//! The hex values below mirror the colors that the old chinese-constant-based
//! themes referenced, so the visual output is unchanged.

use std::{collections::HashMap, sync::RwLock};

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
        color.glow_contrast_dynamic_rgba()
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
// success 葱倩 #0eb840, warning 鹅黄 #fff143, danger 朱红 #ff4c00,
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
            success: Color::from_rgb_hex(0x0e, 0xb8, 0x40), // 葱倩
            warning: Color::from_rgb_hex(0xff, 0xf1, 0x43), // 鹅黄
            danger: Color::from_rgb_hex(0xff, 0x4c, 0x00),  // 朱红
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
            success: Color::from_rgb_hex(0x0e, 0xb8, 0x40), // 葱倩
            warning: Color::from_rgb_hex(0xff, 0xf1, 0x43), // 鹅黄
            danger: Color::from_rgb_hex(0xff, 0x4c, 0x00),  // 朱红
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

// === Arknights — Dark industrial (cyan + gold on deep navy) ==================

/// Arknights-inspired dark industrial theme.
pub struct Arknights;

impl Arknights {
    #[must_use]
    pub const fn palette() -> Palette {
        Palette {
            mode: ThemeMode::Dark,
            primary: Color::from_rgb_hex(0x00, 0xb4, 0xd8),
            secondary: Color::from_rgb_hex(0xff, 0xd7, 0x00),
            accent: Color::from_rgb_hex(0xff, 0xd7, 0x00),
            success: Color::from_rgb_hex(0x3f, 0xb9, 0x50),
            warning: Color::from_rgb_hex(0xd2, 0x99, 0x22),
            danger: Color::from_rgb_hex(0xf8, 0x51, 0x49),
            background: Color::from_rgb_hex(0x0d, 0x11, 0x17),
            surface: Color::from_rgb_hex(0x16, 0x1b, 0x22),
            border: Color::from_rgb_hex(0x30, 0x36, 0x3d),
            text_primary: Color::from_rgb_hex(0xe6, 0xed, 0xf3),
            text_secondary: Color::from_rgb_hex(0x8b, 0x94, 0x9e),
        }
    }
}

impl Default for Arknights {
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
        palettes.insert("arknights".to_string(), Arknights::palette());
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
    fn test_arknights_theme_is_dark() {
        let palette = Arknights::palette();
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
        assert_eq!(registry.get("arknights").unwrap().mode, ThemeMode::Dark);

        let names = registry.list();
        assert!(names.contains(&"hikari".to_string()));
        assert!(names.contains(&"tairitsu".to_string()));
        assert!(names.contains(&"arknights".to_string()));
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
