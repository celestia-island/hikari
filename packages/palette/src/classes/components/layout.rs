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
            Layout::Layout => "hi-layout",
            Layout::Light => "hi-layout-light",
            Layout::Dark => "hi-layout-dark",
            Layout::HasSidebar => "hi-layout-has-sidebar",
            Layout::OverlayOpen => "hi-layout-overlay-open",
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
            AsideClass::Aside => "hi-aside",
            AsideClass::Drawer => "hi-aside-drawer",
            AsideClass::Sm => "hi-aside-sm",
            AsideClass::Md => "hi-aside-md",
            AsideClass::Lg => "hi-aside-lg",
            AsideClass::Light => "hi-aside-light",
            AsideClass::Dark => "hi-aside-dark",
            AsideClass::Content => "hi-aside-content",
            AsideClass::DrawerOpen => "hi-aside-drawer-open",
            AsideClass::Rtl => "hi-aside-rtl",
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
            GridClass::Grid => "hi-grid",
            GridClass::GapSm => "hi-grid-gap-sm",
            GridClass::GapMd => "hi-grid-gap-md",
            GridClass::GapLg => "hi-grid-gap-lg",
            GridClass::Col => "hi-col",
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
            RowClass::Row => "hi-row",
            RowClass::GapSm => "hi-row-gap-sm",
            RowClass::GapMd => "hi-row-gap-md",
            RowClass::GapLg => "hi-row-gap-lg",
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
            ContainerClass::Container => "hi-container",
            ContainerClass::Sm => "hi-container-sm",
            ContainerClass::Md => "hi-container-md",
            ContainerClass::Lg => "hi-container-lg",
            ContainerClass::Xl => "hi-container-xl",
            ContainerClass::Xxl => "hi-container-xxl",
            ContainerClass::Centered => "hi-container-centered",
            ContainerClass::Rtl => "hi-container-rtl",
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
            Footer::Footer => "hi-footer",
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
            AppLayoutClass::Body => "hi-layout-body",
            AppLayoutClass::Main => "hi-layout-main",
            AppLayoutClass::Content => "hi-layout-content",
            AppLayoutClass::AsideHeader => "hi-layout-aside-header",
            AppLayoutClass::AsideFooter => "hi-layout-aside-footer",
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
            SectionClass::Section => "hi-section",
            SectionClass::SectionSm => "hi-section-sm",
            SectionClass::SectionMd => "hi-section-md",
            SectionClass::SectionLg => "hi-section-lg",
            SectionClass::SectionHeader => "hi-section-header",
            SectionClass::SectionTitle => "hi-section-title",
            SectionClass::SectionDescription => "hi-section-description",
            SectionClass::SectionBody => "hi-section-body",
            SectionClass::Spacer => "hi-spacer",
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
            SpaceClass::Space => "hi-space",
            SpaceClass::Horizontal => "hi-space-horizontal",
            SpaceClass::Vertical => "hi-space-vertical",
            SpaceClass::Wrap => "hi-space-wrap",
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
            DividerClass::Divider => "hi-divider",
            DividerClass::Horizontal => "hi-divider-horizontal",
            DividerClass::Vertical => "hi-divider-vertical",
            DividerClass::Solid => "hi-divider-solid",
            DividerClass::Dashed => "hi-divider-dashed",
            DividerClass::Dotted => "hi-divider-dotted",
            DividerClass::WithText => "hi-divider-with-text",
            DividerClass::TextCenter => "hi-divider-text-center",
            DividerClass::TextLeft => "hi-divider-text-left",
            DividerClass::TextRight => "hi-divider-text-right",
            DividerClass::Line => "hi-divider-line",
            DividerClass::DividerText => "hi-divider-text",
            DividerClass::Rtl => "hi-divider-rtl",
        }
    }
}
