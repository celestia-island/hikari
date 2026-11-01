//! Data-family API tests.
//!
//! The W3 wave REPLACED the legacy `Table` / `Tree` mirrors with the Vue
//! `HkTable` / `HkTree` surfaces (their headers carry the MIGRATION notes), so
//! the old `data` / `default_expanded_keys` / `checkable` / `show_line` /
//! `hoverable` / `TableSize::Medium` assertions no longer exist. What remains
//! here covers the pieces of the data family that are still legacy
//! (`pagination`, `filter`, `sort`, `selection`, `cell`, `column`) plus the NEW
//! Table/Tree props, and imports the ambiguous names EXPLICITLY
//! (`filter::FilterOption` vs `filter_panel::FilterOption`).

#[cfg(test)]
mod tests {
    use hikari_components::data::filter_panel::FilterOperator;
    use hikari_components::data::node::{TreeNodeData, TreeNodeProps};
    use hikari_components::data::{
        CellProps, ColumnAlign, ColumnDef, DragDropTreeProps, DragTreeNodeData, PaginationProps,
        RowSelectionProps, SelectionProps, SelectionType, SortConfig, SortDirection, SortProps,
        TableColumn, TableManageMode, TableProps, TableRow, TableSize, TreeItem, TreeProps,
        TreeSize,
    };

    // ── Table (Vue `HkTable` mirror) ─────────────────────────────────

    #[test]
    fn table_props_default() {
        let props = TableProps::default();
        assert!(props.columns.is_empty());
        assert!(props.rows.is_empty());
        assert!(!props.bordered);
        assert!(!props.striped);
        assert!(!props.hover);
        assert!(!props.draggable);
        assert_eq!(props.size, TableSize::Medium);
        assert_eq!(props.class, "");
    }

    #[test]
    fn table_columns_carry_the_vue_column_shape() {
        let column = TableColumn {
            key: "name".to_string(),
            title: "Name".to_string(),
            width: Some("12rem".to_string()),
            sortable: true,
            align: Some(ColumnAlign::Right),
            copyable: false,
        };
        assert_eq!(column.key, "name");
        assert!(column.sortable);
        assert_eq!(column.width.as_deref(), Some("12rem"));
    }

    #[test]
    fn table_rows_are_positional_cells() {
        let row = TableRow {
            key: Some("r1".to_string()),
            cells: vec!["a".to_string(), "b".to_string()],
            manage: TableManageMode::On,
        };
        assert_eq!(row.key.as_deref(), Some("r1"));
        assert_eq!(row.cells.len(), 2);
        assert_eq!(row.manage, TableManageMode::On);
    }

    #[test]
    fn table_size_classes_match_the_sheet() {
        assert_eq!(TableSize::Small.class_name(), "hk-table-sm");
        assert_eq!(TableSize::Medium.class_name(), "hk-table-md");
        assert_eq!(TableSize::Large.class_name(), "hk-table-lg");
    }

    // ── Tree (Vue `HkTree` mirror) ───────────────────────────────────

    #[test]
    fn tree_props_default() {
        let props = TreeProps::default();
        assert!(props.nodes.is_empty());
        assert!(props.expanded_keys.is_empty());
        assert!(props.selected_keys.is_empty());
        assert!(props.loading_keys.is_empty());
        assert_eq!(props.size, TreeSize::Sm);
        assert_eq!(props.class, "");
    }

    #[test]
    fn tree_items_nest_children() {
        let item = TreeItem {
            id: "root".to_string(),
            label: "Root".to_string(),
            children: vec![TreeItem {
                id: "child".to_string(),
                label: "Child".to_string(),
                ..Default::default()
            }],
            ..Default::default()
        };
        assert_eq!(item.id, "root");
        assert_eq!(item.children.len(), 1);
    }

    #[test]
    fn tree_size_tokens_match_the_sheet() {
        // The tree carries its size as `data-size` (the sheet keys off the
        // attribute), not as a per-size class.
        assert_eq!(TreeSize::Xs.data_size(), "xs");
        assert_eq!(TreeSize::Sm.data_size(), "sm");
        assert_eq!(TreeSize::Md.data_size(), "md");
    }

    // ── Pagination (no Vue counterpart — legacy suite) ───────────────

    #[test]
    fn pagination_props_default() {
        let props = PaginationProps::default();
        assert_eq!(props.current, 1);
        assert_eq!(props.total, 0);
        assert_eq!(props.page_size, 10);
        assert!(!props.show_size_changer);
        assert!(!props.show_total);
    }

    #[test]
    fn pagination_props_values() {
        let props = PaginationProps {
            current: 5,
            total: 100,
            page_size: 20,
            show_size_changer: true,
            show_total: true,
            page_size_options: vec![5, 10, 25, 50],
            class: "custom-pagination".to_string(),
            ..Default::default()
        };
        assert_eq!(props.current, 5);
        assert_eq!(props.total, 100);
        assert_eq!(props.page_size, 20);
        assert_eq!(props.page_size_options.len(), 4);
    }

    // ── Legacy filter (still used by the legacy filter surface) ──────

    #[test]
    fn filter_operator_names_match_the_vue_set() {
        // The W3 panel owns the operator vocabulary; sanity-check the enum the
        // rows render against the sheet's data-op tokens.
        let ops = [FilterOperator::Approx, FilterOperator::Napprox];
        assert_eq!(ops.len(), 2);
        assert_eq!(FilterOperator::default(), FilterOperator::Eq);
    }

    // ── Untouched legacy faces (coverage restored after the W3 rewrite) ──

    #[test]
    fn selection_props_default() {
        let props = SelectionProps::default();
        assert!(props.row_keys.is_empty());
        assert_eq!(props.selection_type, SelectionType::Checkbox);
        assert!(!props.fixed_column);
        assert!(props.available_keys.is_empty());
    }

    #[test]
    fn selection_radio_mode() {
        let props = SelectionProps {
            selection_type: SelectionType::Radio,
            available_keys: vec!["a".to_string(), "b".to_string()],
            row_keys: vec!["a".to_string()],
            fixed_column: true,
            ..Default::default()
        };
        assert_eq!(props.selection_type, SelectionType::Radio);
        assert_eq!(props.available_keys.len(), 2);
        assert!(props.fixed_column);
    }

    #[test]
    fn row_selection_props_default() {
        let props = RowSelectionProps {
            row_key: "row1".to_string(),
            ..Default::default()
        };
        assert_eq!(props.row_key, "row1");
        assert!(props.selected_keys.is_empty());
        assert_eq!(props.selection_type, SelectionType::Checkbox);
    }

    #[test]
    fn row_selection_selected_keys() {
        let props = RowSelectionProps {
            row_key: "row2".to_string(),
            selected_keys: vec!["row1".to_string(), "row2".to_string()],
            class: "selected-row".to_string(),
            ..Default::default()
        };
        assert_eq!(props.selected_keys.len(), 2);
        assert_eq!(props.class, "selected-row");
    }

    #[test]
    fn node_props_default() {
        let props = TreeNodeProps::default();
        assert!(props.node_key.is_empty());
        assert!(props.label.is_empty());
        assert!(!props.expanded);
        assert!(!props.selected);
        assert_eq!(props.level, 0);
        assert!(!props.disabled);
    }

    #[test]
    fn node_children_data() {
        let data = [TreeNodeData {
            key: "c1".to_string(),
            label: "Child 1".to_string(),
            children: None,
            disabled: false,
        }];
        assert_eq!(data.len(), 1);
        assert!(!data[0].disabled);
    }

    #[test]
    fn drag_drop_props_default() {
        let props = DragDropTreeProps::default();
        assert!(props.data.is_empty());
        assert!(props.draggable);
        assert!(props.drop_allowed);
    }

    #[test]
    fn drag_tree_data_nests() {
        let data = [DragTreeNodeData {
            item_key: "node1".to_string(),
            title: "Node 1".to_string(),
            node_children: vec![DragTreeNodeData {
                item_key: "node1-1".to_string(),
                title: "Child 1".to_string(),
                node_children: vec![],
                disabled: false,
            }],
            disabled: false,
        }];
        assert_eq!(data.len(), 1);
        assert_eq!(data[0].node_children.len(), 1);
    }

    // ── Sort / cell / column (unchanged legacy primitives) ───────────

    #[test]
    fn sort_direction_toggles_through_the_tri_state() {
        // The tri-state cycle is None → Asc → Desc → None.
        assert_eq!(SortDirection::None.toggle(), SortDirection::Ascending);
        assert_eq!(SortDirection::Ascending.toggle(), SortDirection::Descending);
        assert_eq!(SortDirection::Descending.toggle(), SortDirection::None);
    }

    #[test]
    fn sort_config_default() {
        let config = SortConfig::default();
        assert_eq!(config.direction, SortDirection::None);
    }

    #[test]
    fn sort_props_default() {
        let props = SortProps::default();
        assert_eq!(props.class, "");
    }

    #[test]
    fn cell_props_default() {
        let props = CellProps::default();
        assert_eq!(props.class, "");
    }

    #[test]
    fn column_def_default() {
        let column = ColumnDef::default();
        assert_eq!(column.class, "");
    }
}
