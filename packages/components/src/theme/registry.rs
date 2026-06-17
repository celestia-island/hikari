//! Theme registry for managing registered themes

use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};

use hikari_palette::themes::{Hikari, Palette, Tairitsu};

type ThemeRegistry = HashMap<String, Palette>;

fn init_registry() -> RwLock<ThemeRegistry> {
    let mut registry = ThemeRegistry::new();
    registry.insert("hikari".to_string(), Hikari::palette());
    registry.insert("tairitsu".to_string(), Tairitsu::palette());
    RwLock::new(registry)
}

static THEME_REGISTRY: OnceLock<RwLock<ThemeRegistry>> = OnceLock::new();

fn registry() -> &'static RwLock<ThemeRegistry> {
    THEME_REGISTRY.get_or_init(init_registry)
}

/// Registers a custom theme with the given name
pub fn register_theme(name: &str, palette: Palette) {
    let mut reg = registry().write().unwrap_or_else(|e| e.into_inner());
    reg.insert(name.to_string(), palette);
}

/// Gets a registered theme by name
#[must_use]
pub fn get_registered_theme(name: &str) -> Option<Palette> {
    let reg = registry().read().unwrap_or_else(|e| e.into_inner());
    reg.get(name).cloned()
}

/// Returns the default theme name
/// Uses platform layer to detect dark mode preference
#[must_use]
pub fn get_default_theme() -> &'static str {
    if crate::platform::prefers_dark_mode() {
        "tairitsu"
    } else {
        "hikari"
    }
}

/// Returns true if the system prefers dark mode
/// Delegates to platform layer for unified WASI implementation
#[must_use]
pub fn prefers_dark_mode() -> bool {
    crate::platform::prefers_dark_mode()
}

#[cfg(test)]
mod tests {
    use hikari_palette::themes::{Hikari, Tairitsu, ThemeMode};

    use super::*;

    #[test]
    fn register_and_get_custom_theme() {
        let palette = Hikari::palette();
        register_theme("test_register_custom", palette.clone());
        let result = get_registered_theme("test_register_custom");
        assert!(result.is_some());
        assert_eq!(result.unwrap().mode, ThemeMode::Light);
    }

    #[test]
    fn get_nonexistent_theme_returns_none() {
        assert!(get_registered_theme("nonexistent_theme_xyz_12345").is_none());
    }

    #[test]
    fn default_themes_are_pre_registered() {
        let hikari = get_registered_theme("hikari");
        assert!(hikari.is_some());
        assert_eq!(hikari.unwrap().mode, ThemeMode::Light);

        let tairitsu = get_registered_theme("tairitsu");
        assert!(tairitsu.is_some());
        assert_eq!(tairitsu.unwrap().mode, ThemeMode::Dark);
    }

    #[test]
    fn overwrite_existing_theme_with_same_name() {
        register_theme("test_overwrite_reg", Hikari::palette());
        assert_eq!(
            get_registered_theme("test_overwrite_reg").unwrap().mode,
            ThemeMode::Light
        );

        register_theme("test_overwrite_reg", Tairitsu::palette());
        assert_eq!(
            get_registered_theme("test_overwrite_reg").unwrap().mode,
            ThemeMode::Dark
        );
    }

    #[test]
    fn get_default_theme_returns_valid_name() {
        let name = get_default_theme();
        assert!(name == "hikari" || name == "tairitsu");
    }

    #[test]
    fn prefers_dark_mode_returns_bool_without_panic() {
        let result = prefers_dark_mode();
        let _ = result;
    }
}
