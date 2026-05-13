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
            Header::Header => "hi-header",
            Header::Sticky => "hi-header-sticky",
            Header::Md => "hi-header-md",
            Header::Transparent => "hi-header-transparent",
            Header::Left => "hi-header-left",
            Header::Right => "hi-header-right",
            Header::Toggle => "hi-header-toggle",
            Header::Rtl => "hi-header-rtl",
        }
    }
}
