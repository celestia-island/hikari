//! Data component classes (Table, Pagination, Tree, etc.)

use serde::{Deserialize, Serialize};

use crate::classes::UtilityClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TableClass {
    Table,
    TableSm,
    TableMd,
    TableLg,
    TableBordered,
    TableStriped,
    TableHover,
    TableWrapper,
    TableHeaderCell,
    TableCell,
    TableHeaderRow,
    TableBody,
    TableRow,
    TableEmpty,
    TableEmptyContent,
    TableSortable,
    TableSortIcon,
    TableSortActive,
    TextLeft,
    TextCenter,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TableHeaderClass {
    TableHeader,
    HeaderRow,
    HeaderCell,
    HeaderCellActive,
    HeaderCellContent,
    SortIndicator,
    FilterIcon,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CellClass {
    Cell,
    CellHover,
    CellEditable,
    AlignLeft,
    AlignCenter,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SortClass {
    Sort,
    SortButton,
    SortActive,
    SortClear,
    SortTitle,
    SortIndicator,
    SortClearText,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PaginationClass {
    Pagination,
    PaginationTotal,
    PaginationSizer,
    PaginationPages,
    PaginationPrev,
    PaginationNext,
    PaginationEllipsis,
    PaginationItem,
    PaginationActive,
    PaginationJump,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FilterClass {
    Filter,
    FilterContainer,
    FilterTrigger,
    FilterActive,
    FilterIcon,
    FilterBadge,
    FilterDropdownIcon,
    FilterDropdown,
    FilterHeader,
    FilterTitle,
    FilterClearBtn,
    FilterOptions,
    FilterOption,
    FilterCheckbox,
    FilterLabel,
    FilterFooter,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SelectionClassNew {
    SelectionColumn,
    SelectionFixed,
    SelectionHeader,
    SelectionAll,
    SelectionCheckbox,
    SelectionRow,
    SelectionItem,
    RowSelection,
    RowSelectionLabel,
    RowSelectionInput,
    RowSelectionCustom,
    RowSelectionChecked,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TreeClass {
    DragNode,
    VirtualTree,
    NodeDisabled,
    Dragging,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TreeLabelClass {
    TreeNodeLabel,
}

impl UtilityClass for TreeLabelClass {
    fn as_suffix(&self) -> &'static str {
        "tree-node-label"
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DragDropTreeClass {
    DragDropTree,
}

impl UtilityClass for DragDropTreeClass {
    fn as_suffix(&self) -> &'static str {
        "drag-drop-tree"
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VirtualScrollClass {
    VirtualTree,
}

impl UtilityClass for VirtualScrollClass {
    fn as_suffix(&self) -> &'static str {
        "virtual-tree"
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TreeNodeClass {
    TreeNode,
    TreeNodeSelected,
    TreeNodeDisabled,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CollapseClass {
    CollapseContent,
    Expanded,
    Collapsed,
    TreeNodeChildren,
    TreeExpanded,
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
