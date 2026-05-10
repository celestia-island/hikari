//! Layout utility classes.

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Position {
    Static,
    Relative,
    Absolute,
    Fixed,
    Sticky,
}

impl TypedClass for Position {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Static => "hi-static",
            Self::Relative => "hi-relative",
            Self::Absolute => "hi-absolute",
            Self::Fixed => "hi-fixed",
            Self::Sticky => "hi-sticky",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Overflow {
    Hidden,
    Auto,
    Scroll,
}

impl TypedClass for Overflow {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Hidden => "hi-overflow-hidden",
            Self::Auto => "hi-overflow-auto",
            Self::Scroll => "hi-overflow-scroll",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OverflowX {
    Hidden,
    Auto,
    Scroll,
}

impl TypedClass for OverflowX {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Hidden => "hi-overflow-x-hidden",
            Self::Auto => "hi-overflow-x-auto",
            Self::Scroll => "hi-overflow-x-scroll",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OverflowY {
    Hidden,
    Auto,
    Scroll,
}

impl TypedClass for OverflowY {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Hidden => "hi-overflow-y-hidden",
            Self::Auto => "hi-overflow-y-auto",
            Self::Scroll => "hi-overflow-y-scroll",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ZIndex {
    Z0,
    Z10,
    Z20,
    Z30,
    Z40,
    Z50,
    Auto,
}

impl TypedClass for ZIndex {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Z0 => "hi-z-0",
            Self::Z10 => "hi-z-10",
            Self::Z20 => "hi-z-20",
            Self::Z30 => "hi-z-30",
            Self::Z40 => "hi-z-40",
            Self::Z50 => "hi-z-50",
            Self::Auto => "hi-z-auto",
        }
    }
}
