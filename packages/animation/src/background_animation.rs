//! Background animation utilities
//!
//! Provides utilities for background animations including theme color detection
//! and breathing effects.

use std::cell::RefCell;

use hikari_palette::color_math::{adjust_lightness_hex, adjust_saturation_hex};
use hikari_palette::{墨色, 月白, 粉红, 靛蓝};

/// Background render context (carries render parameters)
#[derive(Clone, Debug)]
pub struct BackgroundRenderContext {
    /// Center X percentage
    pub center_x: f64,
    /// Center Y percentage
    pub center_y: f64,
    /// Color 1 (hex)
    pub color1: String,
    /// Color 2 (hex)
    pub color2: String,
}

/// Cache for theme colors to avoid repeated DOM queries
#[derive(Clone)]
struct ThemeCache {
    last_theme: String,
    colors: (String, String),
}

/// Get theme colors from document with caching
///
/// Performance: Uses thread_local cache to avoid repeated DOM queries.
/// Only queries DOM when theme has changed.
///
/// Returns: (color1, color2) as hex strings
pub fn get_theme_colors() -> (String, String) {
    thread_local! {
        static THEME_CACHE: RefCell<Option<ThemeCache>> = RefCell::new(None);
    }

    let document = match web_sys::window().and_then(|w| w.document()) {
        Some(doc) => doc,
        None => return (月白.hex(), 粉红.hex()),
    };

    // Get current theme from DOM
    let current_theme = match document
        .query_selector(".hi-theme-provider[data-theme]")
        .ok()
        .flatten()
        .and_then(|el| el.get_attribute("data-theme"))
    {
        Some(t) => t,
        None => "hikari".to_string(),
    };

    // Check cache first
    let colors = THEME_CACHE.with_borrow(|cache| {
        if let Some(cached) = cache.as_ref() {
            if cached.last_theme == current_theme {
                // Cache hit - return cached colors
                return cached.colors.clone();
            }
        }
        // Cache miss or theme changed
        let new_colors = match current_theme.as_str() {
            "tairitsu" => (墨色.hex(), 靛蓝.hex()),
            _ => (月白.hex(), 粉红.hex()),
        };
        new_colors
    });

    // Update cache if needed
    THEME_CACHE.with_borrow_mut(|cache| {
        let needs_update = cache.as_ref()
            .map_or(true, |c| c.last_theme != current_theme);
        if needs_update {
            *cache = Some(ThemeCache {
                last_theme: current_theme,
                colors: colors.clone(),
            });
        }
    });

    colors
}

/// Calculate background animation context for a given timestamp
///
/// Returns render context with rotating center position and breathing color effects.
pub fn calculate_background_context(timestamp: f64) -> BackgroundRenderContext {
    // Get theme colors from document (cached)
    let (color1, color2) = get_theme_colors();

    // Rotation period: 60 seconds (60000ms)
    // Calculate new angle based on timestamp
    let period_ms = 60000.0;
    let new_angle = (timestamp / period_ms) * 2.0 * std::f64::consts::PI;

    // Calculate center position (radius = 20%)
    let radius_percent = 20.0;
    let center_x = 50.0 + radius_percent * new_angle.cos();
    let center_y = 50.0 + radius_percent * new_angle.sin();

    // Apply breathing effect (4-second cycle)
    let breathing_progress = (timestamp / 4000.0) % 2.0;
    let actual_progress = if breathing_progress > 1.0 {
        2.0 - breathing_progress
    } else {
        breathing_progress
    };

    let sin_val = (actual_progress * std::f64::consts::PI).sin();
    let saturation_factor = 1.0 + (sin_val * 0.05);
    let lightness_factor = 1.0 + (sin_val * 0.05);

    // Apply breathing to colors
    let breathing_color1 = adjust_saturation_hex(&color1, saturation_factor);
    let breathing_color1 = adjust_lightness_hex(&breathing_color1, lightness_factor);
    let breathing_color2 = adjust_saturation_hex(&color2, saturation_factor);
    let breathing_color2 = adjust_lightness_hex(&breathing_color2, lightness_factor);

    BackgroundRenderContext {
        center_x,
        center_y,
        color1: breathing_color1,
        color2: breathing_color2,
    }
}
