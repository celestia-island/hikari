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
}

impl UtilityClass for MenuClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            MenuClass::Menu => "menu",
            MenuClass::Inline => "menu-inline",
            MenuClass::Submenu => "menu-submenu",
            MenuClass::SubmenuArrowOpen => "menu-submenu-arrow-open",
            MenuClass::SubmenuListOpen => "menu-submenu-list-open",
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
    /// `hi-card-extra` - Extra content
    CardExtra,
    /// `hi-card-body` - Card body
    CardBody,
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
            CardClass::CardExtra => "card-extra",
            CardClass::CardBody => "card-body",
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

/// Glow component classes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GlowClass {
    /// `hi-glow` - Main glow class
    Glow,
    /// `hi-glow-wrapper` - Glow wrapper
    GlowWrapper,
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
    /// `hi-glow-subtle` - Subtle intensity
    GlowSubtle,
    /// `hi-glow-standard` - Standard intensity
    GlowStandard,
    /// `hi-glow-intense` - Intense intensity
    GlowIntense,
}

impl UtilityClass for GlowClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            GlowClass::Glow => "glow",
            GlowClass::GlowWrapper => "glow-wrapper",
            GlowClass::GlowBlurNone => "glow-blur-none",
            GlowClass::GlowBlurLight => "glow-blur-light",
            GlowClass::GlowBlurMedium => "glow-blur-medium",
            GlowClass::GlowBlurHeavy => "glow-blur-heavy",
            GlowClass::GlowGhost => "glow-ghost",
            GlowClass::GlowPrimary => "glow-primary",
            GlowClass::GlowSecondary => "glow-secondary",
            GlowClass::GlowDanger => "glow-danger",
            GlowClass::GlowSuccess => "glow-success",
            GlowClass::GlowSubtle => "glow-subtle",
            GlowClass::GlowStandard => "glow-standard",
            GlowClass::GlowIntense => "glow-intense",
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
}

impl UtilityClass for BadgeClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            BadgeClass::Badge => "badge",
            BadgeClass::Dot => "badge-dot",
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
