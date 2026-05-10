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
            TableClass::Table => "hi-table",
            TableClass::TableSm => "hi-table-sm",
            TableClass::TableMd => "hi-table-md",
            TableClass::TableLg => "hi-table-lg",
            TableClass::TableBordered => "hi-table-bordered",
            TableClass::TableStriped => "hi-table-striped",
            TableClass::TableHover => "hi-table-hover",
            TableClass::TableWrapper => "hi-table-wrapper",
            TableClass::TableHeaderCell => "hi-table-header-cell",
            TableClass::TableCell => "hi-table-cell",
            TableClass::TableHeaderRow => "hi-table-header-row",
            TableClass::TableBody => "hi-table-body",
            TableClass::TableRow => "hi-table-row",
            TableClass::TableEmpty => "hi-table-empty",
            TableClass::TableEmptyContent => "hi-table-empty-content",
            TableClass::TableSortable => "hi-table-sortable",
            TableClass::TableSortIcon => "hi-table-sort-icon",
            TableClass::TableSortActive => "hi-table-sort-active",
            TableClass::TextLeft => "hi-text-left",
            TableClass::TextCenter => "hi-text-center",
            TableClass::TextRight => "hi-text-right",
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
            TableHeaderClass::TableHeader => "hi-table-header",
            TableHeaderClass::HeaderRow => "hi-header-row",
            TableHeaderClass::HeaderCell => "hi-header-cell",
            TableHeaderClass::HeaderCellActive => "hi-header-cell-active",
            TableHeaderClass::HeaderCellContent => "hi-header-cell-content",
            TableHeaderClass::SortIndicator => "hi-sort-indicator",
            TableHeaderClass::FilterIcon => "hi-filter-icon",
            TableHeaderClass::ResizeHandle => "hi-resize-handle",
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
            CellClass::Cell => "hi-cell",
            CellClass::CellHover => "hi-cell-hover",
            CellClass::CellEditable => "hi-cell-editable",
            CellClass::AlignLeft => "hi-align-left",
            CellClass::AlignCenter => "hi-align-center",
            CellClass::AlignRight => "hi-align-right",
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
            SortClass::Sort => "hi-sort",
            SortClass::SortButton => "hi-sort-button",
            SortClass::SortActive => "hi-sort-active",
            SortClass::SortClear => "hi-sort-clear",
            SortClass::SortTitle => "hi-sort-title",
            SortClass::SortIndicator => "hi-sort-indicator",
            SortClass::SortClearText => "hi-sort-clear-text",
            SortClass::SortClearIcon => "hi-sort-clear-icon",
            SortClass::Asc => "hi-sort-asc",
            SortClass::Desc => "hi-sort-desc",
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
            PaginationClass::Pagination => "hi-pagination",
            PaginationClass::PaginationTotal => "hi-pagination-total",
            PaginationClass::PaginationSizer => "hi-pagination-sizer",
            PaginationClass::PaginationPages => "hi-pagination-pages",
            PaginationClass::PaginationPrev => "hi-pagination-prev",
            PaginationClass::PaginationNext => "hi-pagination-next",
            PaginationClass::PaginationEllipsis => "hi-pagination-ellipsis",
            PaginationClass::PaginationItem => "hi-pagination-item",
            PaginationClass::PaginationActive => "hi-pagination-active",
            PaginationClass::PaginationJump => "hi-pagination-jump",
            PaginationClass::PaginationJumpLabel => "hi-pagination-jump-label",
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
            FilterClass::Filter => "hi-filter",
            FilterClass::FilterContainer => "hi-filter-container",
            FilterClass::FilterTrigger => "hi-filter-trigger",
            FilterClass::FilterActive => "hi-filter-active",
            FilterClass::FilterIcon => "hi-filter-icon",
            FilterClass::FilterBadge => "hi-filter-badge",
            FilterClass::FilterDropdownIcon => "hi-filter-dropdown-icon",
            FilterClass::FilterDropdown => "hi-filter-dropdown",
            FilterClass::FilterHeader => "hi-filter-header",
            FilterClass::FilterTitle => "hi-filter-title",
            FilterClass::FilterClearBtn => "hi-filter-clear-btn",
            FilterClass::FilterOptions => "hi-filter-options",
            FilterClass::FilterOption => "hi-filter-option",
            FilterClass::FilterCheckbox => "hi-filter-checkbox",
            FilterClass::FilterLabel => "hi-filter-label",
            FilterClass::FilterFooter => "hi-filter-footer",
            FilterClass::FilterHint => "hi-filter-hint",
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
            SelectionClass::Selection => "hi-selection",
            SelectionClass::RowSelection => "hi-row-selection",
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
            SelectionClassNew::SelectionColumn => "hi-selection-column",
            SelectionClassNew::SelectionFixed => "hi-selection-fixed",
            SelectionClassNew::SelectionHeader => "hi-selection-header",
            SelectionClassNew::SelectionAll => "hi-selection-all",
            SelectionClassNew::SelectionCheckbox => "hi-selection-checkbox",
            SelectionClassNew::SelectionRow => "hi-selection-row",
            SelectionClassNew::SelectionItem => "hi-selection-item",
            SelectionClassNew::RowSelection => "hi-row-selection",
            SelectionClassNew::RowSelectionLabel => "hi-row-selection-label",
            SelectionClassNew::RowSelectionInput => "hi-row-selection-input",
            SelectionClassNew::RowSelectionCustom => "hi-row-selection-custom",
            SelectionClassNew::RowSelectionChecked => "hi-row-selection-checked",
            SelectionClassNew::RowSelectionRadioDot => "hi-row-selection-radio-dot",
            SelectionClassNew::RadioGroup => "hi-selection-radio-group",
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
            TreeClass::DragNode => "hi-drag-node",
            TreeClass::VirtualTree => "hi-virtual-tree",
            TreeClass::NodeDisabled => "hi-tree-node-disabled",
            TreeClass::Dragging => "hi-dragging",
            TreeClass::DragOver => "hi-drag-over",
            TreeClass::ShowLine => "hi-tree-show-line",
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
            TreeClassNew::TreeContainer => "hi-tree-container",
            TreeClassNew::Tree => "hi-tree",
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
            DragDropTreeClass::DragDropTree => "hi-drag-drop-tree",
            DragDropTreeClass::DragNode => "hi-drag-node",
            DragDropTreeClass::Dragging => "hi-drag-node-dragging",
            DragDropTreeClass::DragOver => "hi-drag-node-drag-over",
            DragDropTreeClass::NodeDisabled => "hi-drag-node-disabled",
            DragDropTreeClass::DropIndicator => "hi-drop-indicator",
            DragDropTreeClass::DragHandle => "hi-drag-handle",
            DragDropTreeClass::DragHandleIcon => "hi-drag-handle-icon",
            DragDropTreeClass::NodeContent => "hi-node-content",
            DragDropTreeClass::DragGhost => "hi-drag-ghost",
            DragDropTreeClass::DropLine => "hi-drop-line",
            DragDropTreeClass::NodeChildren => "hi-node-children",
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
            VirtualScrollClass::VirtualTree => "hi-virtual-tree",
            VirtualScrollClass::NodeDisabled => "hi-tree-node-disabled",
            VirtualScrollClass::Viewport => "hi-virtual-tree-viewport",
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
            TreeNodeClass::TreeNode => "hi-tree-node",
            TreeNodeClass::TreeNodeSelected => "hi-tree-node-selected",
            TreeNodeClass::TreeNodeDisabled => "hi-tree-node-disabled",
            TreeNodeClass::TreeNodeParent => "hi-tree-node-parent",
            TreeNodeClass::NodeContent => "hi-tree-node-content",
            TreeNodeClass::NodeIcon => "hi-tree-node-icon",
            TreeNodeClass::NodeArrow => "hi-tree-node-arrow",
            TreeNodeClass::NodeArrowPlaceholder => "hi-tree-node-arrow-placeholder",
            TreeNodeClass::NodeArrowExpanded => "hi-tree-node-arrow-expanded",
            TreeNodeClass::NodeDisabled => "hi-tree-node-disabled",
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
            CollapseClass::CollapseContent => "hi-collapse-content",
            CollapseClass::Expanded => "hi-collapse-expanded",
            CollapseClass::Collapsed => "hi-collapse-collapsed",
            CollapseClass::TreeNodeChildren => "hi-tree-node-children",
            CollapseClass::TreeExpanded => "hi-tree-expanded",
            CollapseClass::TreeCollapsed => "hi-tree-collapsed",
            CollapseClass::Collapse => "hi-collapse",
            CollapseClass::Header => "hi-collapse-header",
            CollapseClass::Arrow => "hi-collapse-arrow",
            CollapseClass::HeaderContent => "hi-collapse-header-content",
            CollapseClass::Inner => "hi-collapse-inner",
        }
    }
}
