//! Theme registry for managing registered themes

use std::{collections::HashMap, sync::RwLock};

use hikari_palette::*;

type ThemeRegistry = HashMap<String, Palette>;

static THEME_REGISTRY: once_cell::sync::Lazy<RwLock<ThemeRegistry>> =
    once_cell::sync::Lazy::new(|| {
        let mut registry = ThemeRegistry::new();

        registry.insert("hikari".to_string(), Hikari::palette());
        registry.insert("tairitsu".to_string(), Tairitsu::palette());

        RwLock::new(registry)
    });

/// Registers a custom theme with the given name
pub fn register_theme(name: &str, palette: Palette) {
    let mut registry = THEME_REGISTRY
        .write()
        .expect("Failed to acquire write lock on theme registry - rwlock poisoned");
    registry.insert(name.to_string(), palette);
}

/// Gets a registered theme by name
pub fn get_registered_theme(name: &str) -> Option<Palette> {
    let registry = THEME_REGISTRY
        .read()
        .expect("Failed to acquire read lock on theme registry - rwlock poisoned");
    registry.get(name).cloned()
}

/// Returns the default theme name
pub fn get_default_theme() -> &'static str {
    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    {
        if prefers_dark_mode() {
            "tairitsu"
        } else {
            "hikari"
        }
    }

    #[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
    {
        "hikari"
    }
}

/// Returns true if the system prefers dark mode
pub fn prefers_dark_mode() -> bool {
    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    {
        web_sys::window()
            .and_then(|w| w.match_media("(prefers-color-scheme: dark)").ok())
            .flatten()
            .map(|mql| mql.matches())
            .unwrap_or(false)
    }

    #[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
    {
        false
    }
}
