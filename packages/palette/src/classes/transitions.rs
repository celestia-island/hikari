//! Transition utility classes.

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Transition {
    All,
    Colors,
    Transform,
}

impl TypedClass for Transition {
    fn class_name(&self) -> &'static str {
        match self {
            Self::All => "hi-transition-all",
            Self::Colors => "hi-transition-colors",
            Self::Transform => "hi-transition-transform",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Duration {
    D150,
    D300,
    D500,
}

impl TypedClass for Duration {
    fn class_name(&self) -> &'static str {
        match self {
            Self::D150 => "hi-duration-150",
            Self::D300 => "hi-duration-300",
            Self::D500 => "hi-duration-500",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ease {
    InOut,
}

impl TypedClass for Ease {
    fn class_name(&self) -> &'static str {
        match self {
            Self::InOut => "hi-ease-in-out",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Transform {
    TranslateX0,
    TranslateXFull,
    TranslateY0,
}

impl TypedClass for Transform {
    fn class_name(&self) -> &'static str {
        match self {
            Self::TranslateX0 => "hi-translate-x-0",
            Self::TranslateXFull => "hi-translate-x-full",
            Self::TranslateY0 => "hi-translate-y-0",
        }
    }
}
