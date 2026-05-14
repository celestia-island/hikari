//! Theme palette definitions
//!
//! This module provides the two official theme palettes:
//! - **Hikari** - Light theme (光) - Pink + White
//! - **Tairitsu** - Dark theme (対立) - Deep Blue + Black

use std::{collections::HashMap, sync::RwLock};

use super::colors::*;

/// Theme mode enumeration
///
/// Identifies whether a palette is light or dark mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ThemeMode {
    /// Light mode (白天模式)
    Light,
    /// Dark mode (暗黑模式)
    Dark,
}

/// Color palette configuration
///
/// Defines a complete color scheme with primary, secondary,
/// accent, semantic colors, and surface/text colors.
#[derive(Debug, Clone)]
pub struct Palette {
    /// Theme mode (light or dark)
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
    /// Get contrast color for a button variant color (for glow effects)
    ///
    /// Returns rgba string for contrast color (black or white) with 0.9 opacity
    ///
    /// Note: For ghost/transparent buttons, use `ghost_glow_color()` instead
    /// Note: Actual glow colors are defined in CSS (base.scss)
    ///       based on button color brightness only (theme-independent)
    ///
    /// # Arguments
    /// * `variant_color` - The button color to get contrast for
    ///
    /// # Examples
    /// ```
    /// use hikari_palette::*;
    ///
    /// let palette = Hikari::palette();
    /// // Returns dynamic opacity based on button brightness (theme-independent)
    /// let contrast = palette.button_glow_color(&palette.primary);
    /// // e.g., "rgba(0, 0, 0, 0.7)" for pink, "rgba(255, 255, 255, 0.6)" for indigo
    /// ```
    pub fn button_glow_color(&self, color: &Color) -> String {
        // Use the color's glow contrast method (theme-independent)
        // Dynamic opacity based on contrast between button and glow color
        color.glow_contrast_dynamic_rgba()
    }

    /// Get contrast color for ghost buttons (text color and border)
    ///
    /// Returns rgba string for 90% opacity
    ///
    /// # Examples
    /// ```
    /// use hikari_palette::*;
    ///
    /// let hikari = Hikari::palette();
    /// // hikari is light mode, ghost uses black text
    /// let text_color = hikari.ghost_text_color(0.9);
    /// // "rgba(0, 0, 0, 0.9)"
    ///
    /// let tairitsu = Tairitsu::palette();
    /// // tairitsu is dark mode, ghost uses white text
    /// let text_color = tairitsu.ghost_text_color(0.9);
    /// // "rgba(255, 255, 255, 0.9)"
    /// ```
    pub fn ghost_text_color(&self, alpha: f64) -> String {
        let color = match self.mode {
            ThemeMode::Light => Color::from_rgb(0, 0, 0),
            ThemeMode::Dark => Color::from_rgb(255, 255, 255),
        };
        color.rgba(alpha)
    }

    /// Get ghost border color (low opacity)
    ///
    /// # Examples
    /// ```
    /// use hikari_palette::*;
    ///
    /// let palette = Hikari::palette();
    /// let border = palette.ghost_border_color(0.2);
    /// // "rgba(0, 0, 0, 0.2)"
    /// ```
    pub fn ghost_border_color(&self, alpha: f64) -> String {
        let color = match self.mode {
            ThemeMode::Light => Color::from_rgb(0, 0, 0),
            ThemeMode::Dark => Color::from_rgb(255, 255, 255),
        };
        color.rgba(alpha)
    }

    /// Get glow color for ghost buttons
    ///
    /// # Examples
    /// ```
    /// use hikari_palette::*;
    ///
    /// let hikari = Hikari::palette();
    /// let glow = hikari.ghost_glow_color(0.8);
    /// // "rgba(0, 0, 0, 0.8)"
    ///
    /// let tairitsu = Tairitsu::palette();
    /// let glow = tairitsu.ghost_glow_color(0.8);
    /// // "rgba(255, 255, 255, 0.8)"
    /// ```
    pub fn ghost_glow_color(&self, alpha: f64) -> String {
        let color = match self.mode {
            ThemeMode::Light => Color::from_rgb(0, 0, 0),
            ThemeMode::Dark => Color::from_rgb(255, 255, 255),
        };
        color.rgba(alpha)
    }

    /// Get focus brightness filter value for a button variant color
    ///
    /// Returns "1.2" for dark buttons (to brighten on focus)
    /// Returns "0.8" for light buttons (to dim on focus)
    ///
    /// This matches the glow color selection logic:
    /// - Dark colors (< 0.4 brightness) need to be brighter on focus
    /// - Light colors (>= 0.4 brightness) need to be darker on focus
    ///
    /// # Examples
    /// ```
    /// use hikari_palette::*;
    ///
    /// let hikari = Hikari::palette();
    /// let primary_brightness = hikari.focus_brightness_filter(&hikari.primary);
    /// // "0.8" (primary is light, should dim on focus)
    ///
    /// let tairitsu = Tairitsu::palette();
    /// let secondary_brightness = tairitsu.focus_brightness_filter(&tairitsu.secondary);
    /// // "1.2" (secondary is dark, should brighten on focus)
    /// ```
    pub fn focus_brightness_filter(&self, color: &Color) -> String {
        let brightness = color.brightness();
        if brightness < 0.4 {
            "1.2".to_string() // Dark button: brighten on focus
        } else {
            "0.8".to_string() // Light button: dim on focus
        }
    }
}

/// Hikari theme - Light theme (光)
///
/// Represents light and brightness. This is the default light theme
/// with clean, bright colors suitable for daytime use.
#[derive(Debug, Clone)]
pub struct Hikari;

impl Hikari {
    pub fn palette() -> Palette {
        Palette {
            mode: ThemeMode::Light,
            primary: 粉红,                                        // 粉红 (255, 179, 167)
            secondary: 苍翠,                                      // 苍翠 (81, 154, 115)
            accent: 姜黄,                                         // 姜黄 (255, 199, 115)
            success: 葱倩,                                        // 葱倩 (14, 184, 64)
            warning: 杏黄,                                        // 杏黄 (255, 166, 49)
            danger: 朱红,                                         // 朱红 (255, 76, 0)
            background: 精白,                                     // 纯白 (255, 255, 255)
            surface: 精白,                                        // 纯白 (255, 255, 255)
            border: Color::from_rgb(196, 216, 218),               // #C4D8DA 浅蓝灰
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

/// Tairitsu theme - Dark theme (tairitsu)
///
/// Represents darkness and contrast. This is the dark theme
/// with deep, rich colors suitable for nighttime use.
#[derive(Debug, Clone)]
pub struct Tairitsu;

impl Tairitsu {
    pub fn palette() -> Palette {
        Palette {
            mode: ThemeMode::Dark,
            primary: 鷃蓝,                                         // 鷃蓝 (20, 74, 116)
            secondary: 姜黄,                                       // 姜黄 (255, 199, 115)
            accent: 姜黄,                                          // 姜黄 (255, 199, 115)
            success: 葱倩,                                         // 葱倩 (14, 184, 64)
            warning: 杏黄,                                         // 杏黄 (255, 166, 49)
            danger: 朱红,                                          // 朱红 (255, 76, 0)
            background: 漆黑,                                      // (22, 24, 35)
            surface: Color::from_rgb(32, 35, 54),
            border: Color::from_rgb(48, 52, 72),
            text_primary: Color::from_rgb_float(0.94, 0.94, 0.96),
            text_secondary: Color::from_rgb_float(0.70, 0.72, 0.78),
        }
    }
}

impl Default for Tairitsu {
    fn default() -> Self {
        Self
    }
}

/// Arknights theme - Dark industrial theme inspired by the game Arknights
///
/// Features cyan/ice blue primary with gold accents on a deep navy background,
/// evoking the tactical industrial aesthetic of the game.
#[derive(Debug, Clone)]
pub struct Arknights;

impl Arknights {
    pub fn palette() -> Palette {
        Palette {
            mode: ThemeMode::Dark,
            primary: Color::from_rgb(0, 180, 216),   // #00B4D8 cyan/ice blue
            secondary: Color::from_rgb(255, 215, 0),  // #FFD700 gold
            accent: Color::from_rgb(255, 215, 0),     // #FFD700 gold
            success: Color::from_rgb(63, 185, 80),    // #3FB950
            warning: Color::from_rgb(210, 153, 34),   // #D29922
            danger: Color::from_rgb(248, 81, 73),     // #F85149
            background: Color::from_rgb(13, 17, 23),  // #0D1117 very dark navy
            surface: Color::from_rgb(22, 27, 34),     // #161B22
            border: Color::from_rgb(48, 54, 61),      // #30363D
            text_primary: Color::from_rgb(230, 237, 243),   // #E6EDF3
            text_secondary: Color::from_rgb(139, 148, 158),  // #8B949E
        }
    }
}

impl Default for Arknights {
    fn default() -> Self {
        Self
    }
}

/// Theme registry for dynamically managing palettes
///
/// Allows registration and retrieval of custom palettes by name.
pub struct ThemeRegistry {
    palettes: RwLock<HashMap<String, Palette>>,
}

impl ThemeRegistry {
    /// Create a new theme registry
    pub fn new() -> Self {
        let mut palettes = HashMap::new();
        palettes.insert("hikari".to_string(), Hikari::palette());
        palettes.insert("tairitsu".to_string(), Tairitsu::palette());
        palettes.insert("arknights".to_string(), Arknights::palette());

        Self {
            palettes: RwLock::new(palettes),
        }
    }

    /// Register a new palette
    ///
    /// # Arguments
    /// * `name` - Unique name for the palette
    /// * `palette` - The palette to register
    ///
    /// # Returns
    /// * `Ok(())` if successfully registered
    /// * `Err(String)` if a palette with this name already exists
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

    /// Get a palette by name
    ///
    /// # Arguments
    /// * `name` - Name of the palette to retrieve
    ///
    /// # Returns
    /// * `Some(Palette)` if found
    /// * `None` if not found
    pub fn get(&self, name: &str) -> Option<Palette> {
        self.palettes
            .read()
            .ok()
            .and_then(|palettes| palettes.get(name).cloned())
    }

    /// Update an existing palette
    ///
    /// # Arguments
    /// * `name` - Name of the palette to update
    /// * `palette` - The new palette
    ///
    /// # Returns
    /// * `Ok(())` if successfully updated
    /// * `Err(String)` if palette not found or lock failed
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

    /// List all registered palette names
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

/// Global theme registry instance
static REGISTRY: std::sync::OnceLock<ThemeRegistry> = std::sync::OnceLock::new();

/// Get the global theme registry
pub fn registry() -> &'static ThemeRegistry {
    REGISTRY.get_or_init(ThemeRegistry::new)
}

/// Get a palette by name from the global registry
pub fn get_palette(name: &str) -> Option<Palette> {
    registry().get(name)
}

/// Register a palette in the global registry
pub fn register_palette(name: &str, palette: Palette) -> Result<(), String> {
    registry().register(name, palette)
}

/// Get the default theme (Hikari light theme)
pub fn default_theme() -> Palette {
    Hikari::palette()
}

/// Get the light theme (Hikari)
pub fn light_theme() -> Palette {
    Hikari::palette()
}

/// Get the dark theme (Tairitsu)
pub fn dark_theme() -> Palette {
    Tairitsu::palette()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hikari_theme() {
        let palette = Hikari::palette();
        assert_eq!(palette.mode, ThemeMode::Light);
        assert_eq!(palette.primary, 粉红);
        assert_eq!(palette.background, 精白);
        assert_eq!(
            palette.text_primary,
            Color::from_rgb_float(0.15, 0.15, 0.15)
        );
    }

    #[test]
    fn test_tairitsu_theme() {
        let palette = Tairitsu::palette();
        assert_eq!(palette.mode, ThemeMode::Dark);
        assert_eq!(palette.primary, 鷃蓝);
        assert_eq!(palette.background, 漆黑);
        assert_eq!(palette.surface, Color::from_rgb(32, 35, 54));
        assert_eq!(palette.border, Color::from_rgb(48, 52, 72));
        assert_eq!(
            palette.text_primary,
            Color::from_rgb_float(0.94, 0.94, 0.96)
        );
        assert_eq!(
            palette.text_secondary,
            Color::from_rgb_float(0.70, 0.72, 0.78)
        );
    }

    #[test]
    fn test_default_is_hikari() {
        let palette = default_theme();
        assert_eq!(palette.mode, ThemeMode::Light);
        assert_eq!(palette.background, 精白);
    }

    #[test]
    fn test_registry() {
        let registry = ThemeRegistry::new();

        // Test getting existing palettes
        let hikari = registry.get("hikari").unwrap();
        assert_eq!(hikari.mode, ThemeMode::Light);

        let tairitsu = registry.get("tairitsu").unwrap();
        assert_eq!(tairitsu.mode, ThemeMode::Dark);

        // Test listing
        let names = registry.list();
        assert!(names.contains(&"hikari".to_string()));
        assert!(names.contains(&"tairitsu".to_string()));

        // Test registration
        let custom = Palette {
            mode: ThemeMode::Light,
            primary: 粉红,
            secondary: 石青,
            accent: 姜黄,
            success: 葱倩,
            warning: 杏黄,
            danger: 朱红,
            background: 精白,
            surface: 精白,
            border: Color::from_rgb(196, 216, 218),
            text_primary: 墨色,
            text_secondary: 黛,
        };

        registry.register("custom", custom.clone()).unwrap();
        let retrieved = registry.get("custom").unwrap();
        assert_eq!(retrieved.primary, 粉红);

        // Test update
        let updated = Palette {
            mode: ThemeMode::Dark,
            ..custom
        };
        registry.update("custom", updated).unwrap();
        let updated_retrieved = registry.get("custom").unwrap();
        assert_eq!(updated_retrieved.mode, ThemeMode::Dark);
    }
}

#[test]
fn test_palette_button_glow() {
    let hikari = Hikari::palette();
    let tairitsu = Tairitsu::palette();

    // hikari Primary (粉红 - brightness 0.786) should get black glow
    // Contrast: |0.786 - 0.0| = 0.786 > 0.7, alpha = 0.7
    let hikari_primary_glow = hikari.button_glow_color(&hikari.primary);
    assert_eq!(hikari_primary_glow, "rgba(0, 0, 0, 0.7)");

    // tairitsu Primary (鷃蓝 - brightness 0.25) should get white glow
    // Contrast: |0.25 - 1.0| = 0.75 > 0.7, alpha = 0.7
    let tairitsu_primary_glow = tairitsu.button_glow_color(&tairitsu.primary);
    assert_eq!(tairitsu_primary_glow, "rgba(255, 255, 255, 0.7)");

    // hikari Secondary (苍翠 - brightness 0.501) should get black glow
    // Contrast: |0.501 - 0.0| = 0.501 > 0.5, <= 0.7, alpha = 0.6
    let hikari_secondary_glow = hikari.button_glow_color(&hikari.secondary);
    assert_eq!(hikari_secondary_glow, "rgba(0, 0, 0, 0.6)");

    // tairitsu Secondary (姜黄 - brightness 0.808) should get black glow
    // Contrast: |0.808 - 0.0| = 0.808 > 0.7, alpha = 0.7
    let tairitsu_secondary_glow = tairitsu.button_glow_color(&tairitsu.secondary);
    assert_eq!(tairitsu_secondary_glow, "rgba(0, 0, 0, 0.7)");

    // Success (葱倩 - brightness 0.47) should get black glow
    // Contrast: |0.47 - 0.0| = 0.47 < 0.5, alpha = 0.5
    let success_glow = hikari.button_glow_color(&hikari.success);
    assert_eq!(success_glow, "rgba(0, 0, 0, 0.5)");

    // Danger (朱红 - brightness 0.47) should get black glow
    // Contrast: |0.47 - 0.0| = 0.47 < 0.5, alpha = 0.5
    let danger_glow = hikari.button_glow_color(&hikari.danger);
    assert_eq!(danger_glow, "rgba(0, 0, 0, 0.5)");

    // tairitsu Success (葱倩 - brightness 0.47) should get black glow
    let tairitsu_success_glow = tairitsu.button_glow_color(&tairitsu.success);
    assert_eq!(tairitsu_success_glow, "rgba(0, 0, 0, 0.5)");

    // tairitsu Danger (朱红 - brightness 0.47) should get black glow
    let tairitsu_danger_glow = tairitsu.button_glow_color(&tairitsu.danger);
    assert_eq!(tairitsu_danger_glow, "rgba(0, 0, 0, 0.5)");
}

#[test]
fn test_palette_ghost_colors() {
    let hikari = Hikari::palette();
    let tairitsu = Tairitsu::palette();

    // hikari ghost text should be black
    let hikari_ghost_text = hikari.ghost_text_color(0.9);
    assert_eq!(hikari_ghost_text, "rgba(0, 0, 0, 0.9)");

    // tairitsu ghost text should be white
    let tairitsu_ghost_text = tairitsu.ghost_text_color(0.9);
    assert_eq!(tairitsu_ghost_text, "rgba(255, 255, 255, 0.9)");

    // hikari ghost glow should be black with low opacity
    let hikari_ghost_glow = hikari.ghost_glow_color(0.2);
    assert_eq!(hikari_ghost_glow, "rgba(0, 0, 0, 0.2)");

    // tairitsu ghost glow should be white
    let tairitsu_ghost_glow = tairitsu.ghost_glow_color(0.8);
    assert_eq!(tairitsu_ghost_glow, "rgba(255, 255, 255, 0.8)");
}
