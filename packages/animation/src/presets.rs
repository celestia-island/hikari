use std::time::Duration;

use crate::core::{
    AnimationEngine, AnimationOptions, EasingFunction, PlaybackMode, PropertyTarget, Tween, TweenId,
};

/// Color configuration for glow animations
#[derive(Debug, Clone)]
pub struct FUIColors {
    /// Primary color (RGB)
    pub primary: (f64, f64, f64),
    /// Accent color (RGB)
    pub accent: (f64, f64, f64),
    /// Glow color (RGB)
    pub glow: (f64, f64, f64),
}

impl Default for FUIColors {
    fn default() -> Self {
        Self {
            primary: (0.0, 0.8, 1.0),
            accent: (0.0, 1.0, 0.8),
            glow: (0.2, 0.6, 1.0),
        }
    }
}

/// Glow effect animations
///
/// Provides glowing, breathing, and shimmer effects suitable for
/// futuristic interfaces and status indicators.
#[derive(Clone)]
pub struct GlowAnimation {
    engine: AnimationEngine,
    colors: FUIColors,
}

impl Default for GlowAnimation {
    fn default() -> Self {
        Self::new()
    }
}

impl GlowAnimation {
    /// Create a new glow animation set with default colors
    #[must_use]
    pub fn new() -> Self {
        Self {
            engine: AnimationEngine::new(),
            colors: FUIColors::default(),
        }
    }

    /// Set custom colors for glow effects
    ///
    /// # Arguments
    /// * `colors` - Color configuration
    #[must_use]
    pub const fn with_colors(mut self, colors: FUIColors) -> Self {
        self.colors = colors;
        self
    }

    /// Create a pulsing glow animation
    ///
    /// Simulates a breathing/pulsing glow effect, ideal for status indicators.
    ///
    /// # Arguments
    /// * `duration_ms` - Duration of one pulse cycle in milliseconds
    /// * `intensity` - Maximum glow intensity (0.0 to 1.0)
    ///
    /// # Returns
    /// ID of the created tween
    #[must_use]
    pub fn pulse(&self, duration_ms: u64, intensity: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInOutSine,
            playback: PlaybackMode::Yoyo,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(TweenId::default(), options);
        tween.add_target(PropertyTarget {
            property: "glow-intensity".to_string(),
            start: 0.0,
            end: intensity,
        });
        tween.add_target(PropertyTarget {
            property: "glow-blur".to_string(),
            start: 5.0,
            end: 20.0,
        });
        tween.play();

        let mut tweens = self.engine.tweens.borrow_mut();
        tweens.insert(tween)
    }

    /// Create a breathing glow animation
    ///
    /// Creates a subtle breathing effect with opacity and glow spread variations.
    ///
    /// # Arguments
    /// * `duration_ms` - Duration of one breath cycle in milliseconds
    ///
    /// # Returns
    /// ID of the created tween
    #[must_use]
    pub fn breathe(&self, duration_ms: u64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInOutQuad,
            playback: PlaybackMode::Yoyo,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(TweenId::default(), options);
        tween.add_target(PropertyTarget {
            property: "opacity".to_string(),
            start: 0.7,
            end: 1.0,
        });
        tween.add_target(PropertyTarget {
            property: "glow-spread".to_string(),
            start: 0.0,
            end: 10.0,
        });
        tween.play();

        let mut tweens = self.engine.tweens.borrow_mut();
        tweens.insert(tween)
    }

    /// Create a shimmering glow animation
    ///
    /// Creates a shimmer effect with angular movement and intensity variation.
    ///
    /// # Arguments
    /// * `duration_ms` - Duration of one shimmer cycle in milliseconds
    /// * `angle_deg` - Maximum rotation angle in degrees
    ///
    /// # Returns
    /// ID of the created tween
    #[must_use]
    pub fn shimmer(&self, duration_ms: u64, angle_deg: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInOutCubic,
            playback: PlaybackMode::Loop,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(TweenId::default(), options);
        tween.add_target(PropertyTarget {
            property: "shimmer-angle".to_string(),
            start: 0.0,
            end: angle_deg,
        });
        tween.add_target(PropertyTarget {
            property: "shimmer-intensity".to_string(),
            start: 0.0,
            end: 1.0,
        });
        tween.play();

        let mut tweens = self.engine.tweens.borrow_mut();
        tweens.insert(tween)
    }
}

/// Neon effect animations
///
/// Provides neon-style glowing, flickering, and scanline effects
/// for retro-futuristic interfaces.
#[derive(Clone)]
pub struct NeonAnimation {
    engine: AnimationEngine,
    colors: FUIColors,
}

impl Default for NeonAnimation {
    fn default() -> Self {
        Self::new()
    }
}

impl NeonAnimation {
    /// Create a new neon animation set with default colors
    #[must_use]
    pub fn new() -> Self {
        Self {
            engine: AnimationEngine::new(),
            colors: FUIColors::default(),
        }
    }

    /// Set custom colors for neon effects
    ///
    /// # Arguments
    /// * `colors` - Color configuration
    #[must_use]
    pub const fn with_colors(mut self, colors: FUIColors) -> Self {
        self.colors = colors;
        self
    }

    /// Create a flickering neon effect
    ///
    /// Simulates a characteristic flicker of neon lights.
    ///
    /// # Arguments
    /// * `duration_ms` - Duration of one flicker cycle in milliseconds
    /// * `intensity` - Flicker intensity (0.0 to 1.0)
    ///
    /// # Returns
    /// ID of the created tween
    #[must_use]
    pub fn flicker(&self, duration_ms: u64, intensity: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInOutQuad,
            playback: PlaybackMode::Yoyo,
            repeat: Some(3),
            ..Default::default()
        };

        let mut tween = Tween::new(TweenId::default(), options);
        tween.add_target(PropertyTarget {
            property: "neon-opacity".to_string(),
            start: 1.0,
            end: 1.0 - intensity,
        });
        tween.add_target(PropertyTarget {
            property: "neon-blur".to_string(),
            start: 2.0,
            end: 4.0,
        });
        tween.play();

        let mut tweens = self.engine.tweens.borrow_mut();
        tweens.insert(tween)
    }

    /// Create a buzzing neon effect
    ///
    /// Simulates a vibration/buzz often seen in neon signs.
    ///
    /// # Arguments
    /// * `duration_ms` - Duration of the buzz in milliseconds
    /// * `amplitude` - Vibration amplitude
    ///
    /// # Returns
    /// ID of the created tween
    #[must_use]
    pub fn buzz(&self, duration_ms: u64, amplitude: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseOutElastic,
            playback: PlaybackMode::Normal,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(TweenId::default(), options);
        tween.add_target(PropertyTarget {
            property: "neon-buzz-x".to_string(),
            start: -amplitude,
            end: amplitude,
        });
        tween.add_target(PropertyTarget {
            property: "neon-buzz-y".to_string(),
            start: -amplitude / 2.0,
            end: amplitude / 2.0,
        });
        tween.play();

        let mut tweens = self.engine.tweens.borrow_mut();
        tweens.insert(tween)
    }

    /// Create a scanline effect
    ///
    /// Creates a moving scanline across the element, common in retro-futuristic interfaces.
    ///
    /// # Arguments
    /// * `duration_ms` - Duration of one scan pass in milliseconds
    ///
    /// # Returns
    /// ID of the created tween
    #[must_use]
    pub fn scanline(&self, duration_ms: u64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::Linear,
            playback: PlaybackMode::Loop,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(TweenId::default(), options);
        tween.add_target(PropertyTarget {
            property: "scanline-position".to_string(),
            start: 0.0,
            end: 100.0,
        });
        tween.play();

        let mut tweens = self.engine.tweens.borrow_mut();
        tweens.insert(tween)
    }
}

/// technology effect animations
///
/// Provides glitch, typing, data flow, and HUD scan effects
/// for technology-themed interfaces.
#[derive(Clone)]
pub struct TechAnimation {
    engine: AnimationEngine,
}

impl Default for TechAnimation {
    fn default() -> Self {
        Self::new()
    }
}

impl TechAnimation {
    /// Create a new tech animation set
    #[must_use]
    pub fn new() -> Self {
        Self {
            engine: AnimationEngine::new(),
        }
    }

    /// Create a digital glitch effect
    ///
    /// Simulates digital signal corruption or interference.
    ///
    /// # Arguments
    /// * `duration_ms` - Duration of one glitch cycle in milliseconds
    /// * `severity` - Severity of the glitch (higher = more distortion)
    ///
    /// # Returns
    /// ID of the created tween
    #[must_use]
    pub fn glitch(&self, duration_ms: u64, severity: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInOutQuad,
            playback: PlaybackMode::Normal,
            repeat: Some(2),
            ..Default::default()
        };

        let mut tween = Tween::new(TweenId::default(), options);
        tween.add_target(PropertyTarget {
            property: "glitch-offset-x".to_string(),
            start: -severity,
            end: severity,
        });
        tween.add_target(PropertyTarget {
            property: "glitch-offset-y".to_string(),
            start: -severity / 2.0,
            end: severity / 2.0,
        });
        tween.add_target(PropertyTarget {
            property: "glitch-slice".to_string(),
            start: 0.0,
            end: severity,
        });
        tween.play();

        let mut tweens = self.engine.tweens.borrow_mut();
        tweens.insert(tween)
    }

    /// Create a typing effect
    ///
    /// Simulates text being typed character by character.
    ///
    /// # Arguments
    /// * `duration_ms` - Total duration to type all characters
    /// * `char_count` - Number of characters to type
    ///
    /// # Returns
    /// ID of the created tween
    #[must_use]
    pub fn typing(&self, duration_ms: u64, char_count: usize) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::Linear,
            playback: PlaybackMode::Normal,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(TweenId::default(), options);
        tween.add_target(PropertyTarget {
            property: "typing-progress".to_string(),
            start: 0.0,
            end: char_count as f64,
        });
        tween.play();

        let mut tweens = self.engine.tweens.borrow_mut();
        tweens.insert(tween)
    }

    /// Create a data flow effect
    ///
    /// Simulates data flowing across an element.
    ///
    /// # Arguments
    /// * `duration_ms` - Duration of one flow cycle in milliseconds
    /// * `direction` - Direction and distance of flow
    ///
    /// # Returns
    /// ID of the created tween
    #[must_use]
    pub fn data_flow(&self, duration_ms: u64, direction: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInOutQuad,
            playback: PlaybackMode::Loop,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(TweenId::default(), options);
        tween.add_target(PropertyTarget {
            property: "data-flow-position".to_string(),
            start: 0.0,
            end: direction,
        });
        tween.add_target(PropertyTarget {
            property: "data-flow-opacity".to_string(),
            start: 1.0,
            end: 0.0,
        });
        tween.play();

        let mut tweens = self.engine.tweens.borrow_mut();
        tweens.insert(tween)
    }

    /// Create a HUD scanning effect
    ///
    /// Simulates a scanning radar or HUD display.
    ///
    /// # Arguments
    /// * `duration_ms` - Duration of one scan cycle in milliseconds
    ///
    /// # Returns
    /// ID of the created tween
    #[must_use]
    pub fn hud_scan(&self, duration_ms: u64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInOutQuad,
            playback: PlaybackMode::Loop,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(TweenId::default(), options);
        tween.add_target(PropertyTarget {
            property: "hud-scan-angle".to_string(),
            start: -45.0,
            end: 45.0,
        });
        tween.add_target(PropertyTarget {
            property: "hud-scan-opacity".to_string(),
            start: 0.0,
            end: 1.0,
        });
        tween.play();

        let mut tweens = self.engine.tweens.borrow_mut();
        tweens.insert(tween)
    }
}

/// Transition effect animations
///
/// Provides fade, slide, scale, blur, and rotation effects
/// for smooth component transitions.
#[derive(Clone)]
pub struct TransitionAnimation {
    engine: AnimationEngine,
}

impl Default for TransitionAnimation {
    fn default() -> Self {
        Self::new()
    }
}

impl TransitionAnimation {
    /// Create a new transition animation set
    #[must_use]
    pub fn new() -> Self {
        Self {
            engine: AnimationEngine::new(),
        }
    }

    /// Create a fade and slide in transition
    ///
    /// Combines opacity fade-in with horizontal slide.
    ///
    /// # Arguments
    /// * `duration_ms` - Duration of transition in milliseconds
    /// * `offset_x` - Starting horizontal offset (pixels or units)
    ///
    /// # Returns
    /// ID of the created tween
    #[must_use]
    pub fn fade_slide_in(&self, duration_ms: u64, offset_x: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseOutCubic,
            playback: PlaybackMode::Normal,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(TweenId::default(), options);
        tween.add_target(PropertyTarget {
            property: "opacity".to_string(),
            start: 0.0,
            end: 1.0,
        });
        tween.add_target(PropertyTarget {
            property: "translate-x".to_string(),
            start: offset_x,
            end: 0.0,
        });
        tween.play();

        let mut tweens = self.engine.tweens.borrow_mut();
        tweens.insert(tween)
    }

    /// Create a fade and slide out transition
    ///
    /// Combines opacity fade-out with horizontal slide.
    ///
    /// # Arguments
    /// * `duration_ms` - Duration of transition in milliseconds
    /// * `offset_x` - Ending horizontal offset (pixels or units)
    ///
    /// # Returns
    /// ID of the created tween
    #[must_use]
    pub fn fade_slide_out(&self, duration_ms: u64, offset_x: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInCubic,
            playback: PlaybackMode::Normal,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(TweenId::default(), options);
        tween.add_target(PropertyTarget {
            property: "opacity".to_string(),
            start: 1.0,
            end: 0.0,
        });
        tween.add_target(PropertyTarget {
            property: "translate-x".to_string(),
            start: 0.0,
            end: offset_x,
        });
        tween.play();

        let mut tweens = self.engine.tweens.borrow_mut();
        tweens.insert(tween)
    }

    /// Create a scale and blur in transition
    ///
    /// Combines scale-up with blur reduction.
    ///
    /// # Arguments
    /// * `duration_ms` - Duration of transition in milliseconds
    ///
    /// # Returns
    /// ID of the created tween
    #[must_use]
    pub fn scale_blur_in(&self, duration_ms: u64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseOutBack,
            playback: PlaybackMode::Normal,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(TweenId::default(), options);
        tween.add_target(PropertyTarget {
            property: "scale".to_string(),
            start: 0.8,
            end: 1.0,
        });
        tween.add_target(PropertyTarget {
            property: "blur".to_string(),
            start: 10.0,
            end: 0.0,
        });
        tween.play();

        let mut tweens = self.engine.tweens.borrow_mut();
        tweens.insert(tween)
    }

    /// Create a scale and blur out transition
    ///
    /// Combines scale-down with blur increase.
    ///
    /// # Arguments
    /// * `duration_ms` - Duration of transition in milliseconds
    ///
    /// # Returns
    /// ID of the created tween
    #[must_use]
    pub fn scale_blur_out(&self, duration_ms: u64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInBack,
            playback: PlaybackMode::Normal,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(TweenId::default(), options);
        tween.add_target(PropertyTarget {
            property: "scale".to_string(),
            start: 1.0,
            end: 0.8,
        });
        tween.add_target(PropertyTarget {
            property: "blur".to_string(),
            start: 0.0,
            end: 10.0,
        });
        tween.play();

        let mut tweens = self.engine.tweens.borrow_mut();
        tweens.insert(tween)
    }

    /// Create a rotate and zoom in transition
    ///
    /// Combines scale-up with rotation fade-out.
    ///
    /// # Arguments
    /// * `duration_ms` - Duration of transition in milliseconds
    /// * `start_angle` - Starting rotation angle in degrees
    ///
    /// # Returns
    /// ID of the created tween
    #[must_use]
    pub fn rotate_zoom_in(&self, duration_ms: u64, start_angle: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseOutCubic,
            playback: PlaybackMode::Normal,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(TweenId::default(), options);
        tween.add_target(PropertyTarget {
            property: "scale".to_string(),
            start: 0.5,
            end: 1.0,
        });
        tween.add_target(PropertyTarget {
            property: "rotate".to_string(),
            start: start_angle,
            end: 0.0,
        });
        tween.add_target(PropertyTarget {
            property: "opacity".to_string(),
            start: 0.0,
            end: 1.0,
        });
        tween.play();

        let mut tweens = self.engine.tweens.borrow_mut();
        tweens.insert(tween)
    }
}

// Simple transition presets (direct AnimationBuilder integration)
pub mod transition;

/// Create a new glow animation set
///
/// # Returns
/// New GlowAnimation instance
#[must_use]
pub fn glow() -> GlowAnimation {
    GlowAnimation::new()
}

/// Create a new neon animation set
///
/// # Returns
/// New NeonAnimation instance
#[must_use]
pub fn neon() -> NeonAnimation {
    NeonAnimation::new()
}

/// Create a new tech animation set
///
/// # Returns
/// New TechAnimation instance
#[must_use]
pub fn tech() -> TechAnimation {
    TechAnimation::new()
}

/// Create a new transition animation set
///
/// # Returns
/// New TransitionAnimation instance
#[must_use]
pub fn transition() -> TransitionAnimation {
    TransitionAnimation::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- FUIColors ---

    #[test]
    fn default_colors() {
        let colors = FUIColors::default();
        assert_eq!(colors.primary, (0.0, 0.8, 1.0));
        assert_eq!(colors.accent, (0.0, 1.0, 0.8));
        assert_eq!(colors.glow, (0.2, 0.6, 1.0));
    }

    #[test]
    fn custom_colors() {
        let colors = FUIColors {
            primary: (1.0, 0.0, 0.0),
            accent: (0.0, 1.0, 0.0),
            glow: (0.0, 0.0, 1.0),
        };
        assert_eq!(colors.primary, (1.0, 0.0, 0.0));
        assert_eq!(colors.accent, (0.0, 1.0, 0.0));
        assert_eq!(colors.glow, (0.0, 0.0, 1.0));
    }

    #[test]
    fn clone_colors() {
        let colors = FUIColors {
            primary: (0.5, 0.5, 0.5),
            ..Default::default()
        };
        let cloned = colors.clone();
        assert_eq!(colors.primary, cloned.primary);
        assert_eq!(colors.accent, cloned.accent);
        assert_eq!(colors.glow, cloned.glow);
    }

    #[test]
    fn fuicolors_debug_contains_rgb() {
        let colors = FUIColors::default();
        let debug = format!("{colors:?}");
        assert!(debug.contains("0.8") || debug.contains("0.6") || debug.contains("0.2"));
    }

    // --- GlowAnimation ---

    #[test]
    fn glow_new_creates_instance() {
        let glow = GlowAnimation::new();
        let id = glow.pulse(1000, 0.5);
        assert!(id != TweenId::default());
    }

    #[test]
    fn glow_default_matches_new() {
        let glow = GlowAnimation::default();
        let id = glow.pulse(500, 0.3);
        assert!(id != TweenId::default());
    }

    #[test]
    fn glow_with_colors() {
        let colors = FUIColors {
            primary: (1.0, 0.0, 0.0),
            ..Default::default()
        };
        let glow = GlowAnimation::new().with_colors(colors);
        let id = glow.pulse(1000, 0.8);
        assert!(id != TweenId::default());
    }

    #[test]
    fn pulse_returns_valid_tween_id() {
        let glow = GlowAnimation::new();
        let id = glow.pulse(1000, 0.5);
        assert!(id != TweenId::default());
    }

    #[test]
    fn pulse_zero_duration() {
        let glow = GlowAnimation::new();
        let id = glow.pulse(0, 0.5);
        assert!(id != TweenId::default());
    }

    #[test]
    fn pulse_zero_intensity() {
        let glow = GlowAnimation::new();
        let id = glow.pulse(1000, 0.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn breathe_returns_valid_tween_id() {
        let glow = GlowAnimation::new();
        let id = glow.breathe(2000);
        assert!(id != TweenId::default());
    }

    #[test]
    fn breathe_zero_duration() {
        let glow = GlowAnimation::new();
        let id = glow.breathe(0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn shimmer_returns_valid_tween_id() {
        let glow = GlowAnimation::new();
        let id = glow.shimmer(1500, 45.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn shimmer_zero_angle() {
        let glow = GlowAnimation::new();
        let id = glow.shimmer(1000, 0.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn clone_glow_animation() {
        let glow = GlowAnimation::new();
        let cloned = glow;
        let id = cloned.pulse(500, 0.5);
        assert!(id != TweenId::default());
    }

    // --- NeonAnimation ---

    #[test]
    fn neon_new_creates_instance() {
        let neon = NeonAnimation::new();
        let id = neon.flicker(500, 0.5);
        assert!(id != TweenId::default());
    }

    #[test]
    fn neon_default_matches_new() {
        let neon = NeonAnimation::default();
        let id = neon.buzz(300, 5.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn neon_with_colors() {
        let colors = FUIColors {
            accent: (1.0, 0.0, 1.0),
            ..Default::default()
        };
        let neon = NeonAnimation::new().with_colors(colors);
        let id = neon.flicker(500, 0.3);
        assert!(id != TweenId::default());
    }

    #[test]
    fn flicker_returns_valid_id() {
        let neon = NeonAnimation::new();
        let id = neon.flicker(500, 0.5);
        assert!(id != TweenId::default());
    }

    #[test]
    fn flicker_zero_duration() {
        let neon = NeonAnimation::new();
        let id = neon.flicker(0, 0.5);
        assert!(id != TweenId::default());
    }

    #[test]
    fn flicker_zero_intensity() {
        let neon = NeonAnimation::new();
        let id = neon.flicker(500, 0.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn buzz_returns_valid_id() {
        let neon = NeonAnimation::new();
        let id = neon.buzz(300, 5.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn buzz_zero_amplitude() {
        let neon = NeonAnimation::new();
        let id = neon.buzz(300, 0.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn scanline_returns_valid_id() {
        let neon = NeonAnimation::new();
        let id = neon.scanline(1000);
        assert!(id != TweenId::default());
    }

    // --- TechAnimation ---

    #[test]
    fn tech_new_creates_instance() {
        let tech = TechAnimation::new();
        let id = tech.glitch(500, 10.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn tech_default_matches_new() {
        let tech = TechAnimation::default();
        let id = tech.data_flow(1000, 200.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn glitch_returns_valid_id() {
        let tech = TechAnimation::new();
        let id = tech.glitch(500, 10.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn glitch_zero_severity() {
        let tech = TechAnimation::new();
        let id = tech.glitch(500, 0.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn typing_returns_valid_id() {
        let tech = TechAnimation::new();
        let id = tech.typing(2000, 50);
        assert!(id != TweenId::default());
    }

    #[test]
    fn typing_zero_chars() {
        let tech = TechAnimation::new();
        let id = tech.typing(1000, 0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn data_flow_returns_valid_id() {
        let tech = TechAnimation::new();
        let id = tech.data_flow(1000, 200.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn hud_scan_returns_valid_id() {
        let tech = TechAnimation::new();
        let id = tech.hud_scan(2000);
        assert!(id != TweenId::default());
    }

    // --- TransitionAnimation ---

    #[test]
    fn transition_new_creates_instance() {
        let trans = TransitionAnimation::new();
        let id = trans.fade_slide_in(300, 20.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn transition_default_matches_new() {
        let trans = TransitionAnimation::default();
        let id = trans.scale_blur_in(500);
        assert!(id != TweenId::default());
    }

    #[test]
    fn fade_slide_in_returns_valid_id() {
        let trans = TransitionAnimation::new();
        let id = trans.fade_slide_in(300, 20.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn fade_slide_in_zero_offset() {
        let trans = TransitionAnimation::new();
        let id = trans.fade_slide_in(300, 0.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn fade_slide_out_returns_valid_id() {
        let trans = TransitionAnimation::new();
        let id = trans.fade_slide_out(300, 20.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn scale_blur_in_returns_valid_id() {
        let trans = TransitionAnimation::new();
        let id = trans.scale_blur_in(500);
        assert!(id != TweenId::default());
    }

    #[test]
    fn scale_blur_out_returns_valid_id() {
        let trans = TransitionAnimation::new();
        let id = trans.scale_blur_out(500);
        assert!(id != TweenId::default());
    }

    #[test]
    fn rotate_zoom_in_returns_valid_id() {
        let trans = TransitionAnimation::new();
        let id = trans.rotate_zoom_in(500, 45.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn rotate_zoom_in_zero_angle() {
        let trans = TransitionAnimation::new();
        let id = trans.rotate_zoom_in(500, 0.0);
        assert!(id != TweenId::default());
    }

    #[test]
    fn rotate_zoom_in_negative_angle() {
        let trans = TransitionAnimation::new();
        let id = trans.rotate_zoom_in(500, -45.0);
        assert!(id != TweenId::default());
    }

    // --- Free functions ---

    #[test]
    fn glow_fn_returns_new() {
        let g = glow();
        let id = g.breathe(1000);
        assert!(id != TweenId::default());
    }

    #[test]
    fn neon_fn_returns_new() {
        let n = neon();
        let id = n.scanline(500);
        assert!(id != TweenId::default());
    }

    #[test]
    fn tech_fn_returns_new() {
        let t = tech();
        let id = t.hud_scan(1000);
        assert!(id != TweenId::default());
    }

    #[test]
    fn transition_fn_returns_new() {
        let t = transition();
        let id = t.fade_slide_out(200, 10.0);
        assert!(id != TweenId::default());
    }

    // --- Clone ---

    #[test]
    fn clone_presets_all() {
        let _ = GlowAnimation::new();
        let _ = NeonAnimation::new();
        let _ = TechAnimation::new();
        let _ = TransitionAnimation::new();
    }
}
