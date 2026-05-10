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
            ArrowClass::Arrow => "hi-arrow",
            ArrowClass::ArrowRight => "hi-arrow-right",
            ArrowClass::ArrowLeft => "hi-arrow-left",
            ArrowClass::ArrowUp => "hi-arrow-up",
            ArrowClass::ArrowDown => "hi-arrow-down",
            ArrowClass::Size14 => "hi-arrow-14",
            ArrowClass::Size16 => "hi-arrow-16",
            ArrowClass::Size20 => "hi-arrow-20",
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
            PortalClass::PortalRoot => "hi-portal-root",
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
            BackgroundClass::Background => "hi-background",
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
