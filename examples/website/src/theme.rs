//! Theme integration for VNode-based rendering
//!
//! This module provides theme utilities for the Tairitsu VDOM framework,
//! generating CSS variables for Hikari/Tairitsu themes.

use hikari_components::{ComponentPalette, Style, ThemePalette};
use hikari_palette::{Hikari, get_palette};

/// Get CSS variables Style for the specified theme
pub fn get_theme_style(theme_name: &str) -> Style {
    let palette = get_palette(theme_name).unwrap_or_else(Hikari::palette);

    let theme_palette = ThemePalette::from_palette(&palette);
    let component_palette = ComponentPalette::from_palette(&palette);

    // Combine both CSS variable strings
    let css_vars = format!(
        "{} {}",
        theme_palette.css_variables(),
        component_palette.css_variables()
    );

    Style::from(css_vars)
}

/// Get the data-theme attribute value for the layout
pub fn get_layout_theme_class(theme_name: &str) -> &'static str {
    match theme_name {
        "tairitsu" => "hi-layout-dark",
        _ => "hi-layout-light",
    }
}

/// Get CSS variables Style for Hikari (light) theme
pub fn hikari_style() -> Style {
    get_theme_style("hikari")
}

/// Get CSS variables Style for Tairitsu (dark) theme
pub fn tairitsu_style() -> Style {
    get_theme_style("tairitsu")
}
