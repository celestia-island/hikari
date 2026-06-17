use tairitsu_vdom::IntoAttrValue;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
#[non_exhaustive]
pub enum GlowBlur {
    None,
    Light,
    #[default]
    Medium,
    Heavy,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
#[non_exhaustive]
pub enum GlowColor {
    #[default]
    Ghost,
    Primary,
    Secondary,
    Danger,
    Success,
    Warning,
    Info,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
#[non_exhaustive]
pub enum GlowIntensity {
    Dim,
    #[default]
    Soft,
    Bright,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
#[non_exhaustive]
pub enum GlowPreset {
    #[default]
    None,
    Pulse,
    Breathe,
    Shimmer,
}

impl std::fmt::Display for GlowBlur {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GlowBlur::None => write!(f, "none"),
            GlowBlur::Light => write!(f, "light"),
            GlowBlur::Medium => write!(f, "medium"),
            GlowBlur::Heavy => write!(f, "heavy"),
        }
    }
}

impl std::fmt::Display for GlowColor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GlowColor::Ghost => write!(f, "ghost"),
            GlowColor::Primary => write!(f, "primary"),
            GlowColor::Secondary => write!(f, "secondary"),
            GlowColor::Danger => write!(f, "danger"),
            GlowColor::Success => write!(f, "success"),
            GlowColor::Warning => write!(f, "warning"),
            GlowColor::Info => write!(f, "info"),
        }
    }
}

impl std::fmt::Display for GlowIntensity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GlowIntensity::Dim => write!(f, "dim"),
            GlowIntensity::Soft => write!(f, "soft"),
            GlowIntensity::Bright => write!(f, "bright"),
        }
    }
}

impl std::fmt::Display for GlowPreset {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GlowPreset::None => write!(f, ""),
            GlowPreset::Pulse => write!(f, "pulse"),
            GlowPreset::Breathe => write!(f, "breathe"),
            GlowPreset::Shimmer => write!(f, "shimmer"),
        }
    }
}

impl IntoAttrValue for GlowBlur {
    fn into_attr_value(self) -> Option<String> {
        Some(self.to_string())
    }
}

impl IntoAttrValue for GlowColor {
    fn into_attr_value(self) -> Option<String> {
        Some(self.to_string())
    }
}

impl IntoAttrValue for GlowIntensity {
    fn into_attr_value(self) -> Option<String> {
        Some(self.to_string())
    }
}

impl IntoAttrValue for GlowPreset {
    fn into_attr_value(self) -> Option<String> {
        if self == GlowPreset::None {
            None
        } else {
            Some(self.to_string())
        }
    }
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct GlowConfig {
    pub glow: bool,
    pub blur: GlowBlur,
    pub color: GlowColor,
    pub intensity: GlowIntensity,
}

pub(crate) fn get_opacity_for_intensity(intensity: GlowIntensity) -> f32 {
    match intensity {
        GlowIntensity::Dim => 0.07,
        GlowIntensity::Soft => 0.15,
        GlowIntensity::Bright => 0.30,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_glow_config_default() {
        let config = GlowConfig::default();
        assert!(!config.glow);
        assert_eq!(config.blur, GlowBlur::Medium);
        assert_eq!(config.color, GlowColor::Ghost);
        assert_eq!(config.intensity, GlowIntensity::Soft);
    }

    #[test]
    fn test_glow_color_variants() {
        assert_eq!(GlowColor::Ghost.to_string(), "ghost");
        assert_eq!(GlowColor::Primary.to_string(), "primary");
        assert_eq!(GlowColor::Secondary.to_string(), "secondary");
        assert_eq!(GlowColor::Danger.to_string(), "danger");
        assert_eq!(GlowColor::Success.to_string(), "success");
        assert_eq!(GlowColor::Warning.to_string(), "warning");
        assert_eq!(GlowColor::Info.to_string(), "info");
    }

    #[test]
    fn test_glow_intensity_display() {
        assert_eq!(GlowIntensity::Dim.to_string(), "dim");
        assert_eq!(GlowIntensity::Soft.to_string(), "soft");
        assert_eq!(GlowIntensity::Bright.to_string(), "bright");
    }

    #[test]
    fn test_glow_intensity_default_is_soft() {
        assert_eq!(GlowIntensity::default(), GlowIntensity::Soft);
    }

    #[test]
    fn test_glow_intensity_opacity() {
        assert!((get_opacity_for_intensity(GlowIntensity::Dim) - 0.07).abs() < f32::EPSILON);
        assert!((get_opacity_for_intensity(GlowIntensity::Soft) - 0.15).abs() < f32::EPSILON);
        assert!((get_opacity_for_intensity(GlowIntensity::Bright) - 0.30).abs() < f32::EPSILON);
    }

    #[test]
    fn test_glow_blur_display() {
        assert_eq!(GlowBlur::None.to_string(), "none");
        assert_eq!(GlowBlur::Light.to_string(), "light");
        assert_eq!(GlowBlur::Medium.to_string(), "medium");
        assert_eq!(GlowBlur::Heavy.to_string(), "heavy");
    }

    #[test]
    fn test_glow_blur_default() {
        assert_eq!(GlowBlur::default(), GlowBlur::Medium);
    }

    #[test]
    fn test_glow_preset_display() {
        assert_eq!(GlowPreset::None.to_string(), "");
        assert_eq!(GlowPreset::Pulse.to_string(), "pulse");
        assert_eq!(GlowPreset::Breathe.to_string(), "breathe");
        assert_eq!(GlowPreset::Shimmer.to_string(), "shimmer");
    }

    #[test]
    fn test_glow_preset_into_attr_value() {
        assert!(GlowPreset::None.into_attr_value().is_none());
        assert_eq!(
            GlowPreset::Pulse.into_attr_value(),
            Some("pulse".to_string())
        );
    }
}
