use std::collections::HashMap;

use palette::color_math::{adjust_lightness_hex, adjust_saturation_hex};
use web_sys::HtmlElement;

use crate::{error::AnimationError, state_machine::{RenderOutput, StateMachineBuilder}};

/// Background animation states
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum BackgroundAnimationState {
    /// Rotating gradient state
    Rotating {
        /// Current angle in radians
        angle: f64,
    },
}

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

/// Background event type (empty - no events)
#[derive(Clone, Debug)]
pub enum BackgroundEvent {
    // No events for background animation
}

/// Background state transition (Closure 1)
///
/// Returns: Result<(next_state, render_context), AnimationError>
pub fn background_transition(
    prev_state: BackgroundAnimationState,
    timestamp: f64,
    _events: Vec<BackgroundEvent>,
) -> Result<(BackgroundAnimationState, BackgroundRenderContext), AnimationError> {
    match prev_state {
        BackgroundAnimationState::Rotating { angle } => {
            // Rotation period: 60 seconds (60000ms)
            // Calculate new angle based on timestamp
            let period_ms = 60000.0;
            let new_angle = (timestamp / period_ms) * 2.0 * std::f64::consts::PI;

            // Calculate center position (radius = 20%)
            let radius_percent = 20.0;
            let center_x = 50.0 + radius_percent * new_angle.cos();
            let center_y = 50.0 + radius_percent * new_angle.sin();

            // Get theme colors from document (cached)
            let (color1, color2) = get_theme_colors();

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

            let ctx = BackgroundRenderContext {
                center_x,
                center_y,
                color1: breathing_color1,
                color2: breathing_color2,
            };

            Ok((BackgroundAnimationState::Rotating { angle: new_angle }, ctx))
        }
    }
}

/// Background render function (Closure 2)
///
/// Returns: Result<render_output, AnimationError>
pub fn background_render(
    _state: BackgroundAnimationState,
    ctx: BackgroundRenderContext,
    elements: &HashMap<String, HtmlElement>,
) -> Result<RenderOutput, AnimationError> {
    let mut output = RenderOutput::default();

    if let Some(_bg_el) = elements.get("background") {
        let mut styles = HashMap::new();
        styles.insert("--bg-center-x".to_string(), format!("{:.1}%", ctx.center_x));
        styles.insert("--bg-center-y".to_string(), format!("{:.1}%", ctx.center_y));
        styles.insert("--bg-color-1".to_string(), ctx.color1);
        styles.insert("--bg-color-2".to_string(), ctx.color2);

        output.styles.insert("background".to_string(), styles);
    } else {
        return Err(AnimationError::ElementNotFound("background".to_string()));
    }

    Ok(output)
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
fn get_theme_colors() -> (String, String) {
    #[cfg(target_arch = "wasm32")]
    {
        use palette::{墨色, 月白, 粉红, 靛蓝};
        use std::cell::RefCell;

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

    #[cfg(not(target_arch = "wasm32"))]
    {
        // Fallback colors for non-WASM
        use palette::{月白, 粉红};
        (月白.hex(), 粉红.hex())
    }
}

/// Create background animation state machine builder
///
/// This is a convenience function to create a properly configured
/// StateMachineBuilder for background animations.
pub fn create_background_state_machine(
) -> StateMachineBuilder<BackgroundAnimationState, BackgroundEvent, BackgroundRenderContext> {
    StateMachineBuilder::new()
        .initial_state(BackgroundAnimationState::Rotating { angle: 0.0 })
        .transition_fn(background_transition)
        .render_fn(background_render)
}
