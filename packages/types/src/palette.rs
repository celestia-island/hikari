use serde::{Deserialize, Serialize};

#[derive(Debug, PartialEq, Eq, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ColorType {
    #[default]
    Primary,
    Secondary,
    Success,
    Error,
    Info,
    Warning,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ColorMode {
    #[default]
    Light,
    Dark,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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
    pub alpha: Option<f32>,
}

#[allow(dead_code)]
impl Color {
    pub fn new(red: f32, green: f32, blue: f32, alpha: Option<f32>) -> Self {
        Self {
            red,
            green,
            blue,
            alpha,
        }
    }

    pub fn from_rgb_str(str: &str) -> Self {
        if str.starts_with("rgba") {
            let str = str.trim_start_matches("rgba(").trim_end_matches(')');
            let mut split = str.split(',');
            let red = split.next().unwrap().parse::<f32>().unwrap() / 256.;
            let green = split.next().unwrap().parse::<f32>().unwrap() / 256.;
            let blue = split.next().unwrap().parse::<f32>().unwrap() / 256.;
            let alpha = split.next().unwrap().parse::<f32>().unwrap();
            Self {
                red,
                green,
                blue,
                alpha: Some(alpha),
            }
        } else if str.starts_with("#") {
            let str = str.trim_start_matches('#');
            let red = u8::from_str_radix(&str[0..2], 16).unwrap() as f32 / 256.;
            let green = u8::from_str_radix(&str[2..4], 16).unwrap() as f32 / 256.;
            let blue = u8::from_str_radix(&str[4..6], 16).unwrap() as f32 / 256.;
            Self {
                red,
                green,
                blue,
                alpha: None,
            }
        } else {
            let str = str.trim_start_matches("rgb(").trim_end_matches(')');
            let mut split = str.split(',');
            let red = split.next().unwrap().parse::<f32>().unwrap() / 256.;
            let green = split.next().unwrap().parse::<f32>().unwrap() / 256.;
            let blue = split.next().unwrap().parse::<f32>().unwrap() / 256.;
            Self {
                red,
                green,
                blue,
                alpha: None,
            }
        }
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
        Ok(Color::from_rgb_str(&s))
    }
}
