// hikari-theme/src/context.rs
// Theme Context Provider

use hikari_palette::*;

/// Theme context state
#[derive(Clone)]
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
}

impl Default for ThemeContext {
    fn default() -> Self {
        ThemeContext {
            palette: "primary".to_string(),
            colors: primary_palette(),
        }
    }
}
