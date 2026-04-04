//! Effects utility classes.

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BorderRadius {
    None,
    Sm,
    Rounded,
    Lg,
    Xl,
    Full,
}

impl TypedClass for BorderRadius {
    fn class_name(&self) -> &'static str {
        match self {
            Self::None => "hi-rounded-none",
            Self::Sm => "hi-rounded-sm",
            Self::Rounded => "hi-rounded",
            Self::Lg => "hi-rounded-lg",
            Self::Xl => "hi-rounded-xl",
            Self::Full => "hi-rounded-full",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Shadow {
    Md,
    Lg,
}

impl TypedClass for Shadow {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Md => "hi-shadow-md",
            Self::Lg => "hi-shadow-lg",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Opacity {
    O0,
    O50,
    O100,
}

impl TypedClass for Opacity {
    fn class_name(&self) -> &'static str {
        match self {
            Self::O0 => "hi-opacity-0",
            Self::O50 => "hi-opacity-50",
            Self::O100 => "hi-opacity-100",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Cursor {
    Pointer,
    NotAllowed,
}

impl TypedClass for Cursor {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Pointer => "hi-cursor-pointer",
            Self::NotAllowed => "hi-cursor-not-allowed",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PointerEvents {
    None,
    Auto,
}

impl TypedClass for PointerEvents {
    fn class_name(&self) -> &'static str {
        match self {
            Self::None => "hi-pointer-events-none",
            Self::Auto => "hi-pointer-events-auto",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserSelect {
    None,
    Text,
    All,
}

impl TypedClass for UserSelect {
    fn class_name(&self) -> &'static str {
        match self {
            Self::None => "hi-select-none",
            Self::Text => "hi-select-text",
            Self::All => "hi-select-all",
        }
    }
}
