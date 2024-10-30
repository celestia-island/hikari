use once_cell::sync::Lazy;

use crate::types::{Color, Palette};

pub static COLOR_MAP: Lazy<Palette> = Lazy::new(|| Palette {
    primary: Color::from_rgb_str_hex("#409EFF"),
    secondary: Color::from_rgb_str_hex("#79bbff"),
    success: Color::from_rgb_str_hex("#67C23A"),
    warning: Color::from_rgb_str_hex("#E6A23C"),
    error: Color::from_rgb_str_hex("#F56C6C"),
    info: Color::from_rgb_str_hex("#909399"),
});
