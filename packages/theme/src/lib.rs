pub mod global_states;
pub mod styles;

pub trait Theme: Clone + PartialEq + Default + 'static {
    fn get_color(&self, t: crate::styles::ColorType) -> crate::styles::Color;
}

pub mod prelude {
    pub use crate::styles::*;
    pub use crate::Theme;
}
