# Tree Component Demo

Comprehensive tree component demonstration with large datasets, virtual scrolling, drag-and-drop, and custom rendering.

## Features

This demo showcases:

- **Basic Tree**: Simple hierarchical data display
- **Large Tree**: 1,000+ node tree for performance testing
- **Virtual Scroll**: Optimized rendering for large datasets
- **Drag & Drop**: Visual demonstration of tree node reordering
- **Custom Render**: Custom icons, badges, and styling

## Running the Demo

```bash
# From the project root
cargo run --bin tree-demo
```

Or from this directory:

```bash
cargo run
```

## Tree Features

### Basic Tree

- Hierarchical data structure
- Expandable and collapsible nodes
- Visual connecting lines
- Keyboard navigation
- Selected state tracking
- Disabled nodes support

### Large Tree (1,000+ nodes)

- Performance test dataset
- Efficient rendering
- Smooth expand/collapse
- Memory-optimized structure
- Ideal for file systems, org charts, etc.

### Virtual Scrolling

- Constant memory usage
- Smooth scrolling performance
- Only renders visible nodes
- 50 categories × 20 items demo
- Best for 1000+ node trees

### Drag & Drop

- Drag nodes within same parent
- Drag nodes between parents
- Visual feedback during drag
- Drop zone highlighting
- Kanban-style task board demo

### Custom Rendering

- Custom icons for node types
- Badges with counts/metadata
- Disabled state styling
- Custom colors and themes
- Action buttons on hover
- Context menu support

## Usage Example

```rust
use hikari_components::{Tree, TreeNodeData};

let tree_data = vec![
    TreeNodeData {
        key: "1".to_string(),
        label: "Project Root".to_string(),
        disabled: false,
        children: Some(vec![
            TreeNodeData {
                key: "1-1".to_string(),
                label: "src".to_string(),
                disabled: false,
                children: Some(vec![
                    TreeNodeData {
                        key: "1-1-1".to_string(),
                        label: "main.rs".to_string(),
                        disabled: false,
                        children: None,
                    },
                ]),
            },
        ]),
    },
];

rsx! {
    Tree {
        data: tree_data,
        default_expanded_keys: vec!["1".to_string()],
        show_line: true,
    }
}
```

## Performance Considerations

### Small Trees (< 100 nodes)

- Use standard tree rendering
- All nodes loaded at once
- Fast expand/collapse

### Medium Trees (100-1,000 nodes)

- Consider virtual scrolling
- Lazy load children
- Good performance with proper optimization

### Large Trees (1,000+ nodes)

- Always use virtual scrolling
- Implement lazy loading
- Consider pagination for children
- Monitor memory usage

## Common Use Cases

- **File Explorer**: Display directory structures
- **Organization Charts**: Company hierarchies
- **Category Navigation**: E-commerce categories
- **Task Trees**: Project management
- **Settings Menus**: Configuration hierarchies
