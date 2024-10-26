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
            "rgb({:.3},{:.3},{:.3})",
            self.red * 256.0,
            self.green * 256.0,
            self.blue * 256.0
        )
    }

    pub fn to_rgba_str(&self, alpha: f32) -> String {
        format!(
            "rgba({:.3},{:.3},{:.3},{:.3})",
            self.red * 256.0,
            self.green * 256.0,
            self.blue * 256.0,
            alpha
        )
    }

    pub fn to_rgb_str_hex(&self) -> String {
        format!(
            "#{:02x}{:02x}{:02x}",
            (self.red * 256.0) as u8,
            (self.green * 256.0) as u8,
            (self.blue * 256.0) as u8
        )
    }
}
