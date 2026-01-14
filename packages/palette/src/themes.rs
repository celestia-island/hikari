//! Theme palette definitions
//!
//! This module provides the two official theme palettes:
//! - **Hikari** - Light theme (光) - Pink + White
//! - **Tairitsu** - Dark theme (tairitsu) - Deep Blue + Black

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
    pub primary: ChineseColor,
    pub secondary: ChineseColor,
    pub accent: ChineseColor,
    pub success: ChineseColor,
    pub warning: ChineseColor,
    pub danger: ChineseColor,
    pub background: ChineseColor,
    pub surface: ChineseColor,
    pub border: ChineseColor,
    pub text_primary: ChineseColor,
    pub text_secondary: ChineseColor,
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
            primary: 粉红,      // 粉红色系 (255, 179, 167)
            secondary: 靛青,    // 蓝色系 (23, 124, 176) - 互补色
            accent: 姜黄,       // 黄色系
            success: 葱倩,      // 绿色系
            warning: 鹅黄,      // 黄色系
            danger: 朱红,       // 红色系
            background: 月白,   // 白色 (214, 236, 240)
            surface: 素,        // 浅灰 (236, 241, 245)
            border: 素,         // 浅灰
            text_primary: 墨色, // 深色 (80, 97, 109)
            text_secondary: 黛, // 灰蓝色 (74, 66, 102)
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
            primary: 靛蓝,      // 深蓝色系 (6, 82, 121)
            secondary: 粉红,    // 粉红色系 (255, 179, 167)
            accent: 姜黄,       // 黄色系
            success: 葱倩,      // 绿色系
            warning: 鹅黄,      // 黄色系
            danger: 朱红,       // 红色系
            background: 墨色,   // 紫黑/深蓝黑 (80, 97, 109)
            surface: 黛,        // 深蓝灰 (74, 66, 102)
            border: 黛,         // 深蓝灰
            text_primary: 月白, // 纯白 (214, 236, 240)
            text_secondary: 素, // 浅灰 (224, 240, 233)
        }
    }
}

impl Default for Tairitsu {
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
    REGISTRY.get_or_init(|| ThemeRegistry::new())
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
        assert_eq!(palette.background, 月白);
        assert_eq!(palette.text_primary, 墨色);
    }

    #[test]
    fn test_tairitsu_theme() {
        let palette = Tairitsu::palette();
        assert_eq!(palette.mode, ThemeMode::Dark);
        assert_eq!(palette.primary, 靛蓝);
        assert_eq!(palette.background, 墨色);
        assert_eq!(palette.text_primary, 月白);
    }

    #[test]
    fn test_default_is_hikari() {
        let palette = default_theme();
        assert_eq!(palette.mode, ThemeMode::Light);
        assert_eq!(palette.background, 月白);
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
            warning: 鹅黄,
            danger: 朱红,
            background: 月白,
            surface: 素,
            border: 素,
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
