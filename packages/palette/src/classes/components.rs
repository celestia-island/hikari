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
    /// `hi-layout-has-sidebar` - Has sidebar
    HasSidebar,
    /// `hi-layout-overlay-open` - Overlay open state
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
pub enum ButtonClass {
    /// `hi-button` - Main button class
    Button,
    /// `hi-button-primary` - Primary variant
    Primary,
    /// `hi-button-secondary` - Secondary variant
    Secondary,
    /// `hi-button-ghost` - Ghost variant
    Ghost,
    /// `hi-button-borderless` - Borderless variant (no border)
    Borderless,
    /// `hi-button-danger` - Danger variant
    Danger,
    /// `hi-button-success` - Success variant
    Success,
    /// `hi-button-sm` - Small size
    Sm,
    /// `hi-button-md` - Medium size
    Md,
    /// `hi-button-lg` - Large size
    Lg,
    /// `hi-button-loading` - Loading state
    Loading,
    /// `hi-button-block` - Block (full width)
    Block,
    /// `hi-button-spinner` - Loading spinner
    Spinner,
    /// `hi-button-icon` - Icon container
    Icon,
    /// `hi-button-space-between` - Space between layout (icon + text + suffix)
    SpaceBetween,
    /// `hi-button-width-auto` - Auto width (default)
    WidthAuto,
    /// `hi-button-width-120` - Fixed width 120px
    Width120,
    /// `hi-button-width-140` - Fixed width 140px
    Width140,
    /// `hi-button-width-160` - Fixed width 160px
    Width160,
    /// `hi-icon-button` - IconButton (square icon-only button)
    IconButton,
    /// `hi-icon-button-16` - IconButton size 16px
    IconButtonSize16,
    /// `hi-icon-button-24` - IconButton size 24px
    IconButtonSize24,
    /// `hi-icon-button-32` - IconButton size 32px
    IconButtonSize32,
    /// `hi-icon-button-36` - IconButton size 36px
    IconButtonSize36,
    /// `hi-icon-button-40` - IconButton size 40px
    IconButtonSize40,
    /// `hi-icon-button-ghost` - IconButton ghost variant (transparent)
    IconButtonGhost,
    /// `hi-icon-button-primary` - IconButton primary variant
    IconButtonPrimary,
    /// `hi-icon-button-secondary` - IconButton secondary variant
    IconButtonSecondary,
    /// `hi-icon-button-danger` - IconButton danger variant
    IconButtonDanger,
    /// `hi-icon-button-success` - IconButton success variant
    IconButtonSuccess,
    /// `hi-button-disabled` - Disabled state
    Disabled,
    /// `hi-icon-button-icon` - IconButton icon wrapper
    IconButtonIcon,
    /// `hi-icon-button-disabled` - IconButton disabled state
    IconButtonDisabled,
}

impl UtilityClass for ButtonClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            ButtonClass::Button => "button",
            ButtonClass::Primary => "button-primary",
            ButtonClass::Secondary => "button-secondary",
            ButtonClass::Ghost => "button-ghost",
            ButtonClass::Borderless => "button-borderless",
            ButtonClass::Danger => "button-danger",
            ButtonClass::Success => "button-success",
            ButtonClass::Sm => "button-sm",
            ButtonClass::Md => "button-md",
            ButtonClass::Lg => "button-lg",
            ButtonClass::Loading => "button-loading",
            ButtonClass::Block => "button-block",
            ButtonClass::Spinner => "button-spinner",
            ButtonClass::Icon => "button-icon",
            ButtonClass::SpaceBetween => "button-space-between",
            ButtonClass::WidthAuto => "button-width-auto",
            ButtonClass::Width120 => "button-width-120",
            ButtonClass::Width140 => "button-width-140",
            ButtonClass::Width160 => "button-width-160",
            ButtonClass::IconButton => "icon-button",
            ButtonClass::IconButtonSize16 => "icon-button-16",
            ButtonClass::IconButtonSize24 => "icon-button-24",
            ButtonClass::IconButtonSize32 => "icon-button-32",
            ButtonClass::IconButtonSize36 => "icon-button-36",
            ButtonClass::IconButtonSize40 => "icon-button-40",
            ButtonClass::IconButtonGhost => "icon-button-ghost",
            ButtonClass::IconButtonPrimary => "icon-button-primary",
            ButtonClass::IconButtonSecondary => "icon-button-secondary",
            ButtonClass::IconButtonDanger => "icon-button-danger",
            ButtonClass::IconButtonSuccess => "icon-button-success",
            ButtonClass::Disabled => "button-disabled",
            ButtonClass::IconButtonIcon => "icon-button-icon",
            ButtonClass::IconButtonDisabled => "icon-button-disabled",
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
    /// `hi-container-md` - Medium max-width (960px)
    Md,
    /// `hi-container-lg` - Large max-width (1024px)
    Lg,
    /// `hi-container-xl` - Extra large max-width (1280px)
    Xl,
    /// `hi-container-xxl` - Extra extra large max-width (1536px)
    Xxl,
    /// `hi-container-centered` - Centered container
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

/// Tabs component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TabsClass {
    /// `hi-tabs-tab` - Tab
    TabsTab,
    /// `hi-tabs-tab-active` - Active tab
    TabActive,
    /// `hi-tabs-tab-disabled` - Disabled tab
    TabDisabled,
    /// `hi-tabs-tabpane` - Tabpane
    TabsTabpane,
    /// `hi-tabs-tabpane-active` - Active tabpane
    TabpaneActive,
    /// `hi-tabs-tabpane-inactive` - Inactive tabpane
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

/// Menu component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MenuClass {
    /// `hi-menu` - Menu
    Menu,
    /// `hi-menu-inline` - Inline mode
    Inline,
    /// `hi-menu-submenu` - Submenu
    Submenu,
    /// `hi-menu-submenu-arrow-open` - Arrow open state
    SubmenuArrowOpen,
    /// `hi-menu-submenu-list-open` - List open state
    SubmenuListOpen,
    /// `hi-menu-vertical` - Vertical mode
    Vertical,
    /// `hi-menu-horizontal` - Horizontal mode
    Horizontal,
    /// `hi-menu-compact` - Compact mode
    Compact,
    /// `hi-menu-item` - Menu item
    MenuItem,
    /// `hi-menu-submenu-list` - Submenu list
    SubmenuList,
    /// `hi-menu-popover` - Menu inside Popover
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

/// Tree/Node component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TreeClass {
    /// `hi-drag-node` - Drag node
    DragNode,
    /// `hi-virtual-tree` - Virtual tree
    VirtualTree,
    /// `hi-tree-node-disabled` - Disabled node
    NodeDisabled,
    /// `hi-dragging` - Dragging state
    Dragging,
    /// `hi-drag-over` - Drag over state
    DragOver,
}

impl UtilityClass for TreeClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            TreeClass::DragNode => "drag-node",
            TreeClass::VirtualTree => "virtual-tree",
            TreeClass::NodeDisabled => "tree-node-disabled",
            TreeClass::Dragging => "dragging",
            TreeClass::DragOver => "drag-over",
        }
    }
}

/// Sidebar component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SidebarClass {
    /// `hi-sidebar` - Sidebar
    Sidebar,
    /// `hi-sidebar-section` - Sidebar section
    Section,
    /// `hi-sidebar-section-arrow-left` - Arrow left
    SectionArrowLeft,
    /// `hi-sidebar-section-arrow-right` - Arrow right
    SectionArrowRight,
    /// `hi-sidebar-item` - Sidebar item
    Item,
    /// `hi-sidebar-item-arrow-left` - Item arrow left
    ItemArrowLeft,
    /// `hi-sidebar-item-arrow-right` - Item arrow right
    ItemArrowRight,
    /// `hi-sidebar-leaf` - Sidebar leaf
    Leaf,
}

impl UtilityClass for SidebarClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SidebarClass::Sidebar => "sidebar",
            SidebarClass::Section => "sidebar-section",
            SidebarClass::SectionArrowLeft => "sidebar-section-arrow-left",
            SidebarClass::SectionArrowRight => "sidebar-section-arrow-right",
            SidebarClass::Item => "sidebar-item",
            SidebarClass::ItemArrowLeft => "sidebar-item-arrow-left",
            SidebarClass::ItemArrowRight => "sidebar-item-arrow-right",
            SidebarClass::Leaf => "sidebar-leaf",
        }
    }
}

/// Breadcrumb component classes
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

/// Sort component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SortClass {
    /// `hi-sort` - Main sort class
    Sort,
    /// `hi-sort-button` - Sort button
    SortButton,
    /// `hi-sort-active` - Active sort state
    SortActive,
    /// `hi-sort-clear` - Clear sort button
    SortClear,
    /// `hi-sort-title` - Sort title
    SortTitle,
    /// `hi-sort-indicator` - Sort indicator
    SortIndicator,
    /// `hi-sort-clear-text` - Clear button text
    SortClearText,
    /// `hi-sort-clear-icon` - Clear button icon
    SortClearIcon,
}

impl UtilityClass for SortClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SortClass::Sort => "sort",
            SortClass::SortButton => "sort-button",
            SortClass::SortActive => "sort-active",
            SortClass::SortClear => "sort-clear",
            SortClass::SortTitle => "sort-title",
            SortClass::SortIndicator => "sort-indicator",
            SortClass::SortClearText => "sort-clear-text",
            SortClass::SortClearIcon => "sort-clear-icon",
        }
    }
}

/// Pagination component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PaginationClass {
    /// `hi-pagination` - Main pagination class
    Pagination,
    /// `hi-pagination-total` - Total items display
    PaginationTotal,
    /// `hi-pagination-sizer` - Page size selector
    PaginationSizer,
    /// `hi-pagination-pages` - Pages container
    PaginationPages,
    /// `hi-pagination-prev` - Previous page button
    PaginationPrev,
    /// `hi-pagination-next` - Next page button
    PaginationNext,
    /// `hi-pagination-ellipsis` - Ellipsis indicator
    PaginationEllipsis,
    /// `hi-pagination-item` - Page item
    PaginationItem,
    /// `hi-pagination-active` - Active page
    PaginationActive,
    /// `hi-pagination-jump` - Jump to page
    PaginationJump,
    /// `hi-pagination-jump-label` - Jump label
    PaginationJumpLabel,
}

impl UtilityClass for PaginationClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            PaginationClass::Pagination => "pagination",
            PaginationClass::PaginationTotal => "pagination-total",
            PaginationClass::PaginationSizer => "pagination-sizer",
            PaginationClass::PaginationPages => "pagination-pages",
            PaginationClass::PaginationPrev => "pagination-prev",
            PaginationClass::PaginationNext => "pagination-next",
            PaginationClass::PaginationEllipsis => "pagination-ellipsis",
            PaginationClass::PaginationItem => "pagination-item",
            PaginationClass::PaginationActive => "pagination-active",
            PaginationClass::PaginationJump => "pagination-jump",
            PaginationClass::PaginationJumpLabel => "pagination-jump-label",
        }
    }
}

/// Filter component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FilterClass {
    /// `hi-filter` - Main filter class
    Filter,
    /// `hi-filter-container` - Filter container
    FilterContainer,
    /// `hi-filter-trigger` - Filter trigger button
    FilterTrigger,
    /// `hi-filter-active` - Active filter state
    FilterActive,
    /// `hi-filter-icon` - Filter icon
    FilterIcon,
    /// `hi-filter-badge` - Filter badge
    FilterBadge,
    /// `hi-filter-dropdown-icon` - Dropdown arrow icon
    FilterDropdownIcon,
    /// `hi-filter-dropdown` - Dropdown menu
    FilterDropdown,
    /// `hi-filter-header` - Dropdown header
    FilterHeader,
    /// `hi-filter-title` - Filter title
    FilterTitle,
    /// `hi-filter-clear-btn` - Clear button
    FilterClearBtn,
    /// `hi-filter-options` - Filter options container
    FilterOptions,
    /// `hi-filter-option` - Filter option
    FilterOption,
    /// `hi-filter-checkbox` - Checkbox
    FilterCheckbox,
    /// `hi-filter-label` - Option label
    FilterLabel,
    /// `hi-filter-footer` - Dropdown footer
    FilterFooter,
    /// `hi-filter-hint` - Filter hint text
    FilterHint,
}

impl UtilityClass for FilterClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            FilterClass::Filter => "filter",
            FilterClass::FilterContainer => "filter-container",
            FilterClass::FilterTrigger => "filter-trigger",
            FilterClass::FilterActive => "filter-active",
            FilterClass::FilterIcon => "filter-icon",
            FilterClass::FilterBadge => "filter-badge",
            FilterClass::FilterDropdownIcon => "filter-dropdown-icon",
            FilterClass::FilterDropdown => "filter-dropdown",
            FilterClass::FilterHeader => "filter-header",
            FilterClass::FilterTitle => "filter-title",
            FilterClass::FilterClearBtn => "filter-clear-btn",
            FilterClass::FilterOptions => "filter-options",
            FilterClass::FilterOption => "filter-option",
            FilterClass::FilterCheckbox => "filter-checkbox",
            FilterClass::FilterLabel => "filter-label",
            FilterClass::FilterFooter => "filter-footer",
            FilterClass::FilterHint => "filter-hint",
        }
    }
}

/// Section component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SectionClass {
    /// `hi-section` - Main section class
    Section,
    /// `hi-section-sm` - Small size
    SectionSm,
    /// `hi-section-md` - Medium size
    SectionMd,
    /// `hi-section-lg` - Large size
    SectionLg,
    /// `hi-section-header` - Section header
    SectionHeader,
    /// `hi-section-title` - Section title
    SectionTitle,
    /// `hi-section-description` - Section description
    SectionDescription,
    /// `hi-section-body` - Section body
    SectionBody,
    /// `hi-spacer` - Spacer
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

/// Tree component classes (new)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TreeClassNew {
    TreeContainer,
    Tree,
}

impl UtilityClass for TreeClassNew {
    fn as_suffix(&self) -> &'static str {
        match self {
            TreeClassNew::TreeContainer => "tree-container",
            TreeClassNew::Tree => "tree",
        }
    }
}

/// Tree label component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TreeLabelClass {
    TreeNodeLabel,
}

impl UtilityClass for TreeLabelClass {
    fn as_suffix(&self) -> &'static str {
        "tree-node-label"
    }
}

/// Selection component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SelectionClass {
    Selection,
    RowSelection,
}

impl UtilityClass for SelectionClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SelectionClass::Selection => "selection",
            SelectionClass::RowSelection => "row-selection",
        }
    }
}

/// Drag drop tree component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DragDropTreeClass {
    DragDropTree,
}

impl UtilityClass for DragDropTreeClass {
    fn as_suffix(&self) -> &'static str {
        "drag-drop-tree"
    }
}

/// Virtual scroll component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VirtualScrollClass {
    VirtualTree,
}

impl UtilityClass for VirtualScrollClass {
    fn as_suffix(&self) -> &'static str {
        "virtual-tree"
    }
}

/// Table component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TableClass {
    /// `hi-table` - Main table class
    Table,
    /// `hi-table-sm` - Small size
    TableSm,
    /// `hi-table-md` - Medium size
    TableMd,
    /// `hi-table-lg` - Large size
    TableLg,
    /// `hi-table-bordered` - Bordered table
    TableBordered,
    /// `hi-table-striped` - Striped rows
    TableStriped,
    /// `hi-table-hover` - Hoverable rows
    TableHover,
    /// `hi-table-wrapper` - Table wrapper
    TableWrapper,
    /// `hi-table-header-cell` - Header cell
    TableHeaderCell,
    /// `hi-table-cell` - Table cell
    TableCell,
    /// `hi-table-header-row` - Header row
    TableHeaderRow,
    /// `hi-table-body` - Table body
    TableBody,
    /// `hi-table-row` - Table row
    TableRow,
    /// `hi-table-empty` - Empty state
    TableEmpty,
    /// `hi-table-empty-content` - Empty state content
    TableEmptyContent,
    /// `hi-table-sortable` - Sortable column
    TableSortable,
    /// `hi-table-sort-icon` - Sort icon
    TableSortIcon,
    /// `hi-table-sort-active` - Active sort column
    TableSortActive,
    /// `hi-text-left` - Left aligned
    TextLeft,
    /// `hi-text-center` - Center aligned
    TextCenter,
    /// `hi-text-right` - Right aligned
    TextRight,
}

impl UtilityClass for TableClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            TableClass::Table => "table",
            TableClass::TableSm => "table-sm",
            TableClass::TableMd => "table-md",
            TableClass::TableLg => "table-lg",
            TableClass::TableBordered => "table-bordered",
            TableClass::TableStriped => "table-striped",
            TableClass::TableHover => "table-hover",
            TableClass::TableWrapper => "table-wrapper",
            TableClass::TableHeaderCell => "table-header-cell",
            TableClass::TableCell => "table-cell",
            TableClass::TableHeaderRow => "table-header-row",
            TableClass::TableBody => "table-body",
            TableClass::TableRow => "table-row",
            TableClass::TableEmpty => "table-empty",
            TableClass::TableEmptyContent => "table-empty-content",
            TableClass::TableSortable => "table-sortable",
            TableClass::TableSortIcon => "table-sort-icon",
            TableClass::TableSortActive => "table-sort-active",
            TableClass::TextLeft => "text-left",
            TableClass::TextCenter => "text-center",
            TableClass::TextRight => "text-right",
        }
    }
}

/// Input component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InputClass {
    /// `hi-input` - Main input class
    Input,
    /// `hi-input-wrapper` - Input wrapper
    InputWrapper,
    /// `hi-input-sm` - Small size (24px height)
    InputSm,
    /// `hi-input-md` - Medium size (32px height)
    InputMd,
    /// `hi-input-lg` - Large size (40px height)
    InputLg,
    /// `hi-input-disabled` - Disabled state
    InputDisabled,
    /// `hi-input-prefix` - Prefix icon
    InputPrefix,
    /// `hi-input-suffix` - Suffix icon
    InputSuffix,
}

impl UtilityClass for InputClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            InputClass::Input => "input",
            InputClass::InputWrapper => "input-wrapper",
            InputClass::InputSm => "input-sm",
            InputClass::InputMd => "input-md",
            InputClass::InputLg => "input-lg",
            InputClass::InputDisabled => "input-disabled",
            InputClass::InputPrefix => "input-prefix",
            InputClass::InputSuffix => "input-suffix",
        }
    }
}

/// Toast component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ToastClass {
    /// `hi-toast` - Main toast class
    Toast,
    /// `hi-toast-info` - Info variant
    ToastInfo,
    /// `hi-toast-success` - Success variant
    ToastSuccess,
    /// `hi-toast-warning` - Warning variant
    ToastWarning,
    /// `hi-toast-error` - Error variant
    ToastError,
    /// `hi-toast-top-right` - Top right position
    ToastTopRight,
    /// `hi-toast-top-center` - Top center position
    ToastTopCenter,
    /// `hi-toast-top-left` - Top left position
    ToastTopLeft,
    /// `hi-toast-bottom-right` - Bottom right position
    ToastBottomRight,
    /// `hi-toast-bottom-center` - Bottom center position
    ToastBottomCenter,
    /// `hi-toast-bottom-left` - Bottom left position
    ToastBottomLeft,
    /// `hi-toast-icon-wrapper` - Icon wrapper
    ToastIconWrapper,
    /// `hi-toast-icon` - Toast icon
    ToastIcon,
    /// `hi-toast-content` - Content container
    ToastContent,
    /// `hi-toast-title` - Toast title
    ToastTitle,
    /// `hi-toast-message` - Toast message
    ToastMessage,
    /// `hi-toast-close` - Close button
    ToastClose,
}

impl UtilityClass for ToastClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            ToastClass::Toast => "toast",
            ToastClass::ToastInfo => "toast-info",
            ToastClass::ToastSuccess => "toast-success",
            ToastClass::ToastWarning => "toast-warning",
            ToastClass::ToastError => "toast-error",
            ToastClass::ToastTopRight => "toast-top-right",
            ToastClass::ToastTopCenter => "toast-top-center",
            ToastClass::ToastTopLeft => "toast-top-left",
            ToastClass::ToastBottomRight => "toast-bottom-right",
            ToastClass::ToastBottomCenter => "toast-bottom-center",
            ToastClass::ToastBottomLeft => "toast-bottom-left",
            ToastClass::ToastIconWrapper => "toast-icon-wrapper",
            ToastClass::ToastIcon => "toast-icon",
            ToastClass::ToastContent => "toast-content",
            ToastClass::ToastTitle => "toast-title",
            ToastClass::ToastMessage => "toast-message",
            ToastClass::ToastClose => "toast-close",
        }
    }
}

/// Tooltip component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TooltipClass {
    /// `hi-tooltip` - Main tooltip class
    Tooltip,
    /// `hi-tooltip-wrapper` - Tooltip wrapper
    TooltipWrapper,
    /// `hi-tooltip-trigger` - Trigger element
    TooltipTrigger,
    /// `hi-tooltip-visible` - Visible state
    TooltipVisible,
    /// `hi-tooltip-top` - Top placement
    TooltipTop,
    /// `hi-tooltip-bottom` - Bottom placement
    TooltipBottom,
    /// `hi-tooltip-left` - Left placement
    TooltipLeft,
    /// `hi-tooltip-right` - Right placement
    TooltipRight,
    /// `hi-tooltip-content` - Content container
    TooltipContent,
    /// `hi-tooltip-arrow` - Arrow element
    TooltipArrow,
    /// `hi-tooltip-arrow-top` - Top arrow
    TooltipArrowTop,
    /// `hi-tooltip-arrow-bottom` - Bottom arrow
    TooltipArrowBottom,
    /// `hi-tooltip-arrow-left` - Left arrow
    TooltipArrowLeft,
    /// `hi-tooltip-arrow-right` - Right arrow
    TooltipArrowRight,
}

impl UtilityClass for TooltipClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            TooltipClass::Tooltip => "tooltip",
            TooltipClass::TooltipWrapper => "tooltip-wrapper",
            TooltipClass::TooltipTrigger => "tooltip-trigger",
            TooltipClass::TooltipVisible => "tooltip-visible",
            TooltipClass::TooltipTop => "tooltip-top",
            TooltipClass::TooltipBottom => "tooltip-bottom",
            TooltipClass::TooltipLeft => "tooltip-left",
            TooltipClass::TooltipRight => "tooltip-right",
            TooltipClass::TooltipContent => "tooltip-content",
            TooltipClass::TooltipArrow => "tooltip-arrow",
            TooltipClass::TooltipArrowTop => "tooltip-arrow-top",
            TooltipClass::TooltipArrowBottom => "tooltip-arrow-bottom",
            TooltipClass::TooltipArrowLeft => "tooltip-arrow-left",
            TooltipClass::TooltipArrowRight => "tooltip-arrow-right",
        }
    }
}

/// Alert component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AlertClass {
    /// `hi-alert` - Main alert class
    Alert,
    /// `hi-alert-info` - Info variant
    AlertInfo,
    /// `hi-alert-success` - Success variant
    AlertSuccess,
    /// `hi-alert-warning` - Warning variant
    AlertWarning,
    /// `hi-alert-error` - Error variant
    AlertError,
    /// `hi-alert-icon-wrapper` - Icon wrapper
    AlertIconWrapper,
    /// `hi-alert-icon` - Alert icon
    AlertIcon,
    /// `hi-alert-content` - Content container
    AlertContent,
    /// `hi-alert-title` - Alert title
    AlertTitle,
    /// `hi-alert-description` - Alert description
    AlertDescription,
    /// `hi-alert-close` - Close button
    AlertClose,
}

impl UtilityClass for AlertClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            AlertClass::Alert => "alert",
            AlertClass::AlertInfo => "alert-info",
            AlertClass::AlertSuccess => "alert-success",
            AlertClass::AlertWarning => "alert-warning",
            AlertClass::AlertError => "alert-error",
            AlertClass::AlertIconWrapper => "alert-icon-wrapper",
            AlertClass::AlertIcon => "alert-icon",
            AlertClass::AlertContent => "alert-content",
            AlertClass::AlertTitle => "alert-title",
            AlertClass::AlertDescription => "alert-description",
            AlertClass::AlertClose => "alert-close",
        }
    }
}

/// Card component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CardClass {
    /// `hi-card` - Main card class
    Card,
    /// `hi-card-hoverable` - Hoverable state
    CardHoverable,
    /// `hi-card-bordered` - Bordered card
    CardBordered,
    /// `hi-card-header` - Card header
    CardHeader,
    /// `hi-card-title` - Card title
    CardTitle,
    /// `hi-card-subtitle` - Card subtitle
    CardSubtitle,
    /// `hi-card-extra` - Extra content
    CardExtra,
    /// `hi-card-body` - Card body
    CardBody,
    /// `hi-card-media` - Card media (images/videos)
    CardMedia,
    /// `hi-card-actions` - Card actions (footer)
    CardActions,
    /// `hi-card-actions-no-spacing` - Card actions without spacing
    CardActionsNoSpacing,
    /// `hi-card-spotlight-wrapper` - Spotlight wrapper
    CardSpotlightWrapper,
}

impl UtilityClass for CardClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            CardClass::Card => "card",
            CardClass::CardHoverable => "card-hoverable",
            CardClass::CardBordered => "card-bordered",
            CardClass::CardHeader => "card-header",
            CardClass::CardTitle => "card-title",
            CardClass::CardSubtitle => "card-subtitle",
            CardClass::CardExtra => "card-extra",
            CardClass::CardBody => "card-body",
            CardClass::CardMedia => "card-media",
            CardClass::CardActions => "card-actions",
            CardClass::CardActionsNoSpacing => "card-actions-no-spacing",
            CardClass::CardSpotlightWrapper => "card-spotlight-wrapper",
        }
    }
}

/// Spotlight component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SpotlightClass {
    /// `hi-spotlight` - Main spotlight class
    Spotlight,
    /// `hi-spotlight-wrapper` - Spotlight wrapper
    SpotlightWrapper,
    /// `hi-spotlight-auto` - Auto color mode
    SpotlightAuto,
    /// `hi-spotlight-theme` - Theme color mode
    SpotlightTheme,
}

impl UtilityClass for SpotlightClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SpotlightClass::Spotlight => "spotlight",
            SpotlightClass::SpotlightWrapper => "spotlight-wrapper",
            SpotlightClass::SpotlightAuto => "spotlight-auto",
            SpotlightClass::SpotlightTheme => "spotlight-theme",
        }
    }
}

/// Calendar component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CalendarClass {
    /// `hi-calendar` - Main calendar class
    Calendar,
    /// `hi-calendar-header` - Header with navigation
    CalendarHeader,
    /// `hi-calendar-nav` - Navigation buttons container
    CalendarNav,
    /// `hi-calendar-nav-button` - Month/year navigation button
    CalendarNavButton,
    /// `hi-calendar-title` - Year/month title
    CalendarTitle,
    /// `hi-calendar-month-title` - Month-only title
    CalendarMonthTitle,
    /// `hi-calendar-weekdays` - Week day headers
    CalendarWeekdays,
    /// `hi-calendar-weekday` - Single week day header
    CalendarWeekday,
    /// `hi-calendar-grid` - Calendar days grid
    CalendarGrid,
    /// `hi-calendar-day-cell` - Single day cell
    CalendarDayCell,
    /// `hi-calendar-day` - Day number
    CalendarDay,
    /// `hi-calendar-day-selected` - Selected day state
    CalendarDaySelected,
    /// `hi-calendar-day-today` - Today marker
    CalendarDayToday,
    /// `hi-calendar-day-disabled` - Disabled day state
    CalendarDayDisabled,
}

impl UtilityClass for CalendarClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            CalendarClass::Calendar => "calendar",
            CalendarClass::CalendarHeader => "calendar-header",
            CalendarClass::CalendarNav => "calendar-nav",
            CalendarClass::CalendarNavButton => "calendar-nav-button",
            CalendarClass::CalendarTitle => "calendar-title",
            CalendarClass::CalendarMonthTitle => "calendar-month-title",
            CalendarClass::CalendarWeekdays => "calendar-weekdays",
            CalendarClass::CalendarWeekday => "calendar-weekday",
            CalendarClass::CalendarGrid => "calendar-grid",
            CalendarClass::CalendarDayCell => "calendar-day-cell",
            CalendarClass::CalendarDay => "calendar-day",
            CalendarClass::CalendarDaySelected => "calendar-day-selected",
            CalendarClass::CalendarDayToday => "calendar-day-today",
            CalendarClass::CalendarDayDisabled => "calendar-day-disabled",
        }
    }
}

/// Timeline component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TimelineClass {
    /// `hi-timeline` - Main timeline class
    Timeline,
    /// `hi-timeline-alternate` - Alternate item positions
    Alternate,
    /// `hi-timeline-left` - Left aligned items
    Left,
    /// `hi-timeline-right` - Right aligned items
    Right,
    /// `hi-timeline-no-line` - Hide center line
    NoLine,
    /// `hi-timeline-item` - Timeline item wrapper
    Item,
    /// `hi-timeline-dot` - Timeline dot
    Dot,
    /// `hi-timeline-content` - Content wrapper
    Content,
    /// `hi-timeline-time` - Time label
    Time,
    /// `hi-timeline-title` - Title text
    Title,
    /// `hi-timeline-last` - Last item marker
    Last,
}

impl UtilityClass for TimelineClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            TimelineClass::Timeline => "timeline",
            TimelineClass::Alternate => "timeline-alternate",
            TimelineClass::Left => "timeline-left",
            TimelineClass::Right => "timeline-right",
            TimelineClass::NoLine => "timeline-no-line",
            TimelineClass::Item => "timeline-item",
            TimelineClass::Dot => "timeline-dot",
            TimelineClass::Content => "timeline-content",
            TimelineClass::Time => "timeline-time",
            TimelineClass::Title => "timeline-title",
            TimelineClass::Last => "timeline-last",
        }
    }
}

/// CodeHighlight component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CodeHighlightClass {
    /// `hi-code-highlight` - Main container
    Container,
    /// `hi-code-highlight-header` - Header with language
    Header,
    /// `hi-code-highlight-language` - Language label
    Language,
    /// `hi-code-highlight-copy` - Copy button
    CopyButton,
    /// `hi-code-highlight-content` - Content wrapper
    Content,
    /// `hi-code-highlight-line-numbers` - Line numbers column
    LineNumbers,
    /// `hi-code-highlight-line-number` - Single line number
    LineNumber,
    /// `hi-code-highlight-code` - Code block
    Code,
}

impl UtilityClass for CodeHighlightClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            CodeHighlightClass::Container => "code-highlight",
            CodeHighlightClass::Header => "code-highlight-header",
            CodeHighlightClass::Language => "code-highlight-language",
            CodeHighlightClass::CopyButton => "code-highlight-copy",
            CodeHighlightClass::Content => "code-highlight-content",
            CodeHighlightClass::LineNumbers => "code-highlight-line-numbers",
            CodeHighlightClass::LineNumber => "code-highlight-line-number",
            CodeHighlightClass::Code => "code-highlight-code",
        }
    }
}

/// VideoPlayer component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VideoPlayerClass {
    /// `hi-video-player` - Main container
    Container,
    /// `hi-video-player-video` - Video element
    Video,
}

impl UtilityClass for VideoPlayerClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            VideoPlayerClass::Container => "video-player",
            VideoPlayerClass::Video => "video-player-video",
        }
    }
}

/// AudioPlayer component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AudioPlayerClass {
    /// `hi-audio-player` - Main container
    Container,
    /// `hi-audio-player-sm` - Small size
    Sm,
    /// `hi-audio-player-md` - Medium size
    Md,
    /// `hi-audio-player-lg` - Large size
    Lg,
    /// `hi-audio-player-header` - Header section
    Header,
    /// `hi-audio-player-cover` - Cover image container
    Cover,
    /// `hi-audio-player-cover-image` - Cover image
    CoverImage,
    /// `hi-audio-player-info` - Info section
    Info,
    /// `hi-audio-player-title` - Audio title
    Title,
    /// `hi-audio-player-artist` - Artist name
    Artist,
    /// `hi-audio-player-audio` - Audio element
    Audio,
    /// `hi-audio-player-controls` - Controls section
    Controls,
    /// `hi-audio-player-play-button` - Play/pause button
    PlayButton,
    /// `hi-audio-player-progress-section` - Progress section
    ProgressSection,
    /// `hi-audio-player-progress-bar` - Progress bar
    ProgressBar,
    /// `hi-audio-player-progress-fill` - Progress fill
    ProgressFill,
    /// `hi-audio-player-time` - Time display
    Time,
    /// `hi-audio-player-volume-section` - Volume section
    VolumeSection,
    /// `hi-audio-player-volume-button` - Volume button
    VolumeButton,
}

impl UtilityClass for AudioPlayerClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            AudioPlayerClass::Container => "audio-player",
            AudioPlayerClass::Sm => "audio-player-sm",
            AudioPlayerClass::Md => "audio-player-md",
            AudioPlayerClass::Lg => "audio-player-lg",
            AudioPlayerClass::Header => "audio-player-header",
            AudioPlayerClass::Cover => "audio-player-cover",
            AudioPlayerClass::CoverImage => "audio-player-cover-image",
            AudioPlayerClass::Info => "audio-player-info",
            AudioPlayerClass::Title => "audio-player-title",
            AudioPlayerClass::Artist => "audio-player-artist",
            AudioPlayerClass::Audio => "audio-player-audio",
            AudioPlayerClass::Controls => "audio-player-controls",
            AudioPlayerClass::PlayButton => "audio-player-play-button",
            AudioPlayerClass::ProgressSection => "audio-player-progress-section",
            AudioPlayerClass::ProgressBar => "audio-player-progress-bar",
            AudioPlayerClass::ProgressFill => "audio-player-progress-fill",
            AudioPlayerClass::Time => "audio-player-time",
            AudioPlayerClass::VolumeSection => "audio-player-volume-section",
            AudioPlayerClass::VolumeButton => "audio-player-volume-button",
        }
    }
}

/// RichTextEditor component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RichTextEditorClass {
    /// `hi-rich-text-editor` - Main container
    Container,
    /// `hi-rich-text-editor-toolbar` - Toolbar
    Toolbar,
    /// `hi-rich-text-editor-toolbar-button` - Toolbar button
    ToolbarButton,
    /// `hi-rich-text-editor-editor` - Editor area
    Editor,
}

impl UtilityClass for RichTextEditorClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            RichTextEditorClass::Container => "rich-text-editor",
            RichTextEditorClass::Toolbar => "rich-text-editor-toolbar",
            RichTextEditorClass::ToolbarButton => "rich-text-editor-toolbar-button",
            RichTextEditorClass::Editor => "rich-text-editor-editor",
        }
    }
}

/// UserGuide component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum UserGuideClass {
    /// `hi-user-guide-overlay` - Overlay mask
    Overlay,
    /// `hi-user-guide-container` - Main container
    Container,
    /// `hi-user-guide-arrow` - Arrow indicator
    Arrow,
    /// `hi-user-guide-content` - Content wrapper
    Content,
    /// `hi-user-guide-header` - Header section
    Header,
    /// `hi-user-guide-title` - Step title
    Title,
    /// `hi-user-guide-counter` - Step counter
    Counter,
    /// `hi-user-guide-description` - Step description
    Description,
    /// `hi-user-guide-footer` - Footer section
    Footer,
    /// `hi-user-guide-skip-button` - Skip button
    SkipButton,
    /// `hi-user-guide-navigation` - Navigation buttons
    Navigation,
    /// `hi-user-guide-nav-button` - Navigation button
    NavButton,
    /// `hi-user-guide-primary-button` - Primary button
    PrimaryButton,
    /// `hi-user-guide-progress` - Progress dots container
    Progress,
    /// `hi-user-guide-progress-dot` - Progress dot
    ProgressDot,
    /// `hi-user-guide-progress-dot-active` - Active progress dot
    ProgressDotActive,
    /// `hi-user-guide-placement-top` - Top placement
    PlacementTop,
    /// `hi-user-guide-placement-bottom` - Bottom placement
    PlacementBottom,
    /// `hi-user-guide-placement-left` - Left placement
    PlacementLeft,
    /// `hi-user-guide-placement-right` - Right placement
    PlacementRight,
}

impl UtilityClass for UserGuideClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            UserGuideClass::Overlay => "user-guide-overlay",
            UserGuideClass::Container => "user-guide-container",
            UserGuideClass::Arrow => "user-guide-arrow",
            UserGuideClass::Content => "user-guide-content",
            UserGuideClass::Header => "user-guide-header",
            UserGuideClass::Title => "user-guide-title",
            UserGuideClass::Counter => "user-guide-counter",
            UserGuideClass::Description => "user-guide-description",
            UserGuideClass::Footer => "user-guide-footer",
            UserGuideClass::SkipButton => "user-guide-skip-button",
            UserGuideClass::Navigation => "user-guide-navigation",
            UserGuideClass::NavButton => "user-guide-nav-button",
            UserGuideClass::PrimaryButton => "user-guide-primary-button",
            UserGuideClass::Progress => "user-guide-progress",
            UserGuideClass::ProgressDot => "user-guide-progress-dot",
            UserGuideClass::ProgressDotActive => "user-guide-progress-dot-active",
            UserGuideClass::PlacementTop => "user-guide-placement-top",
            UserGuideClass::PlacementBottom => "user-guide-placement-bottom",
            UserGuideClass::PlacementLeft => "user-guide-placement-left",
            UserGuideClass::PlacementRight => "user-guide-placement-right",
        }
    }
}

/// MarkdownEditor component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MarkdownEditorClass {
    /// `hi-markdown-editor` - Main container
    Container,
    /// `hi-markdown-editor-sm` - Small size
    Sm,
    /// `hi-markdown-editor-md` - Medium size
    Md,
    /// `hi-markdown-editor-lg` - Large size
    Lg,
    /// `hi-markdown-editor-toolbar` - Toolbar
    Toolbar,
    /// `hi-markdown-editor-toolbar-button` - Toolbar button
    ToolbarButton,
    /// `hi-markdown-editor-toolbar-button-active` - Active toolbar button
    ToolbarButtonActive,
    /// `hi-markdown-editor-toolbar-divider` - Toolbar divider
    ToolbarDivider,
    /// `hi-markdown-editor-content` - Content area
    Content,
    /// `hi-markdown-editor-textarea` - Textarea
    Textarea,
    /// `hi-markdown-editor-preview` - Preview area
    Preview,
    /// `hi-markdown-editor-split-container` - Split container
    SplitContainer,
    /// `hi-markdown-editor-split-pane` - Split pane
    SplitPane,
}

impl UtilityClass for MarkdownEditorClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            MarkdownEditorClass::Container => "markdown-editor",
            MarkdownEditorClass::Sm => "markdown-editor-sm",
            MarkdownEditorClass::Md => "markdown-editor-md",
            MarkdownEditorClass::Lg => "markdown-editor-lg",
            MarkdownEditorClass::Toolbar => "markdown-editor-toolbar",
            MarkdownEditorClass::ToolbarButton => "markdown-editor-toolbar-button",
            MarkdownEditorClass::ToolbarButtonActive => "markdown-editor-toolbar-button-active",
            MarkdownEditorClass::ToolbarDivider => "markdown-editor-toolbar-divider",
            MarkdownEditorClass::Content => "markdown-editor-content",
            MarkdownEditorClass::Textarea => "markdown-editor-textarea",
            MarkdownEditorClass::Preview => "markdown-editor-preview",
            MarkdownEditorClass::SplitContainer => "markdown-editor-split-container",
            MarkdownEditorClass::SplitPane => "markdown-editor-split-pane",
        }
    }
}

/// DragLayer component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DragLayerClass {
    /// `hi-drag-layer` - Main container
    Container,
    /// `hi-drag-layer-drop-zone-overlay` - Drop zone overlay
    DropZoneOverlay,
    /// `hi-drag-layer-drop-zone` - Individual drop zone
    DropZone,
    /// `hi-drag-layer-drag-preview` - Drag preview
    DragPreview,
    /// `hi-drag-layer-drag-preview-content` - Drag preview content
    DragPreviewContent,
    /// `hi-drag-layer-drag-preview-label` - Drag preview label
    DragPreviewLabel,
    /// `hi-drag-layer-drag-preview-type` - Drag preview type
    DragPreviewType,
}

impl UtilityClass for DragLayerClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            DragLayerClass::Container => "drag-layer",
            DragLayerClass::DropZoneOverlay => "drag-layer-drop-zone-overlay",
            DragLayerClass::DropZone => "drag-layer-drop-zone",
            DragLayerClass::DragPreview => "drag-layer-drag-preview",
            DragLayerClass::DragPreviewContent => "drag-layer-drag-preview-content",
            DragLayerClass::DragPreviewLabel => "drag-layer-drag-preview-label",
            DragLayerClass::DragPreviewType => "drag-layer-drag-preview-type",
        }
    }
}

/// ZoomControls component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ZoomControlsClass {
    /// `hi-zoom-controls` - Main container
    Container,
    /// `hi-zoom-controls-button` - Button
    Button,
    /// `hi-zoom-controls-button-disabled` - Disabled button
    ButtonDisabled,
    /// `hi-zoom-controls-percentage` - Percentage display
    Percentage,
    /// `hi-zoom-controls-slider` - Slider
    Slider,
}

impl UtilityClass for ZoomControlsClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            ZoomControlsClass::Container => "zoom-controls",
            ZoomControlsClass::Button => "zoom-controls-button",
            ZoomControlsClass::ButtonDisabled => "zoom-controls-button-disabled",
            ZoomControlsClass::Percentage => "zoom-controls-percentage",
            ZoomControlsClass::Slider => "zoom-controls-slider",
        }
    }
}

/// Glow component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GlowClass {
    /// `hi-glow` - Main glow class
    Glow,
    /// `hi-glow-wrapper` - Glow wrapper
    GlowWrapper,
    /// `hi-glow-wrapper-block` - Block display mode
    GlowWrapperBlock,
    /// `hi-glow-blur-none` - No blur
    GlowBlurNone,
    /// `hi-glow-blur-light` - Light blur
    GlowBlurLight,
    /// `hi-glow-blur-medium` - Medium blur
    GlowBlurMedium,
    /// `hi-glow-blur-heavy` - Heavy blur
    GlowBlurHeavy,
    /// `hi-glow-ghost` - Ghost color
    GlowGhost,
    /// `hi-glow-primary` - Primary color
    GlowPrimary,
    /// `hi-glow-secondary` - Secondary color
    GlowSecondary,
    /// `hi-glow-danger` - Danger color
    GlowDanger,
    /// `hi-glow-success` - Success color
    GlowSuccess,
    /// `hi-glow-thirty` - 30% glow intensity (subtle)
    GlowThirty,
    /// `hi-glow-seventy` - 70% glow intensity (standard)
    GlowSeventy,
    /// `hi-glow-hundred` - 100% glow intensity (intense)
    GlowHundred,
}

impl UtilityClass for GlowClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            GlowClass::Glow => "glow",
            GlowClass::GlowWrapper => "glow-wrapper",
            GlowClass::GlowWrapperBlock => "glow-wrapper-block",
            GlowClass::GlowBlurNone => "glow-blur-none",
            GlowClass::GlowBlurLight => "glow-blur-light",
            GlowClass::GlowBlurMedium => "glow-blur-medium",
            GlowClass::GlowBlurHeavy => "glow-blur-heavy",
            GlowClass::GlowGhost => "glow-ghost",
            GlowClass::GlowPrimary => "glow-primary",
            GlowClass::GlowSecondary => "glow-secondary",
            GlowClass::GlowDanger => "glow-danger",
            GlowClass::GlowSuccess => "glow-success",
            GlowClass::GlowThirty => "glow-thirty",
            GlowClass::GlowSeventy => "glow-seventy",
            GlowClass::GlowHundred => "glow-hundred",
        }
    }
}

/// Badge component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BadgeClass {
    /// `hi-badge` - Badge
    Badge,
    /// `hi-badge-dot` - Dot badge
    Dot,
    /// `hi-badge-primary` - Primary variant
    Primary,
    /// `hi-badge-success` - Success variant
    Success,
    /// `hi-badge-warning` - Warning variant
    Warning,
    /// `hi-badge-danger` - Danger variant
    Danger,
}

impl UtilityClass for BadgeClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            BadgeClass::Badge => "badge",
            BadgeClass::Dot => "badge-dot",
            BadgeClass::Primary => "badge-primary",
            BadgeClass::Success => "badge-success",
            BadgeClass::Warning => "badge-warning",
            BadgeClass::Danger => "badge-danger",
        }
    }
}

/// Collapse component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CollapseClass {
    /// `hi-collapse-content` - Collapse content
    CollapseContent,
    /// `hi-collapse-expanded` - Expanded state
    Expanded,
    /// `hi-collapse-collapsed` - Collapsed state
    Collapsed,
    /// `hi-tree-node-children` - Tree node children
    TreeNodeChildren,
    /// `hi-tree-expanded` - Tree expanded state
    TreeExpanded,
    /// `hi-tree-collapsed` - Tree collapsed state
    TreeCollapsed,
}

impl UtilityClass for CollapseClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            CollapseClass::CollapseContent => "collapse-content",
            CollapseClass::Expanded => "collapse-expanded",
            CollapseClass::Collapsed => "collapse-collapsed",
            CollapseClass::TreeNodeChildren => "tree-node-children",
            CollapseClass::TreeExpanded => "tree-expanded",
            CollapseClass::TreeCollapsed => "tree-collapsed",
        }
    }
}

/// Cell component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CellClass {
    /// `hi-cell` - Main cell class
    Cell,
    /// `hi-cell-hover` - Hover state
    CellHover,
    /// `hi-cell-editable` - Editable state
    CellEditable,
    /// `hi-align-left` - Left aligned
    AlignLeft,
    /// `hi-align-center` - Center aligned
    AlignCenter,
    /// `hi-align-right` - Right aligned
    AlignRight,
}

impl UtilityClass for CellClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            CellClass::Cell => "cell",
            CellClass::CellHover => "cell-hover",
            CellClass::CellEditable => "cell-editable",
            CellClass::AlignLeft => "align-left",
            CellClass::AlignCenter => "align-center",
            CellClass::AlignRight => "align-right",
        }
    }
}

/// Header component classes (for table header)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TableHeaderClass {
    /// `hi-table-header` - Table header
    TableHeader,
    /// `hi-header-row` - Header row
    HeaderRow,
    /// `hi-header-cell` - Header cell
    HeaderCell,
    /// `hi-header-cell-active` - Active header cell
    HeaderCellActive,
    /// `hi-header-cell-content` - Header cell content
    HeaderCellContent,
    /// `hi-sort-indicator` - Sort indicator
    SortIndicator,
    /// `hi-filter-icon` - Filter icon
    FilterIcon,
    /// `hi-resize-handle` - Resize handle
    ResizeHandle,
}

impl UtilityClass for TableHeaderClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            TableHeaderClass::TableHeader => "table-header",
            TableHeaderClass::HeaderRow => "header-row",
            TableHeaderClass::HeaderCell => "header-cell",
            TableHeaderClass::HeaderCellActive => "header-cell-active",
            TableHeaderClass::HeaderCellContent => "header-cell-content",
            TableHeaderClass::SortIndicator => "sort-indicator",
            TableHeaderClass::FilterIcon => "filter-icon",
            TableHeaderClass::ResizeHandle => "resize-handle",
        }
    }
}

/// Tree node component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TreeNodeClass {
    /// `hi-tree-node` - Tree node
    TreeNode,
    /// `hi-tree-node-selected` - Selected node
    TreeNodeSelected,
    /// `hi-tree-node-disabled` - Disabled node
    TreeNodeDisabled,
    /// `hi-tree-node-parent` - Parent node
    TreeNodeParent,
}

impl UtilityClass for TreeNodeClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            TreeNodeClass::TreeNode => "tree-node",
            TreeNodeClass::TreeNodeSelected => "tree-node-selected",
            TreeNodeClass::TreeNodeDisabled => "tree-node-disabled",
            TreeNodeClass::TreeNodeParent => "tree-node-parent",
        }
    }
}

/// Selection component classes (expanded)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SelectionClassNew {
    /// `hi-selection-column` - Selection column
    SelectionColumn,
    /// `hi-selection-fixed` - Fixed column
    SelectionFixed,
    /// `hi-selection-header` - Selection header
    SelectionHeader,
    /// `hi-selection-all` - Select all checkbox
    SelectionAll,
    /// `hi-selection-checkbox` - Selection checkbox
    SelectionCheckbox,
    /// `hi-selection-row` - Selection row
    SelectionRow,
    /// `hi-selection-item` - Selection item
    SelectionItem,
    /// `hi-row-selection` - Row selection wrapper
    RowSelection,
    /// `hi-row-selection-label` - Row selection label
    RowSelectionLabel,
    /// `hi-row-selection-input` - Row selection input
    RowSelectionInput,
    /// `hi-row-selection-custom` - Custom checkbox/radio
    RowSelectionCustom,
    /// `hi-row-selection-checked` - Checked state
    RowSelectionChecked,
    /// `hi-row-selection-radio-dot` - Radio dot
    RowSelectionRadioDot,
}

impl UtilityClass for SelectionClassNew {
    fn as_suffix(&self) -> &'static str {
        match self {
            SelectionClassNew::SelectionColumn => "selection-column",
            SelectionClassNew::SelectionFixed => "selection-fixed",
            SelectionClassNew::SelectionHeader => "selection-header",
            SelectionClassNew::SelectionAll => "selection-all",
            SelectionClassNew::SelectionCheckbox => "selection-checkbox",
            SelectionClassNew::SelectionRow => "selection-row",
            SelectionClassNew::SelectionItem => "selection-item",
            SelectionClassNew::RowSelection => "row-selection",
            SelectionClassNew::RowSelectionLabel => "row-selection-label",
            SelectionClassNew::RowSelectionInput => "row-selection-input",
            SelectionClassNew::RowSelectionCustom => "row-selection-custom",
            SelectionClassNew::RowSelectionChecked => "row-selection-checked",
            SelectionClassNew::RowSelectionRadioDot => "row-selection-radio-dot",
        }
    }
}

/// Footer component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Footer {
    /// `hi-footer` - Main footer class
    Footer,
}

impl UtilityClass for Footer {
    fn as_suffix(&self) -> &'static str {
        match self {
            Footer::Footer => "footer",
        }
    }
}

/// Portal component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PortalClass {
    /// `hi-portal-root` - Portal root container
    PortalRoot,
}

impl UtilityClass for PortalClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            PortalClass::PortalRoot => "portal-root",
        }
    }
}

/// Modal component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModalClass {
    /// `hi-modal-overlay` - Modal overlay
    Overlay,
    /// `hi-modal-overlay-transparent` - Transparent overlay
    OverlayTransparent,
    /// `hi-modal` - Modal content container
    Modal,
    /// `hi-modal-header` - Modal header
    Header,
    /// `hi-modal-title` - Modal title
    Title,
    /// `hi-modal-close` - Modal close button
    Close,
    /// `hi-modal-body` - Modal body
    Body,
}

impl UtilityClass for ModalClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            ModalClass::Overlay => "modal-overlay",
            ModalClass::OverlayTransparent => "modal-overlay-transparent",
            ModalClass::Modal => "modal",
            ModalClass::Header => "modal-header",
            ModalClass::Title => "modal-title",
            ModalClass::Close => "modal-close",
            ModalClass::Body => "modal-body",
        }
    }
}

/// Dropdown component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DropdownClass {
    /// `hi-dropdown-overlay` - Dropdown overlay
    Overlay,
    /// `hi-dropdown-overlay-dimmed` - Dimmed overlay
    OverlayDimmed,
    /// `hi-dropdown` - Dropdown content container
    Dropdown,
}

impl UtilityClass for DropdownClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            DropdownClass::Overlay => "dropdown-overlay",
            DropdownClass::OverlayDimmed => "dropdown-overlay-dimmed",
            DropdownClass::Dropdown => "dropdown",
        }
    }
}

/// Arrow component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ArrowClass {
    /// `hi-arrow` - Main arrow class
    Arrow,
    /// `hi-arrow-right` - Points right
    ArrowRight,
    /// `hi-arrow-left` - Points left
    ArrowLeft,
    /// `hi-arrow-up` - Points up
    ArrowUp,
    /// `hi-arrow-down` - Points down
    ArrowDown,
    /// `hi-arrow-14` - Size 14px
    Size14,
    /// `hi-arrow-16` - Size 16px
    Size16,
    /// `hi-arrow-20` - Size 20px
    Size20,
}

impl UtilityClass for ArrowClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            ArrowClass::Arrow => "arrow",
            ArrowClass::ArrowRight => "arrow-right",
            ArrowClass::ArrowLeft => "arrow-left",
            ArrowClass::ArrowUp => "arrow-up",
            ArrowClass::ArrowDown => "arrow-down",
            ArrowClass::Size14 => "arrow-14",
            ArrowClass::Size16 => "arrow-16",
            ArrowClass::Size20 => "arrow-20",
        }
    }
}

/// Checkbox component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CheckboxClass {
    /// `hi-checkbox` - Main checkbox class
    Checkbox,
    /// `hi-checkbox-sm` - Small size (16px)
    Sm,
    /// `hi-checkbox-md` - Medium size (20px, default)
    Md,
    /// `hi-checkbox-lg` - Large size (24px)
    Lg,
    /// `hi-checkbox-checked` - Checked state
    Checked,
    /// `hi-checkbox-disabled` - Disabled state
    Disabled,
    /// `hi-checkbox-label` - Label wrapper
    Label,
    /// `hi-checkbox-input` - Native input
    Input,
    /// `hi-checkbox-icon` - Checkmark icon
    Icon,
    /// `hi-checkbox-text` - Label text
    Text,
}

impl UtilityClass for CheckboxClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            CheckboxClass::Checkbox => "checkbox",
            CheckboxClass::Sm => "checkbox-sm",
            CheckboxClass::Md => "checkbox-md",
            CheckboxClass::Lg => "checkbox-lg",
            CheckboxClass::Checked => "checkbox-checked",
            CheckboxClass::Disabled => "checkbox-disabled",
            CheckboxClass::Label => "checkbox-label",
            CheckboxClass::Input => "checkbox-input",
            CheckboxClass::Icon => "checkbox-icon",
            CheckboxClass::Text => "checkbox-text",
        }
    }
}

/// Radio component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RadioClass {
    /// `hi-radio-group` - Radio group container
    RadioGroup,
    /// `hi-radio-group-vertical` - Vertical layout
    RadioGroupVertical,
    /// `hi-radio-group-horizontal` - Horizontal layout
    RadioGroupHorizontal,
    /// `hi-radio-label` - Label wrapper
    Label,
    /// `hi-radio-indicator` - Custom radio indicator
    Indicator,
    /// `hi-radio-dot` - Inner dot
    Dot,
    /// `hi-radio-text` - Label text
    Text,
}

impl UtilityClass for RadioClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            RadioClass::RadioGroup => "radio-group",
            RadioClass::RadioGroupVertical => "radio-group-vertical",
            RadioClass::RadioGroupHorizontal => "radio-group-horizontal",
            RadioClass::Label => "radio-label",
            RadioClass::Indicator => "radio-indicator",
            RadioClass::Dot => "radio-dot",
            RadioClass::Text => "radio-text",
        }
    }
}

/// Switch component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SwitchClass {
    /// `hi-switch` - Main switch class
    Switch,
    /// `hi-switch-sm` - Small size
    Sm,
    /// `hi-switch-md` - Medium size (default)
    Md,
    /// `hi-switch-lg` - Large size
    Lg,
    /// `hi-switch-checked` - Checked state
    Checked,
    /// `hi-switch-disabled` - Disabled state
    Disabled,
}

impl UtilityClass for SwitchClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SwitchClass::Switch => "switch",
            SwitchClass::Sm => "switch-sm",
            SwitchClass::Md => "switch-md",
            SwitchClass::Lg => "switch-lg",
            SwitchClass::Checked => "switch-checked",
            SwitchClass::Disabled => "switch-disabled",
        }
    }
}

/// Slider component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SliderClass {
    /// `hi-slider` - Main slider class
    Slider,
    /// `hi-slider-sm` - Small size
    Sm,
    /// `hi-slider-md` - Medium size (default)
    Md,
    /// `hi-slider-lg` - Large size
    Lg,
    /// `hi-slider-disabled` - Disabled state
    Disabled,
}

impl UtilityClass for SliderClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SliderClass::Slider => "slider",
            SliderClass::Sm => "slider-sm",
            SliderClass::Md => "slider-md",
            SliderClass::Lg => "slider-lg",
            SliderClass::Disabled => "slider-disabled",
        }
    }
}

/// Select component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SelectClass {
    /// `hi-select-trigger` - Select trigger
    SelectTrigger,
    /// `hi-select-sm` - Small size
    Sm,
    /// `hi-select-md` - Medium size (default)
    Md,
    /// `hi-select-lg` - Large size
    Lg,
    /// `hi-select-disabled` - Disabled state
    Disabled,
    /// `hi-select-open` - Open state
    Open,
}

impl UtilityClass for SelectClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SelectClass::SelectTrigger => "select-trigger",
            SelectClass::Sm => "select-sm",
            SelectClass::Md => "select-md",
            SelectClass::Lg => "select-lg",
            SelectClass::Disabled => "select-disabled",
            SelectClass::Open => "select-open",
        }
    }
}

/// DatePicker component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DatePickerClass {
    /// `hi-date-picker-wrapper` - DatePicker wrapper
    DatePickerWrapper,
    /// `hi-date-picker` - DatePicker input
    DatePicker,
}

impl UtilityClass for DatePickerClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            DatePickerClass::DatePickerWrapper => "date-picker-wrapper",
            DatePickerClass::DatePicker => "date-picker",
        }
    }
}

/// FileUpload component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FileUploadClass {
    /// `hi-file-upload-wrapper` - FileUpload wrapper
    FileUploadWrapper,
    /// `hi-file-upload` - FileUpload container
    FileUpload,
    /// `hi-file-upload-idle` - Idle state
    Idle,
    /// `hi-file-upload-dragging` - Dragging state
    Dragging,
    /// `hi-file-upload-uploading` - Uploading state
    Uploading,
    /// `hi-file-upload-success` - Success state
    Success,
    /// `hi-file-upload-error` - Error state
    Error,
}

impl UtilityClass for FileUploadClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            FileUploadClass::FileUploadWrapper => "file-upload-wrapper",
            FileUploadClass::FileUpload => "file-upload",
            FileUploadClass::Idle => "file-upload-idle",
            FileUploadClass::Dragging => "file-upload-dragging",
            FileUploadClass::Uploading => "file-upload-uploading",
            FileUploadClass::Success => "file-upload-success",
            FileUploadClass::Error => "file-upload-error",
        }
    }
}

/// FormField component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FormFieldClass {
    /// `hi-form-field` - Form field wrapper
    FormField,
}

impl UtilityClass for FormFieldClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            FormFieldClass::FormField => "form-field",
        }
    }
}

/// Divider component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DividerClass {
    /// `hi-divider` - Main divider class
    Divider,
    /// `hi-divider-horizontal` - Horizontal orientation
    Horizontal,
    /// `hi-divider-vertical` - Vertical orientation
    Vertical,
    /// `hi-divider-solid` - Solid type
    Solid,
    /// `hi-divider-dashed` - Dashed type
    Dashed,
    /// `hi-divider-dotted` - Dotted type
    Dotted,
    /// `hi-divider-with-text` - Has text
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

/// Space component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SpaceClass {
    /// `hi-space` - Main space class
    Space,
    /// `hi-space-horizontal` - Horizontal direction
    Horizontal,
    /// `hi-space-vertical` - Vertical direction
    Vertical,
    /// `hi-space-wrap` - Wrap enabled
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

/// AutoComplete component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AutoCompleteClass {
    /// `hi-autocomplete-wrapper` - AutoComplete wrapper
    Wrapper,
    /// `hi-autocomplete-input` - AutoComplete input
    Input,
    /// `hi-autocomplete-clear` - Clear button
    Clear,
    /// `hi-autocomplete-dropdown` - Dropdown container
    Dropdown,
    /// `hi-autocomplete-show` - Show state
    Show,
    /// `hi-autocomplete-option` - Option item
    Option,
    /// `hi-autocomplete-option-focused` - Focused option
    OptionFocused,
}

impl UtilityClass for AutoCompleteClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            AutoCompleteClass::Wrapper => "autocomplete-wrapper",
            AutoCompleteClass::Input => "autocomplete-input",
            AutoCompleteClass::Clear => "autocomplete-clear",
            AutoCompleteClass::Dropdown => "autocomplete-dropdown",
            AutoCompleteClass::Show => "autocomplete-show",
            AutoCompleteClass::Option => "autocomplete-option",
            AutoCompleteClass::OptionFocused => "autocomplete-option-focused",
        }
    }
}

/// Cascader component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CascaderClass {
    /// `hi-cascader-wrapper` - Cascader wrapper
    Wrapper,
    /// `hi-cascader` - Main cascader class
    Cascader,
    /// `hi-cascader-sm` - Small size
    Sm,
    /// `hi-cascader-md` - Medium size
    Md,
    /// `hi-cascader-lg` - Large size
    Lg,
    /// `hi-cascader-disabled` - Disabled state
    Disabled,
    /// `hi-cascader-open` - Open state
    Open,
    /// `hi-cascader-display` - Display area
    Display,
    /// `hi-cascader-text` - Text display
    Text,
    /// `hi-cascader-clear` - Clear button
    Clear,
    /// `hi-cascader-arrow` - Arrow icon
    Arrow,
    /// `hi-cascader-dropdown` - Dropdown container
    Dropdown,
    /// `hi-cascader-menu` - Menu container
    Menu,
    /// `hi-cascader-menu-list` - Menu list
    MenuList,
    /// `hi-cascader-menu-item` - Menu item
    MenuItem,
    /// `hi-cascader-menu-item-selected` - Selected menu item
    MenuItemSelected,
    /// `hi-cascader-menu-item-disabled` - Disabled menu item
    MenuItemDisabled,
    /// `hi-cascader-menu-item-arrow` - Menu item arrow
    MenuItemArrow,
}

impl UtilityClass for CascaderClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            CascaderClass::Wrapper => "cascader-wrapper",
            CascaderClass::Cascader => "cascader",
            CascaderClass::Sm => "cascader-sm",
            CascaderClass::Md => "cascader-md",
            CascaderClass::Lg => "cascader-lg",
            CascaderClass::Disabled => "cascader-disabled",
            CascaderClass::Open => "cascader-open",
            CascaderClass::Display => "cascader-display",
            CascaderClass::Text => "cascader-text",
            CascaderClass::Clear => "cascader-clear",
            CascaderClass::Arrow => "cascader-arrow",
            CascaderClass::Dropdown => "cascader-dropdown",
            CascaderClass::Menu => "cascader-menu",
            CascaderClass::MenuList => "cascader-menu-list",
            CascaderClass::MenuItem => "cascader-menu-item",
            CascaderClass::MenuItemSelected => "cascader-menu-item-selected",
            CascaderClass::MenuItemDisabled => "cascader-menu-item-disabled",
            CascaderClass::MenuItemArrow => "cascader-menu-item-arrow",
        }
    }
}

/// NumberInput component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NumberInputClass {
    /// `hi-number-input-wrapper` - NumberInput wrapper
    Wrapper,
    /// `hi-number-input-button` - Increment/decrement button
    Button,
    /// `hi-number-input-input` - Number input field
    Input,
}

impl UtilityClass for NumberInputClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            NumberInputClass::Wrapper => "number-input-wrapper",
            NumberInputClass::Button => "number-input-button",
            NumberInputClass::Input => "number-input-input",
        }
    }
}

/// Search component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SearchClass {
    /// `hi-search-wrapper` - Search wrapper
    Wrapper,
    /// `hi-search-input` - Search input
    Input,
    /// `hi-search-clear` - Clear button
    Clear,
    /// `hi-search-loading` - Loading indicator
    Loading,
}

impl UtilityClass for SearchClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SearchClass::Wrapper => "search-wrapper",
            SearchClass::Input => "search-input",
            SearchClass::Clear => "search-clear",
            SearchClass::Loading => "search-loading",
        }
    }
}

/// Transfer component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TransferClass {
    /// `hi-transfer` - Main transfer class
    Transfer,
    /// `hi-transfer-operations` - Operations container
    Operations,
    /// `hi-transfer-operation` - Single operation button
    Operation,
    /// `hi-transfer-panel` - Transfer panel
    Panel,
    /// `hi-transfer-panel-header` - Panel header
    PanelHeader,
    /// `hi-transfer-panel-checkbox` - Panel checkbox
    PanelCheckbox,
    /// `hi-transfer-panel-title` - Panel title
    PanelTitle,
    /// `hi-transfer-panel-count` - Panel count
    PanelCount,
    /// `hi-transfer-panel-search` - Panel search
    PanelSearch,
    /// `hi-transfer-panel-input` - Panel input
    PanelInput,
    /// `hi-transfer-panel-list` - Panel list
    PanelList,
    /// `hi-transfer-panel-item` - Panel item
    PanelItem,
    /// `hi-transfer-panel-item-selected` - Selected item
    PanelItemSelected,
    /// `hi-transfer-panel-item-disabled` - Disabled item
    PanelItemDisabled,
    /// `hi-transfer-panel-empty` - Empty state
    PanelEmpty,
    /// `hi-transfer-item-checkbox` - Item checkbox
    ItemCheckbox,
    /// `hi-transfer-item-label` - Item label
    ItemLabel,
}

impl UtilityClass for TransferClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            TransferClass::Transfer => "transfer",
            TransferClass::Operations => "transfer-operations",
            TransferClass::Operation => "transfer-operation",
            TransferClass::Panel => "transfer-panel",
            TransferClass::PanelHeader => "transfer-panel-header",
            TransferClass::PanelCheckbox => "transfer-panel-checkbox",
            TransferClass::PanelTitle => "transfer-panel-title",
            TransferClass::PanelCount => "transfer-panel-count",
            TransferClass::PanelSearch => "transfer-panel-search",
            TransferClass::PanelInput => "transfer-panel-input",
            TransferClass::PanelList => "transfer-panel-list",
            TransferClass::PanelItem => "transfer-panel-item",
            TransferClass::PanelItemSelected => "transfer-panel-item-selected",
            TransferClass::PanelItemDisabled => "transfer-panel-item-disabled",
            TransferClass::PanelEmpty => "transfer-panel-empty",
            TransferClass::ItemCheckbox => "transfer-item-checkbox",
            TransferClass::ItemLabel => "transfer-item-label",
        }
    }
}

// ============================================================================
// Display Component Classes (Phase 4)
// ============================================================================

/// Tag component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TagClass {
    /// `hi-tag` - Main tag class
    Tag,
    /// `hi-tag-default` - Default variant
    Default,
    /// `hi-tag-primary` - Primary variant
    Primary,
    /// `hi-tag-success` - Success variant
    Success,
    /// `hi-tag-warning` - Warning variant
    Warning,
    /// `hi-tag-danger` - Danger variant
    Danger,
    /// `hi-tag-info` - Info variant
    Info,
    /// `hi-tag-close` - Close button
    Close,
}

impl UtilityClass for TagClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            TagClass::Tag => "tag",
            TagClass::Default => "tag-default",
            TagClass::Primary => "tag-primary",
            TagClass::Success => "tag-success",
            TagClass::Warning => "tag-warning",
            TagClass::Danger => "tag-danger",
            TagClass::Info => "tag-info",
            TagClass::Close => "tag-close",
        }
    }
}

/// DescriptionList component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DescriptionListClass {
    /// `hi-description-list` - Main container
    List,
    /// `hi-description-list-term` - Term/label
    Term,
    /// `hi-description-list-detail` - Detail/value
    Detail,
}

impl UtilityClass for DescriptionListClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            DescriptionListClass::List => "description-list",
            DescriptionListClass::Term => "description-list-term",
            DescriptionListClass::Detail => "description-list-detail",
        }
    }
}

/// Empty component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EmptyClass {
    /// `hi-empty-container` - Main container
    Container,
    /// `hi-empty-image` - Image wrapper
    Image,
    /// `hi-empty-img` - Image element
    Img,
    /// `hi-empty-title` - Title text
    Title,
    /// `hi-empty-description` - Description text
    Description,
    /// `hi-empty-action` - Action area
    Action,
}

impl UtilityClass for EmptyClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            EmptyClass::Container => "empty-container",
            EmptyClass::Image => "empty-image",
            EmptyClass::Img => "empty-img",
            EmptyClass::Title => "empty-title",
            EmptyClass::Description => "empty-description",
            EmptyClass::Action => "empty-action",
        }
    }
}

/// QRCode component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum QRCodeClass {
    /// `hi-qrcode-container` - Main container
    Container,
    /// `hi-qrcode-title` - Title text
    Title,
    /// `hi-qrcode-wrapper` - QR code wrapper
    Wrapper,
    /// `hi-qrcode-image` - QR code image
    Image,
}

impl UtilityClass for QRCodeClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            QRCodeClass::Container => "qrcode-container",
            QRCodeClass::Title => "qrcode-title",
            QRCodeClass::Wrapper => "qrcode-wrapper",
            QRCodeClass::Image => "qrcode-image",
        }
    }
}

// ============================================================================
// Layout Component Classes (Phase 5)
// ============================================================================

/// AppLayout component classes (extends Layout)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AppLayoutClass {
    /// `hi-layout-body` - Body container
    Body,
    /// `hi-layout-main` - Main content area
    Main,
    /// `hi-layout-content` - Content wrapper
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

// ============================================================================
// Feedback Component Classes (Phase 6)
// ============================================================================

/// Drawer component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DrawerClass {
    /// `hi-drawer` - Main drawer class
    Drawer,
    /// `hi-drawer-mask` - Mask overlay
    Mask,
    /// `hi-drawer-right` - Right placement
    Right,
    /// `hi-drawer-left` - Left placement
    Left,
    /// `hi-drawer-top` - Top placement
    Top,
    /// `hi-drawer-bottom` - Bottom placement
    Bottom,
    /// `hi-drawer-header` - Header section
    Header,
    /// `hi-drawer-title` - Title text
    Title,
    /// `hi-drawer-close` - Close button
    Close,
    /// `hi-drawer-body` - Body content
    Body,
    /// `hi-drawer-footer` - Footer section
    Footer,
}

impl UtilityClass for DrawerClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            DrawerClass::Drawer => "drawer",
            DrawerClass::Mask => "drawer-mask",
            DrawerClass::Right => "drawer-right",
            DrawerClass::Left => "drawer-left",
            DrawerClass::Top => "drawer-top",
            DrawerClass::Bottom => "drawer-bottom",
            DrawerClass::Header => "drawer-header",
            DrawerClass::Title => "drawer-title",
            DrawerClass::Close => "drawer-close",
            DrawerClass::Body => "drawer-body",
            DrawerClass::Footer => "drawer-footer",
        }
    }
}

/// Popover component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PopoverClass {
    /// `hi-popover` - Main popover class
    Popover,
    /// `hi-popover-title` - Title text
    Title,
    /// `hi-popover-content` - Content area
    Content,
}

impl UtilityClass for PopoverClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            PopoverClass::Popover => "popover",
            PopoverClass::Title => "popover-title",
            PopoverClass::Content => "popover-content",
        }
    }
}

/// Progress component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProgressClass {
    /// `hi-progress-wrapper` - Progress wrapper
    Wrapper,
    /// `hi-progress` - Main progress class
    Progress,
    /// `hi-progress-linear` - Linear type
    Linear,
    /// `hi-progress-circular` - Circular type
    Circular,
    /// `hi-progress-normal` - Normal status
    Normal,
    /// `hi-progress-active` - Active status
    Active,
    /// `hi-progress-exception` - Exception status
    Exception,
    /// `hi-progress-success` - Success status
    Success,
    /// `hi-progress-info` - Info text
    Info,
    /// `hi-progress-circle` - Circle SVG
    Circle,
}

impl UtilityClass for ProgressClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            ProgressClass::Wrapper => "progress-wrapper",
            ProgressClass::Progress => "progress",
            ProgressClass::Linear => "progress-linear",
            ProgressClass::Circular => "progress-circular",
            ProgressClass::Normal => "progress-normal",
            ProgressClass::Active => "progress-active",
            ProgressClass::Exception => "progress-exception",
            ProgressClass::Success => "progress-success",
            ProgressClass::Info => "progress-info",
            ProgressClass::Circle => "progress-circle",
        }
    }
}

/// Skeleton component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SkeletonClass {
    /// `hi-skeleton-wrapper` - Skeleton wrapper
    Wrapper,
    /// `hi-skeleton` - Base skeleton class
    Skeleton,
    /// `hi-skeleton-active` - Animation active
    Active,
    /// `hi-skeleton-text` - Text shape
    Text,
    /// `hi-skeleton-avatar` - Avatar shape
    Avatar,
    /// `hi-skeleton-image` - Image shape
    Image,
    /// `hi-skeleton-button` - Button shape
    Button,
    /// `hi-skeleton-input` - Input shape
    Input,
    /// `hi-skeleton-rect` - Rect shape
    Rect,
}

impl UtilityClass for SkeletonClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SkeletonClass::Wrapper => "skeleton-wrapper",
            SkeletonClass::Skeleton => "skeleton",
            SkeletonClass::Active => "skeleton-active",
            SkeletonClass::Text => "skeleton-text",
            SkeletonClass::Avatar => "skeleton-avatar",
            SkeletonClass::Image => "skeleton-image",
            SkeletonClass::Button => "skeleton-button",
            SkeletonClass::Input => "skeleton-input",
            SkeletonClass::Rect => "skeleton-rect",
        }
    }
}

/// Spin component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SpinClass {
    /// `hi-spin` - Main spin class
    Spin,
    /// `hi-spin-sm` - Small size
    Sm,
    /// `hi-spin-md` - Medium size
    Md,
    /// `hi-spin-lg` - Large size
    Lg,
    /// `hi-spin-stopped` - Stopped state
    Stopped,
    /// `hi-spin-spinner` - Spinner element
    Spinner,
    /// `hi-spin-tip` - Tip text
    Tip,
}

impl UtilityClass for SpinClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SpinClass::Spin => "spin",
            SpinClass::Sm => "spin-sm",
            SpinClass::Md => "spin-md",
            SpinClass::Lg => "spin-lg",
            SpinClass::Stopped => "spin-stopped",
            SpinClass::Spinner => "spin-spinner",
            SpinClass::Tip => "spin-tip",
        }
    }
}

// ============================================================================
// Navigation Component Classes (Phase 7)
// ============================================================================

/// Anchor component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnchorClass {
    /// `hi-anchor-wrapper` - Anchor wrapper
    Wrapper,
    /// `hi-anchor-link` - Anchor link
    Link,
    /// `hi-anchor-active` - Active state
    Active,
    /// `hi-anchor-left` - Left position
    Left,
    /// `hi-anchor-right` - Right position
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

/// Steps component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StepsClass {
    /// `hi-steps-wrapper` - Steps wrapper
    Wrapper,
    /// `hi-steps-horizontal` - Horizontal direction
    Horizontal,
    /// `hi-steps-vertical` - Vertical direction
    Vertical,
    /// `hi-step-item` - Step item
    Item,
    /// `hi-step-wait` - Wait status
    Wait,
    /// `hi-step-process` - Process status
    Process,
    /// `hi-step-finish` - Finish status
    Finish,
    /// `hi-step-error` - Error status
    Error,
    /// `hi-step-icon` - Icon container
    Icon,
    /// `hi-step-number` - Number indicator
    Number,
    /// `hi-step-content` - Content area
    Content,
    /// `hi-step-title` - Title text
    Title,
    /// `hi-step-description` - Description text
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
