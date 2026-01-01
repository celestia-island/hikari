# Table Component Demo

Advanced table component demonstration with sorting, filtering, pagination, selection, and editing capabilities.

## Features

This demo showcases:

- **Basic Table**: Simple table with bordered, striped, and hoverable styles
- **Sortable Table**: Click column headers to sort data
- **Filterable Table**: Real-time search across all columns
- **Pagination**: Navigate through large datasets efficiently
- **Selection**: Select single or multiple rows
- **Editable**: Double-click cells to edit content

## Running the Demo

```bash
# From the project root
cargo run --bin table-demo
```

Or from this directory:

```bash
cargo run
```

## Table Features

### Basic Table

- Bordered cells for clarity
- Striped rows for better readability
- Hover effect on rows
- Column alignment (left, center, right)
- Custom column widths

### Sortable Table

- Click any column header to sort
- Click again to reverse the sort order
- Visual indicator showing sorted column
- Works with text, numbers, and dates

### Filterable Table

- Real-time search across all columns
- Case-insensitive matching
- Shows matching row count
- Clear filter button

### Paginated Table

- Configurable page size
- Page number navigation
- Previous/Next buttons
- Total row counter
- Ideal for 100+ row datasets

### Selectable Table

- Click rows to select
- Multi-selection support
- Clear selection button
- Selection count display

### Editable Table

- Double-click cells to edit
- Inline input for editing
- Save on blur
- Live data state preview

## Usage Example

```rust
use hikari_components::{Table, ColumnDef, Align};

let columns = vec![
    ColumnDef::new("name", "Name")
        .sortable(true)
        .width("200px"),
    ColumnDef::new("age", "Age")
        .align(Align::Center)
        .width("100px"),
];

let data = vec![
    vec!["Alice".to_string(), "30".to_string()],
    vec!["Bob".to_string(), "25".to_string()],
];

rsx! {
    Table {
        columns: columns,
        data: data,
        bordered: true,
        striped: true,
        hoverable: true,
    }
}
```

## Performance

The table component efficiently handles:

- Up to 1,000 rows without pagination
- 10,000+ rows with pagination
- Real-time filtering and sorting
- Smooth animations and transitions
