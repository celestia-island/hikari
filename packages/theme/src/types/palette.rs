use serde::{Deserialize, Serialize};

#[derive(Debug, PartialEq, Eq, Clone, Copy, Default)]
pub enum ColorType {
    #[default]
    Primary,
    Secondary,
    Success,
    Error,
    Info,
    Warning,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy, Default)]
pub enum ColorLevel {
    #[default]
    Full,
    Most,
    Half,
    Less,
}

impl Into<f64> for ColorLevel {
    fn into(self) -> f64 {
        match self {
            ColorLevel::Full => 1.0,
            ColorLevel::Most => 0.8,
            ColorLevel::Half => 0.5,
            ColorLevel::Less => 0.2,
        }
    }
}

#[derive(Debug, PartialEq, Clone, Serialize, Deserialize)]
pub struct Palette {
    pub primary: Color,
    pub secondary: Color,
    pub success: Color,
    pub error: Color,
    pub info: Color,
    pub warning: Color,
}

#[derive(Debug, PartialEq, Clone, Copy)]
pub struct Color {
    pub red: f32,
    pub green: f32,
    pub blue: f32,
}

#[allow(dead_code)]
impl Color {
    pub fn new(red: f32, green: f32, blue: f32) -> Self {
        Self { red, green, blue }
    }

    pub fn from_rgb_str_hex(rgb_str_hex: &str) -> Self {
        let rgb_str_hex = rgb_str_hex.trim_start_matches('#');
        let red = u8::from_str_radix(&rgb_str_hex[0..2], 16).unwrap() as f32 / 256.0;
        let green = u8::from_str_radix(&rgb_str_hex[2..4], 16).unwrap() as f32 / 256.0;
        let blue = u8::from_str_radix(&rgb_str_hex[4..6], 16).unwrap() as f32 / 256.0;
        Self { red, green, blue }
    }

    pub fn to_rgb_str(&self) -> String {
        format!(
            "rgb({:.0},{:.0},{:.0})",
            self.red * 256.,
            self.green * 256.,
            self.blue * 256.
        )
    }

    pub fn to_rgba_str(&self, alpha: ColorLevel) -> String {
        let alpha: f64 = alpha.into();

        format!(
            "rgba({:.0},{:.0},{:.0},{:.1})",
            self.red * 256.,
            self.green * 256.,
            self.blue * 256.,
            alpha
        )
    }

    pub fn to_rgb_str_hex(&self) -> String {
        format!(
            "#{:02x}{:02x}{:02x}",
            (self.red * 256.) as u8,
            (self.green * 256.) as u8,
            (self.blue * 256.) as u8
        )
    }
}

impl Serialize for Color {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_rgb_str())
    }
}

impl<'de> Deserialize<'de> for Color {
    fn deserialize<D>(deserializer: D) -> Result<Color, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Ok(Color::from_rgb_str_hex(&s))
    }
}
