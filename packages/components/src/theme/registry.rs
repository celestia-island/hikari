//! Theme registry for managing registered themes

use std::{collections::HashMap, sync::RwLock};

use palette::*;

type ThemeRegistry = HashMap<String, Palette>;

static THEME_REGISTRY: once_cell::sync::Lazy<RwLock<ThemeRegistry>> =
    once_cell::sync::Lazy::new(|| {
        let mut registry = ThemeRegistry::new();

        registry.insert("hikari".to_string(), Hikari::palette());
        registry.insert("tairitsu".to_string(), Tairitsu::palette());

        RwLock::new(registry)
    });

/// Register a custom theme
///
/// Allows adding new themes to the global registry that can be used
/// by ThemeProvider via the palette prop.
///
/// # Arguments
///
/// * `name` - Unique identifier for the theme (e.g., "custom-dark")
/// * `palette` - Palette containing all theme colors
///
/// # Example
///
/// ```rust,no_run
/// use hikari_components::register_theme;
/// use hikari_palette::{Palette, ChineseColor};
///
/// register_theme("custom", Palette {
///     primary: ChineseColor::from_rgb(255, 100, 100),
///     secondary: ChineseColor::from_rgb(100, 100, 255),
///     // ... other colors
///     ..Default::default()
/// });
/// ```
pub fn register_theme(name: &str, palette: Palette) {
    let mut registry = THEME_REGISTRY.write().unwrap();
    registry.insert(name.to_string(), palette);
}

/// Get registered theme by name
///
/// Returns the Palette for a registered theme, or None if not found.
///
/// # Arguments
///
/// * `name` - Theme name (e.g., "hikari", "tairitsu")
pub fn get_registered_theme(name: &str) -> Option<Palette> {
    let registry = THEME_REGISTRY.read().unwrap();
    registry.get(name).cloned()
}

/// Get default theme based on system color scheme
///
/// Returns Hikari for light mode, Tairitsu for dark mode.
///
/// # Platform Support
///
/// - **WASM**: Returns actual `prefers-color-scheme: dark` media query result
/// - **Non-WASM**: Always returns Hikari (light mode default)
pub fn get_default_theme() -> &'static str {
    #[cfg(target_arch = "wasm32")]
    {
        if prefers_dark_mode() {
            "tairitsu"
        } else {
            "hikari"
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        "hikari"
    }
}

/// Detect if the system prefers dark mode using `prefers-color-scheme`.
///
/// This function checks the user's system color scheme preference.
/// Returns `true` if dark mode is preferred, `false` otherwise.
///
/// # Example
///
/// ```rust,no_run
/// # use hikari_components::prefers_dark_mode;
/// if prefers_dark_mode() {
///     // Use dark theme
/// }
/// ```
///
/// # Platform Support
///
/// - **WASM**: Returns the actual `prefers-color-scheme: dark` media query result
/// - **Non-WASM**: Always returns `false` (light mode default)
pub fn prefers_dark_mode() -> bool {
    #[cfg(target_arch = "wasm32")]
    {
        use gloo::utils::window;

        window()
            .match_media("(prefers-color-scheme: dark)")
            .ok()
            .flatten()
            .map(|mql| mql.matches())
            .unwrap_or(false)
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        false
    }
}
