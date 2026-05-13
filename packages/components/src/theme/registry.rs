//! Theme registry for managing registered themes

use std::{
    collections::HashMap,
    sync::{OnceLock, RwLock},
};

use hikari_palette::*;

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
    let mut reg = registry()
        .write()
        .expect("Failed to acquire write lock on theme registry - rwlock poisoned");
    reg.insert(name.to_string(), palette);
}

/// Gets a registered theme by name
pub fn get_registered_theme(name: &str) -> Option<Palette> {
    let reg = registry()
        .read()
        .expect("Failed to acquire read lock on theme registry - rwlock poisoned");
    reg.get(name).cloned()
}

/// Returns the default theme name
/// Uses platform layer to detect dark mode preference
pub fn get_default_theme() -> &'static str {
    if crate::platform::prefers_dark_mode() {
        "tairitsu"
    } else {
        "hikari"
    }
}

/// Returns true if the system prefers dark mode
/// Delegates to platform layer for unified WASI implementation
pub fn prefers_dark_mode() -> bool {
    crate::platform::prefers_dark_mode()
}
