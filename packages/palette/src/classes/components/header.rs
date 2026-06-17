//! Header component classes

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Header {
    Header,
    Sticky,
    Md,
    Transparent,
    Left,
    Right,
    Toggle,
    Rtl,
}

impl TypedClass for Header {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Header => "hi-header",
            Self::Sticky => "hi-header-sticky",
            Self::Md => "hi-header-md",
            Self::Transparent => "hi-header-transparent",
            Self::Left => "hi-header-left",
            Self::Right => "hi-header-right",
            Self::Toggle => "hi-header-toggle",
            Self::Rtl => "hi-header-rtl",
        }
    }
}
