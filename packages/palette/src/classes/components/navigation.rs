//! Navigation component classes (Menu, Tabs, Sidebar, etc.)

use serde::{Deserialize, Serialize};

use crate::classes::UtilityClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TabsClass {
    TabsTab,
    TabActive,
    TabDisabled,
    TabsTabpane,
    TabpaneActive,
    TabpaneInactive,
}

impl UtilityClass for TabsClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            TabsClass::TabsTab => "tabs-tab",
            TabsClass::TabActive => "tabs-tab-active",
            TabsClass::TabDisabled => "tabs-tab-disabled",
            TabsClass::TabsTabpane => "tabs-tabpane",
            TabsClass::TabpaneActive => "tabs-tabpane-active",
            TabsClass::TabpaneInactive => "tabs-tabpane-inactive",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MenuClass {
    Menu,
    Inline,
    Submenu,
    SubmenuArrowOpen,
    SubmenuListOpen,
    Vertical,
    Horizontal,
    Compact,
    MenuItem,
    SubmenuList,
    PopoverMenu,
}

impl UtilityClass for MenuClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            MenuClass::Menu => "menu",
            MenuClass::Inline => "menu-inline",
            MenuClass::Submenu => "menu-submenu",
            MenuClass::SubmenuArrowOpen => "menu-submenu-arrow-open",
            MenuClass::SubmenuListOpen => "menu-submenu-list-open",
            MenuClass::Vertical => "menu-vertical",
            MenuClass::Horizontal => "menu-horizontal",
            MenuClass::Compact => "menu-compact",
            MenuClass::MenuItem => "menu-item",
            MenuClass::SubmenuList => "menu-submenu-list",
            MenuClass::PopoverMenu => "menu-popover",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BreadcrumbClass {
    Breadcrumb,
    BreadcrumbItem,
}

impl UtilityClass for BreadcrumbClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            BreadcrumbClass::Breadcrumb => "breadcrumb",
            BreadcrumbClass::BreadcrumbItem => "breadcrumb-item",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SidebarClass {
    Sidebar,
    Section,
    SectionHeader,
    SectionTitleGroup,
    SectionTitlePrimary,
    SectionTitleSecondary,
    SectionArrow,
    SectionArrowRotated,
    SectionChildren,
    Item,
    ItemHeader,
    ItemContent,
    ItemArrow,
    ItemArrowRotated,
    ItemChildren,
    ItemSecondary,
    Leaf,
    LeafContent,
}

impl UtilityClass for SidebarClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SidebarClass::Sidebar => "sidebar",
            SidebarClass::Section => "sidebar-section",
            SidebarClass::SectionHeader => "sidebar-section-header",
            SidebarClass::SectionTitleGroup => "sidebar-section-title-group",
            SidebarClass::SectionTitlePrimary => "sidebar-section-title-primary",
            SidebarClass::SectionTitleSecondary => "sidebar-section-title-secondary",
            SidebarClass::SectionArrow => "sidebar-section-arrow",
            SidebarClass::SectionArrowRotated => "sidebar-section-arrow-rotated",
            SidebarClass::SectionChildren => "sidebar-section-children",
            SidebarClass::Item => "sidebar-item",
            SidebarClass::ItemHeader => "sidebar-item-header",
            SidebarClass::ItemContent => "sidebar-item-content",
            SidebarClass::ItemArrow => "sidebar-item-arrow",
            SidebarClass::ItemArrowRotated => "sidebar-item-arrow-rotated",
            SidebarClass::ItemChildren => "sidebar-item-children",
            SidebarClass::ItemSecondary => "sidebar-item-secondary",
            SidebarClass::Leaf => "sidebar-leaf",
            SidebarClass::LeafContent => "sidebar-leaf-content",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StepperClass {
    Stepper,
    Horizontal,
    Vertical,
    Step,
    StepPending,
    StepActive,
    StepFinished,
    StepNumber,
    StepConnector,
    StepConnectorVertical,
}

impl UtilityClass for StepperClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            StepperClass::Stepper => "stepper",
            StepperClass::Horizontal => "stepper-horizontal",
            StepperClass::Vertical => "stepper-vertical",
            StepperClass::Step => "step",
            StepperClass::StepPending => "step-pending",
            StepperClass::StepActive => "step-active",
            StepperClass::StepFinished => "step-finished",
            StepperClass::StepNumber => "step-number",
            StepperClass::StepConnector => "step-connector",
            StepperClass::StepConnectorVertical => "step-connector-vertical",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnchorClass {
    Wrapper,
    Link,
    Active,
    Left,
    Right,
}

impl UtilityClass for AnchorClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            AnchorClass::Wrapper => "anchor-wrapper",
            AnchorClass::Link => "anchor-link",
            AnchorClass::Active => "anchor-active",
            AnchorClass::Left => "anchor-left",
            AnchorClass::Right => "anchor-right",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StepsClass {
    Wrapper,
    Horizontal,
    Vertical,
    Item,
    Wait,
    Process,
    Finish,
    Error,
    Icon,
    Number,
    Content,
    Title,
    Description,
}

impl UtilityClass for StepsClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            StepsClass::Wrapper => "steps-wrapper",
            StepsClass::Horizontal => "steps-horizontal",
            StepsClass::Vertical => "steps-vertical",
            StepsClass::Item => "step-item",
            StepsClass::Wait => "step-wait",
            StepsClass::Process => "step-process",
            StepsClass::Finish => "step-finish",
            StepsClass::Error => "step-error",
            StepsClass::Icon => "step-icon",
            StepsClass::Number => "step-number",
            StepsClass::Content => "step-content",
            StepsClass::Title => "step-title",
            StepsClass::Description => "step-description",
        }
    }
}
