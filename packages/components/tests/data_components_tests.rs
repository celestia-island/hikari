#[cfg(test)]
mod tests {
    use hikari_components::data::{
        CellProps, ColumnAlign, ColumnDef, DragDropTreeProps, DragTreeNodeData, FilterOption,
        FilterProps, PaginationProps, RowSelectionProps, SelectionProps, SelectionType, SortConfig,
        SortDirection, SortProps, TableProps, TableSize, TreeNodeArrowProps, TreeNodeContentProps,
        TreeNodeData, TreeNodeLabelProps, TreeNodeProps, TreeProps, VirtualTreeNodeData,
        VirtualTreeProps,
    };

    #[test]
    fn test_table_renders() {
        let props = TableProps::default();
        assert!(props.data.is_empty());
        assert!(props.columns.is_empty());
        assert!(!props.bordered);
        assert!(!props.striped);
        assert!(!props.hoverable);
        assert_eq!(props.size, TableSize::Medium);
        assert_eq!(props.empty_text, "No data available");
    }

    #[test]
    fn test_table_with_data_renders() {
        let data = vec![
            vec!["John".to_string(), "25".to_string()],
            vec!["Jane".to_string(), "30".to_string()],
        ];
        let columns = vec![ColumnDef::new("name", "Name"), ColumnDef::new("age", "Age")];
        let props = TableProps {
            data,
            columns,
            bordered: true,
            striped: true,
            size: TableSize::Small,
            ..Default::default()
        };
        assert_eq!(props.data.len(), 2);
        assert_eq!(props.columns.len(), 2);
        assert!(props.bordered);
        assert!(props.striped);
        assert_eq!(props.size, TableSize::Small);
    }

    #[test]
    fn test_table_size_variants() {
        let sm = TableProps {
            size: TableSize::Small,
            ..Default::default()
        };
        let md = TableProps {
            size: TableSize::Medium,
            ..Default::default()
        };
        let lg = TableProps {
            size: TableSize::Large,
            ..Default::default()
        };
        assert_eq!(sm.size, TableSize::Small);
        assert_eq!(md.size, TableSize::Medium);
        assert_eq!(lg.size, TableSize::Large);
    }

    #[test]
    fn test_table_with_custom_class() {
        let props = TableProps {
            class: "custom-table".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-table");
    }

    #[test]
    fn test_table_empty_text() {
        let props = TableProps {
            empty_text: "No results found".to_string(),
            ..Default::default()
        };
        assert_eq!(props.empty_text, "No results found");
    }

    #[test]
    fn test_tree_renders() {
        let props = TreeProps::default();
        assert!(props.data.is_empty());
        assert!(props.default_expanded_keys.is_empty());
        assert!(props.default_selected_keys.is_empty());
        assert!(!props.checkable);
        assert!(!props.show_line);
    }

    #[test]
    fn test_tree_with_data_renders() {
        let data = vec![
            TreeNodeData {
                key: "1".to_string(),
                label: "Node 1".to_string(),
                children: None,
                disabled: false,
            },
            TreeNodeData {
                key: "2".to_string(),
                label: "Node 2".to_string(),
                children: Some(vec![TreeNodeData {
                    key: "2-1".to_string(),
                    label: "Child 1".to_string(),
                    children: None,
                    disabled: true,
                }]),
                disabled: false,
            },
        ];
        let props = TreeProps {
            data,
            default_expanded_keys: vec!["2".to_string()],
            default_selected_keys: vec!["1".to_string()],
            checkable: true,
            show_line: true,
            class: "custom-tree".to_string(),
            ..Default::default()
        };
        assert_eq!(props.data.len(), 2);
        assert!(props.checkable);
        assert!(props.show_line);
        assert_eq!(props.default_expanded_keys.len(), 1);
    }

    #[test]
    fn test_tree_checkable() {
        let props = TreeProps {
            checkable: true,
            ..Default::default()
        };
        assert!(props.checkable);
    }

    #[test]
    fn test_tree_show_line() {
        let props = TreeProps {
            show_line: true,
            ..Default::default()
        };
        assert!(props.show_line);
    }

    #[test]
    fn test_tree_with_custom_class() {
        let props = TreeProps {
            class: "custom-tree".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-tree");
    }

    #[test]
    fn test_pagination_renders() {
        let props = PaginationProps::default();
        assert_eq!(props.current, 1);
        assert_eq!(props.total, 0);
        assert_eq!(props.page_size, 10);
        assert!(!props.show_size_changer);
        assert!(!props.show_total);
    }

    #[test]
    fn test_pagination_with_values_renders() {
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
        assert!(props.show_size_changer);
        assert!(props.show_total);
        assert_eq!(props.page_size_options.len(), 4);
    }

    #[test]
    fn test_pagination_with_total() {
        let props = PaginationProps {
            total: 500,
            ..Default::default()
        };
        assert_eq!(props.total, 500);
    }

    #[test]
    fn test_pagination_show_size_changer() {
        let props = PaginationProps {
            show_size_changer: true,
            total: 100,
            ..Default::default()
        };
        assert!(props.show_size_changer);
    }

    #[test]
    fn test_pagination_show_total() {
        let props = PaginationProps {
            show_total: true,
            total: 100,
            ..Default::default()
        };
        assert!(props.show_total);
    }

    #[test]
    fn test_selection_renders() {
        let props = SelectionProps::default();
        assert!(props.row_keys.is_empty());
        assert_eq!(props.selection_type, SelectionType::Checkbox);
        assert!(!props.fixed_column);
        assert!(props.available_keys.is_empty());
    }

    #[test]
    fn test_selection_radio_renders() {
        let props = SelectionProps {
            selection_type: SelectionType::Radio,
            available_keys: vec!["a".to_string(), "b".to_string(), "c".to_string()],
            row_keys: vec!["a".to_string()],
            fixed_column: true,
            ..Default::default()
        };
        assert_eq!(props.selection_type, SelectionType::Radio);
        assert_eq!(props.available_keys.len(), 3);
        assert!(props.fixed_column);
    }

    #[test]
    fn test_sort_renders() {
        let props = SortProps::default();
        assert!(props.column.is_empty());
        assert_eq!(props.direction, SortDirection::None);
        assert!(props.columns.is_empty());
    }

    #[test]
    fn test_sort_with_columns_renders() {
        let columns = vec![
            ColumnDef::new("name", "Name").sortable(true),
            ColumnDef::new("age", "Age").sortable(true),
            ColumnDef::new("email", "Email"),
        ];
        let props = SortProps {
            columns,
            column: "name".to_string(),
            direction: SortDirection::Ascending,
            ..Default::default()
        };
        assert_eq!(props.columns.len(), 3);
        assert_eq!(props.column, "name");
        assert_eq!(props.direction, SortDirection::Ascending);
    }

    #[test]
    fn test_sort_direction_toggle() {
        assert_eq!(SortDirection::None.toggle(), SortDirection::Ascending);
        assert_eq!(SortDirection::Ascending.toggle(), SortDirection::Descending);
        assert_eq!(SortDirection::Descending.toggle(), SortDirection::None);
    }

    #[test]
    fn test_sort_config() {
        let config = SortConfig::new("name", SortDirection::Ascending);
        assert_eq!(config.column, "name");
        assert_eq!(config.direction, SortDirection::Ascending);
    }

    #[test]
    fn test_sort_direction_icon() {
        assert_eq!(SortDirection::None.icon(), "⇅");
        assert_eq!(SortDirection::Ascending.icon(), "↑");
        assert_eq!(SortDirection::Descending.icon(), "↓");
    }

    #[test]
    fn test_filter_renders() {
        let props = FilterProps::default();
        assert!(props.column.is_empty());
        assert!(props.filters.is_empty());
        assert!(props.selected_values.is_empty());
    }

    #[test]
    fn test_filter_with_options_renders() {
        let filters = vec![
            FilterOption::new("Active", "active"),
            FilterOption::new("Inactive", "inactive"),
            FilterOption::new("Pending", "pending"),
        ];
        let props = FilterProps {
            column: "Status".to_string(),
            filters,
            selected_values: vec!["active".to_string()],
            class: "custom-filter".to_string(),
            ..Default::default()
        };
        assert_eq!(props.column, "Status");
        assert_eq!(props.filters.len(), 3);
        assert_eq!(props.selected_values.len(), 1);
    }

    #[test]
    fn test_filter_option_new() {
        let opt = FilterOption::new("Label", "value");
        assert_eq!(opt.label, "Label");
        assert_eq!(opt.value, "value");
    }

    #[test]
    fn test_virtual_scroll_renders() {
        let props = VirtualTreeProps::default();
        assert!(props.data.is_empty());
        assert_eq!(props.height, "400px");
        assert_eq!(props.item_height, 32);
        assert_eq!(props.overscan, 5);
    }

    #[test]
    fn test_virtual_scroll_with_data_renders() {
        let data = vec![
            VirtualTreeNodeData {
                id: "1".to_string(),
                title: "Item 1".to_string(),
                children: vec![VirtualTreeNodeData {
                    id: "1-1".to_string(),
                    title: "Child 1".to_string(),
                    children: vec![],
                    disabled: false,
                }],
                disabled: false,
            },
            VirtualTreeNodeData {
                id: "2".to_string(),
                title: "Item 2".to_string(),
                children: vec![],
                disabled: true,
            },
        ];
        let props = VirtualTreeProps {
            data,
            height: "600px".to_string(),
            item_height: 48,
            overscan: 10,
            class: "custom-virtual".to_string(),
            ..Default::default()
        };
        assert_eq!(props.data.len(), 2);
        assert_eq!(props.height, "600px");
        assert_eq!(props.item_height, 48);
        assert_eq!(props.overscan, 10);
    }

    #[test]
    fn test_cell_renders() {
        let props = CellProps::default();
        assert_eq!(props.value, String::new());
        assert_eq!(props.row_index, 0);
        assert_eq!(props.col_index, 0);
        assert!(props.class.is_empty());
        assert!(props.render.is_none());
        assert!(!props.editable);
    }

    #[test]
    fn test_cell_with_value_renders() {
        let props = CellProps {
            value: "test value".to_string(),
            column: ColumnDef::new("col1", "Column 1"),
            row_index: 5,
            col_index: 3,
            editable: true,
            class: "custom-cell".to_string(),
            ..Default::default()
        };
        assert_eq!(props.value, "test value");
        assert_eq!(props.row_index, 5);
        assert_eq!(props.col_index, 3);
        assert!(props.editable);
    }

    #[test]
    fn test_column_renders() {
        let col = ColumnDef::new("name", "Name");
        assert_eq!(col.column_key, "name");
        assert_eq!(col.title, "Name");
        assert!(!col.fixed);
        assert!(!col.sortable);
        assert!(!col.filterable);
        assert!(!col.resizable);
        assert!(!col.has_width_constraints());
    }

    #[test]
    fn test_column_builder_renders() {
        let col = ColumnDef::new("email", "Email")
            .width("200px")
            .min_width("100px")
            .max_width("300px")
            .align(ColumnAlign::Center)
            .fixed(true)
            .sortable(true)
            .filterable(true)
            .resizable(true)
            .class("email-col");
        assert_eq!(col.column_key, "email");
        assert_eq!(col.width, Some("200px".to_string()));
        assert_eq!(col.align, ColumnAlign::Center);
        assert!(col.fixed);
        assert!(col.sortable);
        assert!(col.has_width_constraints());
    }

    #[test]
    fn test_column_align_variants() {
        let left = ColumnDef::new("a", "A").align(ColumnAlign::Left);
        let center = ColumnDef::new("b", "B").align(ColumnAlign::Center);
        let right = ColumnDef::new("c", "C").align(ColumnAlign::Right);
        assert_eq!(left.align, ColumnAlign::Left);
        assert_eq!(center.align, ColumnAlign::Center);
        assert_eq!(right.align, ColumnAlign::Right);
    }

    #[test]
    fn test_column_default() {
        let col = ColumnDef::default();
        assert!(col.column_key.is_empty());
        assert!(col.title.is_empty());
        assert!(col.width.is_none());
    }

    #[test]
    fn test_node_renders() {
        let props = TreeNodeProps::default();
        assert!(props.node_key.is_empty());
        assert!(props.label.is_empty());
        assert!(!props.expanded);
        assert!(!props.selected);
        assert_eq!(props.level, 0);
        assert!(!props.disabled);
    }

    #[test]
    fn test_node_with_data_renders() {
        let children = vec![
            TreeNodeData {
                key: "c1".to_string(),
                label: "Child 1".to_string(),
                children: None,
                disabled: false,
            },
            TreeNodeData {
                key: "c2".to_string(),
                label: "Child 2".to_string(),
                children: None,
                disabled: true,
            },
        ];
        let props = TreeNodeProps {
            node_key: "parent".to_string(),
            label: "Parent Node".to_string(),
            node_children: Some(children),
            expanded: true,
            selected: true,
            level: 1,
            class: "parent-node".to_string(),
            ..Default::default()
        };
        assert_eq!(props.node_key, "parent");
        assert_eq!(props.label, "Parent Node");
        assert!(props.expanded);
        assert!(props.selected);
        assert_eq!(props.level, 1);
    }

    #[test]
    fn test_tree_node_arrow_renders() {
        let props = TreeNodeArrowProps::default();
        assert!(!props.expanded);
        assert!(!props.disabled);
        assert!(props.class.is_empty());
    }

    #[test]
    fn test_tree_node_arrow_expanded_renders() {
        let props = TreeNodeArrowProps {
            expanded: true,
            disabled: false,
            ..Default::default()
        };
        assert!(props.expanded);
    }

    #[test]
    fn test_tree_node_arrow_disabled_renders() {
        let props = TreeNodeArrowProps {
            expanded: false,
            disabled: true,
            ..Default::default()
        };
        assert!(props.disabled);
    }

    #[test]
    fn test_tree_node_content_renders() {
        let props = TreeNodeContentProps::default();
        assert_eq!(props.level, 0);
        assert!(!props.disabled);
        assert!(props.class.is_empty());
    }

    #[test]
    fn test_tree_node_content_with_level_renders() {
        let props = TreeNodeContentProps {
            level: 3,
            disabled: true,
            class: "deep-content".to_string(),
            ..Default::default()
        };
        assert_eq!(props.level, 3);
        assert!(props.disabled);
        assert_eq!(props.class, "deep-content");
    }

    #[test]
    fn test_tree_node_label_renders() {
        let props = TreeNodeLabelProps::default();
        assert!(props.label.is_empty());
        assert!(props.icon.is_none());
        assert!(props.class.is_empty());
    }

    #[test]
    fn test_tree_node_label_with_class_renders() {
        let props = TreeNodeLabelProps {
            label: "Important".to_string(),
            class: "label-icon".to_string(),
            ..Default::default()
        };
        assert_eq!(props.label, "Important");
        assert_eq!(props.class, "label-icon");
    }

    #[test]
    fn test_row_selection_renders() {
        let props = RowSelectionProps {
            row_key: "row1".to_string(),
            ..Default::default()
        };
        assert_eq!(props.row_key, "row1");
        assert!(props.selected_keys.is_empty());
        assert_eq!(props.selection_type, SelectionType::Checkbox);
    }

    #[test]
    fn test_row_selection_selected_renders() {
        let props = RowSelectionProps {
            row_key: "row2".to_string(),
            selected_keys: vec!["row1".to_string(), "row2".to_string()],
            selection_type: SelectionType::Checkbox,
            class: "selected-row".to_string(),
            ..Default::default()
        };
        assert_eq!(props.row_key, "row2");
        assert_eq!(props.selected_keys.len(), 2);
    }

    #[test]
    fn test_drag_renders() {
        let props = DragDropTreeProps::default();
        assert!(props.data.is_empty());
        assert!(props.draggable);
        assert!(props.drop_allowed);
    }

    #[test]
    fn test_drag_with_data_renders() {
        let data = vec![
            DragTreeNodeData {
                item_key: "node1".to_string(),
                title: "Node 1".to_string(),
                node_children: vec![DragTreeNodeData {
                    item_key: "node1-1".to_string(),
                    title: "Child 1".to_string(),
                    node_children: vec![],
                    disabled: false,
                }],
                disabled: false,
            },
            DragTreeNodeData {
                item_key: "node2".to_string(),
                title: "Node 2".to_string(),
                node_children: vec![],
                disabled: true,
            },
        ];
        let props = DragDropTreeProps {
            data,
            draggable: false,
            drop_allowed: false,
            class: "drag-tree".to_string(),
            ..Default::default()
        };
        assert_eq!(props.data.len(), 2);
        assert!(!props.draggable);
        assert!(!props.drop_allowed);
    }

    #[test]
    fn test_drag_drop_position_variants() {
        use hikari_components::data::{DropPosition, DropTarget};
        let before = DropTarget {
            target_key: "a".to_string(),
            position: DropPosition::Before,
        };
        let after = DropTarget {
            target_key: "b".to_string(),
            position: DropPosition::After,
        };
        let inside = DropTarget {
            target_key: "c".to_string(),
            position: DropPosition::Inside,
        };
        assert_eq!(before.position, DropPosition::Before);
        assert_eq!(after.position, DropPosition::After);
        assert_eq!(inside.position, DropPosition::Inside);
    }
}
