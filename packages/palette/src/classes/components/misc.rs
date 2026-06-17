//! Miscellaneous component classes (Arrow, Portal)

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArrowClass {
    Arrow,
    ArrowRight,
    ArrowLeft,
    ArrowUp,
    ArrowDown,
    Size14,
    Size16,
    Size20,
}

impl TypedClass for ArrowClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Arrow => "hi-arrow",
            Self::ArrowRight => "hi-arrow-right",
            Self::ArrowLeft => "hi-arrow-left",
            Self::ArrowUp => "hi-arrow-up",
            Self::ArrowDown => "hi-arrow-down",
            Self::Size14 => "hi-arrow-14",
            Self::Size16 => "hi-arrow-16",
            Self::Size20 => "hi-arrow-20",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PortalClass {
    PortalRoot,
}

impl TypedClass for PortalClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::PortalRoot => "hi-portal-root",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackgroundClass {
    Background,
}

impl TypedClass for BackgroundClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Background => "hi-background",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThemeProviderClass {
    ThemeProvider,
}

impl TypedClass for ThemeProviderClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::ThemeProvider => "hi-theme-provider",
        }
    }
}
