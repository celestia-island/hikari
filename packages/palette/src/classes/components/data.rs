//! Data component classes (Table, Pagination, Tree, etc.)

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

impl TypedClass for TableClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Table => "hi-table",
            Self::TableSm => "hi-table-sm",
            Self::TableMd => "hi-table-md",
            Self::TableLg => "hi-table-lg",
            Self::TableBordered => "hi-table-bordered",
            Self::TableStriped => "hi-table-striped",
            Self::TableHover => "hi-table-hover",
            Self::TableWrapper => "hi-table-wrapper",
            Self::TableHeaderCell => "hi-table-header-cell",
            Self::TableCell => "hi-table-cell",
            Self::TableHeaderRow => "hi-table-header-row",
            Self::TableBody => "hi-table-body",
            Self::TableRow => "hi-table-row",
            Self::TableEmpty => "hi-table-empty",
            Self::TableEmptyContent => "hi-table-empty-content",
            Self::TableSortable => "hi-table-sortable",
            Self::TableSortIcon => "hi-table-sort-icon",
            Self::TableSortActive => "hi-table-sort-active",
            Self::TextLeft => "hi-text-left",
            Self::TextCenter => "hi-text-center",
            Self::TextRight => "hi-text-right",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

impl TypedClass for TableHeaderClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::TableHeader => "hi-table-header",
            Self::HeaderRow => "hi-header-row",
            Self::HeaderCell => "hi-header-cell",
            Self::HeaderCellActive => "hi-header-cell-active",
            Self::HeaderCellContent => "hi-header-cell-content",
            Self::SortIndicator => "hi-sort-indicator",
            Self::FilterIcon => "hi-filter-icon",
            Self::ResizeHandle => "hi-resize-handle",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CellClass {
    Cell,
    CellHover,
    CellEditable,
    AlignLeft,
    AlignCenter,
    AlignRight,
}

impl TypedClass for CellClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Cell => "hi-cell",
            Self::CellHover => "hi-cell-hover",
            Self::CellEditable => "hi-cell-editable",
            Self::AlignLeft => "hi-align-left",
            Self::AlignCenter => "hi-align-center",
            Self::AlignRight => "hi-align-right",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SortClass {
    Sort,
    SortButton,
    SortActive,
    SortClear,
    SortTitle,
    SortIndicator,
    SortClearText,
    SortClearIcon,
    Asc,
    Desc,
}

impl TypedClass for SortClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Sort => "hi-sort",
            Self::SortButton => "hi-sort-button",
            Self::SortActive => "hi-sort-active",
            Self::SortClear => "hi-sort-clear",
            Self::SortTitle => "hi-sort-title",
            Self::SortIndicator => "hi-sort-indicator",
            Self::SortClearText => "hi-sort-clear-text",
            Self::SortClearIcon => "hi-sort-clear-icon",
            Self::Asc => "hi-sort-asc",
            Self::Desc => "hi-sort-desc",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

impl TypedClass for PaginationClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Pagination => "hi-pagination",
            Self::PaginationTotal => "hi-pagination-total",
            Self::PaginationSizer => "hi-pagination-sizer",
            Self::PaginationPages => "hi-pagination-pages",
            Self::PaginationPrev => "hi-pagination-prev",
            Self::PaginationNext => "hi-pagination-next",
            Self::PaginationEllipsis => "hi-pagination-ellipsis",
            Self::PaginationItem => "hi-pagination-item",
            Self::PaginationActive => "hi-pagination-active",
            Self::PaginationJump => "hi-pagination-jump",
            Self::PaginationJumpLabel => "hi-pagination-jump-label",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

impl TypedClass for FilterClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Filter => "hi-filter",
            Self::FilterContainer => "hi-filter-container",
            Self::FilterTrigger => "hi-filter-trigger",
            Self::FilterActive => "hi-filter-active",
            Self::FilterIcon => "hi-filter-icon",
            Self::FilterBadge => "hi-filter-badge",
            Self::FilterDropdownIcon => "hi-filter-dropdown-icon",
            Self::FilterDropdown => "hi-filter-dropdown",
            Self::FilterHeader => "hi-filter-header",
            Self::FilterTitle => "hi-filter-title",
            Self::FilterClearBtn => "hi-filter-clear-btn",
            Self::FilterOptions => "hi-filter-options",
            Self::FilterOption => "hi-filter-option",
            Self::FilterCheckbox => "hi-filter-checkbox",
            Self::FilterLabel => "hi-filter-label",
            Self::FilterFooter => "hi-filter-footer",
            Self::FilterHint => "hi-filter-hint",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SelectionClass {
    Selection,
    RowSelection,
}

impl TypedClass for SelectionClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Selection => "hi-selection",
            Self::RowSelection => "hi-row-selection",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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
    RadioGroup,
}

impl TypedClass for SelectionClassNew {
    fn class_name(&self) -> &'static str {
        match self {
            Self::SelectionColumn => "hi-selection-column",
            Self::SelectionFixed => "hi-selection-fixed",
            Self::SelectionHeader => "hi-selection-header",
            Self::SelectionAll => "hi-selection-all",
            Self::SelectionCheckbox => "hi-selection-checkbox",
            Self::SelectionRow => "hi-selection-row",
            Self::SelectionItem => "hi-selection-item",
            Self::RowSelection => "hi-row-selection",
            Self::RowSelectionLabel => "hi-row-selection-label",
            Self::RowSelectionInput => "hi-row-selection-input",
            Self::RowSelectionCustom => "hi-row-selection-custom",
            Self::RowSelectionChecked => "hi-row-selection-checked",
            Self::RowSelectionRadioDot => "hi-row-selection-radio-dot",
            Self::RadioGroup => "hi-selection-radio-group",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ColumnClass {
    Fixed,
    Sortable,
    Resizable,
}

impl TypedClass for ColumnClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Fixed => "hi-column-fixed",
            Self::Sortable => "hi-column-sortable",
            Self::Resizable => "hi-column-resizable",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TreeClass {
    DragNode,
    VirtualTree,
    NodeDisabled,
    Dragging,
    DragOver,
    ShowLine,
}

impl TypedClass for TreeClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::DragNode => "hi-drag-node",
            Self::VirtualTree => "hi-virtual-tree",
            Self::NodeDisabled => "hi-tree-node-disabled",
            Self::Dragging => "hi-dragging",
            Self::DragOver => "hi-drag-over",
            Self::ShowLine => "hi-tree-show-line",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TreeClassNew {
    TreeContainer,
    Tree,
}

impl TypedClass for TreeClassNew {
    fn class_name(&self) -> &'static str {
        match self {
            Self::TreeContainer => "hi-tree-container",
            Self::Tree => "hi-tree",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TreeLabelClass {
    TreeNodeLabel,
}

impl TypedClass for TreeLabelClass {
    fn class_name(&self) -> &'static str {
        "hi-tree-node-label"
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DragDropTreeClass {
    DragDropTree,
    DragNode,
    Dragging,
    DragOver,
    NodeDisabled,
    DropIndicator,
    DragHandle,
    DragHandleIcon,
    NodeContent,
    DragGhost,
    DropLine,
    NodeChildren,
}

impl TypedClass for DragDropTreeClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::DragDropTree => "hi-drag-drop-tree",
            Self::DragNode => "hi-drag-node",
            Self::Dragging => "hi-drag-node-dragging",
            Self::DragOver => "hi-drag-node-drag-over",
            Self::NodeDisabled => "hi-drag-node-disabled",
            Self::DropIndicator => "hi-drop-indicator",
            Self::DragHandle => "hi-drag-handle",
            Self::DragHandleIcon => "hi-drag-handle-icon",
            Self::NodeContent => "hi-node-content",
            Self::DragGhost => "hi-drag-ghost",
            Self::DropLine => "hi-drop-line",
            Self::NodeChildren => "hi-node-children",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VirtualScrollClass {
    VirtualTree,
    NodeDisabled,
    Viewport,
}

impl TypedClass for VirtualScrollClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::VirtualTree => "hi-virtual-tree",
            Self::NodeDisabled => "hi-tree-node-disabled",
            Self::Viewport => "hi-virtual-tree-viewport",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TreeNodeClass {
    TreeNode,
    TreeNodeSelected,
    TreeNodeDisabled,
    TreeNodeParent,
    NodeContent,
    NodeIcon,
    NodeArrow,
    NodeArrowPlaceholder,
    NodeArrowExpanded,
    NodeDisabled,
}

impl TypedClass for TreeNodeClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::TreeNode => "hi-tree-node",
            Self::TreeNodeSelected => "hi-tree-node-selected",
            Self::TreeNodeDisabled => "hi-tree-node-disabled",
            Self::TreeNodeParent => "hi-tree-node-parent",
            Self::NodeContent => "hi-tree-node-content",
            Self::NodeIcon => "hi-tree-node-icon",
            Self::NodeArrow => "hi-tree-node-arrow",
            Self::NodeArrowPlaceholder => "hi-tree-node-arrow-placeholder",
            Self::NodeArrowExpanded => "hi-tree-node-arrow-expanded",
            Self::NodeDisabled => "hi-tree-node-disabled",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CollapseClass {
    CollapseContent,
    Expanded,
    Collapsed,
    TreeNodeChildren,
    TreeExpanded,
    TreeCollapsed,
    Collapse,
    Header,
    Arrow,
    HeaderContent,
    Inner,
}

impl TypedClass for CollapseClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::CollapseContent => "hi-collapse-content",
            Self::Expanded => "hi-collapse-expanded",
            Self::Collapsed => "hi-collapse-collapsed",
            Self::TreeNodeChildren => "hi-tree-node-children",
            Self::TreeExpanded => "hi-tree-expanded",
            Self::TreeCollapsed => "hi-tree-collapsed",
            Self::Collapse => "hi-collapse",
            Self::Header => "hi-collapse-header",
            Self::Arrow => "hi-collapse-arrow",
            Self::HeaderContent => "hi-collapse-header-content",
            Self::Inner => "hi-collapse-inner",
        }
    }
}
