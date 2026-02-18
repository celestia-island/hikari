//! Layout component classes (Layout, Aside, Grid, Row, Container, etc.)

use serde::{Deserialize, Serialize};

use crate::classes::UtilityClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Layout {
    Layout,
    Light,
    Dark,
    HasSidebar,
    OverlayOpen,
}

impl UtilityClass for Layout {
    fn as_suffix(&self) -> &'static str {
        match self {
            Layout::Layout => "layout",
            Layout::Light => "layout-light",
            Layout::Dark => "layout-dark",
            Layout::HasSidebar => "layout-has-sidebar",
            Layout::OverlayOpen => "layout-overlay-open",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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
}

impl UtilityClass for AsideClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            AsideClass::Aside => "aside",
            AsideClass::Drawer => "aside-drawer",
            AsideClass::Sm => "aside-sm",
            AsideClass::Md => "aside-md",
            AsideClass::Lg => "aside-lg",
            AsideClass::Light => "aside-light",
            AsideClass::Dark => "aside-dark",
            AsideClass::Content => "aside-content",
            AsideClass::DrawerOpen => "aside-drawer-open",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GridClass {
    Grid,
    GapSm,
    GapMd,
    GapLg,
    Col,
}

impl UtilityClass for GridClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            GridClass::Grid => "grid",
            GridClass::GapSm => "grid-gap-sm",
            GridClass::GapMd => "grid-gap-md",
            GridClass::GapLg => "grid-gap-lg",
            GridClass::Col => "col",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RowClass {
    Row,
    GapSm,
    GapMd,
    GapLg,
}

impl UtilityClass for RowClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            RowClass::Row => "row",
            RowClass::GapSm => "row-gap-sm",
            RowClass::GapMd => "row-gap-md",
            RowClass::GapLg => "row-gap-lg",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ContainerClass {
    Container,
    Sm,
    Md,
    Lg,
    Xl,
    Xxl,
    Centered,
}

impl UtilityClass for ContainerClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            ContainerClass::Container => "container",
            ContainerClass::Sm => "container-sm",
            ContainerClass::Md => "container-md",
            ContainerClass::Lg => "container-lg",
            ContainerClass::Xl => "container-xl",
            ContainerClass::Xxl => "container-xxl",
            ContainerClass::Centered => "container-centered",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Footer {
    Footer,
}

impl UtilityClass for Footer {
    fn as_suffix(&self) -> &'static str {
        match self {
            Footer::Footer => "footer",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AppLayoutClass {
    Body,
    Main,
    Content,
}

impl UtilityClass for AppLayoutClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            AppLayoutClass::Body => "layout-body",
            AppLayoutClass::Main => "layout-main",
            AppLayoutClass::Content => "layout-content",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for SectionClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SectionClass::Section => "section",
            SectionClass::SectionSm => "section-sm",
            SectionClass::SectionMd => "section-md",
            SectionClass::SectionLg => "section-lg",
            SectionClass::SectionHeader => "section-header",
            SectionClass::SectionTitle => "section-title",
            SectionClass::SectionDescription => "section-description",
            SectionClass::SectionBody => "section-body",
            SectionClass::Spacer => "spacer",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SpaceClass {
    Space,
    Horizontal,
    Vertical,
    Wrap,
}

impl UtilityClass for SpaceClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SpaceClass::Space => "space",
            SpaceClass::Horizontal => "space-horizontal",
            SpaceClass::Vertical => "space-vertical",
            SpaceClass::Wrap => "space-wrap",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DividerClass {
    Divider,
    Horizontal,
    Vertical,
    Solid,
    Dashed,
    Dotted,
    WithText,
}

impl UtilityClass for DividerClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            DividerClass::Divider => "divider",
            DividerClass::Horizontal => "divider-horizontal",
            DividerClass::Vertical => "divider-vertical",
            DividerClass::Solid => "divider-solid",
            DividerClass::Dashed => "divider-dashed",
            DividerClass::Dotted => "divider-dotted",
            DividerClass::WithText => "divider-with-text",
        }
    }
}
