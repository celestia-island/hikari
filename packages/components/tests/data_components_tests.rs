// Unit tests for Layer 2 data components (Tree, Table, Pagination)

use hikari_components::data::{
    PaginationProps, TreeProps, {TableProps, TableSize},
};

// ==================== Tree Tests ====================

#[test]
fn test_tree_props_default() {
    let props = TreeProps::default();

    assert!(props.data.is_empty());
    assert!(props.default_expanded_keys.is_empty());
    assert!(props.default_selected_keys.is_empty());
    assert!(!props.checkable);
    assert!(!props.show_line);
    assert!(props.on_select.is_none());
    assert!(props.on_expand.is_none());
}

#[test]
fn test_tree_with_data() {
    use hikari_components::data::TreeNodeData;

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
            children: None,
            disabled: false,
        },
    ];

    let props = TreeProps {
        data,
        ..Default::default()
    };

    assert_eq!(props.data.len(), 2);
}

#[test]
fn test_tree_with_expanded_keys() {
    let props = TreeProps {
        default_expanded_keys: vec!["1".to_string(), "2".to_string()],
        ..Default::default()
    };

    assert_eq!(props.default_expanded_keys.len(), 2);
}

#[test]
fn test_tree_with_selected_keys() {
    let props = TreeProps {
        default_selected_keys: vec!["3".to_string()],
        ..Default::default()
    };

    assert_eq!(props.default_selected_keys.len(), 1);
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

// ==================== Table Tests ====================

#[test]
fn test_table_props_default() {
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
fn test_table_with_data() {
    let data = vec![
        vec!["John".to_string(), "25".to_string()],
        vec!["Jane".to_string(), "30".to_string()],
    ];

    let props = TableProps {
        data,
        ..Default::default()
    };

    assert_eq!(props.data.len(), 2);
}

#[test]
fn test_table_with_columns() {
    use hikari_components::data::ColumnDef;

    let columns = vec![
        ColumnDef {
            column_key: "name".to_string(),
            title: "Name".to_string(),
            ..Default::default()
        },
        ColumnDef {
            column_key: "age".to_string(),
            title: "Age".to_string(),
            ..Default::default()
        },
    ];

    let props = TableProps {
        columns,
        ..Default::default()
    };

    assert_eq!(props.columns.len(), 2);
}

#[test]
fn test_table_bordered() {
    let props = TableProps {
        bordered: true,
        ..Default::default()
    };

    assert!(props.bordered);
}

#[test]
fn test_table_striped() {
    let props = TableProps {
        striped: true,
        ..Default::default()
    };

    assert!(props.striped);
}

#[test]
fn test_table_hoverable() {
    let props = TableProps {
        hoverable: true,
        ..Default::default()
    };

    assert!(props.hoverable);
}

#[test]
fn test_table_size_small() {
    let props = TableProps {
        size: TableSize::Small,
        ..Default::default()
    };

    assert_eq!(props.size, TableSize::Small);
}

#[test]
fn test_table_size_medium() {
    let props = TableProps {
        size: TableSize::Medium,
        ..Default::default()
    };

    assert_eq!(props.size, TableSize::Medium);
}

#[test]
fn test_table_size_large() {
    let props = TableProps {
        size: TableSize::Large,
        ..Default::default()
    };

    assert_eq!(props.size, TableSize::Large);
}

#[test]
fn test_table_with_custom_empty_text() {
    let props = TableProps {
        empty_text: "No results found".to_string(),
        ..Default::default()
    };

    assert_eq!(props.empty_text, "No results found");
}

#[test]
fn test_table_with_custom_class() {
    let props = TableProps {
        class: "custom-table".to_string(),
        ..Default::default()
    };

    assert_eq!(props.class, "custom-table");
}

// ==================== Pagination Tests ====================

#[test]
fn test_pagination_props_default() {
    let props = PaginationProps::default();

    assert_eq!(props.current, 1);
    assert_eq!(props.total, 0);
    assert_eq!(props.page_size, 10);
    assert!(!props.show_size_changer);
    assert!(!props.show_total);
    assert!(props.on_change.is_none());
    assert!(props.on_size_change.is_none());
}

#[test]
fn test_pagination_with_current() {
    let props = PaginationProps {
        current: 5,
        total: 100,
        ..Default::default()
    };

    assert_eq!(props.current, 5);
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
fn test_pagination_with_page_size() {
    let props = PaginationProps {
        page_size: 20,
        total: 100,
        ..Default::default()
    };

    assert_eq!(props.page_size, 20);
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
fn test_pagination_with_custom_page_size_options() {
    let props = PaginationProps {
        page_size_options: vec![5, 10, 25, 50],
        total: 100,
        ..Default::default()
    };

    assert_eq!(props.page_size_options.len(), 4);
    assert_eq!(props.page_size_options[0], 5);
}

#[test]
fn test_pagination_with_custom_class() {
    let props = PaginationProps {
        class: "custom-pagination".to_string(),
        total: 100,
        ..Default::default()
    };

    assert_eq!(props.class, "custom-pagination");
}
