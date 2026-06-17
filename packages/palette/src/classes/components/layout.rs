//! Layout component classes (Layout, Aside, Grid, Row, Container, etc.)

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Layout {
    Layout,
    Light,
    Dark,
    HasSidebar,
    OverlayOpen,
}

impl TypedClass for Layout {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Layout => "hi-layout",
            Self::Light => "hi-layout-light",
            Self::Dark => "hi-layout-dark",
            Self::HasSidebar => "hi-layout-has-sidebar",
            Self::OverlayOpen => "hi-layout-overlay-open",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AsideClass {
    Aside,
    Drawer,
    Sm,
    Md,
    Lg,
    Light,
    Dark,
    Content,
    DrawerOpen,
    Rtl,
}

impl TypedClass for AsideClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Aside => "hi-aside",
            Self::Drawer => "hi-aside-drawer",
            Self::Sm => "hi-aside-sm",
            Self::Md => "hi-aside-md",
            Self::Lg => "hi-aside-lg",
            Self::Light => "hi-aside-light",
            Self::Dark => "hi-aside-dark",
            Self::Content => "hi-aside-content",
            Self::DrawerOpen => "hi-aside-drawer-open",
            Self::Rtl => "hi-aside-rtl",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GridClass {
    Grid,
    GapSm,
    GapMd,
    GapLg,
    Col,
}

impl TypedClass for GridClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Grid => "hi-grid",
            Self::GapSm => "hi-grid-gap-sm",
            Self::GapMd => "hi-grid-gap-md",
            Self::GapLg => "hi-grid-gap-lg",
            Self::Col => "hi-col",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RowClass {
    Row,
    GapSm,
    GapMd,
    GapLg,
}

impl TypedClass for RowClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Row => "hi-row",
            Self::GapSm => "hi-row-gap-sm",
            Self::GapMd => "hi-row-gap-md",
            Self::GapLg => "hi-row-gap-lg",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContainerClass {
    Container,
    Sm,
    Md,
    Lg,
    Xl,
    Xxl,
    Centered,
    Rtl,
}

impl TypedClass for ContainerClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Container => "hi-container",
            Self::Sm => "hi-container-sm",
            Self::Md => "hi-container-md",
            Self::Lg => "hi-container-lg",
            Self::Xl => "hi-container-xl",
            Self::Xxl => "hi-container-xxl",
            Self::Centered => "hi-container-centered",
            Self::Rtl => "hi-container-rtl",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Footer {
    Footer,
}

impl TypedClass for Footer {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Footer => "hi-footer",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppLayoutClass {
    Body,
    Main,
    Content,
    AsideHeader,
    AsideFooter,
}

impl TypedClass for AppLayoutClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Body => "hi-layout-body",
            Self::Main => "hi-layout-main",
            Self::Content => "hi-layout-content",
            Self::AsideHeader => "hi-layout-aside-header",
            Self::AsideFooter => "hi-layout-aside-footer",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SectionClass {
    Section,
    SectionSm,
    SectionMd,
    SectionLg,
    SectionHeader,
    SectionTitle,
    SectionDescription,
    SectionBody,
    Spacer,
}

impl TypedClass for SectionClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Section => "hi-section",
            Self::SectionSm => "hi-section-sm",
            Self::SectionMd => "hi-section-md",
            Self::SectionLg => "hi-section-lg",
            Self::SectionHeader => "hi-section-header",
            Self::SectionTitle => "hi-section-title",
            Self::SectionDescription => "hi-section-description",
            Self::SectionBody => "hi-section-body",
            Self::Spacer => "hi-spacer",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpaceClass {
    Space,
    Horizontal,
    Vertical,
    Wrap,
}

impl TypedClass for SpaceClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Space => "hi-space",
            Self::Horizontal => "hi-space-horizontal",
            Self::Vertical => "hi-space-vertical",
            Self::Wrap => "hi-space-wrap",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DividerClass {
    Divider,
    Horizontal,
    Vertical,
    Solid,
    Dashed,
    Dotted,
    WithText,
    TextCenter,
    TextLeft,
    TextRight,
    Line,
    DividerText,
    Rtl,
}

impl TypedClass for DividerClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Divider => "hi-divider",
            Self::Horizontal => "hi-divider-horizontal",
            Self::Vertical => "hi-divider-vertical",
            Self::Solid => "hi-divider-solid",
            Self::Dashed => "hi-divider-dashed",
            Self::Dotted => "hi-divider-dotted",
            Self::WithText => "hi-divider-with-text",
            Self::TextCenter => "hi-divider-text-center",
            Self::TextLeft => "hi-divider-text-left",
            Self::TextRight => "hi-divider-text-right",
            Self::Line => "hi-divider-line",
            Self::DividerText => "hi-divider-text",
            Self::Rtl => "hi-divider-rtl",
        }
    }
}
