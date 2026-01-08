//! Component-specific Hikari classes
//!
//! This module contains enums for all component-specific classes
//! that start with `hi-`. Each component in hikari-components
//! should expose its classes here.

use serde::{Deserialize, Serialize};

use super::UtilityClass;

/// Header component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Header {
    /// `hi-header` - Main header class
    Header,
    /// `hi-header-sticky` - Sticky positioning
    Sticky,
    /// `hi-header-md` - Medium size
    Md,
    /// `hi-header-transparent` - Transparent background
    Transparent,
    /// `hi-header-left` - Left section
    Left,
    /// `hi-header-right` - Right section
    Right,
    /// `hi-header-toggle` - Menu toggle button
    Toggle,
}

impl UtilityClass for Header {
    fn as_suffix(&self) -> &'static str {
        match self {
            Header::Header => "header",
            Header::Sticky => "header-sticky",
            Header::Md => "header-md",
            Header::Transparent => "header-transparent",
            Header::Left => "header-left",
            Header::Right => "header-right",
            Header::Toggle => "header-toggle",
        }
    }
}

/// Layout component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Layout {
    /// `hi-layout` - Main layout class
    Layout,
    /// `hi-layout-light` - Light theme
    Light,
    /// `hi-layout-dark` - Dark theme
    Dark,
}

impl UtilityClass for Layout {
    fn as_suffix(&self) -> &'static str {
        match self {
            Layout::Layout => "layout",
            Layout::Light => "layout-light",
            Layout::Dark => "layout-dark",
        }
    }
}

/// Aside component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AsideClass {
    /// `hi-aside` - Main aside class
    Aside,
    /// `hi-aside-drawer` - Drawer mode
    Drawer,
    /// `hi-aside-sm` - Small width (200px)
    Sm,
    /// `hi-aside-md` - Medium width (250px)
    Md,
    /// `hi-aside-lg` - Large width (300px)
    Lg,
    /// `hi-aside-light` - Light variant
    Light,
    /// `hi-aside-dark` - Dark variant
    Dark,
    /// `hi-aside-content` - Content container
    Content,
    /// `hi-aside-drawer-open` - Open state on mobile
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

/// Button component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Button {
    /// `hi-button` - Main button class
    Button,
}

impl UtilityClass for Button {
    fn as_suffix(&self) -> &'static str {
        match self {
            Button::Button => "button",
        }
    }
}

/// Input component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Input {
    /// `hi-input` - Main input class
    Input,
    /// `hi-input-wrapper` - Input wrapper
    Wrapper,
}

impl UtilityClass for Input {
    fn as_suffix(&self) -> &'static str {
        match self {
            Input::Input => "input",
            Input::Wrapper => "input-wrapper",
        }
    }
}

/// Grid component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GridClass {
    /// `hi-grid` - Main grid class
    Grid,
    /// `hi-grid-gap-sm` - Small gap
    GapSm,
    /// `hi-grid-gap-md` - Medium gap (default)
    GapMd,
    /// `hi-grid-gap-lg` - Large gap
    GapLg,
    /// `hi-col` - Grid column
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

/// Row component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RowClass {
    /// `hi-row` - Main row class
    Row,
    /// `hi-row-gap-sm` - Small gap
    GapSm,
    /// `hi-row-gap-md` - Medium gap (default)
    GapMd,
    /// `hi-row-gap-lg` - Large gap
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

/// Container component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ContainerClass {
    /// `hi-container` - Main container class
    Container,
    /// `hi-container-sm` - Small max-width (640px)
    Sm,
    /// `hi-container-lg` - Large max-width (1024px, default)
    Lg,
    /// `hi-container-xl` - Extra large max-width (1280px)
    Xl,
    /// `hi-container-xxl` - Extra extra large max-width (1536px)
    Xxl,
}

impl UtilityClass for ContainerClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            ContainerClass::Container => "container",
            ContainerClass::Sm => "container-sm",
            ContainerClass::Lg => "container-lg",
            ContainerClass::Xl => "container-xl",
            ContainerClass::Xxl => "container-xxl",
        }
    }
}
