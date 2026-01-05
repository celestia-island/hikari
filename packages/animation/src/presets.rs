use std::{cell::RefCell, rc::Rc, time::Duration};

use crate::core::{
    {AnimationDirection, AnimationState, EasingFunction, PlaybackMode},
    {AnimationEngine, AnimationOptions, PropertyTarget, Tween, TweenId},
    {CompletionCallback, TweenCallback},
};

/// Color configuration for FUI animations
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

/// FUI glow effect animations
///
/// Provides glowing, breathing, and shimmer effects suitable for
/// futuristic interfaces and status indicators.
#[derive(Clone)]
pub struct GlowAnimation {
    engine: AnimationEngine,
    colors: FUIColors,
}

impl GlowAnimation {
    /// Create a new glow animation set with default colors
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
    pub fn with_colors(mut self, colors: FUIColors) -> Self {
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
    pub fn pulse(&self, duration_ms: u64, intensity: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInOutSine,
            playback: PlaybackMode::Yoyo,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(self.engine.create_tween(options.clone()), options);
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
    pub fn breathe(&self, duration_ms: u64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInOutQuad,
            playback: PlaybackMode::Yoyo,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(self.engine.create_tween(options.clone()), options);
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
    pub fn shimmer(&self, duration_ms: u64, angle_deg: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInOutCubic,
            playback: PlaybackMode::Loop,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(self.engine.create_tween(options.clone()), options);
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

/// FUI neon effect animations
///
/// Provides neon-style glowing, flickering, and scanline effects
/// for retro-futuristic interfaces.
#[derive(Clone)]
pub struct NeonAnimation {
    engine: AnimationEngine,
    colors: FUIColors,
}

impl NeonAnimation {
    /// Create a new neon animation set with default colors
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
    pub fn with_colors(mut self, colors: FUIColors) -> Self {
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
    pub fn flicker(&self, duration_ms: u64, intensity: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInOutQuad,
            playback: PlaybackMode::Yoyo,
            repeat: Some(3),
            yoyo: true,
            ..Default::default()
        };

        let mut tween = Tween::new(self.engine.create_tween(options.clone()), options);
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
    pub fn buzz(&self, duration_ms: u64, amplitude: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseOutElastic,
            playback: PlaybackMode::Normal,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(self.engine.create_tween(options.clone()), options);
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
    pub fn scanline(&self, duration_ms: u64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::Linear,
            playback: PlaybackMode::Loop,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(self.engine.create_tween(options.clone()), options);
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

/// FUI technology effect animations
///
/// Provides glitch, typing, data flow, and HUD scan effects
/// for technology-themed interfaces.
#[derive(Clone)]
pub struct TechAnimation {
    engine: AnimationEngine,
}

impl TechAnimation {
    /// Create a new tech animation set
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
    pub fn glitch(&self, duration_ms: u64, severity: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInOutQuad,
            playback: PlaybackMode::Normal,
            repeat: Some(2),
            yoyo: true,
            ..Default::default()
        };

        let mut tween = Tween::new(self.engine.create_tween(options.clone()), options);
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
    pub fn typing(&self, duration_ms: u64, char_count: usize) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::Linear,
            playback: PlaybackMode::Normal,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(self.engine.create_tween(options.clone()), options);
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
    pub fn data_flow(&self, duration_ms: u64, direction: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInOutQuad,
            playback: PlaybackMode::Loop,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(self.engine.create_tween(options.clone()), options);
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
    pub fn hud_scan(&self, duration_ms: u64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInOutQuad,
            playback: PlaybackMode::Loop,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(self.engine.create_tween(options.clone()), options);
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

impl TransitionAnimation {
    /// Create a new transition animation set
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
    pub fn fade_slide_in(&self, duration_ms: u64, offset_x: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseOutCubic,
            playback: PlaybackMode::Normal,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(self.engine.create_tween(options.clone()), options);
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
    pub fn fade_slide_out(&self, duration_ms: u64, offset_x: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInCubic,
            playback: PlaybackMode::Normal,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(self.engine.create_tween(options.clone()), options);
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
    pub fn scale_blur_in(&self, duration_ms: u64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseOutBack,
            playback: PlaybackMode::Normal,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(self.engine.create_tween(options.clone()), options);
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
    pub fn scale_blur_out(&self, duration_ms: u64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseInBack,
            playback: PlaybackMode::Normal,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(self.engine.create_tween(options.clone()), options);
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
    pub fn rotate_zoom_in(&self, duration_ms: u64, start_angle: f64) -> TweenId {
        let options = AnimationOptions {
            duration: Duration::from_millis(duration_ms),
            easing: EasingFunction::EaseOutCubic,
            playback: PlaybackMode::Normal,
            repeat: None,
            ..Default::default()
        };

        let mut tween = Tween::new(self.engine.create_tween(options.clone()), options);
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

/// Create a new glow animation set
///
/// # Returns
/// New GlowAnimation instance
pub fn glow() -> GlowAnimation {
    GlowAnimation::new()
}

/// Create a new neon animation set
///
/// # Returns
/// New NeonAnimation instance
pub fn neon() -> NeonAnimation {
    NeonAnimation::new()
}

/// Create a new tech animation set
///
/// # Returns
/// New TechAnimation instance
pub fn tech() -> TechAnimation {
    TechAnimation::new()
}

/// Create a new transition animation set
///
/// # Returns
/// New TransitionAnimation instance
pub fn transition() -> TransitionAnimation {
    TransitionAnimation::new()
}
