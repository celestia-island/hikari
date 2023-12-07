pub mod designs;

use hikari_theme::prelude::*;

#[derive(Debug, Clone, PartialEq, Default)]
pub struct ElementUITheme;

impl Theme for ElementUITheme {
    fn get_color(&self, t: ColorType) -> Color {
        let wrapper = designs::colors::ColorWrapper::from(t);
        wrapper.into()
    }
}
