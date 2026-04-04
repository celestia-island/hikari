//! Navigation component classes (Menu, Tabs, Sidebar, etc.)

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TabsClass {
    TabsTab,
    TabActive,
    TabDisabled,
    TabsTabpane,
    TabpaneActive,
    TabpaneInactive,
    TabsTabIcon,
    TabsTabLabel,
    Tabs,
    Card,
    Segment,
    Top,
    Right,
    Bottom,
    Left,
    Animated,
    Nav,
    NavList,
    InkBar,
    Content,
}

impl TypedClass for TabsClass {
    fn class_name(&self) -> &'static str {
        match self {
            TabsClass::TabsTab => "hi-tab",
            TabsClass::TabActive => "hi-tab-active",
            TabsClass::TabDisabled => "hi-tab-disabled",
            TabsClass::TabsTabpane => "hi-tab-panel",
            TabsClass::TabpaneActive => "hi-tab-panel-active",
            TabsClass::TabpaneInactive => "hi-tab-panel-inactive",
            TabsClass::TabsTabIcon => "hi-tabs-tab-icon",
            TabsClass::TabsTabLabel => "hi-tabs-tab-label",
            TabsClass::Tabs => "hi-tabs",
            TabsClass::Card => "hi-tabs-card",
            TabsClass::Segment => "hi-tabs-segment",
            TabsClass::Top => "hi-tabs-top",
            TabsClass::Right => "hi-tabs-right",
            TabsClass::Bottom => "hi-tabs-bottom",
            TabsClass::Left => "hi-tabs-left",
            TabsClass::Animated => "hi-tabs-animated",
            TabsClass::Nav => "hi-tabs-nav",
            TabsClass::NavList => "hi-tabs-nav-list",
            TabsClass::InkBar => "hi-tabs-ink-bar",
            TabsClass::Content => "hi-tabs-content",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

impl TypedClass for MenuClass {
    fn class_name(&self) -> &'static str {
        match self {
            MenuClass::Menu => "hi-menu",
            MenuClass::Inline => "hi-menu-inline",
            MenuClass::Vertical => "hi-menu-vertical",
            MenuClass::Horizontal => "hi-menu-horizontal",
            MenuClass::Compact => "hi-menu-compact",
            MenuClass::PopoverMenu => "hi-menu-popover",
            MenuClass::MenuList => "hi-menu-list",
            MenuClass::MenuItem => "hi-menu-item",
            MenuClass::MenuItemInner => "hi-menu-item-inner",
            MenuClass::MenuItemWrapper => "hi-menu-item-wrapper",
            MenuClass::MenuItemIcon => "hi-menu-item-icon",
            MenuClass::MenuItemContent => "hi-menu-item-content",
            MenuClass::MenuItemLabel => "hi-menu-item-label",
            MenuClass::MenuItemShortcut => "hi-menu-item-shortcut",
            MenuClass::MenuItemArrow => "hi-menu-item-arrow",
            MenuClass::MenuItemActive => "hi-menu-item-active",
            MenuClass::MenuItemDisabled => "hi-menu-item-disabled",
            MenuClass::MenuItemDanger => "hi-menu-item-danger",
            MenuClass::Submenu => "hi-menu-submenu",
            MenuClass::SubmenuTitle => "hi-menu-submenu-title",
            MenuClass::SubmenuTitleInner => "hi-menu-submenu-title-inner",
            MenuClass::SubmenuList => "hi-menu-submenu-list",
            MenuClass::SubmenuListOpen => "hi-menu-submenu-list-open",
            MenuClass::SubmenuArrowOpen => "hi-menu-submenu-arrow-open",
            MenuClass::MenuDivider => "hi-menu-divider",
            MenuClass::MenuGroup => "hi-menu-group",
            MenuClass::MenuGroupTitle => "hi-menu-group-title",
            MenuClass::MenuHeader => "hi-menu-header",
            MenuClass::MenuSm => "hi-menu-sm",
            MenuClass::MenuMd => "hi-menu-md",
            MenuClass::MenuLg => "hi-menu-lg",
            MenuClass::MenuHeightDefault => "hi-menu-height-default",
            MenuClass::MenuHeightCompact => "hi-menu-height-compact",
            MenuClass::MenuHeightExtraCompact => "hi-menu-height-extra-compact",
            MenuClass::MenuCollapsed => "hi-menu-collapsed",
            MenuClass::MenuIconOnly => "hi-menu-icon-only",
            MenuClass::MenuAnimateIn => "hi-menu-animate-in",
            MenuClass::MenuFadeIn => "hi-menu-fade-in",
            MenuClass::MenuItemPulse => "hi-menu-item-pulse",
            MenuClass::MenuItemRipple => "hi-menu-item-ripple",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

impl TypedClass for BreadcrumbClass {
    fn class_name(&self) -> &'static str {
        match self {
            BreadcrumbClass::Breadcrumb => "hi-breadcrumb",
            BreadcrumbClass::BreadcrumbItem => "hi-breadcrumb-item",
            BreadcrumbClass::BreadcrumbLink => "hi-breadcrumb-link",
            BreadcrumbClass::BreadcrumbLinkActive => "hi-breadcrumb-link-active",
            BreadcrumbClass::BreadcrumbSeparator => "hi-breadcrumb-separator",
            BreadcrumbClass::BreadcrumbSeparatorGlow => "hi-breadcrumb-separator-glow",
            BreadcrumbClass::BreadcrumbSeparatorSlash => "hi-breadcrumb-separator-slash",
            BreadcrumbClass::BreadcrumbSeparatorArrow => "hi-breadcrumb-separator-arrow",
            BreadcrumbClass::BreadcrumbSeparatorDoubleArrow => {
                "hi-breadcrumb-separator-double-arrow"
            }
            BreadcrumbClass::BreadcrumbSeparatorChevron => "hi-breadcrumb-separator-chevron",
            BreadcrumbClass::BreadcrumbSeparatorDot => "hi-breadcrumb-separator-dot",
            BreadcrumbClass::BreadcrumbSeparatorAnimated => "hi-breadcrumb-separator-animated",
            BreadcrumbClass::BreadcrumbIcon => "hi-breadcrumb-icon",
            BreadcrumbClass::BreadcrumbCurrent => "hi-breadcrumb-current",
            BreadcrumbClass::BreadcrumbDropdown => "hi-breadcrumb-dropdown",
            BreadcrumbClass::BreadcrumbDropdownTrigger => "hi-breadcrumb-dropdown-trigger",
            BreadcrumbClass::BreadcrumbDropdownArrow => "hi-breadcrumb-dropdown-arrow",
            BreadcrumbClass::BreadcrumbDropdownOpen => "hi-breadcrumb-dropdown-open",
            BreadcrumbClass::BreadcrumbDropdownMenu => "hi-breadcrumb-dropdown-menu",
            BreadcrumbClass::BreadcrumbDropdownMenuOpen => "hi-breadcrumb-dropdown-menu-open",
            BreadcrumbClass::BreadcrumbDropdownItem => "hi-breadcrumb-dropdown-item",
            BreadcrumbClass::BreadcrumbSm => "hi-breadcrumb-sm",
            BreadcrumbClass::BreadcrumbMd => "hi-breadcrumb-md",
            BreadcrumbClass::BreadcrumbLg => "hi-breadcrumb-lg",
            BreadcrumbClass::BreadcrumbBackground => "hi-breadcrumb-background",
            BreadcrumbClass::BreadcrumbPill => "hi-breadcrumb-pill",
            BreadcrumbClass::BreadcrumbCollapsible => "hi-breadcrumb-collapsible",
            BreadcrumbClass::BreadcrumbEllipsis => "hi-breadcrumb-ellipsis",
            BreadcrumbClass::BreadcrumbPrimary => "hi-breadcrumb-primary",
            BreadcrumbClass::BreadcrumbSuccess => "hi-breadcrumb-success",
            BreadcrumbClass::BreadcrumbWarning => "hi-breadcrumb-warning",
            BreadcrumbClass::BreadcrumbDanger => "hi-breadcrumb-danger",
            BreadcrumbClass::BreadcrumbAnimateIn => "hi-breadcrumb-animate-in",
            BreadcrumbClass::BreadcrumbSlideIn => "hi-breadcrumb-slide-in",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

impl TypedClass for SidebarClass {
    fn class_name(&self) -> &'static str {
        match self {
            SidebarClass::Sidebar => "hi-sidebar",
            SidebarClass::Section => "hi-sidebar-section",
            SidebarClass::SectionHeader => "hi-sidebar-section-header",
            SidebarClass::SectionTitleGroup => "hi-sidebar-section-title-group",
            SidebarClass::SectionTitlePrimary => "hi-sidebar-section-title-primary",
            SidebarClass::SectionTitleSecondary => "hi-sidebar-section-title-secondary",
            SidebarClass::SectionArrow => "hi-sidebar-section-arrow",
            SidebarClass::SectionArrowRotated => "hi-sidebar-section-arrow-rotated",
            SidebarClass::SectionChildren => "hi-sidebar-section-children",
            SidebarClass::Item => "hi-sidebar-item",
            SidebarClass::ItemHeader => "hi-sidebar-item-header",
            SidebarClass::ItemContent => "hi-sidebar-item-content",
            SidebarClass::ItemArrow => "hi-sidebar-item-arrow",
            SidebarClass::ItemArrowRotated => "hi-sidebar-item-arrow-rotated",
            SidebarClass::ItemChildren => "hi-sidebar-item-children",
            SidebarClass::ItemSecondary => "hi-sidebar-item-secondary",
            SidebarClass::Leaf => "hi-sidebar-leaf",
            SidebarClass::LeafContent => "hi-sidebar-leaf-content",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

impl TypedClass for StepperClass {
    fn class_name(&self) -> &'static str {
        match self {
            StepperClass::Stepper => "hi-stepper",
            StepperClass::Horizontal => "hi-stepper-horizontal",
            StepperClass::Vertical => "hi-stepper-vertical",
            StepperClass::Step => "hi-step",
            StepperClass::StepPending => "hi-step-pending",
            StepperClass::StepActive => "hi-step-active",
            StepperClass::StepFinished => "hi-step-finished",
            StepperClass::StepNumber => "hi-step-number",
            StepperClass::StepConnector => "hi-step-connector",
            StepperClass::StepConnectorVertical => "hi-step-connector-vertical",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnchorClass {
    Wrapper,
    Link,
    Active,
    Left,
    Right,
}

impl TypedClass for AnchorClass {
    fn class_name(&self) -> &'static str {
        match self {
            AnchorClass::Wrapper => "hi-anchor-wrapper",
            AnchorClass::Link => "hi-anchor-link",
            AnchorClass::Active => "hi-anchor-active",
            AnchorClass::Left => "hi-anchor-left",
            AnchorClass::Right => "hi-anchor-right",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

impl TypedClass for StepsClass {
    fn class_name(&self) -> &'static str {
        match self {
            StepsClass::Wrapper => "hi-steps-wrapper",
            StepsClass::Horizontal => "hi-steps-horizontal",
            StepsClass::Vertical => "hi-steps-vertical",
            StepsClass::Item => "hi-step-item",
            StepsClass::Wait => "hi-step-wait",
            StepsClass::Process => "hi-step-process",
            StepsClass::Finish => "hi-step-finish",
            StepsClass::Error => "hi-step-error",
            StepsClass::Icon => "hi-step-icon",
            StepsClass::Number => "hi-step-number",
            StepsClass::Content => "hi-step-content",
            StepsClass::Title => "hi-step-title",
            StepsClass::Description => "hi-step-description",
        }
    }
}
