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
            Self::TabsTab => "hi-tab",
            Self::TabActive => "hi-tab-active",
            Self::TabDisabled => "hi-tab-disabled",
            Self::TabsTabpane => "hi-tab-panel",
            Self::TabpaneActive => "hi-tab-panel-active",
            Self::TabpaneInactive => "hi-tab-panel-inactive",
            Self::TabsTabIcon => "hi-tabs-tab-icon",
            Self::TabsTabLabel => "hi-tabs-tab-label",
            Self::Tabs => "hi-tabs",
            Self::Card => "hi-tabs-card",
            Self::Segment => "hi-tabs-segment",
            Self::Top => "hi-tabs-top",
            Self::Right => "hi-tabs-right",
            Self::Bottom => "hi-tabs-bottom",
            Self::Left => "hi-tabs-left",
            Self::Animated => "hi-tabs-animated",
            Self::Nav => "hi-tabs-nav",
            Self::NavList => "hi-tabs-nav-list",
            Self::InkBar => "hi-tabs-ink-bar",
            Self::Content => "hi-tabs-content",
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
            Self::Menu => "hi-menu",
            Self::Inline => "hi-menu-inline",
            Self::Vertical => "hi-menu-vertical",
            Self::Horizontal => "hi-menu-horizontal",
            Self::Compact => "hi-menu-compact",
            Self::PopoverMenu => "hi-menu-popover",
            Self::MenuList => "hi-menu-list",
            Self::MenuItem => "hi-menu-item",
            Self::MenuItemInner => "hi-menu-item-inner",
            Self::MenuItemWrapper => "hi-menu-item-wrapper",
            Self::MenuItemIcon => "hi-menu-item-icon",
            Self::MenuItemContent => "hi-menu-item-content",
            Self::MenuItemLabel => "hi-menu-item-label",
            Self::MenuItemShortcut => "hi-menu-item-shortcut",
            Self::MenuItemArrow => "hi-menu-item-arrow",
            Self::MenuItemActive => "hi-menu-item-active",
            Self::MenuItemDisabled => "hi-menu-item-disabled",
            Self::MenuItemDanger => "hi-menu-item-danger",
            Self::Submenu => "hi-menu-submenu",
            Self::SubmenuTitle => "hi-menu-submenu-title",
            Self::SubmenuTitleInner => "hi-menu-submenu-title-inner",
            Self::SubmenuList => "hi-menu-submenu-list",
            Self::SubmenuListOpen => "hi-menu-submenu-list-open",
            Self::SubmenuArrowOpen => "hi-menu-submenu-arrow-open",
            Self::MenuDivider => "hi-menu-divider",
            Self::MenuGroup => "hi-menu-group",
            Self::MenuGroupTitle => "hi-menu-group-title",
            Self::MenuHeader => "hi-menu-header",
            Self::MenuSm => "hi-menu-sm",
            Self::MenuMd => "hi-menu-md",
            Self::MenuLg => "hi-menu-lg",
            Self::MenuHeightDefault => "hi-menu-height-default",
            Self::MenuHeightCompact => "hi-menu-height-compact",
            Self::MenuHeightExtraCompact => "hi-menu-height-extra-compact",
            Self::MenuCollapsed => "hi-menu-collapsed",
            Self::MenuIconOnly => "hi-menu-icon-only",
            Self::MenuAnimateIn => "hi-menu-animate-in",
            Self::MenuFadeIn => "hi-menu-fade-in",
            Self::MenuItemPulse => "hi-menu-item-pulse",
            Self::MenuItemRipple => "hi-menu-item-ripple",
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
            Self::Breadcrumb => "hi-breadcrumb",
            Self::BreadcrumbItem => "hi-breadcrumb-item",
            Self::BreadcrumbLink => "hi-breadcrumb-link",
            Self::BreadcrumbLinkActive => "hi-breadcrumb-link-active",
            Self::BreadcrumbSeparator => "hi-breadcrumb-separator",
            Self::BreadcrumbSeparatorGlow => "hi-breadcrumb-separator-glow",
            Self::BreadcrumbSeparatorSlash => "hi-breadcrumb-separator-slash",
            Self::BreadcrumbSeparatorArrow => "hi-breadcrumb-separator-arrow",
            Self::BreadcrumbSeparatorDoubleArrow => "hi-breadcrumb-separator-double-arrow",
            Self::BreadcrumbSeparatorChevron => "hi-breadcrumb-separator-chevron",
            Self::BreadcrumbSeparatorDot => "hi-breadcrumb-separator-dot",
            Self::BreadcrumbSeparatorAnimated => "hi-breadcrumb-separator-animated",
            Self::BreadcrumbIcon => "hi-breadcrumb-icon",
            Self::BreadcrumbCurrent => "hi-breadcrumb-current",
            Self::BreadcrumbDropdown => "hi-breadcrumb-dropdown",
            Self::BreadcrumbDropdownTrigger => "hi-breadcrumb-dropdown-trigger",
            Self::BreadcrumbDropdownArrow => "hi-breadcrumb-dropdown-arrow",
            Self::BreadcrumbDropdownOpen => "hi-breadcrumb-dropdown-open",
            Self::BreadcrumbDropdownMenu => "hi-breadcrumb-dropdown-menu",
            Self::BreadcrumbDropdownMenuOpen => "hi-breadcrumb-dropdown-menu-open",
            Self::BreadcrumbDropdownItem => "hi-breadcrumb-dropdown-item",
            Self::BreadcrumbSm => "hi-breadcrumb-sm",
            Self::BreadcrumbMd => "hi-breadcrumb-md",
            Self::BreadcrumbLg => "hi-breadcrumb-lg",
            Self::BreadcrumbBackground => "hi-breadcrumb-background",
            Self::BreadcrumbPill => "hi-breadcrumb-pill",
            Self::BreadcrumbCollapsible => "hi-breadcrumb-collapsible",
            Self::BreadcrumbEllipsis => "hi-breadcrumb-ellipsis",
            Self::BreadcrumbPrimary => "hi-breadcrumb-primary",
            Self::BreadcrumbSuccess => "hi-breadcrumb-success",
            Self::BreadcrumbWarning => "hi-breadcrumb-warning",
            Self::BreadcrumbDanger => "hi-breadcrumb-danger",
            Self::BreadcrumbAnimateIn => "hi-breadcrumb-animate-in",
            Self::BreadcrumbSlideIn => "hi-breadcrumb-slide-in",
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
            Self::Sidebar => "hi-sidebar",
            Self::Section => "hi-sidebar-section",
            Self::SectionHeader => "hi-sidebar-section-header",
            Self::SectionTitleGroup => "hi-sidebar-section-title-group",
            Self::SectionTitlePrimary => "hi-sidebar-section-title-primary",
            Self::SectionTitleSecondary => "hi-sidebar-section-title-secondary",
            Self::SectionArrow => "hi-sidebar-section-arrow",
            Self::SectionArrowRotated => "hi-sidebar-section-arrow-rotated",
            Self::SectionChildren => "hi-sidebar-section-children",
            Self::Item => "hi-sidebar-item",
            Self::ItemHeader => "hi-sidebar-item-header",
            Self::ItemContent => "hi-sidebar-item-content",
            Self::ItemArrow => "hi-sidebar-item-arrow",
            Self::ItemArrowRotated => "hi-sidebar-item-arrow-rotated",
            Self::ItemChildren => "hi-sidebar-item-children",
            Self::ItemSecondary => "hi-sidebar-item-secondary",
            Self::Leaf => "hi-sidebar-leaf",
            Self::LeafContent => "hi-sidebar-leaf-content",
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
            Self::Stepper => "hi-stepper",
            Self::Horizontal => "hi-stepper-horizontal",
            Self::Vertical => "hi-stepper-vertical",
            Self::Step => "hi-step",
            Self::StepPending => "hi-step-pending",
            Self::StepActive => "hi-step-active",
            Self::StepFinished => "hi-step-finished",
            Self::StepNumber => "hi-step-number",
            Self::StepConnector => "hi-step-connector",
            Self::StepConnectorVertical => "hi-step-connector-vertical",
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
            Self::Wrapper => "hi-anchor-wrapper",
            Self::Link => "hi-anchor-link",
            Self::Active => "hi-anchor-active",
            Self::Left => "hi-anchor-left",
            Self::Right => "hi-anchor-right",
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
            Self::Wrapper => "hi-steps-wrapper",
            Self::Horizontal => "hi-steps-horizontal",
            Self::Vertical => "hi-steps-vertical",
            Self::Item => "hi-step-item",
            Self::Wait => "hi-step-wait",
            Self::Process => "hi-step-process",
            Self::Finish => "hi-step-finish",
            Self::Error => "hi-step-error",
            Self::Icon => "hi-step-icon",
            Self::Number => "hi-step-number",
            Self::Content => "hi-step-content",
            Self::Title => "hi-step-title",
            Self::Description => "hi-step-description",
        }
    }
}
