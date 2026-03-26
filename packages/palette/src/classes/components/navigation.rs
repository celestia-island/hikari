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
    TabsTabIcon,
    TabsTabLabel,
}

impl UtilityClass for TabsClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            TabsClass::TabsTab => "tab",
            TabsClass::TabActive => "tab-active",
            TabsClass::TabDisabled => "tab-disabled",
            TabsClass::TabsTabpane => "tab-panel",
            TabsClass::TabpaneActive => "tab-panel-active",
            TabsClass::TabpaneInactive => "tab-panel-inactive",
            TabsClass::TabsTabIcon => "tabs-tab-icon",
            TabsClass::TabsTabLabel => "tabs-tab-label",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MenuClass {
    // Root menu
    Menu,
    Inline,
    Vertical,
    Horizontal,
    Compact,
    PopoverMenu,
    // Menu list
    MenuList,
    // Menu item
    MenuItem,
    MenuItemInner,
    MenuItemWrapper,
    MenuItemIcon,
    MenuItemContent,
    MenuItemLabel,
    MenuItemShortcut,
    MenuItemArrow,
    MenuItemActive,
    MenuItemDisabled,
    MenuItemDanger,
    // Submenu
    Submenu,
    SubmenuTitle,
    SubmenuTitleInner,
    SubmenuList,
    SubmenuListOpen,
    SubmenuArrowOpen,
    // Other elements
    MenuDivider,
    MenuGroup,
    MenuGroupTitle,
    MenuHeader,
    // Size variants
    MenuSm,
    MenuMd,
    MenuLg,
    // Height variants (used internally by MenuItemHeight)
    MenuHeightDefault,
    MenuHeightCompact,
    MenuHeightExtraCompact,
    // Special states
    MenuCollapsed,
    MenuIconOnly,
    // Animations
    MenuAnimateIn,
    MenuFadeIn,
    MenuItemPulse,
    MenuItemRipple,
}

impl UtilityClass for MenuClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            MenuClass::Menu => "menu",
            MenuClass::Inline => "menu-inline",
            MenuClass::Vertical => "menu-vertical",
            MenuClass::Horizontal => "menu-horizontal",
            MenuClass::Compact => "menu-compact",
            MenuClass::PopoverMenu => "menu-popover",
            MenuClass::MenuList => "menu-list",
            MenuClass::MenuItem => "menu-item",
            MenuClass::MenuItemInner => "menu-item-inner",
            MenuClass::MenuItemWrapper => "menu-item-wrapper",
            MenuClass::MenuItemIcon => "menu-item-icon",
            MenuClass::MenuItemContent => "menu-item-content",
            MenuClass::MenuItemLabel => "menu-item-label",
            MenuClass::MenuItemShortcut => "menu-item-shortcut",
            MenuClass::MenuItemArrow => "menu-item-arrow",
            MenuClass::MenuItemActive => "menu-item-active",
            MenuClass::MenuItemDisabled => "menu-item-disabled",
            MenuClass::MenuItemDanger => "menu-item-danger",
            MenuClass::Submenu => "menu-submenu",
            MenuClass::SubmenuTitle => "menu-submenu-title",
            MenuClass::SubmenuTitleInner => "menu-submenu-title-inner",
            MenuClass::SubmenuList => "menu-submenu-list",
            MenuClass::SubmenuListOpen => "menu-submenu-list-open",
            MenuClass::SubmenuArrowOpen => "menu-submenu-arrow-open",
            MenuClass::MenuDivider => "menu-divider",
            MenuClass::MenuGroup => "menu-group",
            MenuClass::MenuGroupTitle => "menu-group-title",
            MenuClass::MenuHeader => "menu-header",
            MenuClass::MenuSm => "menu-sm",
            MenuClass::MenuMd => "menu-md",
            MenuClass::MenuLg => "menu-lg",
            MenuClass::MenuHeightDefault => "menu-height-default",
            MenuClass::MenuHeightCompact => "menu-height-compact",
            MenuClass::MenuHeightExtraCompact => "menu-height-extra-compact",
            MenuClass::MenuCollapsed => "menu-collapsed",
            MenuClass::MenuIconOnly => "menu-icon-only",
            MenuClass::MenuAnimateIn => "menu-animate-in",
            MenuClass::MenuFadeIn => "menu-fade-in",
            MenuClass::MenuItemPulse => "menu-item-pulse",
            MenuClass::MenuItemRipple => "menu-item-ripple",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BreadcrumbClass {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbLinkActive,
    BreadcrumbSeparator,
    BreadcrumbSeparatorGlow,
    BreadcrumbSeparatorSlash,
    BreadcrumbSeparatorArrow,
    BreadcrumbSeparatorDoubleArrow,
    BreadcrumbSeparatorChevron,
    BreadcrumbSeparatorDot,
    BreadcrumbSeparatorAnimated,
    BreadcrumbIcon,
    BreadcrumbCurrent,
    // Dropdown
    BreadcrumbDropdown,
    BreadcrumbDropdownTrigger,
    BreadcrumbDropdownArrow,
    BreadcrumbDropdownOpen,
    BreadcrumbDropdownMenu,
    BreadcrumbDropdownMenuOpen,
    BreadcrumbDropdownItem,
    // Size variants
    BreadcrumbSm,
    BreadcrumbMd,
    BreadcrumbLg,
    // Theme variants
    BreadcrumbBackground,
    BreadcrumbPill,
    // States
    BreadcrumbCollapsible,
    BreadcrumbEllipsis,
    // Color variants
    BreadcrumbPrimary,
    BreadcrumbSuccess,
    BreadcrumbWarning,
    BreadcrumbDanger,
    // Animations
    BreadcrumbAnimateIn,
    BreadcrumbSlideIn,
}

impl UtilityClass for BreadcrumbClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            BreadcrumbClass::Breadcrumb => "breadcrumb",
            BreadcrumbClass::BreadcrumbItem => "breadcrumb-item",
            BreadcrumbClass::BreadcrumbLink => "breadcrumb-link",
            BreadcrumbClass::BreadcrumbLinkActive => "breadcrumb-link-active",
            BreadcrumbClass::BreadcrumbSeparator => "breadcrumb-separator",
            BreadcrumbClass::BreadcrumbSeparatorGlow => "breadcrumb-separator-glow",
            BreadcrumbClass::BreadcrumbSeparatorSlash => "breadcrumb-separator-slash",
            BreadcrumbClass::BreadcrumbSeparatorArrow => "breadcrumb-separator-arrow",
            BreadcrumbClass::BreadcrumbSeparatorDoubleArrow => "breadcrumb-separator-double-arrow",
            BreadcrumbClass::BreadcrumbSeparatorChevron => "breadcrumb-separator-chevron",
            BreadcrumbClass::BreadcrumbSeparatorDot => "breadcrumb-separator-dot",
            BreadcrumbClass::BreadcrumbSeparatorAnimated => "breadcrumb-separator-animated",
            BreadcrumbClass::BreadcrumbIcon => "breadcrumb-icon",
            BreadcrumbClass::BreadcrumbCurrent => "breadcrumb-current",
            BreadcrumbClass::BreadcrumbDropdown => "breadcrumb-dropdown",
            BreadcrumbClass::BreadcrumbDropdownTrigger => "breadcrumb-dropdown-trigger",
            BreadcrumbClass::BreadcrumbDropdownArrow => "breadcrumb-dropdown-arrow",
            BreadcrumbClass::BreadcrumbDropdownOpen => "breadcrumb-dropdown-open",
            BreadcrumbClass::BreadcrumbDropdownMenu => "breadcrumb-dropdown-menu",
            BreadcrumbClass::BreadcrumbDropdownMenuOpen => "breadcrumb-dropdown-menu-open",
            BreadcrumbClass::BreadcrumbDropdownItem => "breadcrumb-dropdown-item",
            BreadcrumbClass::BreadcrumbSm => "breadcrumb-sm",
            BreadcrumbClass::BreadcrumbMd => "breadcrumb-md",
            BreadcrumbClass::BreadcrumbLg => "breadcrumb-lg",
            BreadcrumbClass::BreadcrumbBackground => "breadcrumb-background",
            BreadcrumbClass::BreadcrumbPill => "breadcrumb-pill",
            BreadcrumbClass::BreadcrumbCollapsible => "breadcrumb-collapsible",
            BreadcrumbClass::BreadcrumbEllipsis => "breadcrumb-ellipsis",
            BreadcrumbClass::BreadcrumbPrimary => "breadcrumb-primary",
            BreadcrumbClass::BreadcrumbSuccess => "breadcrumb-success",
            BreadcrumbClass::BreadcrumbWarning => "breadcrumb-warning",
            BreadcrumbClass::BreadcrumbDanger => "breadcrumb-danger",
            BreadcrumbClass::BreadcrumbAnimateIn => "breadcrumb-animate-in",
            BreadcrumbClass::BreadcrumbSlideIn => "breadcrumb-slide-in",
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
