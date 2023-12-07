use hikari_theme::styles::{Color, ColorType};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ColorWrapper(ColorType);

impl From<ColorType> for ColorWrapper {
    fn from(color_type: ColorType) -> Self {
        Self(color_type)
    }
}

impl From<ColorWrapper> for Color {
    fn from(color_wrapper: ColorWrapper) -> Self {
        match color_wrapper.0 {
            ColorType::Primary => Self::from_rgb_str_hex("#409EFF"),
            ColorType::Secondary => Self::from_rgb_str_hex("#79bbff"),
            ColorType::Success => Self::from_rgb_str_hex("#67C23A"),
            ColorType::Warning => Self::from_rgb_str_hex("#E6A23C"),
            ColorType::Error => Self::from_rgb_str_hex("#F56C6C"),
            ColorType::Info => Self::from_rgb_str_hex("#909399"),
        }
    }
}
