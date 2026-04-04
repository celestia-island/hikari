//! Sizing utility classes.

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Width {
    Full,
    Screen,
    Auto,
    W6,
    W8,
    W12,
    W16,
    W24,
    W64,
}

impl TypedClass for Width {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Full => "hi-w-full",
            Self::Screen => "hi-w-screen",
            Self::Auto => "hi-w-auto",
            Self::W6 => "hi-w-6",
            Self::W8 => "hi-w-8",
            Self::W12 => "hi-w-12",
            Self::W16 => "hi-w-16",
            Self::W24 => "hi-w-24",
            Self::W64 => "hi-w-64",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Height {
    Full,
    Screen,
    Auto,
    H6,
    H8,
    H10,
    H12,
}

impl TypedClass for Height {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Full => "hi-h-full",
            Self::Screen => "hi-h-screen",
            Self::Auto => "hi-h-auto",
            Self::H6 => "hi-h-6",
            Self::H8 => "hi-h-8",
            Self::H10 => "hi-h-10",
            Self::H12 => "hi-h-12",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MinWidth {
    MinW0,
}

impl TypedClass for MinWidth {
    fn class_name(&self) -> &'static str {
        match self {
            Self::MinW0 => "hi-min-w-0",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MaxWidth {
    MaxWFull,
    MaxW2xl,
    MaxW3xl,
    MaxW4xl,
    MaxWLogo,
}

impl TypedClass for MaxWidth {
    fn class_name(&self) -> &'static str {
        match self {
            Self::MaxWFull => "hi-max-w-full",
            Self::MaxW2xl => "hi-max-w-2xl",
            Self::MaxW3xl => "hi-max-w-3xl",
            Self::MaxW4xl => "hi-max-w-4xl",
            Self::MaxWLogo => "hi-max-w-logo",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ObjectFit {
    Contain,
    Cover,
    Fill,
    None,
    ScaleDown,
}

impl TypedClass for ObjectFit {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Contain => "hi-object-contain",
            Self::Cover => "hi-object-cover",
            Self::Fill => "hi-object-fill",
            Self::None => "hi-object-none",
            Self::ScaleDown => "hi-object-scale-down",
        }
    }
}
